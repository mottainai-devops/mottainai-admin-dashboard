import mongoose, { Schema, Document } from 'mongoose';

/**
 * Operational Lot Schema
 * Represents a lot managed by a company with webhook URLs for different billing types
 */
export interface IOperationalLot {
  lotCode: string;
  lotName: string;
  paytWebhook: string;
  monthlyWebhook: string;
}

const operationalLotSchema = new Schema<IOperationalLot>({
  lotCode: { type: String, required: true },
  lotName: { type: String, required: true },
  paytWebhook: { type: String, required: true },
  monthlyWebhook: { type: String, required: true }
}, { _id: false });

/**
 * Company Document Interface
 * Extends MongoDB Document with company-specific fields
 */
export interface ICompany extends Document {
  _id: string; // Override Document's _id to be string
  companyId: string;
  companyName: string;
  pin: string; // PIN for mobile app authentication
  operationalLots: IOperationalLot[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Company Schema
 * Matches production MongoDB structure with added PIN field
 */
const companySchema = new Schema<ICompany>({
  companyId: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  pin: { type: String, required: true, default: '0000' }, // Default PIN, should be changed
  operationalLots: [operationalLotSchema],
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true // Automatically manage createdAt and updatedAt
});

// Create index on companyId for faster lookups
companySchema.index({ companyId: 1 });

// Create index on PIN for authentication queries
companySchema.index({ pin: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
