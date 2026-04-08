import { getMongoDb } from '../mongodb';

export interface WebhookMonitor {
  _id?: string;
  companyId: string;
  companyName: string;
  lotCode?: string;
  lotName?: string;
  webhookType: 'payt' | 'monthly';
  webhookUrl: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked?: Date | string;
  lastSuccessful?: Date | string;
  responseTime?: number;
  failureCount?: number;
  consecutiveFailures?: number;
  emailAlertSent?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export async function getAllWebhookStatus(): Promise<WebhookMonitor[]> {
  const db = await getMongoDb();
  return await db.collection('webhookmonitors').find({}).sort({ updatedAt: -1 }).toArray() as unknown as WebhookMonitor[];
}

export async function getCompanyWebhookStatus(companyId: string): Promise<WebhookMonitor[]> {
  const db = await getMongoDb();
  return await db.collection('webhookmonitors').find({ companyId }).toArray() as unknown as WebhookMonitor[];
}

export async function getUnhealthyWebhooks(): Promise<WebhookMonitor[]> {
  const db = await getMongoDb();
  return await db.collection('webhookmonitors')
    .find({ status: { $ne: 'healthy' } })
    .sort({ consecutiveFailures: -1 })
    .toArray() as unknown as WebhookMonitor[];
}

export async function testWebhookEndpoint(url: string): Promise<{
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
}> {
  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;
    return {
      success: response.ok,
      statusCode: response.status,
      responseTime,
    };
  } catch (err: unknown) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

export async function updateWebhookMonitor(
  companyId: string,
  companyName: string,
  webhookUrl: string,
  webhookType: 'payt' | 'monthly',
  result: { success: boolean; responseTime: number; error?: string }
): Promise<void> {
  const db = await getMongoDb();
  const now = new Date();
  const status = result.success ? 'healthy' : 'unhealthy';

  await db.collection('webhookmonitors').updateOne(
    { companyId, webhookType },
    {
      $set: {
        companyName,
        webhookUrl,
        status,
        lastChecked: now,
        ...(result.success ? { lastSuccessful: now } : {}),
        responseTime: result.responseTime,
        updatedAt: now,
      },
      $inc: {
        failureCount: result.success ? 0 : 1,
        consecutiveFailures: result.success ? 0 : 1,
      },
      $setOnInsert: { createdAt: now },
    },
    { upsert: true }
  );

  if (result.success) {
    await db.collection('webhookmonitors').updateOne(
      { companyId, webhookType },
      { $set: { consecutiveFailures: 0 } }
    );
  }
}

export async function checkAllWebhooks(): Promise<void> {
  const db = await getMongoDb();
  const monitors = await db.collection('webhookmonitors').find({}).toArray() as unknown as WebhookMonitor[];

  for (const monitor of monitors) {
    const result = await testWebhookEndpoint(monitor.webhookUrl);
    await updateWebhookMonitor(
      monitor.companyId,
      monitor.companyName,
      monitor.webhookUrl,
      monitor.webhookType,
      result
    );
  }
}

export async function sendWebhookAlert(webhook: WebhookMonitor): Promise<void> {
  // Mark alert as sent in the database
  const db = await getMongoDb();
  await db.collection('webhookmonitors').updateOne(
    { companyId: webhook.companyId, webhookType: webhook.webhookType },
    { $set: { emailAlertSent: true, updatedAt: new Date() } }
  );
}
