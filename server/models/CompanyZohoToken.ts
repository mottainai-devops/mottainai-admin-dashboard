import mongoose, { Schema, Document } from 'mongoose';

/**
 * CompanyZohoToken
 *
 * Stores per-company Zoho Books OAuth tokens.
 * Mottainai registers a single Zoho OAuth application (shared Client ID + Secret).
 * Each company connects its own Zoho Books organisation — only `organizationId` differs.
 *
 * Token refresh is handled automatically by the Zoho service before each API call.
 */
export interface ICompanyZohoToken extends Document {
  companyId: string;           // FK → Company.companyId
  organizationId: string;      // Company's Zoho Books organisation ID
  accessToken: string;         // Current Zoho access token
  refreshToken: string;        // Long-lived refresh token (never expires unless revoked)
  expiresAt: Date;             // When the current access token expires
  scope: string;               // OAuth scopes granted
  connectedAt: Date;           // When the company first connected
  lastRefreshedAt: Date;       // Last successful token refresh
  createdAt: Date;
  updatedAt: Date;
}

const companyZohoTokenSchema = new Schema<ICompanyZohoToken>({
  companyId: { type: String, required: true, unique: true },
  organizationId: { type: String, required: true },
  accessToken: { type: String, required: true },
  refreshToken: { type: String, required: true },
  expiresAt: { type: Date, required: true },
  scope: { type: String, default: 'ZohoBooks.fullaccess.all' },
  connectedAt: { type: Date, default: Date.now },
  lastRefreshedAt: { type: Date, default: Date.now },
}, {
  timestamps: true
});

companyZohoTokenSchema.index({ companyId: 1 }, { unique: true });

export const CompanyZohoToken = mongoose.model<ICompanyZohoToken>(
  'CompanyZohoToken',
  companyZohoTokenSchema
);
