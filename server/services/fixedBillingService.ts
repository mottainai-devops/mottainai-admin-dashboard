/**
 * Fixed Billing Service
 *
 * Handles all logic for the Fixed Billing revenue model:
 * - Outstanding balance computation
 * - Paystack payment link generation (pre-loaded with total payable)
 * - Short link creation (upwork.kowope.xyz/payment/{id})
 * - SMS notifications via Termii (N-Alert, DND channel)
 * - Email notifications via Gmail/Nodemailer
 * - Monthly ledger generation
 *
 * Uses the same providers as the existing mottainai-platform-backend:
 *   SMS:   Termii (api.ng.termii.com)
 *   Email: Gmail SMTP via nodemailer
 */

import axios from 'axios';
import nodemailer from 'nodemailer';
import mongoose from 'mongoose';
import { FixedBillingLedger, IFixedBillingLedger } from '../models/FixedBillingLedger';
import { FixedBillingNotificationLog } from '../models/FixedBillingNotificationLog';
import { FixedBillingAgreement, IFixedBillingAgreement } from '../models/FixedBillingAgreement';

// ─── Constants ───────────────────────────────────────────────────────────────

const TERMII_API_KEY = 'TLW8fey92j3yyTTobx5jyMlARQ7qcyBuvJ3uq0e1AfNSxad6arSZBCxgraB6hK';
const TERMII_URL = 'https://api.ng.termii.com/api/sms/send';
const TERMII_SENDER = 'N-Alert';

const GMAIL_USER = 'mottainairecycling21@gmail.com';
const GMAIL_PASS = 'izcq igit hyiz nxac';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || '';
const SHORT_LINK_BASE = 'https://upwork.kowope.xyz/payment';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OutstandingSummary {
  currentMonthChargeKobo: number;
  currentBillingMonth: string;       // "YYYY-MM"
  currentBillingMonthLabel: string;  // "April 2026"
  previousOutstandingKobo: number;
  outstandingMonthsCount: number;
  outstandingMonthLabels: string[];
  /** Pre-existing debt from Zoho Books captured at agreement creation */
  openingBalanceKobo: number;
  totalPayableKobo: number;
}

export interface PickupTriggerData {
  pickupId: string;
  pickupDate: Date;
  binType: string;
  binQuantity: number;
  lotCode: string;
}

// ─── Billing Month Helpers ────────────────────────────────────────────────────

export function getCurrentBillingMonth(): { month: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const label = now.toLocaleString('en-NG', { month: 'long', year: 'numeric' });
  return { month: `${year}-${month}`, label };
}

export function formatMonthLabel(billingMonth: string): string {
  const [year, month] = billingMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  return date.toLocaleString('en-NG', { month: 'long', year: 'numeric' });
}

// ─── Outstanding Balance Computation ─────────────────────────────────────────

/**
 * Compute the full outstanding summary for a customer.
 * Returns current month charge + all previous unpaid months.
 */
export async function computeOutstanding(
  agreement: IFixedBillingAgreement
): Promise<OutstandingSummary> {
  const { month: currentMonth, label: currentMonthLabel } = getCurrentBillingMonth();

  // Ensure a ledger entry exists for the current month
  await ensureCurrentMonthLedger(agreement, currentMonth, currentMonthLabel);

  // Fetch current month ledger
  const currentLedger = await FixedBillingLedger.findOne({
    customerId: agreement.customerId,
    billingMonth: currentMonth,
  });

  const currentMonthChargeKobo = currentLedger?.chargedAmountKobo ?? agreement.agreedMonthlyPriceKobo;

  // Fetch all previous unpaid/partial months
  const previousUnpaid = await FixedBillingLedger.find({
    customerId: agreement.customerId,
    billingMonth: { $lt: currentMonth },
    status: { $in: ['unpaid', 'partial'] },
  }).sort({ billingMonth: 1 });

  const previousOutstandingKobo = previousUnpaid.reduce(
    (sum, entry) => sum + entry.outstandingAmountKobo,
    0
  );

  const outstandingMonthLabels = previousUnpaid.map(e => e.billingMonthLabel);

  const openingBalanceKobo = (agreement as any).openingBalanceKobo ?? 0;

  return {
    currentMonthChargeKobo,
    currentBillingMonth: currentMonth,
    currentBillingMonthLabel: currentMonthLabel,
    previousOutstandingKobo,
    outstandingMonthsCount: previousUnpaid.length,
    outstandingMonthLabels,
    openingBalanceKobo,
    totalPayableKobo: currentMonthChargeKobo + previousOutstandingKobo + openingBalanceKobo,
  };
}

