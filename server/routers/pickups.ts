import { adminProcedure, router, publicProcedure } from '../_core/trpc';
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
        source: z.enum(["webapp_current", "webapp_old", "mobile_app", "field_worker", "unknown"]).optional(),
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
        customerName: pickup.customerName || null,
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
  updateStatus: adminProcedure
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

  // Map data — returns one marker per unique building with aggregated pickup stats
  mapData: publicProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        companyId: z.string().optional(),
        lotId: z.string().optional(),
        binType: z.string().optional(),
        paymentType: z.enum(['PAYT', 'Monthly']).optional(),
        source: z.string().optional(),
        arcgisBuildingId: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const searchQuery: any = {};

        if (input?.dateFrom || input?.dateTo) {
          searchQuery.createdAt = {};
          if (input?.dateFrom) searchQuery.createdAt.$gte = new Date(input.dateFrom);
          if (input?.dateTo) {
            const endDate = new Date(input.dateTo);
            endDate.setHours(23, 59, 59, 999);
            searchQuery.createdAt.$lte = endDate;
          }
        }
        if (input?.lotId) searchQuery.buildingId = { $regex: `\\s${input.lotId}$`, $options: 'i' };
        if (input?.binType) searchQuery.binType = input.binType;
        if (input?.paymentType) searchQuery.isMonthly = input.paymentType === 'Monthly';
        if (input?.source) searchQuery.source = input.source;
        if (input?.arcgisBuildingId) searchQuery.arcgisBuildingId = input.arcgisBuildingId;

        if (input?.companyId) {
          const company = await Company.findById(input.companyId).lean() as any;
          if (!company) return { markers: [], unlocatedCount: 0, totalCount: 0 };
          const companyConditions: any[] = [];
          if (company.splitCodes?.length) companyConditions.push({ splitCode: { $in: company.splitCodes } });
          if (company.lotCodes?.length) {
            company.lotCodes.forEach((lc: string) => companyConditions.push({ buildingId: { $regex: `\\s${lc}$`, $options: 'i' } }));
          }
          companyConditions.push({ companyId: input.companyId });
          if (company.companyName) companyConditions.push({ companyName: company.companyName });
          if (companyConditions.length === 0) return { markers: [], unlocatedCount: 0, totalCount: 0 };
          searchQuery.$or = companyConditions;
        }

        const totalCount = await FormSubmission.countDocuments(searchQuery);
        const unlocatedCount = await FormSubmission.countDocuments({
          ...searchQuery,
          $or: [{ latitude: { $exists: false } }, { latitude: null }, { longitude: null }],
        });

        const results = await FormSubmission.aggregate([
          { $match: { ...searchQuery, latitude: { $exists: true, $ne: null }, longitude: { $exists: true, $ne: null } } },
          {
            $group: {
              _id: '$buildingId',
              latitude: { $first: '$latitude' },
              longitude: { $first: '$longitude' },
              arcgisBuildingId: { $first: '$arcgisBuildingId' },
              pickupCount: { $sum: 1 },
              totalAmount: { $sum: { $ifNull: ['$amount', 0] } },
              lastPickupDate: { $max: '$createdAt' },
              binTypes: { $addToSet: '$binType' },
              paytCount: { $sum: { $cond: [{ $eq: ['$isMonthly', false] }, 1, 0] } },
              monthlyCount: { $sum: { $cond: [{ $eq: ['$isMonthly', true] }, 1, 0] } },
              latestPickupId: { $last: '$_id' },
              customerName: { $first: '$customerName' },
            },
          },
          { $sort: { pickupCount: -1 } },
          { $limit: 5000 },
        ]);

        return {
          markers: results.map((r: any) => ({
            buildingId: r._id as string,
            arcgisBuildingId: (r.arcgisBuildingId as string) || null,
            latitude: r.latitude as number,
            longitude: r.longitude as number,
            pickupCount: r.pickupCount as number,
            totalAmount: r.totalAmount as number,
            lastPickupDate: r.lastPickupDate as Date,
            binTypes: ((r.binTypes as string[]) || []).filter(Boolean),
            paytCount: r.paytCount as number,
            monthlyCount: r.monthlyCount as number,
            latestPickupId: r.latestPickupId?.toString() as string,
            customerName: (r.customerName as string) || null,
          })),
          unlocatedCount,
          totalCount,
        };
      } catch (error) {
        console.error('[Pickups] Error getting map data:', error);
        return { markers: [], unlocatedCount: 0, totalCount: 0 };
      }
    }),

  // Backfill 27 CBM DINO BIN amounts to correct tariff (₦320,000 per bin)
  // dryRun=true audits without changing; dryRun=false applies the fix
  backfillDinoBinAmount: adminProcedure
    .input(z.object({ dryRun: z.boolean().default(true) }))
    .mutation(async ({ input }) => {
      try {
        const DINO_BIN_TYPE = '27 CBM DINO BIN';
        const UNIT_PRICE = 320000;

        // Fetch all DINO BIN records
        const records = await FormSubmission.find({ binType: DINO_BIN_TYPE }).lean();
        const total = records.length;

        // Classify records that need fixing
        const toFix = records.filter((r: any) => {
          const expectedAmount = (r.binQuantity || 1) * UNIT_PRICE;
          return r.amount !== expectedAmount;
        });

        // Build breakdown by current amount for audit
        const byCurrentAmount: Record<string, number> = {};
        toFix.forEach((r: any) => {
          const key = `₦${r.amount ?? 0} (qty ${r.binQuantity})`;
          byCurrentAmount[key] = (byCurrentAmount[key] || 0) + 1;
        });

        if (input.dryRun) {
          return {
            dryRun: true,
            total,
            alreadyCorrect: total - toFix.length,
            toFix: toFix.length,
            byCurrentAmount,
            updated: 0,
          };
        }

        // Apply fix using bulkWrite for efficiency
        const bulkOps = toFix.map((r: any) => ({
          updateOne: {
            filter: { _id: r._id },
            update: { $set: { amount: (r.binQuantity || 1) * UNIT_PRICE } },
          },
        }));

        let updated = 0;
        if (bulkOps.length > 0) {
          const result = await FormSubmission.bulkWrite(bulkOps);
          updated = result.modifiedCount;
        }

        return {
          dryRun: false,
          total,
          alreadyCorrect: total - toFix.length,
          toFix: toFix.length,
          byCurrentAmount,
          updated,
        };
      } catch (error) {
        console.error('[Pickups] Error in backfillDinoBinAmount:', error);
        throw error;
      }
    }),

  // Export all filtered records as CSV (no pagination limit)
  exportCsv: publicProcedure
    .input(
      z.object({
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        companyId: z.string().optional(),
        fieldWorkerId: z.string().optional(),
        lotId: z.string().optional(),
        binType: z.string().optional(),
        paymentType: z.enum(['PAYT', 'Monthly']).optional(),
        source: z.enum(['webapp_current', 'webapp_old', 'mobile_app', 'field_worker', 'unknown']).optional(),
        arcgisBuildingId: z.string().optional(),
        search: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const searchQuery: any = {};

      if (input?.search) {
        searchQuery.$or = [
          { buildingId: { $regex: input.search, $options: 'i' } },
          { arcgisBuildingId: { $regex: input.search, $options: 'i' } },
          { splitCode: { $regex: input.search, $options: 'i' } },
          { nameBin: { $regex: input.search, $options: 'i' } },
        ];
      }
      if (input?.arcgisBuildingId) searchQuery.arcgisBuildingId = input.arcgisBuildingId;
      if (input?.dateFrom || input?.dateTo) {
        searchQuery.createdAt = {};
        if (input.dateFrom) searchQuery.createdAt.$gte = new Date(input.dateFrom);
        if (input.dateTo) {
          const endDate = new Date(input.dateTo);
          endDate.setDate(endDate.getDate() + 1);
          searchQuery.createdAt.$lt = endDate;
        }
      }
      if (input?.lotId) searchQuery.buildingId = { $regex: `\\s${input.lotId}$`, $options: 'i' };
      if (input?.binType) searchQuery.binType = input.binType;
      if (input?.companyId) {
        const company = await Company.findById(input.companyId).lean() as any;
        if (company) {
          const conds: any[] = [];
          if (company.splitCodes?.length) conds.push({ splitCode: { $in: company.splitCodes } });
          if (company.lotCodes?.length) {
            company.lotCodes.forEach((lc: string) => conds.push({ buildingId: { $regex: `\\s${lc}$`, $options: 'i' } }));
          }
          conds.push({ companyId: input.companyId });
          if (company.companyId) conds.push({ companyId: company.companyId });
          if (company.companyName) conds.push({ companyName: company.companyName });
          searchQuery.$or = conds;
        } else {
          searchQuery.userId = 'no-match';
        }
      }
      if (input?.fieldWorkerId) searchQuery.userId = input.fieldWorkerId;
      if (input?.paymentType) searchQuery.isMonthly = input.paymentType === 'Monthly';
      if (input?.source) searchQuery.source = input.source;

      // Fetch all matching records (no pagination)
      const records = await FormSubmission.find(searchQuery)
        .sort({ createdAt: -1 })
        .lean();

      // Build CSV rows
      const headers = [
        'Customer ID', 'Customer Name', 'Bin Type', 'Quantity', 'Amount',
        'Billing Type', 'Source', 'Lot', 'LGA', 'Ward', 'Date', 'Zoho Invoice ID',
      ];

      const rows = records.map((r: any) => {
        const ct = (r.customerType || '').toLowerCase();
        const isMonthly = ct.includes('monthly billing');
        const isBiz = ct.includes('business') || ct === 'commercial';
        const billingType = isMonthly
          ? (isBiz ? 'Monthly - Business' : 'Monthly - Residential')
          : (isBiz ? 'PAYT - Business' : 'PAYT - Residential');
        const date = r.createdAt ? new Date(r.createdAt).toISOString().substring(0, 10) : '';
        const lotCode = r.lotCode || (() => {
          const parts = (r.buildingId || '').trim().split(/\s+/);
          return parts.length >= 3 ? parts[parts.length - 1] : '';
        })();
        // Escape CSV fields that may contain commas
        const esc = (v: any) => {
          const s = String(v ?? '');
          return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
        };
        return [
          esc(r.buildingId),
          esc(r.customerName || ''),
          esc(r.binType),
          r.binQuantity ?? 0,
          r.amount ?? 0,
          esc(billingType),
          esc(r.source || 'unknown'),
          esc(lotCode),
          esc(r.lgaName || ''),
          esc(r.wardName || ''),
          esc(date),
          esc(r.zohoInvoiceId || ''),
        ].join(',');
      });

      const csv = [headers.join(','), ...rows].join('\n');
      return { csv, total: records.length };
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
