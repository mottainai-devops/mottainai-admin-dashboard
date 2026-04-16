import mongoose, { Schema, Document } from 'mongoose';
import type { BinType, CollectionFrequency } from './TariffSchedule';

/**
 * FixedBillingAgreement Document Interface
 *
 * Represents the pre-agreed fixed billing contract between a customer and a company.
 * The agreed monthly amount is derived from the official tariff schedule but can be
 * overridden (e.g. negotiated discount) with admin justification.
 *
 * Billing model: FIXED — customer is charged a fixed monthly amount regardless of
 * how many pickups occur. Each pickup triggers an SMS/email notification with the
 * amount due (current month + outstanding) and a Paystack payment link.
 */
export interface IFixedBillingAgreement extends Document {
  _id: string;

  // ─── Customer & Company ──────────────────────────────────────────────────
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;

  companyId: string;
  companyName: string;

  lotCode: string;

  // ─── Agreement Terms ─────────────────────────────────────────────────────
  /** Reference tariff code from TariffSchedule */
  tariffCode: string;
  /** Bin type agreed */
  binType: BinType;
  /** Collection frequency agreed */
  frequency: CollectionFrequency;
  /** Number of bins agreed */
  binsCount: number;
  /** Official tariff monthly price in kobo (from TariffSchedule at time of agreement) */
  officialMonthlyPriceKobo: number;
  /**
   * Actual agreed monthly price in kobo.
   * Usually equals officialMonthlyPriceKobo but can differ if negotiated.
   */
  agreedMonthlyPriceKobo: number;
  /** If agreedMonthlyPriceKobo differs from official, reason must be provided */
  priceOverrideReason?: string;
  /**
   * Opening balance in kobo imported from Zoho Books at agreement creation.
   * Represents any pre-existing debt before entering the fixed billing scheme.
   * Added to totalPayableKobo in computeOutstanding.
   */
  openingBalanceKobo: number;

  // ─── Agreement Lifecycle ─────────────────────────────────────────────────
  /** Date from which billing starts */
  startDate: Date;
  /** Date on which billing ends (null = ongoing) */
  endDate?: Date;
  /** Whether this agreement is currently active */
  active: boolean;

  // ─── Notification Preferences ────────────────────────────────────────────
  /** Send SMS notification on each pickup */
  notifyBySms: boolean;
  /** Send email notification on each pickup */
  notifyByEmail: boolean;

  // ─── Audit ───────────────────────────────────────────────────────────────
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  notes?: string;
}

const FixedBillingAgreementSchema = new Schema<IFixedBillingAgreement>(
  {
    customerId: { type: String, required: true },
    customerName: { type: String, required: true },
    customerPhone: { type: String },
    customerEmail: { type: String },

    companyId: { type: String, required: true },
    companyName: { type: String, required: true },
    lotCode: { type: String, required: true },

    tariffCode: { type: String, required: true },
    binType: {
      type: String,
      enum: ['120L', '240L', '660L', '1100L', 'sachet', 'other'],
      required: true,
    },
    frequency: {
      type: String,
      enum: ['once_weekly', 'twice_weekly', 'thrice_weekly', 'daily', 'fortnightly', 'monthly'],
      required: true,
    },
    binsCount: { type: Number, required: true, default: 1, min: 1 },
    officialMonthlyPriceKobo: { type: Number, required: true },
    agreedMonthlyPriceKobo: { type: Number, required: true },
    priceOverrideReason: { type: String },
    openingBalanceKobo: { type: Number, default: 0 },

    startDate: { type: Date, required: true },
    endDate: { type: Date },
    active: { type: Boolean, default: true },

    notifyBySms: { type: Boolean, default: true },
    notifyByEmail: { type: Boolean, default: true },

    createdBy: { type: String, required: true },
    notes: { type: String },
  },
  { timestamps: true }
);

FixedBillingAgreementSchema.index({ customerId: 1, active: 1 });
FixedBillingAgreementSchema.index({ companyId: 1, active: 1 });
FixedBillingAgreementSchema.index({ lotCode: 1 });

export const FixedBillingAgreement = mongoose.model<IFixedBillingAgreement>(
  'FixedBillingAgreement',
  FixedBillingAgreementSchema,
  'fixedbillingagreements'
);
