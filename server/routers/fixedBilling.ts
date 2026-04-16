/**
 * Fixed Billing Router
 *
 * tRPC procedures for the Fixed Billing revenue model:
 * - Tariff schedule CRUD (admin)
 * - Agreement CRUD (admin + company portal)
 * - Ledger view and payment recording
 * - Manual notification trigger
 * - Notification history
 * - Monthly ledger generation
 */

import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import { TariffSchedule } from '../models/TariffSchedule';
import { MonthlyBillData } from '../models/MonthlyBillData';
import { FixedBillingAgreement } from '../models/FixedBillingAgreement';
import { FixedBillingLedger } from '../models/FixedBillingLedger';
import { FixedBillingNotificationLog } from '../models/FixedBillingNotificationLog';
import { Customer } from '../models/Customer';
import { Company } from '../models/Company';
import {
  computeOutstanding,
  triggerFixedBillingNotification,
  generateMonthlyLedgerEntries,
  recordLedgerPayment,
  getCurrentBillingMonth,
} from '../services/fixedBillingService';

// ─── Shared Zod Schemas ───────────────────────────────────────────────────────

const BinTypeEnum = z.enum(['120L', '240L', '660L', '1100L', 'MAMMOTH (1100 LITRE)', '7-11 TONNE COMPACTOR', 'sachet', 'other']);
const FrequencyEnum = z.enum([
  'once_weekly',
  'twice_weekly',
  'thrice_weekly',
  'daily',
  'fortnightly',
  'monthly',
]);

// ─── Router ───────────────────────────────────────────────────────────────────

