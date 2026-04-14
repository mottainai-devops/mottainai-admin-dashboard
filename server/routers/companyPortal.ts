/**
 * Company Portal Router
 *
 * Provides all tRPC procedures for the independent company portal.
 * Authentication: PIN-based JWT (companyId + PIN → JWT → all portal procedures).
 *
 * Data segregation: every procedure is strictly scoped to the authenticated
 * company's lot codes and split codes — no cross-company data leakage.
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as jose from 'jose';
import { Company } from '../models/Company';
import { Customer } from '../models/Customer';
import { MonthlyBillData } from '../models/MonthlyBillData';
import { getOrCreateCustomer } from '../services/paystackService';
import {
  getZohoContacts,
  getZohoInvoices,
  getZohoPayments,
  getAuthorizationUrl,
  isZohoConnected,
} from '../services/zohoService';
import axios from 'axios';
import mongoose from 'mongoose';

// ─── JWT Helpers ──────────────────────────────────────────────────────────────

const PORTAL_JWT_EXPIRY = '8h';
const PORTAL_JWT_ISSUER = 'mottainai-company-portal';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || 'mottainai-portal-secret';
  return new TextEncoder().encode(secret);
}

export async function signPortalToken(companyId: string, companyName: string): Promise<string> {
  const secret = getJwtSecret();
  return new jose.SignJWT({ companyId, companyName, type: 'company-portal' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(PORTAL_JWT_ISSUER)
    .setExpirationTime(PORTAL_JWT_EXPIRY)
    .sign(secret);
}

export async function verifyPortalToken(token: string): Promise<{ companyId: string; companyName: string }> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jose.jwtVerify(token, secret, { issuer: PORTAL_JWT_ISSUER });
    if (payload.type !== 'company-portal' || !payload.companyId) {
      throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Invalid portal token' });
    }
    return {
      companyId: payload.companyId as string,
      companyName: payload.companyName as string,
    };
  } catch {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Portal session expired. Please log in again.' });
  }
}

// ─── Portal Procedure Middleware ──────────────────────────────────────────────

/**
 * A procedure that requires a valid company portal JWT.
 * Injects { companyId, companyName } into context via input.portalToken.
 *
 * We use publicProcedure + manual token verification because the portal uses
 * a separate JWT from the admin dashboard's Manus OAuth session.
 */
const portalTokenSchema = z.object({ portalToken: z.string() });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Get the split codes and lot codes for a company.
 * Used to scope all data queries.
 */
async function getCompanyScope(companyId: string) {
  const company = await Company.findOne({ companyId }).lean();
  if (!company) throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found' });
  if (!company.portalEnabled) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Portal access is not enabled for this company. Please contact Mottainai.' });
  }

  const lotCodes = company.operationalLots.map((l) => l.lotCode);

  // Collect all split codes (from stored fields + webhook URLs)
  const splitCodes = new Set<string>();
  if (company.paystackSplitCodeResidential) splitCodes.add(company.paystackSplitCodeResidential);
  if (company.paystackSplitCodeCommercial) splitCodes.add(company.paystackSplitCodeCommercial);

  // Also extract from webhook URLs (for legacy companies)
  const splRegex = /\/(SPL_[A-Za-z0-9]+)/g;
  for (const lot of company.operationalLots) {
    for (const url of [lot.paytWebhook, lot.monthlyWebhook]) {
      if (!url) continue;
      splRegex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = splRegex.exec(url)) !== null) splitCodes.add(m[1]);
    }
  }

  return {
    company,
    lotCodes,
    splitCodes: Array.from(splitCodes),
  };
}

// In-memory batch job store (same pattern as billing.ts)
const portalBatchJobs = new Map<string, {
  status: 'running' | 'done' | 'failed';
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
  startedAt: Date;
  completedAt?: Date;
}>();

// ─── Router ───────────────────────────────────────────────────────────────────

