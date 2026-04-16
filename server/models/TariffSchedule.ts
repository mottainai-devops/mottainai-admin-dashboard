import mongoose, { Schema, Document } from 'mongoose';

/**
 * Frequency Enum
 * How often waste is collected per week
 */
export type CollectionFrequency =
  | 'once_weekly'
  | 'twice_weekly'
  | 'thrice_weekly'
  | 'daily'
  | 'fortnightly'
  | 'monthly';

/**
 * Bin Type Enum
 * Standard bin types used in the platform
 */
export type BinType =
  | '120L'
  | '240L'
  | '660L'
  | '1100L'
  | 'MAMMOTH (1100 LITRE)'
  | '7-11 TONNE COMPACTOR'
  | 'sachet'
  | 'other';

/**
 * TariffSchedule Document Interface
 * Represents an official approved price for a given bin type × frequency combination.
 * These are the reference prices used when setting up Fixed Billing agreements.
 */
export interface ITariffSchedule extends Document {
  _id: string;
  /** Unique code for this tariff line, e.g. "120L-TWICE" */
  tariffCode: string;
  /** Human-readable label, e.g. "120L bin — twice weekly" */
  label: string;
  /** Bin type */
  binType: BinType;
  /** Collection frequency */
  frequency: CollectionFrequency;
  /** Number of bins this tariff applies to (default 1) */
  binsCount: number;
  /** Official approved monthly price in Naira (kobo stored, display in Naira) */
  monthlyPriceKobo: number;
  /** Customer type this tariff applies to */
  customerType: 'residential' | 'commercial' | 'industrial' | 'all';
  /** Whether this tariff is currently active */
  active: boolean;
  /** Admin notes */
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

const TariffScheduleSchema = new Schema<ITariffSchedule>(
  {
    tariffCode: { type: String, required: true, unique: true, uppercase: true, trim: true },
    label: { type: String, required: true },
    binType: {
      type: String,
      enum: ['120L', '240L', '660L', '1100L', 'MAMMOTH (1100 LITRE)', '7-11 TONNE COMPACTOR', 'sachet', 'other'],
      required: true,
    },
    frequency: {
      type: String,
      enum: ['once_weekly', 'twice_weekly', 'thrice_weekly', 'daily', 'fortnightly', 'monthly'],
      required: true,
    },
    binsCount: { type: Number, required: true, default: 1, min: 1 },
    monthlyPriceKobo: { type: Number, required: true, min: 0 },
    customerType: {
      type: String,
      enum: ['residential', 'commercial', 'industrial', 'all'],
      default: 'all',
    },
    active: { type: Boolean, default: true },
    notes: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

TariffScheduleSchema.index({ binType: 1, frequency: 1, binsCount: 1 });
TariffScheduleSchema.index({ active: 1 });

export const TariffSchedule = mongoose.model<ITariffSchedule>(
  'TariffSchedule',
  TariffScheduleSchema,
  'tariffschedules'
);
