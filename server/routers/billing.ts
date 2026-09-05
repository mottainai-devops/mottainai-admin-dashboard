import { adminProcedure, router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import {
  getOverallStats,
  getCompanyBreakdown,
  getLotBreakdown,
  getMonthlyTrends,
  generateBillingCSV,
  getReconciliation,
} from '../services/billingAnalytics';
import { getMongoDb } from '../mongodb';

// ============================================================
// In-memory job store for batch reinvoice jobs
// ============================================================
interface BatchJob {
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
  dryRun: boolean;
  errors: Array<{ id: string; buildingId?: string; error: string }>;
}
const batchJobStore: Record<string, BatchJob> = {};

// ============================================================
// Paystack helpers — run entirely within this server
// ============================================================
function getPaystackToken(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set in dashboard environment');
  return key;
}

async function paystackRequest(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getPaystackToken()}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message || `Paystack ${res.status}`);
  return json.data;
}

/** Find or create a Paystack customer and return their customer_code */
async function getOrCreateCustomer(email: string, fullName: string, phone?: string): Promise<string> {
  // Normalise email — fall back to billing address
  const safeEmail = email && !email.includes('null') && email.includes('@')
    ? email.toLowerCase().trim()
    : 'billing@mottainai.africa';

  // Search for existing customer by email
  try {
    const existing = await paystackRequest('GET', `/customer/${encodeURIComponent(safeEmail)}`);
    if (existing?.customer_code) return existing.customer_code;
  } catch {
    // Not found — create below
  }

  const nameParts = (fullName || 'Unknown Customer').trim().split(/\s+/);
  const created = await paystackRequest('POST', '/customer', {
    first_name: nameParts[0] || fullName,
    last_name: nameParts.slice(1).join(' ') || nameParts[0],
    email: safeEmail,
    phone: phone || undefined,
  });
  return created.customer_code;
}

/** Create a Paystack payment request (invoice) for a single billing record */
async function createPaystackInvoice(opts: {
  customerCode: string;
  buildingId: string;
  nameBin: string;
  amount: number;   // in Naira (kobo conversion done here)
  quantity: number;
  splitCode?: string;
}): Promise<{ id: string; invoice_number: string; offline_reference: string }> {
  const { customerCode, buildingId, nameBin, amount, quantity, splitCode } = opts;
  const perUnitKobo = Math.round((amount / Math.max(quantity, 1)) * 100);
  const vatKobo = Math.round(amount * 0.075 * 100);

  const body: any = {
    customer: customerCode,
    description: `Waste Disposal Service — Customer ID: ${buildingId || 'N/A'}`,
    line_items: [
      { name: nameBin || 'Waste Disposal', amount: perUnitKobo, quantity: Math.max(quantity, 1) },
    ],
    tax: [{ name: 'VAT', amount: vatKobo }],
    send_notification: true,
    due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  };
  if (splitCode) body.split_code = splitCode;

  return await paystackRequest('POST', '/paymentrequest', body);
}

/** Sleep helper for rate limiting */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================
// Background batch processor
// ============================================================
async function processBatchInBackground(jobId: string, recordIds: string[], dryRun: boolean) {
  const job = batchJobStore[jobId];
  const db = await getMongoDb();
  const { ObjectId } = await import('mongodb');

  for (const recordId of recordIds) {
    let buildingId = '';
    try {
      // Fetch the billing record
      let oid: any;
      try { oid = new ObjectId(recordId); } catch { throw new Error('Invalid ObjectId'); }

      const record = await db.collection('monthlybilldatas').findOne({ _id: oid });
      if (!record) { job.skipped++; job.processed++; continue; }

      buildingId = record.buildingId || '';

      // Skip if already invoiced (idempotency guard)
      if (record.transcationId && record.transcationId !== '000') {
        job.skipped++;
        job.processed++;
        continue;
      }

      // Skip zero-amount records
      if (!record.amount || record.amount <= 0) {
        job.skipped++;
        job.processed++;
        continue;
      }

      if (dryRun) {
        // Dry run — just count as success without calling Paystack
        job.success++;
        job.processed++;
        continue;
      }

      // Fetch customer info
      const userId = record.userId;
      let customerName = 'Unknown Customer';
      let customerEmail = 'billing@mottainai.africa';
      let customerPhone: string | undefined;

      if (userId) {
        try {
          const custOid = new ObjectId(userId.toString());
          const cust = await db.collection('customerdatas').findOne({ _id: custOid });
          if (cust) {
            customerName = cust.fullName || 'Unknown Customer';
            customerEmail = cust.email || 'billing@mottainai.africa';
            customerPhone = cust.phone || undefined;
          }
        } catch { /* use defaults */ }
      }

      // Get or create Paystack customer
      const customerCode = await getOrCreateCustomer(customerEmail, customerName, customerPhone);

      // Create Paystack invoice
      const invoice = await createPaystackInvoice({
        customerCode,
        buildingId,
        nameBin: record.nameBin || 'Waste Disposal',
        amount: record.amount,
        quantity: record.quantity || 1,
        splitCode: record.splitCode || undefined,
      });

      // Update the billing record with the invoice ID
      await db.collection('monthlybilldatas').updateOne(
        { _id: oid },
        { $set: { transcationId: String(invoice.id), updatedAt: new Date() } }
      );

      job.success++;
      job.processed++;

      // Rate limit: ~1 invoice per 1.5 seconds
      await sleep(1500);

    } catch (err: any) {
      job.failed++;
      job.processed++;
      job.errors.push({ id: recordId, buildingId, error: err.message || String(err) });
    }
  }

  job.status = 'completed';
}

