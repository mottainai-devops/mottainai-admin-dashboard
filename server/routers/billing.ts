import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import {
  getOverallStats,
  getCompanyBreakdown,
  getLotBreakdown,
  getMonthlyTrends,
  generateBillingCSV,
  getReconciliation,
} from '../services/billingAnalytics';
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
  // Get company-wise revenue breakdown
  getCompanyBreakdown: publicProcedure.query(async () => {
    return await getCompanyBreakdown();
  }),
  // Get lot-wise revenue breakdown
  getLotBreakdown: publicProcedure.query(async () => {
    return await getLotBreakdown();
  }),
  // Get monthly revenue trends
  getMonthlyTrends: publicProcedure.query(async () => {
    return await getMonthlyTrends();
  }),
  // Export company breakdown as CSV
  exportCompanyCSV: publicProcedure.query(async () => {
    const data = await getCompanyBreakdown();
    const csv = generateBillingCSV(data);
    return { csv };
  }),
  // Export lot breakdown as CSV
  exportLotCSV: publicProcedure.query(async () => {
    const data = await getLotBreakdown();
    const csv = generateBillingCSV(data);
    return { csv };
  }),
  // Billing reconciliation: per-pickup billing status view
  // Returns summary counts + paginated records with status:
  //   paid | invoiced | yet_to_bill | not_billed | free
  getReconciliation: publicProcedure
    .input(
      z.object({
        page: z.number().optional(),
        limit: z.number().optional(),
        status: z.enum(['paid', 'invoiced', 'yet_to_bill', 'not_billed', 'free', 'all']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        buildingId: z.string().optional(),
        lotCode: z.string().optional(),
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
      });
    }),
  // Export reconciliation as CSV
  exportReconciliationCSV: publicProcedure
    .input(
      z.object({
        status: z.enum(['paid', 'invoiced', 'yet_to_bill', 'not_billed', 'free', 'all']).optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        buildingId: z.string().optional(),
        lotCode: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      const result = await getReconciliation({
        page: 1,
        limit: 10000, // export all
        status: input?.status,
        startDate: input?.startDate ? new Date(input.startDate) : undefined,
        endDate: input?.endDate ? new Date(input.endDate) : undefined,
        buildingId: input?.buildingId,
        lotCode: input?.lotCode,
      });
      const csvData = result.records.map((r: any) => ({
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
});
