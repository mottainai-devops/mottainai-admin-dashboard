import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookMonitor extends Document {
  companyId: string;
  companyName: string;
  webhookUrl: string;
  webhookType: 'payt' | 'monthly';
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  responseTime: number | null; // in milliseconds
  errorMessage: string | null;
  consecutiveFailures: number;
  emailAlertSent: boolean;
}

const WebhookMonitorSchema = new Schema<IWebhookMonitor>({
  companyId: { type: String, required: true },
  companyName: { type: String, required: true },
  webhookUrl: { type: String, required: true },
  webhookType: { type: String, enum: ['payt', 'monthly'], required: true },
  status: { type: String, enum: ['healthy', 'unhealthy', 'unknown'], default: 'unknown' },
  lastChecked: { type: Date, default: Date.now },
  lastSuccess: { type: Date, default: null },
  lastFailure: { type: Date, default: null },
  responseTime: { type: Number, default: null },
  errorMessage: { type: String, default: null },
  consecutiveFailures: { type: Number, default: 0 },
  emailAlertSent: { type: Boolean, default: false },
}, {
  timestamps: true,
});

export const WebhookMonitor = mongoose.model<IWebhookMonitor>('WebhookMonitor', WebhookMonitorSchema, 'webhookmonitors');
