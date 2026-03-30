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
 * Company Type Enum
 * Defines the hierarchy level of a company
 */
export type CompanyType = 'franchisor' | 'franchisee' | 'independent';

/**
 * Company Document Interface
 * Extends MongoDB Document with company-specific fields
 */
export interface ICompany extends Document {
  _id: string; // Override Document's _id to be string
  companyId: string;
  companyName: string;
  pin: string; // PIN for mobile app authentication
  
  // Franchise hierarchy fields
  companyType: CompanyType; // Franchisor, Franchisee, or Independent
  parentCompanyId: string | null; // Links franchisee to franchisor
  canCherryPick: boolean; // Can claim pickups from any lot (franchisor only)
  
  operationalLots: IOperationalLot[]; // Lots directly owned/operated by this company
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Company Schema
 * Matches production MongoDB structure with franchise hierarchy support
 */
const companySchema = new Schema<ICompany>({
  companyId: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  pin: { type: String, required: true, default: '000000' }, // 6-digit PIN for mobile app
  
  // Franchise hierarchy fields
  companyType: { 
    type: String, 
    enum: ['franchisor', 'franchisee', 'independent'],
    default: 'independent',
    required: true 
  },
  parentCompanyId: { 
    type: String, 
    default: null,
    validate: {
      validator: function(this: ICompany, value: string | null) {
        // Franchisees must have a parent, others must not
        if (this.companyType === 'franchisee') {
          return value !== null && value !== '';
        }
        return value === null;
      },
      message: 'Franchisees must have a parent company, others must not'
    }
  },
  canCherryPick: { 
    type: Boolean, 
    default: false,
    validate: {
      validator: function(this: ICompany, value: boolean) {
        // Only franchisors can cherry pick
        if (value === true && this.companyType !== 'franchisor') {
          return false;
        }
        return true;
      },
      message: 'Only franchisors can have cherry pick capability'
    }
  },
  
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
