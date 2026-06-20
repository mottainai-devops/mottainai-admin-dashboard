import { router, publicProcedure } from '../_core/trpc';
import { Company } from '../models/Company';
import { User } from '../models/User';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';

/**
 * Lots Router
 * Handles operational lot fetching with role-based filtering
 * 
 * Access Rules:
 * - Regular users: Only see lots from their assigned company
 * - Cherry pickers: See all lots from all companies
 * - Admins: See all lots from all companies
 */
export const lotsRouter = router({
  /**
   * List operational lots based on user role and company assignment
   * 
   * Authorization:
   * - Requires userId in request
   * - Regular users get filtered by companyId
   * - Cherry pickers and admins get all lots
   */
  list: publicProcedure
    .input(z.object({
      userId: z.string().optional(), // User ID for role-based filtering
      companyId: z.string().optional(), // Optional: filter lots to a specific company (admin use)
      // search: free-text filter applied after role/company filtering.
      // Used by FieldScheduler server-to-server enrichment calls to narrow
      // the result to a specific lotCode without a separate endpoint.
      search: z.string().optional(),
      page: z.number().optional(),
      limit: z.number().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      try {
        // Resolve the acting user:
        // 1. Prefer session user from ctx (admin dashboard cookie/JWT login)
        // 2. Fall back to userId input (legacy mobile app path)
        // 3. Fall back to companyId-only service-to-server path (FieldScheduler enrichment)
        //    In this case no user record is needed — the caller is trusted to pass a valid
        //    companyId and we filter directly by it.
        //    TODO(security): Replace with a signed JWT or shared secret header so that
        //    companyId cannot be guessed/spoofed by an unauthenticated caller.
        let user: any = ctx.user || null;
        if (!user && input?.userId && input.userId !== 'admin-placeholder') {
          user = await User.findById(input.userId);
        }

        // Service-to-server path: companyId provided without a user session.
        // Return all lots for that company directly, bypassing role-based filtering.
        if (!user && input?.companyId) {
          const companies = await Company.find({ active: true }).select('companyName operationalLots');
          const allLots = companies.flatMap(company =>
            company.operationalLots.map(lot => ({
              id: `${company._id}_${lot.lotCode}`,
              lotCode: lot.lotCode,
              lotName: lot.lotName,
              paytWebhook: lot.paytWebhook,
              monthlyWebhook: lot.monthlyWebhook,
              companyId: company._id.toString(),
              companyName: company.companyName,
            }))
          );
          // Filter by the short companyId string stored on the Company document
          // (e.g. "MOTTAINAI") — match against both _id and the companyId field.
          let filteredLots = allLots.filter(lot =>
            lot.companyId === input.companyId ||
            lot.companyName?.toUpperCase() === input.companyId.toUpperCase()
          );
          // Also try matching against Company.companyId field directly
          if (filteredLots.length === 0) {
            const matchedCompany = await (Company as any).findOne({
              $or: [
                { companyId: input.companyId },
                { companyId: { $regex: new RegExp(`^${input.companyId}$`, 'i') } },
              ]
            }).select('_id companyName operationalLots');
            if (matchedCompany) {
              filteredLots = matchedCompany.operationalLots.map((lot: any) => ({
                id: `${matchedCompany._id}_${lot.lotCode}`,
                lotCode: lot.lotCode,
                lotName: lot.lotName,
                paytWebhook: lot.paytWebhook,
                monthlyWebhook: lot.monthlyWebhook,
                companyId: matchedCompany._id.toString(),
                companyName: matchedCompany.companyName,
              }));
            }
          }
          if (input?.search) {
            const s = input.search.toLowerCase();
            filteredLots = filteredLots.filter(
              lot => lot.lotCode.toLowerCase().includes(s) || lot.lotName.toLowerCase().includes(s)
            );
          }
          return {
            lots: filteredLots,
            totalCount: filteredLots.length,
            userRole: 'service',
            message: `Showing ${filteredLots.length} lots for company ${input.companyId}`
          };
        }

        // If still no user, require authentication
        if (!user) {
          return {
            lots: [],
            totalCount: 0,
            userRole: 'guest',
            message: 'Authentication required'
          };
        }

        // Fetch all active companies with their operational lots
        const companies = await Company.find({ active: true }).select('companyName operationalLots');

        // Flatten all operational lots with company information
        const allLots = companies.flatMap(company => 
          company.operationalLots.map(lot => ({
            id: `${company._id}_${lot.lotCode}`,
            lotCode: lot.lotCode,
            lotName: lot.lotName,
            paytWebhook: lot.paytWebhook,
            monthlyWebhook: lot.monthlyWebhook,
            companyId: company._id.toString(),
            companyName: company.companyName,
          }))
        );

        // Apply role-based filtering
        let filteredLots = allLots;
        
        if (user.role === 'user') {
          // Regular users: Only see lots from their assigned company
          if (!user.companyId) {
            return {
              lots: [],
              totalCount: 0,
              userRole: user.role,
              message: 'No company assigned to user'
            };
          }
          
          filteredLots = allLots.filter(lot => lot.companyId === user.companyId);
        }
        // Cherry pickers and admins see all lots (no role filtering)

        // Apply optional admin company filter (overrides role-based result for admins/cherry-pickers)
        if (input?.companyId && user.role !== 'user') {
          filteredLots = filteredLots.filter(lot => lot.companyId === input.companyId);
        }

        // Apply optional free-text search filter (lotCode or lotName, case-insensitive).
        // This is the primary path used by FieldScheduler server-to-server enrichment:
        // it passes search=<lotCode> to resolve webhook URLs for a specific lot.
        if (input?.search) {
          const s = input.search.toLowerCase();
          filteredLots = filteredLots.filter(
            lot =>
              lot.lotCode.toLowerCase().includes(s) ||
              lot.lotName.toLowerCase().includes(s)
          );
        }

        return {
          lots: filteredLots,
          totalCount: filteredLots.length,
          userRole: user.role,
          userCompanyId: user.companyId,
          filterCompanyId: input?.companyId,
          message: input?.companyId && user.role !== 'user'
            ? `Showing ${filteredLots.length} lots for selected company`
            : user.role === 'user'
              ? `Showing ${filteredLots.length} lots from your company`
              : `Showing all ${filteredLots.length} operational lots`
        };
      } catch (error: any) {
        console.error('[Lots API] Error fetching lots:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || 'Failed to fetch operational lots'
        });
      }
    }),

  /**
   * Get lot assignments (which lots belong to which companies)
   * Admin only
   */
  assignments: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .query(async ({ input }) => {
      // Verify user is admin
      const user = await User.findById(input.userId);
      
      if (!user || user.role !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Admin access required'
        });
      }

      // Fetch all companies with their lots
      const companies = await Company.find({ active: true })
        .select('companyName operationalLots')
        .sort({ companyName: 1 });

      return {
        companies: companies.map(company => ({
          id: company._id.toString(),
          name: company.companyName,
          lotCount: company.operationalLots.length,
          lots: company.operationalLots.map(lot => ({
            lotCode: lot.lotCode,
            lotName: lot.lotName,
          }))
        })),
        totalCompanies: companies.length,
        totalLots: companies.reduce((sum, c) => sum + c.operationalLots.length, 0)
      };
    }),

  /**
   * Validate if a user can access a specific lot
   * Used by mobile app before submitting pickup
   */
  validateAccess: publicProcedure
    .input(z.object({
      userId: z.string(),
      lotCode: z.string(),
      companyId: z.string(),
    }))
    .query(async ({ input }) => {
      const user = await User.findById(input.userId);
      
      if (!user) {
        return { hasAccess: false, reason: 'User not found' };
      }

      // Cherry pickers and admins have access to all lots
      if (user.role === 'cherry_picker' || user.role === 'admin') {
        return { hasAccess: true, reason: 'Authorized role' };
      }

      // Regular users: Check if lot belongs to their company
      if (user.role === 'user') {
        if (!user.companyId) {
          return { hasAccess: false, reason: 'No company assigned' };
        }

        if (user.companyId !== input.companyId) {
          return { hasAccess: false, reason: 'Lot does not belong to your company' };
        }

        // Verify the lot actually exists in the company
        const company = await Company.findById(input.companyId);
        if (!company) {
          return { hasAccess: false, reason: 'Company not found' };
        }

        const lotExists = company.operationalLots.some(lot => lot.lotCode === input.lotCode);
        if (!lotExists) {
          return { hasAccess: false, reason: 'Lot not found in company' };
        }

        return { hasAccess: true, reason: 'Lot belongs to your company' };
      }

      return { hasAccess: false, reason: 'Unknown role' };
    }),
});
