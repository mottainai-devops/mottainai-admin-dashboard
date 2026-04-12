/**
 * Real Webhook Monitoring Service
 * Performs live HTTP health checks against actual webhook endpoints.
 */

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST';
  category: 'payment' | 'accounting' | 'sms' | 'email' | 'database' | 'api';
  description: string;
  expectedStatus?: number;
  testPayload?: Record<string, unknown>;
}

export interface WebhookHealthResult {
  id: string;
  name: string;
  url: string;
  category: string;
  status: 'healthy' | 'unhealthy' | 'timeout' | 'unknown';
  statusCode?: number;
  responseTime: number;
  error?: string;
  checkedAt: Date;
}

export interface WebhookHealthSummary {
  total: number;
  healthy: number;
  unhealthy: number;
  timeout: number;
  unknown: number;
  healthPercentage: number;
  avgResponseTime: number;
}

/**
 * Configured webhook endpoints to monitor.
 * Add or update entries here as new integrations are added.
 */
export const WEBHOOK_ENDPOINTS: WebhookEndpoint[] = [
  {
    id: 'mottainai-backend',
    name: 'Mottainai Backend API',
    url: 'https://upwork.kowope.xyz/health',
    method: 'GET',
    category: 'api',
    description: 'Core backend API health check',
    expectedStatus: 200,
  },
  {
    id: 'admin-dashboard',
    name: 'Admin Dashboard API',
    url: 'https://admin.kowope.xyz/api/health',
    method: 'GET',
    category: 'api',
    description: 'Admin dashboard tRPC server health check',
    expectedStatus: 200,
  },
  {
    id: 'franchisee-portal',
    name: 'Franchisee Portal API',
    url: 'https://portal.kowope.xyz/api/franchisee/health',
    method: 'GET',
    category: 'api',
    description: 'Franchisee portal API health check',
    expectedStatus: 200,
  },
];

/**
 * Check the health of a single webhook endpoint.
 */
export async function checkWebhookHealth(endpoint: WebhookEndpoint): Promise<WebhookHealthResult> {
  const startTime = Date.now();
  const checkedAt = new Date();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    const response = await fetch(endpoint.url, {
      method: endpoint.method,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      ...(endpoint.method === 'POST' && endpoint.testPayload
        ? { body: JSON.stringify(endpoint.testPayload) }
        : {}),
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;
    const expectedStatus = endpoint.expectedStatus ?? 200;
    const isHealthy = response.status === expectedStatus || (response.status >= 200 && response.status < 300);

    return {
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      category: endpoint.category,
      status: isHealthy ? 'healthy' : 'unhealthy',
      statusCode: response.status,
      responseTime,
      checkedAt,
    };
  } catch (err: unknown) {
    const responseTime = Date.now() - startTime;
    const isTimeout = err instanceof Error && err.name === 'AbortError';

    return {
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      category: endpoint.category,
      status: isTimeout ? 'timeout' : 'unknown',
      responseTime,
      error: err instanceof Error ? err.message : String(err),
      checkedAt,
    };
  }
}

/**
 * Check health of all configured webhook endpoints in parallel.
 */
export async function checkAllWebhooksHealth(): Promise<WebhookHealthResult[]> {
  return Promise.all(WEBHOOK_ENDPOINTS.map(checkWebhookHealth));
}

/**
 * Compute a summary from an array of health results.
 */
export function getWebhookHealthSummary(results: WebhookHealthResult[]): WebhookHealthSummary {
  const total = results.length;
  const healthy = results.filter(r => r.status === 'healthy').length;
  const unhealthy = results.filter(r => r.status === 'unhealthy').length;
  const timeout = results.filter(r => r.status === 'timeout').length;
  const unknown = results.filter(r => r.status === 'unknown').length;
  const healthPercentage = total > 0 ? Math.round((healthy / total) * 100) : 0;
  const avgResponseTime =
    total > 0 ? Math.round(results.reduce((sum, r) => sum + r.responseTime, 0) / total) : 0;

  return { total, healthy, unhealthy, timeout, unknown, healthPercentage, avgResponseTime };
}
