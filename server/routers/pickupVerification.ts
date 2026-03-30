import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import * as pickupVerificationService from "../services/pickupVerification";

export const pickupVerificationRouter = router({
  /**
   * Get all pickups that are unsynced (in formsubmissions but not in monthlybilldatas)
   */
  getUnsynced: protectedProcedure.query(async () => {
    return await pickupVerificationService.getUnsyncedPickups();
  }),

  /**
   * Get sync statistics
   */
  getStatistics: protectedProcedure.query(async () => {
    return await pickupVerificationService.getSyncStatistics();
  }),

  /**
   * Re-sync a specific pickup
   */
  resync: protectedProcedure
    .input(
      z.object({
        submissionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await pickupVerificationService.resyncPickup(input.submissionId);
    }),

  /**
   * Delete a submission (for mistakes)
   */
  deleteSubmission: protectedProcedure
    .input(
      z.object({
        submissionId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      return await pickupVerificationService.deleteSubmission(input.submissionId);
    }),
});
