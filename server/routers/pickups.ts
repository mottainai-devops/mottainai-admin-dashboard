import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { FormSubmission } from '../models/FormSubmission';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { FixedBillingAgreement } from '../models/FixedBillingAgreement';

export const pickupsRouter = router({
  // List pickup records with pagination and search
  list: publicProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().default(1),
        limit: z.number().default(50),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        companyId: z.string().optional(),
        fieldWorkerId: z.string().optional(),
        lotId: z.string().optional(),
        binType: z.string().optional(),
        paymentType: z.enum(["PAYT", "Monthly"]).optional(),
        source: z.enum(["webapp_current", "webapp_old", "mobile_app", "unknown"]).optional(),
        arcgisBuildingId: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const page = input?.page || 1;
      const limit = input?.limit || 50;
      const search = input?.search || '';
      
      // Build search query
      const searchQuery: any = {};
      
      // Text search
      if (search) {
        searchQuery.$or = [
          { buildingId: { $regex: search, $options: 'i' } },
          { arcgisBuildingId: { $regex: search, $options: 'i' } },
          { splitCode: { $regex: search, $options: 'i' } },
          { nameBin: { $regex: search, $options: 'i' } },
        ];
      }

      // ArcGIS Building ID filter
      if (input?.arcgisBuildingId) {
        searchQuery.arcgisBuildingId = input.arcgisBuildingId;
      }
      
      // Date range filter (use createdAt for accurate date filtering)
      if (input?.dateFrom || input?.dateTo) {
        searchQuery.createdAt = {};
        if (input.dateFrom) {
          searchQuery.createdAt.$gte = new Date(input.dateFrom);
        }
        if (input.dateTo) {
          // Add 1 day to include the entire end date
          const endDate = new Date(input.dateTo);
          endDate.setDate(endDate.getDate() + 1);
          searchQuery.createdAt.$lt = endDate;
        }
      }
      
      // Lot filter (match last 3 digits of buildingId)
      if (input?.lotId) {
        // Match building IDs ending with the lot code
        // Example: lotId "410" matches "401638 OYSISW08 410"
        searchQuery.buildingId = { $regex: `\\s${input.lotId}$`, $options: 'i' };
      }
      
      // Bin type filter
      if (input?.binType) {
        searchQuery.binType = input.binType;
      }
      
      // Company filter strategy (in priority order):
      //
      // 1. PRIMARY — splitCode field (Paystack webhook split code)
      //    This is the most accurate identifier: it is the split code from the Survey123
      //    webhook URL that was used to submit the pickup. It directly determines which
      //    company's moneybox receives the payment. All 22,327 formsubmissions have been
      //    backfilled with splitCode via monthlybilldatas join + lot-number fallback.
      //    Each company document has a splitCodes[] array.
      //
      // 2. SECONDARY — lot number (last token of buildingId)
      //    For companies with no SPL_ codes (Urban Spirit/LASIKA06, Sarobol), or for
      //    records where splitCode is null, fall back to lot-number matching.
      //    Each company document has a lotCodes[] array.
      //
      // 3. FALLBACK — explicit companyId/companyName fields
      //    Only ~185 records have these set directly (mobile app submissions).
      //
      if (input?.companyId) {
        const company = await Company.findById(input.companyId).lean() as any;
        if (company) {
          const companyConditions: any[] = [];

          // PRIMARY: match by splitCode (Paystack webhook split code)
          if (company.splitCodes && company.splitCodes.length > 0) {
            companyConditions.push({ splitCode: { $in: company.splitCodes } });
          }

          // SECONDARY: match by lot number in buildingId (covers LASIKA06/Urban Spirit
          // and any records where splitCode is null)
          if (company.lotCodes && company.lotCodes.length > 0) {
            company.lotCodes.forEach((lotCode: string) => {
              companyConditions.push({
                buildingId: { $regex: `\\s${lotCode}$`, $options: 'i' }
              });
            });
          }

          // FALLBACK: match the minority of records with explicit companyId/companyName
          companyConditions.push({ companyId: input.companyId });
          if (company.companyId) {
            companyConditions.push({ companyId: company.companyId });
          }
          if (company.companyName) {
            companyConditions.push({ companyName: company.companyName });
          }

          if (companyConditions.length > 0) {
            searchQuery.$or = companyConditions;
          } else {
            searchQuery.userId = 'no-match';
          }
        } else {
          // Company not found — return empty results
          searchQuery.userId = 'no-match';
        }
      }
      
      // Field Worker filter
      if (input?.fieldWorkerId) {
        searchQuery.userId = input.fieldWorkerId;
      }
      
      // Payment type filter
      if (input?.paymentType) {
        searchQuery.isMonthly = input.paymentType === "Monthly";
      }
      
      // Source filter
      if (input?.source) {
        searchQuery.source = input.source;
      }
      
      // Get total count
      const total = await FormSubmission.countDocuments(searchQuery);
      
      // Get paginated results
      const pickups = await FormSubmission.find(searchQuery)
        .sort({ createdAt: -1 }) // Sort by newest first
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
      
      // Gap 2: Collect all customerIds that have an active Fixed Billing agreement
      // so we can flag them in the pickup records UI.
      const customerIds = Array.from(new Set(pickups.map((p: any) => p.userId).filter(Boolean)));
      const fixedBillingCustomerIds = new Set<string>();
      if (customerIds.length > 0) {
        const fbAgreements = await FixedBillingAgreement.find(
          { customerId: { $in: customerIds }, active: true },
          { customerId: 1 }
        ).lean();
        fbAgreements.forEach((a: any) => fixedBillingCustomerIds.add(a.customerId));
      }

      // Transform data to match expected format
      const transformedPickups = pickups.map((pickup: any) => {
        // Derive billing type from customerType field
        // customerType values: "Monthly Billing - Business", "Monthly Billing - Residential",
        // "PAYT - Business", "PAYT - Residential", "commercial", "residential"
        const ct = (pickup.customerType || '').toLowerCase();
        const isMonthlyBilling = ct.includes('monthly billing');
        const isPAYT = ct.includes('payt') || (!isMonthlyBilling && (ct === 'commercial' || ct === 'residential'));
        // Determine customer class (residential vs business)
        const isResidential = ct.includes('residential') || ct === 'residential';
        const isBusiness = ct.includes('business') || ct === 'commercial';
        let billingType: string;
        if (isMonthlyBilling) {
          billingType = isBusiness ? 'Monthly - Business' : 'Monthly - Residential';
        } else {
          billingType = isBusiness ? 'PAYT - Business' : 'PAYT - Residential';
        }
        return {
        _id: pickup._id,
        buildingId: pickup.buildingId,
        splitCode: pickup.buildingId, // Use buildingId as splitCode for now
        nameBin: pickup.binType,
        quantity: pickup.binQuantity,
        amount: pickup.amount || 0,
        isMonthly: isMonthlyBilling,
        isFixedBilling: fixedBillingCustomerIds.has(pickup.userId || ''),
        billingType,
        month: pickup.pickupDate ? new Date(pickup.pickupDate).toISOString().substring(0, 7) : '',
        year: pickup.pickupDate ? new Date(pickup.pickupDate).getFullYear().toString() : '',
        status: false, // Default unpaid
        source: pickup.source || 'unknown', // Add source field
        customerType: pickup.customerType,
        socioClass: pickup.socioClass,
        firstPhoto: pickup.firstPhoto,
        secondPhoto: pickup.secondPhoto,
        firstPhotoUrl: pickup.firstPhotoUrl,
        secondPhotoUrl: pickup.secondPhotoUrl,
        pickUpDate: pickup.pickUpDate,
        pickupDate: pickup.pickupDate,
        incidentReport: pickup.incidentReport,
        userId: pickup.userId,
        companyId: pickup.companyId,
        companyName: pickup.companyName,
        zohoInvoiceId: pickup.zohoInvoiceId,
        arcgisBuildingId: pickup.arcgisBuildingId || null,
        lgaName: pickup.lgaName || null,
        lgaCode: pickup.lgaCode || null,
        stateCode: pickup.stateCode || null,
        country: pickup.country || null,
        wardCode: pickup.wardCode || null,
        wardName: pickup.wardName || null,
        lotCode: pickup.lotCode || null,
        latitude: pickup.latitude || null,
        longitude: pickup.longitude || null,
        createdAt: pickup.createdAt,
        submittedAt: pickup.submittedAt || pickup.createdAt,
        };
      });
      
      return {
        pickups: transformedPickups,
        total,
        page,
        limit,
      };
    }),

  // Get pickup by ID with photo data from form submissions
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      try {
        const pickup = await FormSubmission.findById(input.id).lean();
        
        if (!pickup) {
          return null;
        }

        const ct2 = ((pickup as any).customerType || '').toLowerCase();
        const isMonthlyById = ct2.includes('monthly billing');
        const isBizById = ct2.includes('business') || ct2 === 'commercial';
        const billingTypeById = isMonthlyById
          ? (isBizById ? 'Monthly - Business' : 'Monthly - Residential')
          : (isBizById ? 'PAYT - Business' : 'PAYT - Residential');
        const p = pickup as any;
        return {
          _id: p._id,
          buildingId: p.buildingId,
          splitCode: p.buildingId,
          // Customer info
          fullName: p.customerName || null,
          phoneNumber: p.customerPhone || null,
          customerEmail: p.customerEmail || null,
          customerAddress: p.customerAddress || null,
          customerType: p.customerType,
          // Bin info
          binType: p.binType,
          nameBin: p.binType,
          quantity: p.binQuantity,
          binQtyPerPickup: p.binQuantity || 1,
          // Amount & billing
          amount: p.amount || 0,
          totalDue: p.amount || 0,
          isMonthly: isMonthlyById,
          billingType: billingTypeById,
          paymentType: isMonthlyById ? 'monthly' : 'payt',
          paymentStatus: p.zohoInvoiceId ? 'invoiced' : 'pending',
          // Geographic
          lotCode: p.lotCode || null,
          lgaName: p.lgaName || null,
          wardName: p.wardName || null,
          stateCode: p.stateCode || null,
          country: p.country || null,
          // Photos
          firstPhoto: p.firstPhoto,
          secondPhoto: p.secondPhoto,
          firstPhotoUrl: p.firstPhotoUrl,
          secondPhotoUrl: p.secondPhotoUrl,
          // Other
          socioClass: p.socioClass,
          incidentReport: p.incidentReport,
          pickUpDate: p.pickUpDate,
          pickupDate: p.pickupDate,
          paymentDueDate: null,
          userId: p.userId,
          companyId: p.companyId,
          companyName: p.companyName,
          zohoInvoiceId: p.zohoInvoiceId,
          transactionId: p._id.toString(),
          createdAt: p.createdAt,
        };
      } catch (error) {
        console.error('[Pickups] Error getting pickup by ID:', error);
        throw error;
      }
    }),

  // Update pickup status (not applicable to FormSubmission, kept for compatibility)
  updateStatus: publicProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // FormSubmission doesn't have a status field, but we keep this for API compatibility
        const pickup = await FormSubmission.findById(input.id);

        if (!pickup) {
          throw new Error('Pickup not found');
        }

        return {
          success: true,
          pickup,
        };
      } catch (error) {
        console.error('[Pickups] Error updating status:', error);
        throw error;
      }
    }),

  // Get top polygons by pickup frequency (for Pickups by Polygon summary card)
  topPolygons: publicProcedure
    .input(z.object({
      limit: z.number().default(10),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const limit = input?.limit || 10;
        const matchStage: any = { arcgisBuildingId: { $exists: true, $nin: [null, ''] } };
        if (input?.dateFrom || input?.dateTo) {
          matchStage.createdAt = {};
          if (input?.dateFrom) matchStage.createdAt.$gte = new Date(input.dateFrom);
          if (input?.dateTo) {
            const end = new Date(input.dateTo);
            end.setHours(23, 59, 59, 999);
            matchStage.createdAt.$lte = end;
          }
        }
        const results = await FormSubmission.aggregate([
          { $match: matchStage },
          { $group: {
              _id: '$arcgisBuildingId',
              count: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
              lastPickup: { $max: '$createdAt' },
              companyName: { $first: '$companyName' },
              buildingId: { $first: '$buildingId' },
          }},
          { $sort: { count: -1 } },
          { $limit: limit },
        ]);
        return results.map((r: any) => ({
          arcgisBuildingId: r._id,
          count: r.count,
          totalAmount: r.totalAmount,
          lastPickup: r.lastPickup,
          companyName: r.companyName || null,
          buildingId: r.buildingId || null,
        }));
      } catch (error) {
        console.error('[Pickups] Error getting top polygons:', error);
        return [];
      }
    }),

  // Get filter options (lots, bin types, companies)
  getFilterOptions: publicProcedure.query(async () => {
    try {
      // Get unique bin types
      const binTypes = await FormSubmission.distinct('binType');
      
      // Get unique companies
      const companies = await Company.find({}).select('_id companyName').lean();
      
      // Get unique lots (extract last 3 digits from buildingId)
      const buildingIds = await FormSubmission.distinct('buildingId');
      const lotCodes = new Set<string>();
      
      buildingIds.forEach((buildingId: string) => {
        if (!buildingId || typeof buildingId !== 'string') return;
        
        // Extract lot code (last 3 digits)
        const parts = buildingId.trim().split(/\s+/);
        if (parts.length >= 3) {
          const lotCode = parts[parts.length - 1];
          if (/^\d{1,3}$/.test(lotCode)) {
            lotCodes.add(lotCode.padStart(3, '0'));
          }
        }
      });
      
      // Convert Set to sorted array
      const lots = Array.from(lotCodes).sort();
      
      return {
        binTypes: binTypes.filter(Boolean),
        companies: (companies as any[]).map(c => ({ id: c._id.toString(), name: c.companyName || 'Unknown' })),
        lots,
      };
    } catch (error) {
      console.error('[Pickups] Error getting filter options:', error);
      return {
        binTypes: [],
        companies: [],
        lots: [],
      };
    }
  }),
});
