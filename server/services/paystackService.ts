/**
 * Paystack Service
 *
 * Handles all Paystack API calls for:
 * - Subaccount creation (per-company settlement account)
 * - Split code creation (residential + commercial)
 * - Webhook registration (dynamic per-company webhook URLs)
 * - Customer and invoice management (used by batch re-invoicing)
 */

import axios from 'axios';

const PAYSTACK_BASE = 'https://api.paystack.co';

function getHeaders() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured');
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
}

// ─── Subaccount ─────────────────────────────────────────────────────────────

export interface CreateSubaccountParams {
  businessName: string;
  settlementBank: string;   // Bank code, e.g. "058" for GTBank
  accountNumber: string;    // 10-digit NUBAN
  percentageCharge: number; // 1–99 (company's share)
  description?: string;
}

export interface PaystackSubaccount {
  id: number;
  subaccount_code: string;
  business_name: string;
  settlement_bank: string;
  account_number: string;
  percentage_charge: number;
  active: boolean;
}

export async function createSubaccount(params: CreateSubaccountParams): Promise<PaystackSubaccount> {
  const response = await axios.post(
    `${PAYSTACK_BASE}/subaccount`,
    {
      business_name: params.businessName,
      settlement_bank: params.settlementBank,
      account_number: params.accountNumber,
      percentage_charge: params.percentageCharge,
      description: params.description || `Mottainai partner: ${params.businessName}`,
    },
    { headers: getHeaders() }
  );
  if (!response.data.status) {
    throw new Error(`Paystack subaccount creation failed: ${response.data.message}`);
  }
  return response.data.data as PaystackSubaccount;
}

export async function getSubaccount(subaccountCode: string): Promise<PaystackSubaccount> {
  const response = await axios.get(
    `${PAYSTACK_BASE}/subaccount/${subaccountCode}`,
    { headers: getHeaders() }
  );
  if (!response.data.status) {
    throw new Error(`Paystack subaccount fetch failed: ${response.data.message}`);
  }
  return response.data.data as PaystackSubaccount;
}

// ─── Split Codes ─────────────────────────────────────────────────────────────

export interface CreateSplitParams {
  name: string;             // e.g. "Mottainai - ABC Company Residential"
  subaccountCode: string;   // ACCT_xxxxxxxxxxxxxxx
  percentageCharge: number; // company's share (1–99)
  bearerType?: 'account' | 'subaccount' | 'all-proportional' | 'all';
}

export interface PaystackSplit {
  id: number;
  name: string;
  split_code: string;
  type: string;
  active: boolean;
  bearer_type: string;
  subaccounts: Array<{
    subaccount: { subaccount_code: string };
    share: number;
  }>;
}

export async function createSplitCode(params: CreateSplitParams): Promise<PaystackSplit> {
  const response = await axios.post(
    `${PAYSTACK_BASE}/split`,
    {
      name: params.name,
      type: 'percentage',
      currency: 'NGN',
      bearer_type: params.bearerType || 'subaccount',
      bearer_subaccount: params.subaccountCode,
      subaccounts: [
        {
          subaccount: params.subaccountCode,
          share: params.percentageCharge,
        },
      ],
    },
    { headers: getHeaders() }
  );
  if (!response.data.status) {
    throw new Error(`Paystack split code creation failed: ${response.data.message}`);
  }
  return response.data.data as PaystackSplit;
}

export async function getSplitCode(splitCode: string): Promise<PaystackSplit> {
  const response = await axios.get(
    `${PAYSTACK_BASE}/split/${splitCode}`,
    { headers: getHeaders() }
  );
  if (!response.data.status) {
    throw new Error(`Paystack split code fetch failed: ${response.data.message}`);
  }
  return response.data.data as PaystackSplit;
}

// ─── Banks ────────────────────────────────────────────────────────────────────

export interface PaystackBank {
  id: number;
  name: string;
  code: string;
  country: string;
  currency: string;
}

export async function listBanks(): Promise<PaystackBank[]> {
  const response = await axios.get(
    `${PAYSTACK_BASE}/bank?country=nigeria&currency=NGN&perPage=100`,
    { headers: getHeaders() }
  );
  if (!response.data.status) {
    throw new Error(`Paystack bank list failed: ${response.data.message}`);
  }
  return response.data.data as PaystackBank[];
}

export async function resolveAccountNumber(accountNumber: string, bankCode: string): Promise<{ account_name: string; account_number: string }> {
  const response = await axios.get(
    `${PAYSTACK_BASE}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
    { headers: getHeaders() }
  );
  if (!response.data.status) {
    throw new Error(`Account resolution failed: ${response.data.message}`);
  }
  return response.data.data;
}

// ─── Webhook Registration ─────────────────────────────────────────────────────

/**
 * Paystack does not have a REST API for webhook registration — webhooks are
 * configured in the Paystack dashboard per integration key.
 *
 * For per-company dynamic webhooks, we use Paystack's split code + subaccount
 * model: all payments flow through the main Mottainai Paystack account, and
 * the webhook URL on the main account routes events to the correct company
 * handler based on the split_code embedded in the event payload.
 *
 * This function generates the webhook URL that should be registered for a
 * company's operational lot, following the existing pattern:
 *   https://upwork.kowope.xyz/survey/{SPL_residential}/{SPL_commercial}?token={TOKEN}
 */
export function generateWebhookUrl(
  splitCodeResidential: string,
  splitCodeCommercial: string,
  token: string,
  baseUrl = 'https://upwork.kowope.xyz'
): string {
  return `${baseUrl}/survey/${splitCodeResidential}/${splitCodeCommercial}?token=${token}`;
}

// ─── Customer & Invoice ───────────────────────────────────────────────────────

export async function getOrCreateCustomer(email: string, fullName: string, phone?: string) {
  const headers = getHeaders();
  // Try to find existing customer
  try {
    const searchResp = await axios.get(
      `${PAYSTACK_BASE}/customer?email=${encodeURIComponent(email)}`,
      { headers }
    );
    if (searchResp.data.status && searchResp.data.data?.length > 0) {
      return searchResp.data.data[0];
    }
  } catch (_) {
    // Fall through to create
  }

  // Create new customer
  const nameParts = fullName.trim().split(' ');
  const createResp = await axios.post(
    `${PAYSTACK_BASE}/customer`,
    {
      email,
      first_name: nameParts[0] || fullName,
      last_name: nameParts.slice(1).join(' ') || fullName,
      phone: phone || undefined,
    },
    { headers }
  );
  if (!createResp.data.status) {
    throw new Error(`Customer creation failed: ${createResp.data.message}`);
  }
  return createResp.data.data;
}
