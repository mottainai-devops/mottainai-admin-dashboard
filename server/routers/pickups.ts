import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { FormSubmission } from '../models/FormSubmission';
import { Company } from '../models/Company';
import { User } from '../models/User';

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
        searchQuery.nameBin = input.binType;
      }
      
      // Company filter (get all users for this company and filter by their IDs)
      if (input?.companyId) {
        const companyUsers = await User.find({ companyId: input.companyId }).select('_id').lean();
        const userIds = companyUsers.map(u => u._id.toString());
        if (userIds.length > 0) {
          searchQuery.userId = { $in: userIds };
        } else {
          // No users for this company, return empty results
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
      
      // Transform data to match expected format
      const transformedPickups = pickups.map((pickup: any) => ({
        _id: pickup._id,
        buildingId: pickup.buildingId,
        splitCode: pickup.buildingId, // Use buildingId as splitCode for now
        nameBin: pickup.binType,
        quantity: pickup.binQuantity,
        amount: pickup.amount || 0,
        isMonthly: false, // Default to PAYT, can be enhanced later
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
        createdAt: pickup.createdAt,
      }));
      
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

        return {
          _id: pickup._id,
          buildingId: pickup.buildingId,
          splitCode: pickup.buildingId,
          nameBin: pickup.binType,
          quantity: pickup.binQuantity,
          amount: pickup.amount || 0,
          isMonthly: false,
          customerType: pickup.customerType,
          socioClass: pickup.socioClass,
          firstPhoto: pickup.firstPhoto,
          secondPhoto: pickup.secondPhoto,
          firstPhotoUrl: pickup.firstPhotoUrl,
          secondPhotoUrl: pickup.secondPhotoUrl,
          incidentReport: pickup.incidentReport,
          pickUpDate: pickup.pickUpDate,
          pickupDate: pickup.pickupDate,
          userId: pickup.userId,
          companyId: pickup.companyId,
          companyName: pickup.companyName,
          zohoInvoiceId: pickup.zohoInvoiceId,
          transactionId: pickup._id.toString(),
          createdAt: pickup.createdAt,
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
      const companies = await Company.find({}).select('_id name').lean();
      
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
        companies: companies.map(c => ({ id: c._id.toString(), name: c.name })),
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