/**
 * Ensure a ledger entry exists for the current billing month.
 * Creates one if it does not exist (idempotent).
 */
async function ensureCurrentMonthLedger(
  agreement: IFixedBillingAgreement,
  billingMonth: string,
  billingMonthLabel: string
): Promise<void> {
  const existing = await FixedBillingLedger.findOne({
    customerId: agreement.customerId,
    billingMonth,
  });

  if (!existing) {
    await FixedBillingLedger.create({
      agreementId: agreement._id.toString(),
      customerId: agreement.customerId,
      customerName: agreement.customerName,
      companyId: agreement.companyId,
      lotCode: agreement.lotCode,
      billingMonth,
      billingMonthLabel,
      chargedAmountKobo: agreement.agreedMonthlyPriceKobo,
      paidAmountKobo: 0,
      outstandingAmountKobo: agreement.agreedMonthlyPriceKobo,
      status: 'unpaid',
      payments: [],
      chargeRaisedAt: new Date(),
    });
  }
}

// ─── Paystack Payment Link ────────────────────────────────────────────────────

/**
 * Create a Paystack payment page/request pre-loaded with the total payable amount.
 * Returns the payment link and reference.
 */
export async function createFixedBillingPaymentLink(
  agreement: IFixedBillingAgreement,
  outstanding: OutstandingSummary
): Promise<{ paymentLink: string; reference: string; shortLink: string }> {
  const reference = `FB-${agreement.customerId}-${Date.now()}`;

  // Build description
  const monthsDesc =
    outstanding.outstandingMonthsCount > 0
      ? `${outstanding.currentBillingMonthLabel} + ${outstanding.outstandingMonthsCount} outstanding month(s)`
      : outstanding.currentBillingMonthLabel;

  const payload = {
    email: agreement.customerEmail || `${agreement.customerId}@mottainai.placeholder`,
    amount: outstanding.totalPayableKobo,
    reference,
    description: `Fixed Billing — ${agreement.customerName} — ${monthsDesc}`,
    currency: 'NGN',
    metadata: {
      customerId: agreement.customerId,
      customerName: agreement.customerName,
      companyId: agreement.companyId,
      billingType: 'fixed',
      currentBillingMonth: outstanding.currentBillingMonth,
      outstandingMonths: outstanding.outstandingMonthLabels,
    },
    ...(agreement.companyId ? {} : {}), // split code injected by caller if needed
  };

  const response = await axios.post(
    'https://api.paystack.co/transaction/initialize',
    payload,
    {
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
    }
  );

  const paymentLink: string = response.data?.data?.authorization_url ?? '';

  // Create short link via the PaymentsLinks collection (same as existing platform)
  const shortLink = await createShortLink(paymentLink);

  return { paymentLink, reference, shortLink };
}

/**
 * Create a short link using the PaymentsLinks MongoDB collection.
 * Returns https://upwork.kowope.xyz/payment/{id}
 */
async function createShortLink(fullUrl: string): Promise<string> {
  try {
    // Use the shared MongoDB connection — access the PaymentsLinks collection directly
    const db = mongoose.connection.db;
    if (!db) return fullUrl;
    const result = await db.collection('paymentslinks').insertOne({ paymentLink: fullUrl });
    return `${SHORT_LINK_BASE}/${result.insertedId.toString()}`;
  } catch {
    // Fallback: return the full URL if short link creation fails
    return fullUrl;
  }
}

// ─── SMS via Termii ───────────────────────────────────────────────────────────

/**
 * Normalise a Nigerian phone number to +234XXXXXXXXXX format.
 */
function normalisePhone(phone: string): string | null {
  const cleaned = (phone || '').trim().replace(/\s+/g, '');
  if (cleaned.startsWith('0') && cleaned.length === 11) {
    return `+234${cleaned.slice(1)}`;
  }
  if (cleaned.startsWith('234') && cleaned.length === 13) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith('+234') && cleaned.length === 14) {
    return cleaned;
  }
  return null;
}

/**
 * Build the Fixed Billing SMS message.
 */
