import { z } from "zod";
import { adminProcedure, router } from "../_core/trpc";
import { 
  WEBHOOK_ENDPOINTS, 
  checkWebhookHealth, 
  checkAllWebhooksHealth,
  getWebhookHealthSummary,
  type WebhookHealthResult 
} from "../services/realWebhookMonitoring";

export function serializeWebhookHealthForAdmin(result: WebhookHealthResult) {
  return {
    id: result.id,
    name: result.name,
    category: result.category,
    status: result.status,
    statusCode: result.statusCode,
    responseTime: result.responseTime,
    checkedAt: result.checkedAt,
    error: result.error ? 'Health check failed' : undefined,
  };
}

export const realWebhookRouter = router({
  /**
   * Get all webhook endpoints configuration
   */
  getEndpoints: adminProcedure.query(async () => {
    return WEBHOOK_ENDPOINTS.map(endpoint => ({
      id: endpoint.id,
      name: endpoint.name,
      method: endpoint.method,
      category: endpoint.category,
      description: endpoint.description,
    }));
  }),

  /**
   * Check health of all webhooks
   */
  checkAll: adminProcedure.query(async () => {
    const results = await checkAllWebhooksHealth();
    const summary = getWebhookHealthSummary(results);
    
    return {
      results: results.map(serializeWebhookHealthForAdmin),
      summary,
      lastChecked: new Date(),
    };
  }),

  /**
   * Check health of a single webhook
   */
  checkOne: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input }) => {
      const endpoint = WEBHOOK_ENDPOINTS.find(e => e.id === input.id);
      
      if (!endpoint) {
        throw new Error(`Webhook endpoint not found: ${input.id}`);
      }
      
      const result = await checkWebhookHealth(endpoint);
      return serializeWebhookHealthForAdmin(result);
    }),

  /**
   * Get webhook health summary only (faster)
   */
  getSummary: adminProcedure.query(async () => {
    const results = await checkAllWebhooksHealth();
    const summary = getWebhookHealthSummary(results);
    
    return summary;
  }),

  /**
   * Get webhooks by category
   */
  getByCategory: adminProcedure
    .input(z.object({
      category: z.enum(['payment', 'accounting', 'sms', 'email', 'database', 'api']),
    }))
    .query(async ({ input }) => {
      const endpoints = WEBHOOK_ENDPOINTS.filter(e => e.category === input.category);
      const results = await Promise.all(
        endpoints.map(endpoint => checkWebhookHealth(endpoint))
      );
      
      return results.map(serializeWebhookHealthForAdmin);
    }),
});
