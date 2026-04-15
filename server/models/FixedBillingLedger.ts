import mongoose, { Schema, Document } from 'mongoose';

/**
 * Ledger Entry Status
 */
export type LedgerEntryStatus = 'unpaid' | 'partial' | 'paid' | 'waived';

/**
 * FixedBillingLedger Document Interface
 *
 * One record per customer per billing month.
 * Tracks the monthly charge raised, how much has been paid, and the outstanding balance.
 *
 * The outstanding balance across ALL unpaid months is used to compute the total
 * amount shown in pickup notifications and on the Paystack payment link.
 */
export interface IFixedBillingLedger extends Document {
  _id: string;

  // ─── Reference ───────────────────────────────────────────────────────────
  agreementId: string;
  customerId: string;
  customerName: string;
  companyId: string;
  lotCode: string;

  // ─── Billing Period ──────────────────────────────────────────────────────
  /** Billing month in "YYYY-MM" format, e.g. "2026-04" */
  billingMonth: string;
  /** Human-readable label, e.g. "April 2026" */
  billingMonthLabel: string;

  // ─── Amounts (all in kobo) ───────────────────────────────────────────────
  /** Monthly charge raised (from agreement at time of generation) */
  chargedAmountKobo: number;
  /** Total amount paid so far against this month */
  paidAmountKobo: number;
  /** Outstanding = chargedAmountKobo - paidAmountKobo */
  outstandingAmountKobo: number;

  // ─── Status ──────────────────────────────────────────────────────────────
  status: LedgerEntryStatus;

  // ─── Payment Records ─────────────────────────────────────────────────────
  payments: {
    paidAt: Date;
    amountKobo: number;
    paystackReference?: string;
    channel?: string; // 'paystack' | 'cash' | 'bank_transfer' | 'other'
    recordedBy?: string;
    notes?: string;
  }[];

  // ─── Pickup Tracking ─────────────────────────────────────────────────────
  /** Number of pickups recorded against this billing month */
  pickupCount: number;

  // ─── Audit ───────────────────────────────────────────────────────────────
  /** Date the charge was raised (usually 1st of the billing month) */
  chargeRaisedAt: Date;
  /** Date fully paid (null if not yet paid) */
  paidAt?: Date;
  /** Admin who waived the charge (if waived) */
  waivedBy?: string;
  waivedReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema(
  {
    paidAt: { type: Date, required: true },
    amountKobo: { type: Number, required: true },
    paystackReference: { type: String },
    channel: { type: String, default: 'paystack' },
    recordedBy: { type: String },
    notes: { type: String },
  },
  { _id: true }
);

const FixedBillingLedgerSchema = new Schema<IFixedBillingLedger>(
  {
    agreementId: { type: String, required: true },
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    companyId: { type: String, required: true },
    lotCode: { type: String, required: true },

    billingMonth: { type: String, required: true }, // "YYYY-MM"
    billingMonthLabel: { type: String, required: true }, // "April 2026"

    chargedAmountKobo: { type: Number, required: true },
    paidAmountKobo: { type: Number, default: 0 },
    outstandingAmountKobo: { type: Number, required: true },

    status: {
      type: String,
      enum: ['unpaid', 'partial', 'paid', 'waived'],
      default: 'unpaid',
    },

    payments: [PaymentRecordSchema],

    pickupCount: { type: Number, default: 0 },
    chargeRaisedAt: { type: Date, required: true },
    paidAt: { type: Date },
    waivedBy: { type: String },
    waivedReason: { type: String },
  },
  { timestamps: true }
);

// Unique constraint: one ledger entry per customer per month
FixedBillingLedgerSchema.index(
  { customerId: 1, billingMonth: 1 },
  { unique: true }
);
FixedBillingLedgerSchema.index({ companyId: 1, billingMonth: 1 });
FixedBillingLedgerSchema.index({ status: 1 });
FixedBillingLedgerSchema.index({ agreementId: 1 });

export const FixedBillingLedger = mongoose.model<IFixedBillingLedger>(
  'FixedBillingLedger',
  FixedBillingLedgerSchema,
  'fixedbillingledger'
);