function buildSmsMessage(
  agreement: IFixedBillingAgreement,
  pickup: PickupTriggerData,
  outstanding: OutstandingSummary,
  shortLink: string
): string {
  const amountNaira = (outstanding.totalPayableKobo / 100).toLocaleString('en-NG');
  const currentMonthNaira = (outstanding.currentMonthChargeKobo / 100).toLocaleString('en-NG');

  let outstandingLine = '';
  if (outstanding.outstandingMonthsCount > 0) {
    const prevNaira = (outstanding.previousOutstandingKobo / 100).toLocaleString('en-NG');
    outstandingLine = ` Outstanding: ₦${prevNaira} (${outstanding.outstandingMonthsCount} month(s): ${outstanding.outstandingMonthLabels.join(', ')}).`;
  }

  return (
    `Hello ${agreement.customerName}! Your ${pickup.binQuantity} ${pickup.binType} bin(s) ` +
    `were collected on ${pickup.pickupDate.toLocaleDateString('en-NG')} at ${pickup.lotCode}. ` +
    `${outstanding.currentBillingMonthLabel} charge: ₦${currentMonthNaira}.` +
    outstandingLine +
    ` Total due: ₦${amountNaira}. Pay: ${shortLink}`
  );
}

/**
 * Send SMS via Termii.
 */
