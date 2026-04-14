import mongoose, { Schema, Document } from 'mongoose';

/**
 * Notification Channel
 */
export type NotificationChannel = 'sms' | 'email';

/**
 * Notification Status
 */
export type NotificationStatus = 'sent' | 'failed' | 'skipped';

/**
 * FixedBillingNotificationLog Document Interface
 *
 * Logs every SMS and email notification sent to a Fixed Billing customer
 * when a pickup is recorded. Includes the full message content, amounts,
 * Paystack payment link, and delivery status.
 */
export interface IFixedBillingNotificationLog extends Document {
  _id: string;

  // ─── Reference ───────────────────────────────────────────────────────────
  agreementId: string;
  customerId: string;
  customerName: string;
  companyId: string;

  // ─── Trigger ─────────────────────────────────────────────────────────────
  /** The pickup record ID that triggered this notification */
  pickupId: string;
  /** Date and time of the pickup */
  pickupDate: Date;
  /** What was collected */
  binType: string;
  binQuantity: number;
  lotCode: string;

  // ─── Financial Summary at Time of Notification ───────────────────────────
  /** Current month's charge in kobo */
  currentMonthChargeKobo: number;
  /** Current billing month label, e.g. "April 2026" */
  currentBillingMonth: string;
  /** Total outstanding from previous months in kobo */
  previousOutstandingKobo: number;
  /** Number of months with outstanding balance */
  outstandingMonthsCount: number;
  /** Labels of outstanding months, e.g. ["February 2026", "March 2026"] */
  outstandingMonthLabels: string[];
  /** Total payable = currentMonthChargeKobo + previousOutstandingKobo */
  totalPayableKobo: number;
  /** Paystack payment link pre-loaded with totalPayableKobo */
  paystackPaymentLink: string;
  /** Paystack payment link reference */
  paystackReference: string;

  // ─── Notification ────────────────────────────────────────────────────────
  channel: NotificationChannel;
  /** Recipient phone number (for SMS) or email address */
  recipient: string;
  /** Full message content sent */
  messageContent: string;
  /** Delivery status */
  status: NotificationStatus;
  /** Error message if failed */
  errorMessage?: string;
  /** External delivery reference (e.g. Termii message ID) */
  externalReference?: string;

  sentAt: Date;
  createdAt: Date;
}

const FixedBillingNotificationLogSchema = new Schema<IFixedBillingNotificationLog>(
  {
    agreementId: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    companyId: { type: String, required: true },

    pickupId: { type: String, required: true },
    pickupDate: { type: Date, required: true },
    binType: { type: String, required: true },
    binQuantity: { type: Number, required: true, default: 1 },
    lotCode: { type: String, required: true },

    currentMonthChargeKobo: { type: Number, required: true },
    currentBillingMonth: { type: String, required: true },
    previousOutstandingKobo: { type: Number, default: 0 },
    outstandingMonthsCount: { type: Number, default: 0 },
    outstandingMonthLabels: [{ type: String }],
    totalPayableKobo: { type: Number, required: true },
    paystackPaymentLink: { type: String, required: true },
    paystackReference: { type: String, required: true },

    channel: { type: String, enum: ['sms', 'email'], required: true },
    recipient: { type: String, required: true },
    messageContent: { type: String, required: true },
    status: { type: String, enum: ['sent', 'failed', 'skipped'], required: true },
    errorMessage: { type: String },
    externalReference: { type: String },

    sentAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

FixedBillingNotificationLogSchema.index({ customerId: 1, sentAt: -1 });
FixedBillingNotificationLogSchema.index({ companyId: 1, sentAt: -1 });
FixedBillingNotificationLogSchema.index({ pickupId: 1 });
FixedBillingNotificationLogSchema.index({ status: 1 });

export const FixedBillingNotificationLog = mongoose.model<IFixedBillingNotificationLog>(
  'FixedBillingNotificationLog',
  FixedBillingNotificationLogSchema,
  'fixedbillingnotificationlogs'
);
