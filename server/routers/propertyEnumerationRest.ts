import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { authenticateJWT } from '../middleware/jwtAuth';
import { Customer } from '../models/Customer';
import { Session } from '../models/Session';
import { getMongoDb } from '../mongodb';
import { validateLotAccess } from '../lotValidation';
import { getUserById } from '../db';
import { Company } from '../models/Company';

const router = express.Router();

// In-memory multer storage for CSV uploads (no disk writes)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// CORS middleware for mobile app
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

/**
 * Helper: resolve the ownerCompanyId string for the authenticated user.
 *
 * The User model stores `companyId` as the MongoDB _id of the Company document
 * (not the Company's own `companyId` string field like "ADESKUNLAR").
 * We must look up the Company by its _id and return the `companyId` string
 * that is used on Customer records (ownerCompanyId / servingCompanyId).
 *
 * - admin / cherry_picker / superadmin: no company restriction (returns null)
 * - regular user: returns the Company's `companyId` string
 */
async function resolveUserCompanyId(userId: string, role: string): Promise<string | null> {
  if (!userId || role === 'admin' || role === 'cherry_picker' || role === 'superadmin') {
    return null; // Admins see all companies
  }
  const user = await getUserById(userId);
  if (!user?.companyId) return null;

  // user.companyId is the MongoDB _id of the Company document
  // We need the Company's own `companyId` string field
  const company = await Company.findById(user.companyId).lean();
  return (company as any)?.companyId ?? null;
}

/**
 * GET /property-enumeration/customers
 * Search customers by name, phone, or address.
 * Results are scoped to the authenticated user's company (regular users only).
 * Admins/cherry_pickers see all companies.
 *
 * Query params:
 *   search            - text search across name, phone, address
 *   limit             - max results (default 50)
 *   digitalizationStatus - "digitalized" | "not-digitalized"
 *   propertyType      - "residential" | "commercial"
 *   companyId         - optional explicit company filter (admin only)
 */
