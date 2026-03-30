import { router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import {
  testWebhookEndpoint,
  updateWebhookMonitor,
  checkAllWebhooks,
  getAllWebhookStatus,
  getCompanyWebhookStatus,
  getUnhealthyWebhooks,
  sendWebhookAlert,
} from '../services/webhookMonitoring';

export const webhookRouter = router({
  // Get all webhook monitoring status
  getAllStatus: publicProcedure.query(async () => {
    return await getAllWebhookStatus();
  }),

  // Get webhook status for a specific company
  getCompanyStatus: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return await getCompanyWebhookStatus(input.companyId);
    }),

  // Get unhealthy webhooks
  getUnhealthy: publicProcedure.query(async () => {
    return await getUnhealthyWebhooks();
  }),

  // Test a single webhook endpoint
  testEndpoint: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        companyId: z.string(),
        companyName: z.string(),
        webhookType: z.enum(['payt', 'monthly']),
      })
    )
    .mutation(async ({ input }) => {
      const result = await testWebhookEndpoint(input.url);
      
      // Update monitor record
      await updateWebhookMonitor(
        input.companyId,
        input.companyName,
        input.url,
        input.webhookType,
        result
      );
      
      return result;
    }),

  // Check all webhooks
  checkAll: publicProcedure.mutation(async () => {
    await checkAllWebhooks();
    return { success: true, message: 'All webhooks checked successfully' };
  }),

  // Send alert for unhealthy webhooks
  sendAlerts: publicProcedure.mutation(async () => {
    const unhealthyWebhooks = await getUnhealthyWebhooks();
    
    let alertsSent = 0;
    for (const webhook of unhealthyWebhooks) {
      if (!webhook.emailAlertSent) {
        await sendWebhookAlert(webhook);
        alertsSent++;
      }
    }
    
    return {
      success: true,
      alertsSent,
      totalUnhealthy: unhealthyWebhooks.length,
    };
  }),
});
