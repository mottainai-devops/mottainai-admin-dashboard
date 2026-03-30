import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import {
  getOverallStats,
  getCompanyBreakdown,
  getLotBreakdown,
  getMonthlyTrends,
  generateBillingCSV,
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
});