router.get('/customers', authenticateJWT, async (req: any, res) => {
  try {
    const { search = '', limit = 50, digitalizationStatus, propertyType, companyId: companyIdParam } = req.query;
    const query: any = {};

    // --- Company scoping ---
    const userCompanyId = await resolveUserCompanyId(req.user.userId, req.user.role);
    if (userCompanyId) {
      // Regular user: hard-scope to their company; ignore any companyId query param
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { ownerCompanyId: userCompanyId },
          { servingCompanyId: userCompanyId },
        ],
      });
    } else if (companyIdParam) {
      // Admin explicitly filtering by a company
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { ownerCompanyId: companyIdParam },
          { servingCompanyId: companyIdParam },
        ],
      });
    }

    // --- Text search ---
    if (search) {
      const searchCondition = {
        $or: [
          { customerName: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
        ],
      };
      if (query.$and) {
        query.$and.push(searchCondition);
      } else {
        Object.assign(query, searchCondition);
      }
    }

    // --- Digitalization filter ---
    if (digitalizationStatus === 'digitalized') {
      query.buildingId = { $exists: true, $ne: null };
    } else if (digitalizationStatus === 'not-digitalized') {
      const noLinkCondition = { $or: [{ buildingId: { $exists: false } }, { buildingId: null }] };
      if (query.$and) {
        query.$and.push(noLinkCondition);
      } else {
        Object.assign(query, noLinkCondition);
      }
    }

    // --- Property type filter ---
    if (propertyType) {
      query.customerType = propertyType;
    }

    const customers = await Customer.find(query).limit(parseInt(limit as string, 10)).lean();
    const transformedCustomers = customers.map((customer: any) => ({
      id: customer.customerId || customer._id.toString(),
      customerName: customer.customerName,
      phoneNumber: customer.phone || '',
      address: customer.address || '',
      propertyType: customer.customerType || 'residential',
      digitalizationStatus: customer.buildingId ? 'digitalized' : 'not-digitalized',
      isDigitalized: !!customer.buildingId,
      linkedBuildingAddress: customer.buildingId ? customer.address : undefined,
      companyId: customer.ownerCompanyId || customer.servingCompanyId,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    }));

    console.log(
      `[PropertyEnumerationREST] Customer search: "${search}" ` +
      `(company: ${userCompanyId || companyIdParam || 'all'}) ` +
      `returned ${transformedCustomers.length} results`
    );

    res.json({
      success: true,
      data: { customers: transformedCustomers },
    });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Customer search error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /property-enumeration/customers/bulk
 * Bulk import customers from a JSON array.
 * Requires admin or cherry_picker role.
 *
 * Body (JSON):
 * {
 *   ownerCompanyId: string,          // Required: target company
 *   customers: [
 *     {
 *       customerName: string,         // Required
 *       address:      string,         // Required
 *       lotCode:      string,         // Required (must be a valid Lot_ID)
 *       phone?:       string,
 *       email?:       string,
 *       customerType?: "residential" | "commercial",
 *       customerId?:  string          // External reference ID (optional)
 *     }
 *   ]
 * }
 *
 * Response:
 * { success: true, results: { created, updated, failed, errors[] } }
 *
 * Duplicate logic: match on (customerName + address).
 *   - Existing record → upsert (update phone/email/lotCode/customerType)
 *   - New record      → create
 */
router.post('/customers/bulk', authenticateJWT, async (req: any, res) => {
  try {
    const { role, userId } = req.user;
    if (role !== 'admin' && role !== 'cherry_picker' && role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Admin role required for bulk import' });
    }

    const { ownerCompanyId, customers: customersData } = req.body;

    if (!ownerCompanyId) {
      return res.status(400).json({ success: false, error: 'ownerCompanyId is required' });
    }
    if (!Array.isArray(customersData) || customersData.length === 0) {
      return res.status(400).json({ success: false, error: 'customers array is required and must not be empty' });
    }
    if (customersData.length > 5000) {
      return res.status(400).json({ success: false, error: 'Maximum 5,000 customers per request' });
    }

    // Verify company exists
    const ownerCompany = await Company.findOne({ companyId: ownerCompanyId });
    if (!ownerCompany) {
      return res.status(404).json({ success: false, error: `Company not found: ${ownerCompanyId}` });
    }

    // Load active lots for validation
    const activeLots: any[] = require('../../shared/active_lots.json');

    const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

    for (const row of customersData) {
      const { customerName, address, lotCode, phone, email, customerType, customerId: externalId } = row;

      // Validate required fields
      if (!customerName || !address || !lotCode) {
        results.failed++;
        results.errors.push(`Row missing required fields (customerName, address, lotCode): ${JSON.stringify(row)}`);
        continue;
      }

      // Validate lot code
      const lot = activeLots.find((l: any) => String(l.Lot_ID) === String(lotCode));
      if (!lot) {
        results.failed++;
        results.errors.push(`Invalid lot code "${lotCode}" for customer "${customerName}"`);
        continue;
      }

      try {
        // Duplicate check: match on customerName + address (case-insensitive)
        const existing = await Customer.findOne({
          customerName: { $regex: `^${customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
          address: { $regex: `^${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });

        if (existing) {
          // Upsert: update mutable fields only
          if (phone) existing.phone = phone;
          if (email) existing.email = email;
          existing.lotCode = lotCode;
          existing.lotName = lot.ward_name?.trim() || `Lot ${lotCode}`;
          if (customerType) existing.customerType = customerType;
          await existing.save();
          results.updated++;
        } else {
          // Create new customer
          const newCustomerId = externalId || `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          await Customer.create({
            customerId: newCustomerId,
            customerName,
            address,
            phone: phone || undefined,
            email: email || undefined,
            lotCode,
            lotName: lot.ward_name?.trim() || `Lot ${lotCode}`,
            customerType: customerType || 'residential',
            servingCompanyId: ownerCompanyId,
            servingCompanyName: ownerCompany.companyName,
            ownerCompanyId,
            ownerCompanyName: ownerCompany.companyName,
            pickups: [],
            totalPickups: 0,
            active: true,
            createdBy: userId || 'bulk-import',
          });
          results.created++;
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Error processing "${customerName}": ${err.message}`);
      }
    }

    console.log(
      `[PropertyEnumerationREST] Bulk import for company ${ownerCompanyId}: ` +
      `created=${results.created}, updated=${results.updated}, failed=${results.failed}`
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Bulk import error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /property-enumeration/customers/import
 * Bulk import customers from a CSV file upload.
 * Requires admin or cherry_picker role.
 *
 * Multipart form fields:
 *   file          - CSV file (required)
 *   ownerCompanyId - target company ID (required)
 *
 * CSV headers (first row):
 *   customerName, address, lotCode, phone, email, customerType, customerId
 *   (only customerName, address, lotCode are required)
 *
 * Response: same shape as /customers/bulk
 */
router.post('/customers/import', authenticateJWT, upload.single('file'), async (req: any, res) => {
  try {
    const { role, userId } = req.user;
    if (role !== 'admin' && role !== 'cherry_picker' && role !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Admin role required for CSV import' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'CSV file is required (field name: "file")' });
    }

    const { ownerCompanyId } = req.body;
    if (!ownerCompanyId) {
      return res.status(400).json({ success: false, error: 'ownerCompanyId is required' });
    }

    // Parse CSV
    let rows: any[];
    try {
      rows = parse(req.file.buffer, {
        columns: true,          // Use first row as column names
        skip_empty_lines: true,
        trim: true,
        bom: true,              // Handle BOM from Excel-exported CSVs
      });
    } catch (parseErr: any) {
      return res.status(400).json({ success: false, error: `CSV parse error: ${parseErr.message}` });
    }

    if (rows.length === 0) {
      return res.status(400).json({ success: false, error: 'CSV file contains no data rows' });
    }
    if (rows.length > 5000) {
      return res.status(400).json({ success: false, error: 'Maximum 5,000 rows per CSV upload' });
    }

    // Normalise column names: accept both camelCase and snake_case variants
    const normalise = (row: any) => ({
      customerName: row.customerName || row.customer_name || row.name || '',
      address:      row.address || row.Address || '',
      lotCode:      row.lotCode || row.lot_code || row.Lot_ID || '',
      phone:        row.phone || row.Phone || row.phoneNumber || row.phone_number || '',
      email:        row.email || row.Email || '',
      customerType: row.customerType || row.customer_type || row.type || '',
      customerId:   row.customerId || row.customer_id || row.externalId || row.external_id || '',
    });

    // Delegate to the same logic as /customers/bulk by forwarding to that handler
    req.body = { ownerCompanyId, customers: rows.map(normalise) };

    // Re-use the bulk import handler inline (avoid circular call; duplicate logic is minimal)
    const ownerCompany = await Company.findOne({ companyId: ownerCompanyId });
    if (!ownerCompany) {
      return res.status(404).json({ success: false, error: `Company not found: ${ownerCompanyId}` });
    }

    const activeLots: any[] = require('../../shared/active_lots.json');
    const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

    for (const row of rows.map(normalise)) {
      const { customerName, address, lotCode, phone, email, customerType, customerId: externalId } = row;

      if (!customerName || !address || !lotCode) {
        results.failed++;
        results.errors.push(`Row missing required fields: ${JSON.stringify(row)}`);
        continue;
      }

      const lot = activeLots.find((l: any) => String(l.Lot_ID) === String(lotCode));
      if (!lot) {
        results.failed++;
        results.errors.push(`Invalid lot code "${lotCode}" for customer "${customerName}"`);
        continue;
      }

      try {
        const existing = await Customer.findOne({
          customerName: { $regex: `^${customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
          address: { $regex: `^${address.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
        });

        if (existing) {
          if (phone) existing.phone = phone;
          if (email) existing.email = email;
          existing.lotCode = lotCode;
          existing.lotName = lot.ward_name?.trim() || `Lot ${lotCode}`;
          if (customerType) existing.customerType = customerType;
          await existing.save();
          results.updated++;
        } else {
          const newCustomerId = externalId || `CUST-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
          await Customer.create({
            customerId: newCustomerId,
            customerName,
            address,
            phone: phone || undefined,
            email: email || undefined,
            lotCode,
            lotName: lot.ward_name?.trim() || `Lot ${lotCode}`,
            customerType: customerType || 'residential',
            servingCompanyId: ownerCompanyId,
            servingCompanyName: ownerCompany.companyName,
            ownerCompanyId,
            ownerCompanyName: ownerCompany.companyName,
            pickups: [],
            totalPickups: 0,
            active: true,
            createdBy: userId || 'csv-import',
          });
          results.created++;
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Error processing "${customerName}": ${err.message}`);
      }
    }

    console.log(
      `[PropertyEnumerationREST] CSV import for company ${ownerCompanyId}: ` +
      `rows=${rows.length}, created=${results.created}, updated=${results.updated}, failed=${results.failed}`
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('[PropertyEnumerationREST] CSV import error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /property-enumeration/customers/:customerId/link
 * Link customer to building
 * Body: { buildingId: string }
 */
router.post('/customers/:customerId/link', authenticateJWT, async (req: any, res) => {
  try {
    const { customerId } = req.params;
    const { buildingId } = req.body;
    if (!buildingId) {
      return res.status(400).json({
        success: false,
        error: 'Building ID is required',
      });
    }
    // Find customer
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }
    // Verify building exists
    const db = await getMongoDb();
    const buildingsCollection = db.collection('buildings');
    const building = await buildingsCollection.findOne({ buildingId });
    if (!building) {
      return res.status(404).json({
        success: false,
        error: 'Building not found',
      });
    }
    // Validate user has access to building's lot
    if (building.lotCode) {
      const lotValidation = await validateLotAccess(req.user.userId, building.lotCode);
      if (!lotValidation.hasAccess) {
        return res.status(403).json({
          success: false,
          error: lotValidation.error || 'You do not have access to this lot',
        });
      }
    }
    // Link customer to building
    customer.buildingId = buildingId;
    customer.linkedAt = new Date();
    customer.linkedBy = req.user.userId;
    await customer.save();
    // Update building's customer list
    await buildingsCollection.updateOne(
      { buildingId },
      {
        $addToSet: { customers: customerId },
        $inc: { customersCount: 1 },
      }
    );
    console.log(`[PropertyEnumerationREST] Customer ${customerId} linked to building ${buildingId} by user ${req.user.userId}`);
    res.json({
      success: true,
      message: 'Customer linked to building successfully',
    });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Customer link error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * DELETE /property-enumeration/customers/:customerId/unlink
 * Unlink customer from building
 */
router.delete('/customers/:customerId/unlink', authenticateJWT, async (req: any, res) => {
  try {
    const { customerId } = req.params;
    // Find customer
    const customer = await Customer.findOne({ customerId });
    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found',
      });
    }
    const previousBuildingId = customer.buildingId;
    if (!previousBuildingId) {
      return res.status(400).json({
        success: false,
        error: 'Customer is not linked to any building',
      });
    }
    // Unlink customer from building
    customer.buildingId = undefined;
    customer.linkedAt = undefined;
    customer.linkedBy = undefined;
    await customer.save();
    // Update building's customer list
    const db = await getMongoDb();
    const buildingsCollection = db.collection('buildings');
    await buildingsCollection.updateOne(
      { buildingId: previousBuildingId },
      {
        $pull: { customers: customerId },
        $inc: { customersCount: -1 },
      }
    );
    console.log(`[PropertyEnumerationREST] Customer ${customerId} unlinked from building ${previousBuildingId} by user ${req.user.userId}`);
    res.json({
      success: true,
      message: 'Customer unlinked from building successfully',
    });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Customer unlink error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  }
});

/**
 * POST /property-enumeration/sessions/start
 * Start a new enumeration session
 * Body: { lotCode: string, location: { latitude: number, longitude: number }, notes?: string }
 */
router.post('/sessions/start', authenticateJWT, async (req: any, res) => {
  try {
    const { lotCode, location, notes } = req.body;
    if (!lotCode) {
      return res.status(400).json({ success: false, error: 'lotCode is required' });
    }
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return res.status(400).json({ success: false, error: 'Valid location (latitude and longitude) is required' });
    }
    // Validate lot access
    const lotValidation = await validateLotAccess(req.user.userId, lotCode);
    if (!lotValidation.hasAccess) {
      return res.status(403).json({ success: false, error: lotValidation.error || 'You do not have access to this lot' });
    }
    // Check for existing active session
    const existingSession = await Session.findOne({ userId: req.user.userId, status: 'active' });
    if (existingSession) {
      return res.status(409).json({
        success: false,
        error: 'You already have an active session. Please end it before starting a new one.',
        activeSession: {
          sessionId: existingSession._id.toString(),
          lotCode: existingSession.lotCode,
          startTime: existingSession.startTime,
        },
      });
    }
    // Create new session
    const newSession = new Session({
      userId: req.user.userId,
      lotCode,
      notes,
      startLocation: { latitude: location.latitude, longitude: location.longitude },
      startTime: new Date(),
      status: 'active',
    });
    await newSession.save();
    console.log(`[PropertyEnumerationREST] Session started: ${newSession._id} by user ${req.user.userId} in lot ${lotCode}`);
    res.json({
      success: true,
      message: 'Session started successfully',
      sessionId: newSession._id.toString(),
      lotCode: newSession.lotCode,
      startTime: newSession.startTime,
    });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Session start error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * POST /property-enumeration/sessions/end
 * End the active enumeration session
 * Body: { location: { latitude: number, longitude: number } }
 */
router.post('/sessions/end', authenticateJWT, async (req: any, res) => {
  try {
    const { location } = req.body;
    if (!location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return res.status(400).json({ success: false, error: 'Valid location (latitude and longitude) is required' });
    }
    const activeSession = await Session.findOne({ userId: req.user.userId, status: 'active' });
    if (!activeSession) {
      return res.status(404).json({ success: false, error: 'No active session found' });
    }
    activeSession.status = 'ended';
    activeSession.endTime = new Date();
    activeSession.endLocation = { latitude: location.latitude, longitude: location.longitude };
    await activeSession.save();
    console.log(`[PropertyEnumerationREST] Session ended: ${activeSession._id} by user ${req.user.userId}`);
    res.json({
      success: true,
      message: 'Session ended successfully',
      sessionId: activeSession._id.toString(),
      duration: activeSession.endTime.getTime() - activeSession.startTime.getTime(),
    });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Session end error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /property-enumeration/sessions/active
 * Get the user's active session
 */
router.get('/sessions/active', authenticateJWT, async (req: any, res) => {
  try {
    const activeSession = await Session.findOne({ userId: req.user.userId, status: 'active' });
    if (!activeSession) {
      return res.json({ success: true, hasActiveSession: false, session: null });
    }
    res.json({
      success: true,
      hasActiveSession: true,
      session: {
        sessionId: activeSession._id.toString(),
        lotCode: activeSession.lotCode,
        notes: activeSession.notes,
        startTime: activeSession.startTime,
        startLocation: activeSession.startLocation,
      },
    });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Get active session error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * GET /property-enumeration/sessions/history
 * Get the user's session history
 * Query params: limit (default: 20)
 */
router.get('/sessions/history', authenticateJWT, async (req: any, res) => {
  try {
    const { limit = 20 } = req.query;
    const sessions = await Session.find({ userId: req.user.userId })
      .sort({ startTime: -1 })
      .limit(parseInt(limit as string, 10))
      .lean();
    const transformedSessions = sessions.map((session: any) => ({
      sessionId: session._id.toString(),
      lotCode: session.lotCode,
      notes: session.notes,
      startTime: session.startTime,
      endTime: session.endTime,
      startLocation: session.startLocation,
      endLocation: session.endLocation,
      status: session.status,
      duration: session.endTime ? session.endTime.getTime() - session.startTime.getTime() : null,
    }));
    res.json({ success: true, sessions: transformedSessions });
  } catch (error) {
    console.error('[PropertyEnumerationREST] Get session history error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'property-enumeration-rest' });
});

export default router;
