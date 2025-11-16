import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import { TRPCError } from '@trpc/server';
import * as db from '../db';

const BACKEND_API_URL = 'http://172.232.24.180:3000';

interface CompanyStats {
  companyId: string;
  companyName: string;
  totalSubmissions: number;
  paytSubmissions: number;
  monthlySubmissions: number;
  successRate: number;
  lastSubmission: string | null;
}

interface WebhookStatus {
  url: string;
  status: 'active' | 'inactive' | 'error';
  lastChecked: string;
  responseTime: number;
}

/**
 * Analytics router for monitoring dashboard
 */
export const analyticsRouter = router({
  /**
   * Get company submission statistics
   */
  getCompanyStats: protectedProcedure.query(async (): Promise<CompanyStats[]> => {
    try {
      // Fetch companies from MongoDB
      const companies = await db.getAllCompanies();

      // For now, return mock stats since we don't have submission data yet
      // In production, this would query the actual submission database
      const stats: CompanyStats[] = companies.map((company: any) => ({
        companyId: company.companyId,
        companyName: company.companyName,
        totalSubmissions: Math.floor(Math.random() * 1000), // Mock data
        paytSubmissions: Math.floor(Math.random() * 500),
        monthlySubmissions: Math.floor(Math.random() * 500),
        successRate: 95 + Math.random() * 5, // 95-100%
        lastSubmission: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      }));

      return stats;
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch company stats',
      });
    }
  }),

  /**
   * Get overall system metrics
   */
  getSystemMetrics: protectedProcedure.query(async () => {
    try {
      // Fetch companies from MongoDB
      const companies = await db.getAllCompanies();

      // Calculate metrics
      const totalCompanies = companies.length;
      const totalLots = companies.reduce(
        (sum: number, company: any) => sum + (company.operationalLots?.length || 0),
        0
      );

      // Mock submission data (in production, query actual database)
      const totalSubmissions = Math.floor(Math.random() * 10000) + 5000;
      const todaySubmissions = Math.floor(Math.random() * 500) + 100;
      const weekSubmissions = Math.floor(Math.random() * 2000) + 500;
      const monthSubmissions = Math.floor(Math.random() * 5000) + 1000;

      const paytSubmissions = Math.floor(totalSubmissions * 0.6);
      const monthlyBillingSubmissions = totalSubmissions - paytSubmissions;

      const syncSuccessRate = 97 + Math.random() * 3; // 97-100%
      const avgResponseTime = 150 + Math.random() * 100; // 150-250ms

      return {
        companies: {
          total: totalCompanies,
          active: totalCompanies,
          inactive: 0,
        },
        operationalLots: {
          total: totalLots,
        },
        submissions: {
          total: totalSubmissions,
          today: todaySubmissions,
          week: weekSubmissions,
          month: monthSubmissions,
          byType: {
            payt: paytSubmissions,
            monthly: monthlyBillingSubmissions,
          },
        },
        performance: {
          syncSuccessRate: Math.round(syncSuccessRate * 100) / 100,
          avgResponseTime: Math.round(avgResponseTime),
          uptime: 99.8,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch system metrics',
      });
    }
  }),

  /**
   * Get webhook health status
   */
  getWebhookHealth: protectedProcedure.query(async (): Promise<WebhookStatus[]> => {
    try {
      // Fetch companies from MongoDB
      const companies = await db.getAllCompanies();

      // Extract unique webhooks
      const webhooks: Set<string> = new Set();
      companies.forEach((company: any) => {
        company.operationalLots?.forEach((lot: any) => {
          if (lot.paytWebhook) webhooks.add(lot.paytWebhook);
          if (lot.monthlyWebhook) webhooks.add(lot.monthlyWebhook);
        });
      });

      // Check webhook health (mock for now)
      const webhookStatuses: WebhookStatus[] = Array.from(webhooks).map(url => ({
        url,
        status: Math.random() > 0.1 ? 'active' : 'error',
        lastChecked: new Date().toISOString(),
        responseTime: Math.floor(Math.random() * 300) + 100, // 100-400ms
      }));

      return webhookStatuses;
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch webhook health',
      });
    }
  }),

  /**
   * Get submission timeline (last 7 days)
   */
  getSubmissionTimeline: protectedProcedure.query(async () => {
    try {
      // Generate mock timeline data for last 7 days
      const timeline = [];
      const now = new Date();
      
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        timeline.push({
          date: date.toISOString().split('T')[0],
          submissions: Math.floor(Math.random() * 200) + 50,
          payt: Math.floor(Math.random() * 120) + 30,
          monthly: Math.floor(Math.random() * 80) + 20,
        });
      }

      return timeline;
    } catch (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Failed to fetch submission timeline',
      });
    }
  }),

  /**
   * Get recent errors
   */
  getRecentErrors: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
    }))
    .query(async ({ input }) => {
      try {
        // Mock error data (in production, query actual error logs)
        const errors = [
          {
            id: '1',
            timestamp: new Date(Date.now() - 3600000).toISOString(),
            type: 'webhook_timeout',
            message: 'Webhook request timed out after 30s',
            company: 'MOTTAINAI',
            lot: 'MOT-027',
            severity: 'warning',
          },
          {
            id: '2',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            type: 'sync_failed',
            message: 'Failed to sync polygon cache',
            company: 'CUMMINGTONITE',
            lot: 'CUM-099',
            severity: 'error',
          },
          {
            id: '3',
            timestamp: new Date(Date.now() - 10800000).toISOString(),
            type: 'validation_error',
            message: 'Missing required field: buildingId',
            company: 'EMERALD',
            lot: 'EME-001',
            severity: 'warning',
          },
        ];

        return errors.slice(0, input.limit);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch recent errors',
        });
      }
    }),

  /**
   * Get top performing companies
   */
  getTopCompanies: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(20).default(5),
      sortBy: z.enum(['submissions', 'successRate']).default('submissions'),
    }))
    .query(async ({ input }) => {
      try {
        // Fetch companies from MongoDB
        const companies = await db.getAllCompanies();

        // Generate mock stats and sort
        const stats = companies.map((company: any) => ({
          companyId: company.companyId,
          companyName: company.companyName,
          submissions: Math.floor(Math.random() * 1000) + 100,
          successRate: 95 + Math.random() * 5,
        }));

        stats.sort((a: any, b: any) => {
          if (input.sortBy === 'submissions') {
            return b.submissions - a.submissions;
          } else {
            return b.successRate - a.successRate;
          }
        });

        return stats.slice(0, input.limit);
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error instanceof Error ? error.message : 'Failed to fetch top companies',
        });
      }
    }),
});
