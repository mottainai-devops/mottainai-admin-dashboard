import { adminProcedure, fieldSchedulerServiceProcedure, protectedProcedure, router } from '../_core/trpc';
import { User } from '../models/User';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { listAccessibleLots, listLotsForFieldScheduler } from '../services/lotAccess';

const clientLotInput = z.object({
  search: z.string().trim().min(1).max(128).optional(),
}).optional();

/**
 * Operational lots are resolved from a verified Survey identity. The prior
 * caller-supplied userId and public companyId fallback are intentionally gone.
 */
export const lotsRouter = router({
  list: protectedProcedure
    .input(clientLotInput)
    .query(async ({ input, ctx }) => {
      const user = await User.findById(ctx.user._id);
      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authenticated Survey user not found' });
      }
      const search = input?.search?.toLowerCase();
      const lots = (await listAccessibleLots(user)).filter(lot =>
        !search || lot.lotCode.toLowerCase().includes(search) || lot.lotName.toLowerCase().includes(search),
      );
      return {
        lots,
        totalCount: lots.length,
        userRole: user.role,
        userCompanyId: user.companyId,
        message: 'Showing operational lots authorized for the signed-in user',
      };
    }),

  validateAccess: protectedProcedure
    .input(z.object({
      lotCode: z.string().trim().min(1).max(128),
      companyId: z.string().trim().min(1).max(128),
    }))
    .query(async ({ input, ctx }) => {
      const user = await User.findById(ctx.user._id);
      if (!user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Authenticated Survey user not found' });
      }
      const hasAccess = (await listAccessibleLots(user)).some(
        lot => lot.companyId === input.companyId && lot.lotCode === input.lotCode,
      );
      return {
        hasAccess,
        reason: hasAccess ? 'Authorized for selected operational lot' : 'Lot is not authorized for this user',
      };
    }),

  /** Field Scheduler only; fails closed until its explicit service token exists. */
  lookupForFieldScheduler: fieldSchedulerServiceProcedure
    .input(z.object({
      companyId: z.string().trim().min(1).max(128),
      search: z.string().trim().min(1).max(128).optional(),
    }))
    .query(async ({ input }) => {
      const lots = await listLotsForFieldScheduler(input.companyId, input.search);
      return { lots, totalCount: lots.length };
    }),

  /** Dashboard administration retains a separately authorized all-company view. */
  adminList: adminProcedure
    .input(z.object({
      companyId: z.string().trim().min(1).max(128).optional(),
      search: z.string().trim().min(1).max(128).optional(),
    }).optional())
    .query(async ({ input }) => {
      const { Company } = await import('../models/Company');
      const companies = await Company.find({ active: true })
        .select('_id companyName operationalLots')
        .lean();
      const search = input?.search?.toLowerCase();
      const lots = companies
        .flatMap(company => company.operationalLots.map(lot => ({
          id: `${company._id}_${lot.lotCode}`,
          lotCode: lot.lotCode,
          lotName: lot.lotName,
          paytWebhook: lot.paytWebhook,
          monthlyWebhook: lot.monthlyWebhook,
          companyId: company._id.toString(),
          companyName: company.companyName,
        })))
        .filter(lot =>
          (!input?.companyId || lot.companyId === input.companyId) &&
          (!search || lot.lotCode.toLowerCase().includes(search) || lot.lotName.toLowerCase().includes(search)),
        );
      return { lots, totalCount: lots.length };
    }),

  /** The all-company assignment map is dashboard-admin only. */
  assignments: adminProcedure.query(async () => {
    const { Company } = await import('../models/Company');
    const companies = await Company.find({ active: true })
      .select('companyName operationalLots')
      .sort({ companyName: 1 });
    return {
      companies: companies.map(company => ({
        id: company._id.toString(),
        name: company.companyName,
        lotCount: company.operationalLots.length,
        lots: company.operationalLots.map(lot => ({ lotCode: lot.lotCode, lotName: lot.lotName })),
      })),
      totalCompanies: companies.length,
      totalLots: companies.reduce((sum, company) => sum + company.operationalLots.length, 0),
    };
  }),
});