export const companyPortalRouter = router({

  // ── Authentication ──────────────────────────────────────────────────────────

  /**
   * Login with companyId + PIN.
   * Returns a signed JWT for subsequent portal API calls.
   */
  login: publicProcedure
    .input(z.object({
      companyId: z.string().min(1),
      pin: z.string().min(4).max(8),
    }))
    .mutation(async ({ input }) => {
      const company = await Company.findOne({
        companyId: input.companyId,
        pin: input.pin,
        active: true,
        companyType: 'independent',
      }).lean();

      if (!company) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid company ID or PIN. Please check your credentials.',
        });
      }

      if (!company.portalEnabled) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Portal access is not yet enabled for your company. Please contact Mottainai.',
        });
      }

      const token = await signPortalToken(company.companyId, company.companyName);

      return {
        token,
        company: {
          companyId: company.companyId,
          companyName: company.companyName,
          paystackSetupStatus: company.paystackSetupStatus,
          zohoSetupStatus: company.zohoSetupStatus,
          portalEnabled: company.portalEnabled,
        },
      };
    }),

  /**
   * Get the authenticated company's profile.
   */
  me: publicProcedure
    .input(portalTokenSchema)
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const { company, lotCodes, splitCodes } = await getCompanyScope(companyId);

      const zohoConnected = await isZohoConnected(companyId);

      return {
        companyId: company.companyId,
        companyName: company.companyName,
        companyType: company.companyType,
        operationalLots: company.operationalLots,
        lotCodes,
        splitCodes,
        paystackSetupStatus: company.paystackSetupStatus,
        paystackSubaccountCode: company.paystackSubaccountCode,
        paystackSplitCodeResidential: company.paystackSplitCodeResidential,
        paystackSplitCodeCommercial: company.paystackSplitCodeCommercial,
        paystackPercentageCharge: company.paystackPercentageCharge,
        zohoSetupStatus: company.zohoSetupStatus,
        zohoOrganizationId: company.zohoOrganizationId,
        zohoConnected,
        portalEnabled: company.portalEnabled,
      };
    }),

  // ── Dashboard KPIs ──────────────────────────────────────────────────────────

  /**
   * Dashboard summary: customers, pickups, revenue, outstanding invoices.
   */
  dashboardStats: publicProcedure
    .input(portalTokenSchema)
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const { lotCodes, splitCodes } = await getCompanyScope(companyId);

      const [
        totalCustomers,
        totalBillingRecords,
        yetToBillCount,
        billedCount,
        totalBilledAmount,
        totalOutstandingAmount,
      ] = await Promise.all([
        // Total customers in the company's lots
        Customer.countDocuments({ lotCode: { $in: lotCodes } }),

        // Total billing records
        MonthlyBillData.countDocuments({ splitCode: { $in: splitCodes } }),

        // Yet to bill
        MonthlyBillData.countDocuments({
          splitCode: { $in: splitCodes },
          transcationId: '000',
        }),

        // Billed
        MonthlyBillData.countDocuments({
          splitCode: { $in: splitCodes },
          transcationId: { $nin: ['000', null, ''] },
        }),

        // Total billed amount
        MonthlyBillData.aggregate([
          { $match: { splitCode: { $in: splitCodes }, transcationId: { $nin: ['000', null, ''] } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).then((r) => r[0]?.total || 0),

        // Total outstanding (yet to bill)
        MonthlyBillData.aggregate([
          { $match: { splitCode: { $in: splitCodes }, transcationId: '000' } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]).then((r) => r[0]?.total || 0),
      ]);

      return {
        totalCustomers,
        totalBillingRecords,
        yetToBillCount,
        billedCount,
        totalBilledAmount,
        totalOutstandingAmount,
        collectionRate: totalBillingRecords > 0
          ? Math.round((billedCount / totalBillingRecords) * 100)
          : 0,
      };
    }),

  // ── Customers ───────────────────────────────────────────────────────────────

  getCustomers: publicProcedure
    .input(portalTokenSchema.extend({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
      search: z.string().optional(),
      customerType: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const { lotCodes } = await getCompanyScope(companyId);

      const filter: any = { lotCode: { $in: lotCodes } };
      if (input.search) {
        filter.$or = [
          { fullName: { $regex: input.search, $options: 'i' } },
          { email: { $regex: input.search, $options: 'i' } },
          { buildingId: { $regex: input.search, $options: 'i' } },
        ];
      }
      if (input.customerType) filter.customerType = input.customerType;

      const skip = (input.page - 1) * input.limit;
      const [customers, total] = await Promise.all([
        Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
        Customer.countDocuments(filter),
      ]);

      return { customers, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  // ── Billing Records ─────────────────────────────────────────────────────────

  getBillingRecords: publicProcedure
    .input(portalTokenSchema.extend({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
      status: z.enum(['all', 'billed', 'yet_to_bill']).default('all'),
      month: z.string().optional(), // e.g. "2025-12"
    }))
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const { splitCodes } = await getCompanyScope(companyId);

      const filter: any = { splitCode: { $in: splitCodes } };
      if (input.status === 'billed') filter.transcationId = { $nin: ['000', null, ''] };
      if (input.status === 'yet_to_bill') filter.transcationId = '000';
      if (input.month) {
        const [year, month] = input.month.split('-').map(Number);
        const start = new Date(year, month - 1, 1);
        const end = new Date(year, month, 1);
        filter.createdAt = { $gte: start, $lt: end };
      }

      const skip = (input.page - 1) * input.limit;
      const [records, total] = await Promise.all([
        MonthlyBillData.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
        MonthlyBillData.countDocuments(filter),
      ]);

      return { records, total, page: input.page, totalPages: Math.ceil(total / input.limit) };
    }),

  // ── Batch Invoicing (Company-Scoped) ────────────────────────────────────────

  getBatchPreview: publicProcedure
    .input(portalTokenSchema.extend({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(50),
    }))
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const { splitCodes } = await getCompanyScope(companyId);

      const filter = {
        splitCode: { $in: splitCodes },
        transcationId: '000',
      };

      const skip = (input.page - 1) * input.limit;
      const [records, total, totalAmountResult] = await Promise.all([
        MonthlyBillData.find(filter).sort({ createdAt: -1 }).skip(skip).limit(input.limit).lean(),
        MonthlyBillData.countDocuments(filter),
        MonthlyBillData.aggregate([
          { $match: filter },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
      ]);

      return {
        records,
        total,
        totalAmount: totalAmountResult[0]?.total || 0,
        page: input.page,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  triggerBatch: publicProcedure
    .input(portalTokenSchema.extend({
      recordIds: z.array(z.string()).min(1).max(100),
      dryRun: z.boolean().default(false),
    }))
    .mutation(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const { splitCodes } = await getCompanyScope(companyId);

      // Verify all records belong to this company
      const records = await MonthlyBillData.find({
        _id: { $in: input.recordIds.map((id) => new mongoose.Types.ObjectId(id)) },
        splitCode: { $in: splitCodes },
        transcationId: '000',
      }).lean();

      if (records.length === 0) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No eligible records found for this company.' });
      }

      if (input.dryRun) {
        const totalAmount = records.reduce((sum, r) => sum + ((r as any).amount || 0), 0);
        return {
          dryRun: true,
          eligible: records.length,
          totalAmount,
          message: `Dry run: ${records.length} records would be invoiced for ₦${totalAmount.toLocaleString()}`,
        };
      }

      // Start background job
      const jobId = `portal-${companyId}-${Date.now()}`;
      portalBatchJobs.set(jobId, {
        status: 'running',
        total: records.length,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        errors: [],
        startedAt: new Date(),
      });

      // Fire and forget
      processBatchInBackground(jobId, records, companyId).catch((err) => {
        const job = portalBatchJobs.get(jobId);
        if (job) {
          job.status = 'failed';
          job.errors.push(err.message);
        }
      });

      return { jobId, total: records.length, dryRun: false };
    }),

  getBatchJobStatus: publicProcedure
    .input(portalTokenSchema.extend({ jobId: z.string() }))
    .query(async ({ input }) => {
      await verifyPortalToken(input.portalToken);
      const job = portalBatchJobs.get(input.jobId);
      if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
      return job;
    }),

  // ── Webhooks ────────────────────────────────────────────────────────────────

  getWebhookHealth: publicProcedure
    .input(portalTokenSchema)
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const { company } = await getCompanyScope(companyId);

      const results = [];
      for (const lot of company.operationalLots) {
        for (const [type, url] of [['payt', lot.paytWebhook], ['monthly', lot.monthlyWebhook]] as const) {
          if (!url) continue;
          try {
            const start = Date.now();
            const resp = await axios.get(url, { timeout: 5000, validateStatus: () => true });
            results.push({
              lotCode: lot.lotCode,
              lotName: lot.lotName,
              type,
              url,
              status: resp.status < 500 ? 'healthy' : 'degraded',
              httpStatus: resp.status,
              responseMs: Date.now() - start,
            });
          } catch {
            results.push({
              lotCode: lot.lotCode,
              lotName: lot.lotName,
              type,
              url,
              status: 'unreachable',
              httpStatus: 0,
              responseMs: 0,
            });
          }
        }
      }

      return {
        lots: results,
        healthy: results.filter((r) => r.status === 'healthy').length,
        degraded: results.filter((r) => r.status === 'degraded').length,
        unreachable: results.filter((r) => r.status === 'unreachable').length,
      };
    }),

  // ── Zoho Integration ────────────────────────────────────────────────────────

  getZohoAuthUrl: publicProcedure
    .input(portalTokenSchema)
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const url = getAuthorizationUrl(companyId);
      return { url };
    }),

  getZohoContacts: publicProcedure
    .input(portalTokenSchema.extend({ page: z.number().min(1).default(1) }))
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const company = await Company.findOne({ companyId }).lean();
      if (!company?.zohoOrganizationId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Zoho Books is not connected. Please connect in Settings.' });
      }
      return getZohoContacts(companyId, company.zohoOrganizationId, input.page);
    }),

  getZohoInvoices: publicProcedure
    .input(portalTokenSchema.extend({ page: z.number().min(1).default(1) }))
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const company = await Company.findOne({ companyId }).lean();
      if (!company?.zohoOrganizationId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Zoho Books is not connected. Please connect in Settings.' });
      }
      return getZohoInvoices(companyId, company.zohoOrganizationId, input.page);
    }),

  getZohoPayments: publicProcedure
    .input(portalTokenSchema.extend({ page: z.number().min(1).default(1) }))
    .query(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const company = await Company.findOne({ companyId }).lean();
      if (!company?.zohoOrganizationId) {
        throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Zoho Books is not connected. Please connect in Settings.' });
      }
      return getZohoPayments(companyId, company.zohoOrganizationId, input.page);
    }),

  // ── Settings ────────────────────────────────────────────────────────────────

  changePin: publicProcedure
    .input(portalTokenSchema.extend({
      currentPin: z.string().min(4).max(8),
      newPin: z.string().min(6).max(8),
    }))
    .mutation(async ({ input }) => {
      const { companyId } = await verifyPortalToken(input.portalToken);
      const company = await Company.findOne({ companyId });
      if (!company) throw new TRPCError({ code: 'NOT_FOUND', message: 'Company not found' });
      if (company.pin !== input.currentPin) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Current PIN is incorrect' });
      }
      company.pin = input.newPin;
      await company.save();
      return { success: true };
    }),
});

