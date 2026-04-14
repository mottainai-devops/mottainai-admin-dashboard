/**
 * Zoho Books Service (Per-Company)
 *
 * Mottainai registers ONE Zoho OAuth application (shared Client ID + Secret).
 * Each independent company connects its own Zoho Books organisation — only
 * `organizationId` differs per company.
 *
 * Token lifecycle:
 *   - Access tokens expire in 1 hour
 *   - Refresh tokens are long-lived (never expire unless revoked)
 *   - This service auto-refreshes before every API call
 */

import axios from 'axios';
import { CompanyZohoToken } from '../models/CompanyZohoToken';
import { Company } from '../models/Company';

const ZOHO_ACCOUNTS_URL = 'https://accounts.zoho.com/oauth/v2';
const ZOHO_BOOKS_URL = 'https://www.zohoapis.com/books/v3';
const TOKEN_BUFFER_SECONDS = 300; // Refresh 5 minutes before expiry

function getOAuthCredentials() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const redirectUri = process.env.ZOHO_REDIRECT_URI || 'https://admin.kowope.xyz/api/company-portal/zoho/callback';
  if (!clientId || !clientSecret) {
    throw new Error('ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET must be configured');
  }
  return { clientId, clientSecret, redirectUri };
}

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

/**
 * Generate the Zoho OAuth authorization URL for a specific company.
 * The `state` parameter encodes the companyId so the callback can associate
 * the token with the correct company.
 */
export function getAuthorizationUrl(companyId: string): string {
  const { clientId, redirectUri } = getOAuthCredentials();
  const state = Buffer.from(JSON.stringify({ companyId })).toString('base64');
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: 'ZohoBooks.fullaccess.all',
    redirect_uri: redirectUri,
    access_type: 'offline',
    state,
  });
  return `${ZOHO_ACCOUNTS_URL}/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Stores the tokens in CompanyZohoToken and updates the Company record.
 */
export async function handleOAuthCallback(
  code: string,
  companyId: string,
  organizationId: string
): Promise<void> {
  const { clientId, clientSecret, redirectUri } = getOAuthCredentials();

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await axios.post(`${ZOHO_ACCOUNTS_URL}/token`, params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!response.data.access_token) {
    throw new Error(`Zoho OAuth callback failed: ${JSON.stringify(response.data)}`);
  }

  const expiresAt = new Date(Date.now() + (response.data.expires_in || 3600) * 1000);

  await CompanyZohoToken.findOneAndUpdate(
    { companyId },
    {
      companyId,
      organizationId,
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresAt,
      scope: response.data.scope || 'ZohoBooks.fullaccess.all',
      connectedAt: new Date(),
      lastRefreshedAt: new Date(),
    },
    { upsert: true, new: true }
  );

  // Update company record
  await Company.findOneAndUpdate(
    { companyId },
    {
      zohoOrganizationId: organizationId,
      zohoSetupStatus: 'connected',
    }
  );
}

// ─── Token Management ─────────────────────────────────────────────────────────

/**
 * Get a valid access token for a company, refreshing if necessary.
 */
async function getValidAccessToken(companyId: string): Promise<string> {
  const tokenDoc = await CompanyZohoToken.findOne({ companyId });
  if (!tokenDoc) {
    throw new Error(`No Zoho token found for company ${companyId}. Please connect Zoho Books first.`);
  }

  const now = new Date();
  const bufferMs = TOKEN_BUFFER_SECONDS * 1000;
  const isExpired = tokenDoc.expiresAt.getTime() - now.getTime() < bufferMs;

  if (!isExpired) {
    return tokenDoc.accessToken;
  }

  // Refresh the token
  const { clientId, clientSecret } = getOAuthCredentials();
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: tokenDoc.refreshToken,
  });

  try {
    const response = await axios.post(`${ZOHO_ACCOUNTS_URL}/token`, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    if (!response.data.access_token) {
      throw new Error(`Token refresh failed: ${JSON.stringify(response.data)}`);
    }

    const newExpiresAt = new Date(Date.now() + (response.data.expires_in || 3600) * 1000);

    await CompanyZohoToken.findOneAndUpdate(
      { companyId },
      {
        accessToken: response.data.access_token,
        expiresAt: newExpiresAt,
        lastRefreshedAt: new Date(),
      }
    );

    return response.data.access_token;
  } catch (err: any) {
    // Mark as expired in company record
    await Company.findOneAndUpdate({ companyId }, { zohoSetupStatus: 'expired' });
    throw new Error(`Zoho token refresh failed for company ${companyId}: ${err.message}`);
  }
}

function zohoUrl(path: string, organizationId: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${ZOHO_BOOKS_URL}${path}${sep}organization_id=${organizationId}`;
}

async function getHeaders(companyId: string): Promise<Record<string, string>> {
  const accessToken = await getValidAccessToken(companyId);
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

// ─── Zoho Books API Calls ─────────────────────────────────────────────────────

export async function getZohoContacts(companyId: string, organizationId: string, page = 1) {
  const headers = await getHeaders(companyId);
  const response = await axios.get(
    zohoUrl(`/contacts?page=${page}&per_page=200`, organizationId),
    { headers }
  );
  return response.data;
}

export async function getZohoInvoices(companyId: string, organizationId: string, page = 1) {
  const headers = await getHeaders(companyId);
  const response = await axios.get(
    zohoUrl(`/invoices?page=${page}&per_page=200&sort_column=created_time&sort_order=D`, organizationId),
    { headers }
  );
  return response.data;
}

export async function getZohoPayments(companyId: string, organizationId: string, page = 1) {
  const headers = await getHeaders(companyId);
  const response = await axios.get(
    zohoUrl(`/customerpayments?page=${page}&per_page=200`, organizationId),
    { headers }
  );
  return response.data;
}

export async function getZohoOrganizationInfo(companyId: string, organizationId: string) {
  const headers = await getHeaders(companyId);
  const response = await axios.get(
    zohoUrl(`/organizations/${organizationId}`, organizationId),
    { headers }
  );
  return response.data;
}

export async function isZohoConnected(companyId: string): Promise<boolean> {
  const tokenDoc = await CompanyZohoToken.findOne({ companyId });
  return !!tokenDoc;
}
