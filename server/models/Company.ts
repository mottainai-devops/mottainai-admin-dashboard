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
 * Paystack Setup Status
 */
export type PaystackSetupStatus = 'not_configured' | 'pending' | 'active' | 'failed';

/**
 * Zoho Setup Status
 */
export type ZohoSetupStatus = 'not_connected' | 'connected' | 'expired';

/**
 * Company Document Interface
 * Extends MongoDB Document with company-specific fields
 */
export interface ICompany extends Document {
  _id: string;
  companyId: string;
  companyName: string;
  pin: string;

  // Franchise hierarchy fields
  companyType: CompanyType;
  parentCompanyId: string | null;
  canCherryPick: boolean;

  operationalLots: IOperationalLot[];
  active: boolean;

  // ─── Paystack Integration ──────────────────────────────────────────────────
  /** Paystack subaccount code, e.g. "ACCT_xxxxxxxxxxxxxxx" */
  paystackSubaccountCode: string | null;
  /** Paystack internal subaccount ID */
  paystackSubaccountId: string | null;
  /** Split code for residential customers, e.g. "SPL_xxxxxxxxxx" */
  paystackSplitCodeResidential: string | null;
  /** Split code for commercial customers, e.g. "SPL_xxxxxxxxxx" */
  paystackSplitCodeCommercial: string | null;
  /** Percentage of each transaction that goes to the company (1–99) */
  paystackPercentageCharge: number;
  /** Bank code for the company's settlement bank (e.g. "058" for GTBank) */
  paystackBankCode: string | null;
  /** Bank account number for settlement */
  paystackAccountNumber: string | null;
  /** Current Paystack setup status */
  paystackSetupStatus: PaystackSetupStatus;

  // ─── Zoho Books Integration ────────────────────────────────────────────────
  /** Company's own Zoho Books organisation ID */
  zohoOrganizationId: string | null;
  /** Current Zoho connection status */
  zohoSetupStatus: ZohoSetupStatus;

  // ─── Portal Access ─────────────────────────────────────────────────────────
  /** Whether this company can access the independent company portal */
  portalEnabled: boolean;

  createdAt: Date;
  updatedAt: Date;
}

/**
 * Company Schema
 * Matches production MongoDB structure with franchise hierarchy and integration support
 */
const companySchema = new Schema<ICompany>({
  companyId: { type: String, required: true, unique: true },
  companyName: { type: String, required: true },
  pin: { type: String, required: true, default: '000000' },

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

  // ─── Paystack Integration ──────────────────────────────────────────────────
  paystackSubaccountCode: { type: String, default: null },
  paystackSubaccountId: { type: String, default: null },
  paystackSplitCodeResidential: { type: String, default: null },
  paystackSplitCodeCommercial: { type: String, default: null },
  paystackPercentageCharge: { type: Number, default: 80, min: 1, max: 99 },
  paystackBankCode: { type: String, default: null },
  paystackAccountNumber: { type: String, default: null },
  paystackSetupStatus: {
    type: String,
    enum: ['not_configured', 'pending', 'active', 'failed'],
    default: 'not_configured'
  },

  // ─── Zoho Books Integration ────────────────────────────────────────────────
  zohoOrganizationId: { type: String, default: null },
  zohoSetupStatus: {
    type: String,
    enum: ['not_connected', 'connected', 'expired'],
    default: 'not_connected'
  },

  // ─── Portal Access ─────────────────────────────────────────────────────────
  portalEnabled: { type: Boolean, default: false },

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
companySchema.index({ companyId: 1 });
companySchema.index({ pin: 1 });
companySchema.index({ companyType: 1 });
companySchema.index({ paystackSetupStatus: 1 });

export const Company = mongoose.model<ICompany>('Company', companySchema);