export async function sendFixedBillingSms(
  agreement: IFixedBillingAgreement,
  pickup: PickupTriggerData,
  outstanding: OutstandingSummary,
  shortLink: string
): Promise<{ success: boolean; externalReference?: string; error?: string }> {
  const phone = normalisePhone(agreement.customerPhone || '');
  if (!phone) {
    return { success: false, error: `Invalid phone number: ${agreement.customerPhone}` };
  }

  const message = buildSmsMessage(agreement, pickup, outstanding, shortLink);

  try {
    const response = await axios.post(
      TERMII_URL,
      {
        to: phone,
        from: TERMII_SENDER,
        sms: message,
        type: 'plain',
        channel: 'dnd',
        api_key: TERMII_API_KEY,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );
    const ref = response.data?.message_id || response.data?.data?.message_id || '';
    return { success: true, externalReference: ref };
  } catch (err: any) {
    const errMsg = err?.response?.data?.message || err?.message || 'Unknown error';
    console.error('[FixedBilling SMS] Failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

// ─── Email via Gmail/Nodemailer ───────────────────────────────────────────────

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: GMAIL_USER,
    pass: GMAIL_PASS,
  },
});

/**
 * Build the Fixed Billing email HTML body.
 */
function buildEmailBody(
  agreement: IFixedBillingAgreement,
  pickup: PickupTriggerData,
  outstanding: OutstandingSummary,
  paymentLink: string
): string {
  const amountNaira = (outstanding.totalPayableKobo / 100).toLocaleString('en-NG');
  const currentMonthNaira = (outstanding.currentMonthChargeKobo / 100).toLocaleString('en-NG');

  const outstandingSection =
    outstanding.outstandingMonthsCount > 0
      ? `
        <tr>
          <td style="padding:8px 0;color:#666;">Outstanding Balance</td>
          <td style="padding:8px 0;font-weight:bold;color:#e53e3e;">
            ₦${(outstanding.previousOutstandingKobo / 100).toLocaleString('en-NG')}
            (${outstanding.outstandingMonthsCount} month(s): ${outstanding.outstandingMonthLabels.join(', ')})
          </td>
        </tr>`
      : '';

  return `
<!DOCTYPE html>
<html>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#1a7a4a;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
    <h1 style="color:#fff;margin:0;font-size:22px;">MOTTAINAI RECYCLING</h1>
    <p style="color:#b7f5d4;margin:4px 0 0;">Fixed Billing — Pickup Notification</p>
  </div>
  <div style="background:#f9f9f9;padding:24px;border:1px solid #e2e8f0;border-top:none;">
    <p>🌟 Hello <strong>${agreement.customerName}</strong>! 🌟</p>
    <p>
      Your <strong>${pickup.binQuantity} ${pickup.binType} bin(s)</strong> were collected on
      <strong>${pickup.pickupDate.toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</strong>
      at <strong>${pickup.lotCode}</strong>.
    </p>

    <h3 style="color:#1a7a4a;border-bottom:2px solid #1a7a4a;padding-bottom:8px;">Billing Summary</h3>
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="padding:8px 0;color:#666;">${outstanding.currentBillingMonthLabel} Charge</td>
        <td style="padding:8px 0;font-weight:bold;">₦${currentMonthNaira}</td>
      </tr>
      ${outstandingSection}
      <tr style="border-top:2px solid #1a7a4a;">
        <td style="padding:12px 0;font-weight:bold;font-size:16px;">Total Amount Due</td>
        <td style="padding:12px 0;font-weight:bold;font-size:18px;color:#1a7a4a;">₦${amountNaira}</td>
      </tr>
    </table>

    <div style="text-align:center;margin:24px 0;">
      <a href="${paymentLink}"
         style="background:#1a7a4a;color:#fff;padding:14px 32px;border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;display:inline-block;">
        💳 Pay Now — ₦${amountNaira}
      </a>
    </div>

    <p style="font-size:13px;color:#888;">
      Your contribution matters! Together, we're creating a greener future. Let's keep up the great work! 💚🌍
    </p>
  </div>
  <div style="background:#e8f5e9;padding:12px;border-radius:0 0 8px 8px;text-align:center;font-size:12px;color:#666;">
    MOTTAINAI RECYCLING — billing@mottainai.africa
  </div>
</body>
</html>`;
}

/**
 * Send email notification via Gmail/Nodemailer.
 */
export async function sendFixedBillingEmail(
  agreement: IFixedBillingAgreement,
  pickup: PickupTriggerData,
  outstanding: OutstandingSummary,
  paymentLink: string
): Promise<{ success: boolean; error?: string }> {
  if (!agreement.customerEmail) {
    return { success: false, error: 'No email address on agreement' };
  }

  const subject = `Pickup Notification & Invoice — ${outstanding.currentBillingMonthLabel} | ₦${(outstanding.totalPayableKobo / 100).toLocaleString('en-NG')} due`;
  const html = buildEmailBody(agreement, pickup, outstanding, paymentLink);

  try {
    await emailTransporter.sendMail({
      from: 'MOTTAINAI RECYCLING <mottainairecycling21@gmail.com>',
      to: agreement.customerEmail,
      cc: 'billing@mottainai.africa, operations@mottainai.africa',
      subject,
      html,
    });
    return { success: true };
  } catch (err: any) {
    const errMsg = err?.message || 'Unknown error';
    console.error('[FixedBilling Email] Failed:', errMsg);
    return { success: false, error: errMsg };
  }
}

// ─── Main Trigger: Pickup → Notify ───────────────────────────────────────────

/**
 * Main entry point called when a pickup is recorded for a Fixed Billing customer.
 * 1. Compute outstanding balance
 * 2. Create Paystack payment link
 * 3. Send SMS (if enabled)
 * 4. Send Email (if enabled)
 * 5. Log all notifications
 */
export async function triggerFixedBillingNotification(
  agreement: IFixedBillingAgreement,
  pickup: PickupTriggerData
): Promise<{ smsResult: string; emailResult: string }> {
  // 0. Increment pickup count on the current month's ledger entry (Gap 1)
  const { month: currentMonth, label: currentLabel } = getCurrentBillingMonth();
  await ensureCurrentMonthLedger(agreement, currentMonth, currentLabel);
  await FixedBillingLedger.updateOne(
    { customerId: agreement.customerId, billingMonth: currentMonth },
    { $inc: { pickupCount: 1 } }
  );

  // 1. Compute outstanding
  const outstanding = await computeOutstanding(agreement);

  // 2. Create payment link
  let paymentLink = '';
  let reference = `FB-${agreement.customerId}-${Date.now()}`;
  let shortLink = '';

  try {
    const linkResult = await createFixedBillingPaymentLink(agreement, outstanding);
    paymentLink = linkResult.paymentLink;
    reference = linkResult.reference;
    shortLink = linkResult.shortLink;
  } catch (err: any) {
    console.error('[FixedBilling] Payment link creation failed:', err.message);
    // Use a fallback link so notification still goes out
    shortLink = `https://paystack.com/pay/mottainai`;
    paymentLink = shortLink;
  }

  let smsResult = 'skipped';
  let emailResult = 'skipped';

  // 3. Send SMS
  if (agreement.notifyBySms && agreement.customerPhone) {
    const smsRes = await sendFixedBillingSms(agreement, pickup, outstanding, shortLink);
    smsResult = smsRes.success ? 'sent' : 'failed';

    await FixedBillingNotificationLog.create({
      agreementId: agreement._id.toString(),
      customerId: agreement.customerId,
      customerName: agreement.customerName,
      companyId: agreement.companyId,
      pickupId: pickup.pickupId,
      pickupDate: pickup.pickupDate,
      binType: pickup.binType,
      binQuantity: pickup.binQuantity,
      lotCode: pickup.lotCode,
      currentMonthChargeKobo: outstanding.currentMonthChargeKobo,
      currentBillingMonth: outstanding.currentBillingMonth,
      previousOutstandingKobo: outstanding.previousOutstandingKobo,
      outstandingMonthsCount: outstanding.outstandingMonthsCount,
      outstandingMonthLabels: outstanding.outstandingMonthLabels,
      totalPayableKobo: outstanding.totalPayableKobo,
      paystackPaymentLink: paymentLink,
      paystackReference: reference,
      channel: 'sms',
      recipient: agreement.customerPhone,
      messageContent: buildSmsMessage(agreement, pickup, outstanding, shortLink),
      status: smsResult as 'sent' | 'failed' | 'skipped',
      errorMessage: smsRes.success ? undefined : smsRes.error,
      externalReference: smsRes.externalReference,
      sentAt: new Date(),
    });
  }

  // 4. Send Email
  if (agreement.notifyByEmail && agreement.customerEmail) {
    const emailRes = await sendFixedBillingEmail(agreement, pickup, outstanding, paymentLink);
    emailResult = emailRes.success ? 'sent' : 'failed';

    await FixedBillingNotificationLog.create({
      agreementId: agreement._id.toString(),
      customerId: agreement.customerId,
      customerName: agreement.customerName,
      companyId: agreement.companyId,
      pickupId: pickup.pickupId,
      pickupDate: pickup.pickupDate,
      binType: pickup.binType,
      binQuantity: pickup.binQuantity,
      lotCode: pickup.lotCode,
      currentMonthChargeKobo: outstanding.currentMonthChargeKobo,
      currentBillingMonth: outstanding.currentBillingMonth,
      previousOutstandingKobo: outstanding.previousOutstandingKobo,
      outstandingMonthsCount: outstanding.outstandingMonthsCount,
      outstandingMonthLabels: outstanding.outstandingMonthLabels,
      totalPayableKobo: outstanding.totalPayableKobo,
      paystackPaymentLink: paymentLink,
      paystackReference: reference,
      channel: 'email',
      recipient: agreement.customerEmail,
      messageContent: `Email sent: ${subject_placeholder(outstanding)}`,
      status: emailResult as 'sent' | 'failed' | 'skipped',
      errorMessage: emailRes.success ? undefined : emailRes.error,
      sentAt: new Date(),
    });
  }

  return { smsResult, emailResult };
}

function subject_placeholder(outstanding: OutstandingSummary): string {
  return `Pickup Notification & Invoice — ${outstanding.currentBillingMonthLabel} | ₦${(outstanding.totalPayableKobo / 100).toLocaleString('en-NG')} due`;
}

// ─── Bulk Monthly Ledger Generation ──────────────────────────────────────────

/**
 * Generate ledger entries for all active Fixed Billing agreements for the current month.
 * Called by a cron job or manually from the admin dashboard.
 * Idempotent — skips customers who already have a ledger entry for the current month.
 */
export async function generateMonthlyLedgerEntries(): Promise<{
  created: number;
  skipped: number;
}> {
  const { month, label } = getCurrentBillingMonth();

  const activeAgreements = await FixedBillingAgreement.find({ active: true });
  let created = 0;
  let skipped = 0;

  for (const agreement of activeAgreements) {
    const existing = await FixedBillingLedger.findOne({
      customerId: agreement.customerId,
      billingMonth: month,
    });

    if (existing) {
      skipped++;
      continue;
    }

    await FixedBillingLedger.create({
      agreementId: agreement._id.toString(),
      customerId: agreement.customerId,
      customerName: agreement.customerName,
      companyId: agreement.companyId,
      lotCode: agreement.lotCode,
      billingMonth: month,
      billingMonthLabel: label,
      chargedAmountKobo: agreement.agreedMonthlyPriceKobo,
      paidAmountKobo: 0,
      outstandingAmountKobo: agreement.agreedMonthlyPriceKobo,
      status: 'unpaid',
      payments: [],
      chargeRaisedAt: new Date(),
    });
    created++;
  }

  return { created, skipped };
}

// ─── Record Payment ───────────────────────────────────────────────────────────

/**
 * Record a payment against a ledger entry (from Paystack webhook or manual entry).
 */
export async function recordLedgerPayment(
  customerId: string,
  billingMonth: string,
  amountKobo: number,
  paystackReference?: string,
  channel = 'paystack',
  recordedBy?: string
): Promise<IFixedBillingLedger | null> {
  const ledger = await FixedBillingLedger.findOne({ customerId, billingMonth });
  if (!ledger) return null;

  const newPaid = ledger.paidAmountKobo + amountKobo;
  const newOutstanding = Math.max(0, ledger.chargedAmountKobo - newPaid);
  const newStatus =
    newOutstanding === 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';

  ledger.paidAmountKobo = newPaid;
  ledger.outstandingAmountKobo = newOutstanding;
  ledger.status = newStatus as any;
  ledger.payments.push({
    paidAt: new Date(),
    amountKobo,
    paystackReference,
    channel,
    recordedBy,
  });
  if (newStatus === 'paid') {
    ledger.paidAt = new Date();
  }

  await ledger.save();
  return ledger;
}