// ============================================================
// Router
// ============================================================
export const billingRouter = router({
  // Get overall billing statistics
  getStats: publicProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const startDate = input?.startDate ? new Date(input.startDate) : undefined;
      const endDate = input?.endDate ? new Date(input.endDate) : undefined;
      return await getOverallStats(startDate, endDate);
    }),

  getCompanyBreakdown: publicProcedure.query(async () => {
    return await getCompanyBreakdown();
  }),

  getLotBreakdown: publicProcedure.query(async () => {
    return await getLotBreakdown();
  }),

  getMonthlyTrends: publicProcedure.query(async () => {
    return await getMonthlyTrends();
  }),

  exportCompanyCSV: adminProcedure.query(async () => {
    const data = await getCompanyBreakdown();
    const csv = generateBillingCSV(data);
    return { csv };
  }),

  exportLotCSV: adminProcedure.query(async () => {
    const data = await getLotBreakdown();
    const csv = generateBillingCSV(data);
    return { csv };
  }),

  getReconciliation: adminProcedure
    .input(
      z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
        status: z.enum(['paid', 'invoiced', 'yet_to_bill', 'not_billed', 'free', 'all']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        buildingId: z.string().optional(),
        lotCode: z.string().optional(),
        billingType: z.enum(['payt', 'monthly', 'all']).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      return await getReconciliation({
        page: input?.page,
        limit: input?.limit,
        status: input?.status,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        buildingId: input?.buildingId,
        lotCode: input?.lotCode,
        billingType: input?.billingType,
      });
    }),

  exportReconciliationCSV: adminProcedure
    .input(
      z.object({
        status: z.enum(['paid', 'invoiced', 'yet_to_bill', 'not_billed', 'free', 'all']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        buildingId: z.string().optional(),
        lotCode: z.string().optional(),
        billingType: z.enum(['payt', 'monthly', 'all']).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const result = await getReconciliation({
        page: 1,
        limit: 10000,
        status: input?.status,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        buildingId: input?.buildingId,
        lotCode: input?.lotCode,
        billingType: input?.billingType,
      });
      const csvData = result.records.map((r: any) => ({
        customerId: r.buildingId, // MCU Customer ID
        buildingId: r.buildingId,
        customerType: r.customerType,
        binType: r.binType,
        binQuantity: r.binQuantity,
        pickupAmount: r.amount || 0,
        pickupDate: r.pickUpDate,
        billingStatus: r.billingStatus,
        billingAmount: r.billingRecord?.amount || 0,
        paystackInvoiceId: r.billingRecord?.transcationId || '',
        zohoInvoiceId: r.billingRecord?.quickbookInvoices || '',
        paidAt: r.billingRecord?.paidAt || '',
        createdAt: r.createdAt,
      }));
      const csv = generateBillingCSV(csvData);
      return { csv };
    }),

  // ============================================================
  // BATCH RE-INVOICING — runs entirely within this server
  // ============================================================

  /** Preview yet-to-bill records (paginated, with filters) */
  getBatchReinvoicePreview: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(200).default(50),
        splitCode: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getMongoDb();
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const skip = (page - 1) * limit;

      const query: any = { transcationId: '000', amount: { $gt: 0 } };
      if (input?.splitCode) query.splitCode = input.splitCode;
      if (input?.dateFrom || input?.dateTo) {
        query.createdAt = {};
        if (input?.dateFrom) query.createdAt.$gte = new Date(input.dateFrom);
        if (input?.dateTo) query.createdAt.$lte = new Date(input.dateTo);
      }

      const total = await db.collection('monthlybilldatas').countDocuments(query);
      const records = await db.collection('monthlybilldatas')
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .toArray();

      // Enrich with customer data
      const { ObjectId } = await import('mongodb');
      const userIds = [...new Set(records.map((r: any) => r.userId).filter(Boolean))];
      const validObjectIds = userIds.filter((id: any) => {
        try { new ObjectId(id); return true; } catch { return false; }
      });
      const customers = validObjectIds.length > 0
        ? await db.collection('customerdatas')
            .find({ _id: { $in: validObjectIds.map((id: any) => new ObjectId(id)) } })
            .toArray()
        : [];
      const custMap: Record<string, any> = {};
      customers.forEach((c: any) => { custMap[c._id.toString()] = c; });

      const enriched = records.map((r: any) => {
        const cust = custMap[r.userId?.toString()] || null;
        const email = cust?.email || null;
        const phone = cust?.phone || null;
        return {
          _id: r._id.toString(),
          buildingId: r.buildingId,
          amount: r.amount,
          quantity: r.quantity,
          nameBin: r.nameBin,
          splitCode: r.splitCode,
          createdAt: r.createdAt,
          isMonthly: r.isMonthly,
          customerName: cust?.fullName || 'Unknown',
          customerEmail: email,
          customerPhone: phone,
          hasValidEmail: !!(email && !email.includes('null') && email.includes('@')),
          hasValidPhone: !!(phone && phone.length >= 7),
        };
      });

      // Unique split codes for filter dropdown
      const splitCodes = await db.collection('monthlybilldatas').distinct('splitCode', {
        transcationId: '000', amount: { $gt: 0 }
      });

      // Total amount for current filter
      const amountAgg = await db.collection('monthlybilldatas').aggregate([
        { $match: query },
        { $group: { _id: null, totalAmount: { $sum: '$amount' } } }
      ]).toArray();
      const totalAmount = amountAgg[0]?.totalAmount || 0;

      return {
        total,
        totalAmount,
        page,
        pages: Math.ceil(total / limit),
        records: enriched,
        splitCodes: (splitCodes as string[]).filter(Boolean).sort(),
      };
    }),

  /** Get status of a batch job by jobId */
  getBatchJobStatus: adminProcedure
    .input(z.object({ jobId: z.string() }))
    .query(({ input }) => {
      const job = batchJobStore[input.jobId];
      if (!job) return { found: false, job: null };
      return { found: true, job };
    }),

  /** Trigger a batch reinvoice job — processes entirely within this server */
  triggerBatchReinvoice: adminProcedure
    .input(
      z.object({
        recordIds: z.array(z.string()).min(1).max(100),
        dryRun: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const jobId = `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Initialise job record
      batchJobStore[jobId] = {
        status: 'running',
        startedAt: new Date(),
        total: input.recordIds.length,
        processed: 0,
        success: 0,
        failed: 0,
        skipped: 0,
        dryRun: input.dryRun,
        errors: [],
      };

      // Fire-and-forget background processing
      processBatchInBackground(jobId, input.recordIds, input.dryRun).catch(err => {
        const job = batchJobStore[jobId];
        if (job) {
          job.status = 'failed';
          job.errors.push({ id: 'system', error: err.message });
        }
      });

      return {
        success: true,
        jobId,
        total: input.recordIds.length,
        dryRun: input.dryRun,
        message: input.dryRun
          ? `Dry run started for ${input.recordIds.length} records`
          : `Batch job started for ${input.recordIds.length} records`,
      };
    }),

  // ============================================================
  // MONTHLY BILLING MANAGEMENT (Gap 6)
  // ============================================================

  /**
   * List Monthly Billing records (isMonthly: true) with filters.
   * Used by the new Monthly Billing Management page in the admin dashboard.
   */
  listMonthlyBillingRecords: adminProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(200).default(50),
        splitCode: z.string().optional(),
        month: z.string().optional(),       // e.g. "2024-11"
        status: z.enum(['paid', 'invoiced', 'yet_to_bill', 'all']).default('all'),
        buildingId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const db = await getMongoDb();
      const page = input?.page ?? 1;
      const limit = input?.limit ?? 50;
      const skip = (page - 1) * limit;

      // Only Monthly Billing records
      const query: any = { isMonthly: true };
      if (input?.splitCode) query.splitCode = input.splitCode;
      if (input?.buildingId) query.buildingId = { $regex: input.buildingId, $options: 'i' };
      if (input?.month) query.month = input.month;
      if (input?.dateFrom || input?.dateTo) {
        query.createdAt = {};
        if (input?.dateFrom) query.createdAt.$gte = new Date(input.dateFrom);
        if (input?.dateTo) query.createdAt.$lte = new Date(input.dateTo);
      }
      // Status filter
      if (input?.status === 'paid') {
        query.status = 'true';
        query.transcationId = { $nin: ['000', '', null] };
      } else if (input?.status === 'invoiced') {
        query.status = { $ne: 'true' };
        query.transcationId = { $nin: ['000', '', null] };
      } else if (input?.status === 'yet_to_bill') {
        query.transcationId = { $in: ['000', ''] };
      }

      const [total, records] = await Promise.all([
        db.collection('monthlybilldatas').countDocuments(query),
        db.collection('monthlybilldatas')
          .find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .toArray(),
      ]);

      // Enrich with customer names
      const { ObjectId } = await import('mongodb');
      const userIds = [...new Set(records.map((r: any) => r.userId).filter(Boolean))];
      const validObjectIds = userIds.filter((id: any) => {
        try { new ObjectId(id); return true; } catch { return false; }
      });
      const customers = validObjectIds.length > 0
        ? await db.collection('customerdatas')
            .find({ _id: { $in: validObjectIds.map((id: any) => new ObjectId(id)) } })
            .toArray()
        : [];
      const custMap: Record<string, any> = {};
      customers.forEach((c: any) => { custMap[c._id.toString()] = c; });

      const enriched = records.map((r: any) => {
        const cust = custMap[r.userId?.toString()] || null;
        const txnId = r.transcationId;
        let billingStatus: string;
        if (!txnId || txnId === '000' || txnId === '') billingStatus = 'yet_to_bill';
        else if (r.status === 'true' || r.status === true) billingStatus = 'paid';
        else billingStatus = 'invoiced';
        return {
          _id: r._id.toString(),
          buildingId: r.buildingId,
          userId: r.userId,
          month: r.month,
          amount: r.amount,
          quantity: r.quantity,
          nameBin: r.nameBin,
          splitCode: r.splitCode,
          transcationId: txnId,
          status: r.status,
          billingStatus,
          quickbookInvoices: r.quickbookInvoices,
          createdAt: r.createdAt,
          customerName: cust?.fullName || 'Unknown',
          customerEmail: cust?.email || null,
          customerPhone: cust?.phone || null,
        };
      });

      // Distinct split codes and months for filter dropdowns
      const [splitCodes, months] = await Promise.all([
        db.collection('monthlybilldatas').distinct('splitCode', { isMonthly: true }),
        db.collection('monthlybilldatas').distinct('month', { isMonthly: true }),
      ]);

      // Summary stats for current filter
      const summaryAgg = await db.collection('monthlybilldatas').aggregate([
        { $match: { isMonthly: true, ...(input?.splitCode ? { splitCode: input.splitCode } : {}), ...(input?.month ? { month: input.month } : {}) } },
        { $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          paidAmount: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'true'] }, { $not: { $in: ['$transcationId', ['000', '']] } }] }, '$amount', 0] } },
          paidCount: { $sum: { $cond: [{ $and: [{ $eq: ['$status', 'true'] }, { $not: { $in: ['$transcationId', ['000', '']] } }] }, 1, 0] } },
          yetToBillCount: { $sum: { $cond: [{ $in: ['$transcationId', ['000', '']] }, 1, 0] } },
          yetToBillAmount: { $sum: { $cond: [{ $in: ['$transcationId', ['000', '']] }, '$amount', 0] } },
          invoicedCount: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'true'] }, { $not: { $in: ['$transcationId', ['000', '']] } }] }, 1, 0] } },
          invoicedAmount: { $sum: { $cond: [{ $and: [{ $ne: ['$status', 'true'] }, { $not: { $in: ['$transcationId', ['000', '']] } }] }, '$amount', 0] } },
        }}
      ]).toArray();
      const summary = summaryAgg[0] || { totalAmount: 0, paidAmount: 0, paidCount: 0, yetToBillCount: 0, yetToBillAmount: 0, invoicedCount: 0, invoicedAmount: 0 };

      return {
        total,
        pages: Math.ceil(total / limit),
        page,
        records: enriched,
        splitCodes: (splitCodes as string[]).filter(Boolean).sort(),
        months: (months as string[]).filter(Boolean).sort().reverse(),
        summary,
      };
    }),
});
