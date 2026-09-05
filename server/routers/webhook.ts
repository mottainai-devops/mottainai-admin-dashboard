import { adminProcedure, router, publicProcedure } from '../_core/trpc';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import {
  testWebhookEndpoint,
  updateWebhookMonitor,
  checkAllWebhooks,
  getAllWebhookStatus,
  getCompanyWebhookStatus,
  getUnhealthyWebhooks,
  sendWebhookAlert,
} from '../services/webhookMonitoring';
import * as db from '../db';

export function serializeWebhookMonitorForAdmin(monitor: {
  companyName: string;
  lotCode?: string;
  lotName?: string;
  webhookType: 'payt' | 'monthly';
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked?: Date | string;
  lastSuccessful?: Date | string;
  responseTime?: number;
  failureCount?: number;
  consecutiveFailures?: number;
  emailAlertSent?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}) {
  return {
    companyName: monitor.companyName,
    lotCode: monitor.lotCode,
    lotName: monitor.lotName,
    webhookType: monitor.webhookType,
    status: monitor.status,
    lastChecked: monitor.lastChecked,
    lastSuccessful: monitor.lastSuccessful,
    responseTime: monitor.responseTime,
    failureCount: monitor.failureCount,
    consecutiveFailures: monitor.consecutiveFailures,
    emailAlertSent: monitor.emailAlertSent,
    createdAt: monitor.createdAt,
    updatedAt: monitor.updatedAt,
  };
}

export const webhookRouter = router({
  // Get all webhook monitoring status
  getAllStatus: adminProcedure.query(async () => {
    return (await getAllWebhookStatus()).map(serializeWebhookMonitorForAdmin);
  }),

  // Alias for getAllStatus (used by DashboardWidgets)
  getAll: adminProcedure.query(async () => {
    return (await getAllWebhookStatus()).map(serializeWebhookMonitorForAdmin);
  }),

  // Get webhook status for a specific company
  getCompanyStatus: adminProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      return (await getCompanyWebhookStatus(input.companyId)).map(serializeWebhookMonitorForAdmin);
    }),

  // Get unhealthy webhooks
  getUnhealthy: adminProcedure.query(async () => {
    return (await getUnhealthyWebhooks()).map(serializeWebhookMonitorForAdmin);
  }),

  getConfiguredTestTargets: adminProcedure.query(async () => {
    const companies = await db.getAllCompanies();
    return companies.flatMap(company =>
      (company.operationalLots || [])
        .filter(lot => Boolean(lot.paytWebhook || lot.monthlyWebhook))
        .map(lot => ({
          companyId: company._id.toString(),
          companyName: company.companyName,
          lotCode: lot.lotCode,
          lotName: lot.lotName,
          availableTypes: [
            ...(lot.paytWebhook ? ['payt' as const] : []),
            ...(lot.monthlyWebhook ? ['monthly' as const] : []),
          ],
        }))
    );
  }),

  testConfiguredEndpoint: adminProcedure
    .input(z.object({
      companyId: z.string(),
      lotCode: z.string(),
      webhookType: z.enum(['payt', 'monthly']),
    }))
    .mutation(async ({ input }) => {
      const companies = await db.getAllCompanies();
      const company = companies.find(candidate => candidate._id.toString() === input.companyId);
      const lot = company?.operationalLots?.find(candidate => candidate.lotCode === input.lotCode);
      const endpoint = input.webhookType === 'payt' ? lot?.paytWebhook : lot?.monthlyWebhook;

      if (!endpoint) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Configured webhook endpoint not found' });
      }

      const result = await testWebhookEndpoint(endpoint);
      return {
        name: 'Configured webhook test',
        status: result.success ? 'pass' : 'fail',
        message: result.success ? 'Configured endpoint accepted the test request' : 'Configured endpoint did not accept the test request',
        duration: result.responseTime,
      };
    }),

  // Test a single webhook endpoint
  testEndpoint: adminProcedure
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
  checkAll: adminProcedure.mutation(async () => {
    await checkAllWebhooks();
    return { success: true, message: 'All webhooks checked successfully' };
  }),

  // Send alert for unhealthy webhooks
  sendAlerts: adminProcedure.mutation(async () => {
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
