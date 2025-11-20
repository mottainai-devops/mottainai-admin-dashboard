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
    }).optional())
    .query(async ({ input }) => {
      try {
        // If no userId provided, return empty array (require authentication)
        if (!input || !input.userId) {
          return {
            lots: [],
            totalCount: 0,
            userRole: 'guest',
            message: 'Authentication required'
          };
        }

        // Fetch user to check role and company assignment
        const user = await User.findById(input.userId);
        
        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found'
          });
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
        // Cherry pickers and admins see all lots (no filtering)

        return {
          lots: filteredLots,
          totalCount: filteredLots.length,
          userRole: user.role,
          userCompanyId: user.companyId,
          message: user.role === 'user' 
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