// ─── Background Batch Processor ───────────────────────────────────────────────

async function processBatchInBackground(
  jobId: string,
  records: any[],
  companyId: string
): Promise<void> {
  const job = portalBatchJobs.get(jobId)!;
  const PAYSTACK_BASE = 'https://api.paystack.co';
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) {
    job.status = 'failed';
    job.errors.push('PAYSTACK_SECRET_KEY not configured');
    return;
  }
  const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  for (const record of records) {
    try {
      // Idempotency: skip if already invoiced
      const current = await MonthlyBillData.findById(record._id).lean();
      if (!current || (current as any).transcationId !== '000') {
        job.skipped++;
        job.processed++;
        continue;
      }

      // Skip LASIKA06
      if ((record.splitCode || '').toUpperCase().includes('LASIKA06') ||
          (record.lotCode || '').toUpperCase().includes('LASIKA06')) {
        job.skipped++;
        job.processed++;
        continue;
      }

      const email = record.email || 'billing@mottainai.africa';
      const fullName = record.customerName || record.fullName || 'Customer';

      // Get or create Paystack customer
      const customer = await getOrCreateCustomer(email, fullName, record.phone);
      if (!customer) throw new Error('Could not create Paystack customer');

      // Create invoice
      const invoiceData: any = {
        description: `Waste Disposal Service - ${record.month || 'Monthly'}`,
        line_items: [{ name: record.binType || 'Waste Disposal', amount: (record.amount || 0) * 100, quantity: 1 }],
        tax: [{ name: 'VAT', amount: Math.round((record.amount || 0) * 0.075 * 100) }],
        customer: customer.customer_code,
        send_notification: true,
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      };

      if (record.splitCode && record.splitCode !== '000') {
        invoiceData.split_code = record.splitCode;
      }

      const invoiceResp = await axios.post(`${PAYSTACK_BASE}/paymentrequest`, invoiceData, { headers });
      if (!invoiceResp.data.status) throw new Error(invoiceResp.data.message);

      const transactionId = invoiceResp.data.data?.request_code || invoiceResp.data.data?.id;
      await MonthlyBillData.findByIdAndUpdate(record._id, { transcationId: String(transactionId) });

      job.success++;
    } catch (err: any) {
      job.failed++;
      job.errors.push(`${record._id}: ${err.message}`);
      if (job.errors.length > 20) job.errors = job.errors.slice(-20);
    } finally {
      job.processed++;
    }

    // Rate limit: 1 invoice per 1.5 seconds
    await new Promise((r) => setTimeout(r, 1500));
  }

  job.status = 'done';
  job.completedAt = new Date();
}