export const fixedBillingRouter = router({

  // ═══════════════════════════════════════════════════════════════════════════
  // TARIFF SCHEDULE
  // ═══════════════════════════════════════════════════════════════════════════

  /** List all tariff schedules */
  listTariffs: protectedProcedure
    .input(
      z.object({
        activeOnly: z.boolean().default(true),
        customerType: z.enum(['residential', 'commercial', 'industrial', 'all']).optional(),
      })
    )
    .query(async ({ input }) => {
      const filter: Record<string, any> = {};
      if (input.activeOnly) filter.active = true;
      if (input.customerType) filter.customerType = { $in: [input.customerType, 'all'] };

      const tariffs = await TariffSchedule.find(filter).sort({ binType: 1, frequency: 1 });
      return tariffs;
    }),

  /** Create a new tariff schedule entry */
  createTariff: protectedProcedure
    .input(
      z.object({
        tariffCode: z.string().min(2).max(30),
        label: z.string().min(3),
        binType: BinTypeEnum,
        frequency: FrequencyEnum,
        binsCount: z.number().int().min(1).default(1),
        monthlyPriceKobo: z.number().int().min(0),
        customerType: z.enum(['residential', 'commercial', 'industrial', 'all']).default('all'),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const existing = await TariffSchedule.findOne({ tariffCode: input.tariffCode.toUpperCase() });
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Tariff code already exists' });
      }
      const tariff = await TariffSchedule.create({
        ...input,
        tariffCode: input.tariffCode.toUpperCase(),
        active: true,
        createdBy: ctx.user?.id || 'admin',
      });
      return tariff;
    }),

  /** Update a tariff schedule entry */
  updateTariff: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        monthlyPriceKobo: z.number().int().min(0).optional(),
        label: z.string().optional(),
        active: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const tariff = await TariffSchedule.findByIdAndUpdate(id, updates, { new: true });
      if (!tariff) throw new TRPCError({ code: 'NOT_FOUND', message: 'Tariff not found' });
      return tariff;
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // FIXED BILLING AGREEMENTS
  // ═══════════════════════════════════════════════════════════════════════════

  /** List agreements — optionally filtered by company or customer */
  listAgreements: protectedProcedure
    .input(
      z.object({
        companyId: z.string().optional(),
        customerId: z.string().optional(),
        activeOnly: z.boolean().default(true),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const filter: Record<string, any> = {};
      if (input.companyId) filter.companyId = input.companyId;
      if (input.customerId) filter.customerId = input.customerId;
      if (input.activeOnly) filter.active = true;

      const skip = (input.page - 1) * input.limit;
      const [agreements, total] = await Promise.all([
        FixedBillingAgreement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit),
        FixedBillingAgreement.countDocuments(filter),
      ]);

      return { agreements, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  /**
   * Check if a customer already has Monthly Billing records.
   * Used to show a warning in the New Agreement dialog (Gap 3).
   */
  checkCustomerBillingType: protectedProcedure
    .input(z.object({ customerId: z.string() }))
    .query(async ({ input }) => {
      if (!input.customerId || input.customerId.trim().length < 2) {
        return { hasMonthlyBilling: false, monthlyCount: 0 };
      }
      // Check monthlybilldatas for records with isMonthly: true for this customer
      const monthlyCount = await MonthlyBillData.countDocuments({
        userId: input.customerId,
        isMonthly: true,
      });
      return { hasMonthlyBilling: monthlyCount > 0, monthlyCount };
    }),

  /** Create a new Fixed Billing agreement for a customer */
  createAgreement: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        customerName: z.string(),
        customerPhone: z.string().optional(),
        customerEmail: z.string().email().optional(),
        companyId: z.string(),
        companyName: z.string(),
        lotCode: z.string(),
        tariffCode: z.string(),
        binType: BinTypeEnum,
        frequency: FrequencyEnum,
        binsCount: z.number().int().min(1).default(1),
        officialMonthlyPriceKobo: z.number().int().min(0),
        agreedMonthlyPriceKobo: z.number().int().min(0),
        priceOverrideReason: z.string().optional(),
        /** Pre-existing Zoho balance in kobo captured at agreement creation */
        openingBalanceKobo: z.number().int().min(0).default(0),
        startDate: z.date(),
        notifyBySms: z.boolean().default(true),
        notifyByEmail: z.boolean().default(true),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check for existing active agreement for this customer
      const existing = await FixedBillingAgreement.findOne({
        customerId: input.customerId,
        active: true,
      });
      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Customer already has an active Fixed Billing agreement. Terminate it first.',
        });
      }

      // Validate price override requires reason
      if (
        input.agreedMonthlyPriceKobo !== input.officialMonthlyPriceKobo &&
        !input.priceOverrideReason
      ) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A reason is required when the agreed price differs from the official tariff price.',
        });
      }

      const agreement = await FixedBillingAgreement.create({
        ...input,
        active: true,
        createdBy: ctx.user?.id || 'admin',
      });

      return agreement;
    }),

  /** Update an agreement (e.g. change notification preferences, terminate) */
  updateAgreement: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        notifyBySms: z.boolean().optional(),
        notifyByEmail: z.boolean().optional(),
        active: z.boolean().optional(),
        endDate: z.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...updates } = input;
      const agreement = await FixedBillingAgreement.findByIdAndUpdate(id, updates, { new: true });
      if (!agreement) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agreement not found' });
      return agreement;
    }),

  /** Get a single agreement with its current outstanding summary */
  getAgreementWithOutstanding: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const agreement = await FixedBillingAgreement.findById(input.id);
      if (!agreement) throw new TRPCError({ code: 'NOT_FOUND', message: 'Agreement not found' });

      const outstanding = await computeOutstanding(agreement);
      return { agreement, outstanding };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // LEDGER
  // ═══════════════════════════════════════════════════════════════════════════

  /** List ledger entries for a customer or company */
  listLedger: protectedProcedure
    .input(
      z.object({
        customerId: z.string().optional(),
        companyId: z.string().optional(),
        status: z.enum(['unpaid', 'partial', 'paid', 'waived']).optional(),
        billingMonth: z.string().optional(), // "YYYY-MM"
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const filter: Record<string, any> = {};
      if (input.customerId) filter.customerId = input.customerId;
      if (input.companyId) filter.companyId = input.companyId;
      if (input.status) filter.status = input.status;
      if (input.billingMonth) filter.billingMonth = input.billingMonth;

      const skip = (input.page - 1) * input.limit;
      const [entries, total] = await Promise.all([
        FixedBillingLedger.find(filter).sort({ billingMonth: -1 }).skip(skip).limit(input.limit),
        FixedBillingLedger.countDocuments(filter),
      ]);

      return { entries, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  /** Get outstanding summary for a company (for portal dashboard card) */
  getCompanyOutstandingSummary: protectedProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      const { month } = getCurrentBillingMonth();

      const [totalOutstanding, unpaidCount, totalCustomers] = await Promise.all([
        FixedBillingLedger.aggregate([
          { $match: { companyId: input.companyId, status: { $in: ['unpaid', 'partial'] } } },
          { $group: { _id: null, total: { $sum: '$outstandingAmountKobo' } } },
        ]),
        FixedBillingLedger.countDocuments({
          companyId: input.companyId,
          status: { $in: ['unpaid', 'partial'] },
        }),
        FixedBillingAgreement.countDocuments({ companyId: input.companyId, active: true }),
      ]);

      return {
        totalOutstandingKobo: totalOutstanding[0]?.total ?? 0,
        unpaidLedgerEntries: unpaidCount,
        activeAgreements: totalCustomers,
        currentBillingMonth: month,
      };
    }),

  /** Record a manual payment against a ledger entry */
  recordPayment: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        billingMonth: z.string(),
        amountKobo: z.number().int().min(1),
        paystackReference: z.string().optional(),
        channel: z.enum(['paystack', 'cash', 'bank_transfer', 'other']).default('paystack'),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const ledger = await recordLedgerPayment(
        input.customerId,
        input.billingMonth,
        input.amountKobo,
        input.paystackReference,
        input.channel,
        ctx.user?.id || 'admin'
      );
      if (!ledger) throw new TRPCError({ code: 'NOT_FOUND', message: 'Ledger entry not found' });
      return ledger;
    }),

  /** Waive / write-off a ledger entry (admin only) */
  waiveLedgerEntry: protectedProcedure
    .input(
      z.object({
        customerId: z.string(),
        billingMonth: z.string(), // "YYYY-MM"
        waivedReason: z.string().min(1, 'A reason is required to waive a charge'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const entry = await FixedBillingLedger.findOne({
        customerId: input.customerId,
        billingMonth: input.billingMonth,
      });
      if (!entry) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Ledger entry not found' });
      }
      if (entry.status === 'waived') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This entry is already waived' });
      }
      if (entry.status === 'paid') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Cannot waive a fully paid entry' });
      }
      entry.status = 'waived';
      entry.waivedBy = ctx.user?.id || 'admin';
      entry.waivedReason = input.waivedReason;
      entry.outstandingAmountKobo = 0;
      await entry.save();
      return entry;
    }),

  /** Generate monthly ledger entries for all active agreements (admin only) */
  generateMonthlyLedger: protectedProcedure
    .mutation(async () => {
      const result = await generateMonthlyLedgerEntries();
      return result;
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Manually trigger a Fixed Billing notification for a customer.
   * Used when a pickup is recorded from the admin dashboard or portal.
   */
  triggerPickupNotification: protectedProcedure
    .input(
      z.object({
        agreementId: z.string(),
        pickupId: z.string(),
        pickupDate: z.date(),
        binType: z.string(),
        binQuantity: z.number().int().min(1).default(1),
        lotCode: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const agreement = await FixedBillingAgreement.findById(input.agreementId);
      if (!agreement) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Agreement not found' });
      }
      if (!agreement.active) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Agreement is not active' });
      }

      const result = await triggerFixedBillingNotification(agreement, {
        pickupId: input.pickupId,
        pickupDate: input.pickupDate,
        binType: input.binType,
        binQuantity: input.binQuantity,
        lotCode: input.lotCode,
      });

      return result;
    }),

  /** List notification history for a customer or company */
  listNotifications: protectedProcedure
    .input(
      z.object({
        customerId: z.string().optional(),
        companyId: z.string().optional(),
        channel: z.enum(['sms', 'email']).optional(),
        status: z.enum(['sent', 'failed', 'skipped']).optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(100).default(50),
      })
    )
    .query(async ({ input }) => {
      const filter: Record<string, any> = {};
      if (input.customerId) filter.customerId = input.customerId;
      if (input.companyId) filter.companyId = input.companyId;
      if (input.channel) filter.channel = input.channel;
      if (input.status) filter.status = input.status;

      const skip = (input.page - 1) * input.limit;
      const [logs, total] = await Promise.all([
        FixedBillingNotificationLog.find(filter)
          .sort({ sentAt: -1 })
          .skip(skip)
          .limit(input.limit),
        FixedBillingNotificationLog.countDocuments(filter),
      ]);

      return { logs, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // PAYSTACK WEBHOOK — record payment from Paystack callback
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Called internally when a Paystack webhook confirms a Fixed Billing payment.
   * Matches by reference prefix "FB-" and records against the correct ledger month.
   */
  // ═══════════════════════════════════════════════════════════════════════════
  // GAP 1 & 3: CUSTOMER SEARCH — scoped by company for agreement form
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Search customers scoped to a company for the Fixed Billing agreement form.
   * Supports Independent, Franchisor (all franchisees), and specific Franchisee scopes.
   * Returns lightweight customer records for the searchable dropdown.
   */
  searchCustomersForAgreement: protectedProcedure
    .input(
      z.object({
        companyId: z.string(),
        /** Optional: narrow to a specific franchisee when companyId is a franchisor */
        franchiseeId: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().int().min(1).max(100).default(30),
      })
    )
    .query(async ({ input }) => {
      const company = await Company.findOne({ companyId: input.companyId });
      if (!company) throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found' });

      const filter: Record<string, any> = { active: true };

      if (company.companyType === 'franchisor') {
        if (input.franchiseeId) {
          // Specific franchisee selected
          filter.ownerCompanyId = input.franchiseeId;
        } else {
          // All franchisees under this franchisor
          const franchisees = await Company.find({ parentCompanyId: input.companyId }, { companyId: 1 }).lean();
          const franchiseeIds = franchisees.map((f: any) => f.companyId);
          filter.ownerCompanyId = { $in: [input.companyId, ...franchiseeIds] };
        }
      } else {
        // Independent company — only its own customers
        filter.ownerCompanyId = input.companyId;
      }

      if (input.search) {
        filter.$or = [
          { customerName: { $regex: input.search, $options: 'i' } },
          { customerId: { $regex: input.search, $options: 'i' } },
          { phone: { $regex: input.search, $options: 'i' } },
          { address: { $regex: input.search, $options: 'i' } },
        ];
      }

      const customers = await Customer.find(filter)
        .select('customerId customerName phone email address lotCode ownerCompanyId ownerCompanyName buildingId')
        .sort({ customerName: 1 })
        .limit(input.limit)
        .lean();

      return customers.map((c: any) => ({
        customerId: c.customerId,
        customerName: c.customerName,
        phone: c.phone || '',
        email: c.email || '',
        address: c.address || '',
        lotCode: c.lotCode || '',
        ownerCompanyId: c.ownerCompanyId,
        ownerCompanyName: c.ownerCompanyName,
        buildingId: c.buildingId || null,
      }));
    }),

  /**
   * List franchisees under a franchisor — used in the company scope selector.
   */
  listFranchisees: protectedProcedure
    .input(z.object({ franchisorId: z.string() }))
    .query(async ({ input }) => {
      const franchisees = await Company.find(
        { parentCompanyId: input.franchisorId },
        { companyId: 1, companyName: 1 }
      ).lean();
      return franchisees.map((f: any) => ({ companyId: f.companyId, companyName: f.companyName }));
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // GAP 2: PICKUP BRIDGE — called by platform backend after every pickup save
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Internal endpoint called by the mottainai-platform-backend after a pickup is
   * saved. Looks up the Fixed Billing agreement by buildingId → customerId and
   * triggers the SMS/email notification.
   *
   * Authentication: shared secret header (FIXED_BILLING_BRIDGE_SECRET).
   */
  pickupBridge: publicProcedure
    .input(
      z.object({
        secret: z.string(),
        buildingId: z.string(),
        pickupId: z.string(),
        pickupDate: z.string(), // ISO string from platform backend
        binType: z.string(),
        binQuantity: z.number().int().min(1),
        lotCode: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const expectedSecret = process.env.FIXED_BILLING_BRIDGE_SECRET || 'mottainai-fb-bridge-2026';
      if (input.secret !== expectedSecret) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid bridge secret' });
      }

      // Find the admin dashboard Customer by buildingId
      const customer = await Customer.findOne({ buildingId: input.buildingId }).lean();
      if (!customer) {
        return { triggered: false, reason: `No customer found for buildingId: ${input.buildingId}` };
      }

      // Find active Fixed Billing agreement for this customer
      const agreement = await FixedBillingAgreement.findOne({
        customerId: (customer as any).customerId,
        active: true,
      });
      if (!agreement) {
        return { triggered: false, reason: `No active Fixed Billing agreement for customerId: ${(customer as any).customerId}` };
      }

      const result = await triggerFixedBillingNotification(agreement, {
        pickupId: input.pickupId,
        pickupDate: new Date(input.pickupDate),
        binType: input.binType,
        binQuantity: input.binQuantity,
        lotCode: input.lotCode || (customer as any).lotCode || '',
      });

      return { triggered: true, customerId: (customer as any).customerId, result };
    }),

  // ═══════════════════════════════════════════════════════════════════════════
  // GAP 5: BULK UPLOAD — create multiple agreements from CSV data
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Bulk create Fixed Billing agreements from CSV row data.
   * The calling admin must specify the company scope first (independent or franchisor + optional franchisee).
   * Each row is validated; errors are returned per-row without aborting the whole batch.
   */
  bulkCreateAgreements: protectedProcedure
    .input(
      z.object({
        /** The company scope for this bulk upload */
        scopeCompanyId: z.string(),
        /** Optional: restrict to a specific franchisee when scopeCompanyId is a franchisor */
        scopeFranchiseeId: z.string().optional(),
        rows: z.array(
          z.object({
            customerId: z.string(),
            tariffCode: z.string(),
            binType: BinTypeEnum,
            frequency: FrequencyEnum,
            binsCount: z.number().int().min(1).default(1),
            agreedMonthlyPriceKobo: z.number().int().min(0),
            openingBalanceKobo: z.number().int().min(0).default(0),
            startDate: z.string(), // ISO date string from CSV
            notifyBySms: z.boolean().default(true),
            notifyByEmail: z.boolean().default(true),
            notes: z.string().optional(),
          })
        ).min(1).max(500),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const scopeCompany = await Company.findOne({ companyId: input.scopeCompanyId });
      if (!scopeCompany) throw new TRPCError({ code: 'NOT_FOUND', message: 'Scope company not found' });

      // Build allowed customer ID set for this scope
      const scopeFilter: Record<string, any> = { active: true };
      if (scopeCompany.companyType === 'franchisor') {
        if (input.scopeFranchiseeId) {
          scopeFilter.ownerCompanyId = input.scopeFranchiseeId;
        } else {
          const franchisees = await Company.find({ parentCompanyId: input.scopeCompanyId }, { companyId: 1 }).lean();
          const ids = franchisees.map((f: any) => f.companyId);
          scopeFilter.ownerCompanyId = { $in: [input.scopeCompanyId, ...ids] };
        }
      } else {
        scopeFilter.ownerCompanyId = input.scopeCompanyId;
      }

      const scopeCustomers = await Customer.find(scopeFilter).select('customerId customerName phone email lotCode ownerCompanyId ownerCompanyName').lean();
      const customerMap = new Map<string, any>();
      for (const c of scopeCustomers as any[]) customerMap.set(c.customerId, c);

      const results: Array<{ customerId: string; success: boolean; error?: string; agreementId?: string }> = [];

      for (const row of input.rows) {
        try {
          const customer = customerMap.get(row.customerId);
          if (!customer) {
            results.push({ customerId: row.customerId, success: false, error: 'Customer not found in scope' });
            continue;
          }

          // Check for existing active agreement
          const existing = await FixedBillingAgreement.findOne({ customerId: row.customerId, active: true });
          if (existing) {
            results.push({ customerId: row.customerId, success: false, error: 'Already has an active agreement' });
            continue;
          }

          // Look up tariff for official price
          const tariff = await TariffSchedule.findOne({ tariffCode: row.tariffCode, active: true });
          const officialMonthlyPriceKobo = tariff?.monthlyPriceKobo ?? row.agreedMonthlyPriceKobo;

          const agreement = await FixedBillingAgreement.create({
            customerId: customer.customerId,
            customerName: customer.customerName,
            customerPhone: customer.phone || '',
            customerEmail: customer.email || '',
            companyId: customer.ownerCompanyId,
            companyName: customer.ownerCompanyName,
            lotCode: customer.lotCode,
            tariffCode: row.tariffCode,
            binType: row.binType,
            frequency: row.frequency,
            binsCount: row.binsCount,
            officialMonthlyPriceKobo,
            agreedMonthlyPriceKobo: row.agreedMonthlyPriceKobo,
            openingBalanceKobo: row.openingBalanceKobo,
            startDate: new Date(row.startDate),
            notifyBySms: row.notifyBySms,
            notifyByEmail: row.notifyByEmail,
            notes: row.notes || '',
            active: true,
            createdBy: ctx.user?.id || 'bulk-admin',
          });

          results.push({ customerId: row.customerId, success: true, agreementId: agreement._id.toString() });
        } catch (err: any) {
          results.push({ customerId: row.customerId, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      return { successCount, failCount, results };
    }),

  handlePaystackWebhook: publicProcedure
    .input(
      z.object({
        reference: z.string(),
        amountKobo: z.number().int(),
        status: z.string(),
        metadata: z.record(z.string(), z.any()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (input.status !== 'success') return { recorded: false };
      if (!input.reference.startsWith('FB-')) return { recorded: false };

      const meta = input.metadata || {};
      const customerId: string = String(meta['customerId'] ?? '');
      const billingMonth: string = String(meta['currentBillingMonth'] ?? getCurrentBillingMonth().month);

      if (!customerId) return { recorded: false };

      const ledger = await recordLedgerPayment(
        customerId,
        billingMonth,
        input.amountKobo,
        input.reference,
        'paystack'
      );

      return { recorded: !!ledger };
    }),
});
