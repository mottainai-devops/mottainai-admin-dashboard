import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { User } from '../models/User';
import { FormSubmission } from '../models/FormSubmission';
import { Company } from '../models/Company';

/**
 * MAF (Company/Franchisee) Router
 * 
 * Provides endpoints for filtering pickup records by:
 * - Company/MAF (organizational level)
 * - Field Worker (individual level)
 */
export const mafRouter = router({
  /**
   * Get all field workers for a specific company (MAF)
   * Used to populate the Field Worker dropdown when a company is selected
   */
  getFieldWorkers: publicProcedure
    .input(z.object({ 
      companyId: z.string() 
    }))
    .query(async ({ input }) => {
      try {
        // Find all users with role "user" (field workers) for this company
        const fieldWorkers = await User.find({
          companyId: input.companyId,
          role: 'user'
        })
        .select('_id fullName email')
        .sort({ fullName: 1 })
        .lean();

        return fieldWorkers.map(worker => ({
          id: worker._id.toString(),
          name: worker.fullName || worker.email || 'Unknown',
          email: worker.email
        }));
      } catch (error) {
        console.error('[MAF] Error getting field workers:', error);
        return [];
      }
    }),

  /**
   * Get statistics for all MAFs (companies)
   * Shows total pickups per company
   */
  getMafStats: publicProcedure.query(async () => {
    try {
      const companies = await Company.find({ active: true })
        .select('_id companyId companyName')
        .lean();

      const stats = await Promise.all(
        companies.map(async (company) => {
          const pickupCount = await FormSubmission.countDocuments({
            companyId: company._id.toString()
          });

          return {
            mafId: company._id.toString(),
            mafName: company.companyName,
            companyId: company.companyId,
            totalPickups: pickupCount
          };
        })
      );

      // Only return companies with pickups
      return stats.filter(s => s.totalPickups > 0).sort((a, b) => 
        a.mafName.localeCompare(b.mafName)
      );
    } catch (error) {
      console.error('[MAF] Error getting MAF stats:', error);
      return [];
    }
  }),

  /**
   * Get field worker statistics
   * Shows total pickups per field worker for a specific company
   */
  getFieldWorkerStats: publicProcedure
    .input(z.object({ 
      companyId: z.string() 
    }))
    .query(async ({ input }) => {
      try {
        const fieldWorkers = await User.find({
          companyId: input.companyId,
          role: 'user'
        })
        .select('_id fullName email')
        .lean();

        const stats = await Promise.all(
          fieldWorkers.map(async (worker) => {
            const pickupCount = await FormSubmission.countDocuments({
              userId: worker._id.toString()
            });

            return {
              id: worker._id.toString(),
              name: worker.fullName || worker.email || 'Unknown',
              email: worker.email,
              totalPickups: pickupCount
            };
          })
        );

        // Only return workers with pickups
        return stats.filter(s => s.totalPickups > 0).sort((a, b) => 
          b.totalPickups - a.totalPickups // Sort by pickup count descending
        );
      } catch (error) {
        console.error('[MAF] Error getting field worker stats:', error);
        return [];
      }
    })
});
