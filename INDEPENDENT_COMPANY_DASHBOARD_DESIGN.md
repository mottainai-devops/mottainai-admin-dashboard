# Independent Company Dashboard — Forensic Design Document

**Date:** April 14, 2026  
**Author:** Manus AI (Architecture Review)  
**Status:** AWAITING APPROVAL — No implementation has begun

---

## 1. Executive Summary

The goal is to give each independent/franchisee company on the Mottainai platform its own **self-service dashboard** where it can:

1. View and manage its own customers, pickups, billing records, and invoices — **scoped exclusively to its own data**
2. Connect its own **Zoho Books account** (OAuth) so invoices land in its own books
3. Have its own **Paystack subaccount** created dynamically, with a **split code** auto-generated and stored against its company record
4. Receive **Paystack webhook events** routed to the correct company automatically
5. Register and monitor its own **webhook endpoints** (payt + monthly) without needing admin intervention

Currently there are **18 companies** (4 independent, 12 franchisee, 2 franchisor) and **25 distinct Paystack split codes** in production. All of this is manually configured today. This design makes it dynamic.

---

## 2. Current State — What Exists Today

### 2.1 Company Model (MongoDB `companies` collection)

```
companyId          → unique string ID (e.g. "DIC", "TINKUB")
companyName        → display name
pin                → 6-digit PIN for mobile app
companyType        → "franchisor" | "franchisee" | "independent"
parentCompanyId    → links franchisee to franchisor
canCherryPick      → franchisor-only flag
operationalLots[]  → array of { lotCode, lotName, paytWebhook, monthlyWebhook }
active             → boolean
```

### 2.2 Webhook URL Pattern (Production)

Every lot's webhook URL follows this pattern:

```
PAYT:    https://upwork.kowope.xyz/survey/{splitCodeResidential}/{splitCodeCommercial}?token={TOKEN}
MONTHLY: https://upwork.kowope.xyz/survey/monthly/{splitCodeResidential}/{splitCodeCommercial}?token={TOKEN}
```

The backend route `/survey/:splitCodeResidential/:splitCodeCommercial` extracts the split codes from the URL, determines residential vs commercial from the form data, and uses the correct split code when creating the Paystack invoice.

### 2.3 Paystack Split Codes — Current State

25 distinct `SPL_*` codes exist in `monthlybilldatas`. Each code maps to a **Paystack Transaction Split** that defines the revenue share between Mottainai and the company's Paystack subaccount. These are currently created manually in the Paystack dashboard.

### 2.4 Zoho Books — Current State

A single Zoho Books organisation (`854644244`) is used for all companies. Invoices from all companies land in Mottainai's books. Independent companies have no visibility into their own Zoho invoices.

### 2.5 What Is Missing

| Feature | Current State | Target State |
|---|---|---|
| Company self-service portal | None | Dedicated login → scoped dashboard |
| Per-company Zoho account | Single shared org | Each company connects its own Zoho OAuth |
| Paystack subaccount | Manual creation | Auto-created on company registration |
| Split code | Manual creation | Auto-created and stored on company record |
| Webhook URL | Manually set per lot | Auto-generated from split codes |
| Webhook monitoring | Admin-only | Company can see its own webhook health |
| Billing visibility | Admin-only | Company sees its own invoices/payments |

---

## 3. Proposed Architecture

### 3.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MOTTAINAI PLATFORM                           │
│                                                                     │
│  ┌─────────────────────┐      ┌──────────────────────────────────┐  │
│  │  ADMIN DASHBOARD    │      │  COMPANY PORTAL (NEW)            │  │
│  │  admin.kowope.xyz   │      │  portal.kowope.xyz               │  │
│  │  (port 3003)        │      │  (port 3003, new routes)         │  │
│  │                     │      │                                  │  │
│  │  - All companies    │      │  - Company logs in with PIN      │  │
│  │  - Create company   │      │  - Sees ONLY its own data        │  │
│  │  - Assign lots      │      │  - Connects Zoho account         │  │
│  │  - Monitor all      │      │  - Views invoices/payments       │  │
│  │    webhooks         │      │  - Monitors its webhooks         │  │
│  │  - Batch reinvoice  │      │  - Batch reinvoice (own records) │  │
│  └──────────┬──────────┘      └──────────────┬───────────────────┘  │
│             │                                │                      │
│             └──────────────┬─────────────────┘                      │
│                            │                                        │
│                   ┌────────▼────────┐                               │
│                   │  tRPC API       │                               │
│                   │  (admin-dash    │                               │
│                   │   server)       │                               │
│                   └────────┬────────┘                               │
│                            │                                        │
│          ┌─────────────────┼─────────────────┐                      │
│          │                 │                 │                      │
│   ┌──────▼──────┐  ┌───────▼──────┐  ┌──────▼──────┐              │
│   │  MongoDB    │  │  Paystack    │  │  Zoho Books │              │
│   │  (arcgis)   │  │  API         │  │  (per-co    │              │
│   │             │  │              │  │   OAuth)    │              │
│   │  companies  │  │  /subaccount │  │             │              │
│   │  customers  │  │  /split      │  │  per-org    │              │
│   │  monthlybill│  │  /customer   │  │  invoices   │              │
│   │  zohotokens │  │  /payment    │  │             │              │
│   │  (per-co)   │  │   request    │  │             │              │
│   └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Authentication Strategy

The company portal reuses the existing **PIN-based authentication** already in the mobile app:

```
Company logs in → POST /api/company-portal/login { companyId, pin }
                → Returns JWT with { companyId, companyName, role: 'company' }
                → All subsequent tRPC calls carry this JWT
                → Backend scopes every query to req.companyId
```

This avoids creating a new auth system. The existing `User` model already has `companyId`. We add a `companyPortalProcedure` in tRPC that validates the company JWT and injects `ctx.company`.

---

## 4. Database Schema Changes

### 4.1 Extend the `Company` Model

Add the following fields to `ICompany` and `companySchema`:

```typescript
// Paystack integration
paystackSubaccountCode: string | null;   // e.g. "ACCT_xxxxxxxxxxxxxxx"
paystackSubaccountId:   string | null;   // Paystack internal ID
paystackSplitCodeResidential: string | null;  // e.g. "SPL_xxxxxxxxxx"
paystackSplitCodeCommercial:  string | null;  // e.g. "SPL_xxxxxxxxxx"
paystackSetupStatus: 'pending' | 'active' | 'failed';

// Zoho Books per-company integration
zohoOrganizationId:   string | null;   // Company's own Zoho org ID
zohoClientId:         string | null;   // Company's Zoho OAuth client ID
zohoClientSecret:     string | null;   // Company's Zoho OAuth client secret
zohoRefreshToken:     string | null;   // Stored refresh token
zohoAccessToken:      string | null;   // Current access token
zohoTokenExpiresAt:   Date | null;     // Token expiry
zohoSetupStatus: 'not_connected' | 'connected' | 'expired';

// Portal access
portalEnabled: boolean;  // Whether this company can access the portal
```

### 4.2 New `CompanyZohoToken` Collection

Rather than storing Zoho tokens directly on the Company document (security concern), create a separate collection:

```typescript
// server/models/CompanyZohoToken.ts
{
  companyId:      string;   // FK to Company.companyId
  organizationId: string;
  accessToken:    string;
  refreshToken:   string;
  expiresAt:      Date;
  clientId:       string;
  clientSecret:   string;  // encrypted at rest
  createdAt:      Date;
  updatedAt:      Date;
}
```

---

## 5. Paystack Dynamic Setup — Step by Step

### 5.1 When a New Company Is Created (Admin Flow)

When an admin creates or onboards a new company, the system automatically:

**Step 1 — Create Paystack Subaccount**

```
POST https://api.paystack.co/subaccount
Authorization: Bearer {PAYSTACK_SECRET_KEY}
{
  "business_name": "{companyName}",
  "settlement_bank": "{bankCode}",   // Admin provides bank code
  "account_number": "{accountNo}",   // Admin provides account number
  "percentage_charge": 80            // Mottainai takes 20%, company gets 80%
}
→ Returns: { subaccount_code: "ACCT_xxxx", id: 12345 }
→ Store: company.paystackSubaccountCode = "ACCT_xxxx"
```

**Step 2 — Create Residential Split Code**

```
POST https://api.paystack.co/split
Authorization: Bearer {PAYSTACK_SECRET_KEY}
{
  "name": "{companyName} - Residential",
  "type": "percentage",
  "currency": "NGN",
  "subaccounts": [
    { "subaccount": "ACCT_xxxx", "share": 80 }
  ],
  "bearer_type": "account",
  "bearer_subaccount": "ACCT_xxxx"
}
→ Returns: { split_code: "SPL_xxxxxxxxxx" }
→ Store: company.paystackSplitCodeResidential = "SPL_xxxxxxxxxx"
```

**Step 3 — Create Commercial Split Code**

```
POST https://api.paystack.co/split
(same as above but name = "{companyName} - Commercial")
→ Store: company.paystackSplitCodeCommercial = "SPL_xxxxxxxxxx"
```

**Step 4 — Auto-Generate Webhook URLs for All Lots**

```
For each lot in company.operationalLots:
  paytWebhook    = https://upwork.kowope.xyz/survey/{SPL_residential}/{SPL_commercial}?token={TOKEN}
  monthlyWebhook = https://upwork.kowope.xyz/survey/monthly/{SPL_residential}/{SPL_commercial}?token={TOKEN}
  
→ Update all lot webhook URLs automatically
→ No manual configuration needed
```

**Step 5 — Save Everything**

```
company.paystackSetupStatus = 'active'
company.save()
```

### 5.2 Admin UI — Company Creation Wizard

The existing `Companies.tsx` page gets a new **"Setup Paystack"** step in the create/edit dialog:

```
Step 1: Basic Info (companyId, companyName, companyType, pin)
Step 2: Operational Lots (lotCode, lotName — webhooks auto-generated)
Step 3: Paystack Setup (bankCode, accountNumber, percentageCharge)
         → "Create Subaccount & Split Codes" button
         → Shows live status: ✅ Subaccount created | ✅ Residential split | ✅ Commercial split
         → Webhook URLs auto-populated in all lots
Step 4: Zoho Setup (optional — company can do this themselves via portal)
```

### 5.3 Backfill Existing Companies

For the 18 existing companies that have manually-created split codes, a **backfill tool** in the admin dashboard will:

1. Show a table of all companies with their current split codes from `monthlybilldatas`
2. Allow admin to enter the existing `SPL_*` codes and `ACCT_*` codes
3. Store them on the Company document
4. Mark `paystackSetupStatus = 'active'`

This is a one-time migration, not a re-creation.

---

## 6. Zoho Books Per-Company Setup

### 6.1 Architecture

Each company that wants its own Zoho Books integration:

1. Goes to the **Company Portal** → Settings → Zoho Integration
2. Clicks **"Connect Zoho Books"**
3. Is redirected to Zoho OAuth: `https://accounts.zoho.com/oauth/v2/auth?...`
4. Authorises and is redirected back to: `https://admin.kowope.xyz/api/company-portal/zoho/callback?companyId={id}`
5. The callback exchanges the code for tokens and stores them in `CompanyZohoToken`
6. From this point, all invoice creation for this company uses its own Zoho org

### 6.2 Zoho OAuth Flow Per Company

```
Company Portal → "Connect Zoho" button
              → GET /api/company-portal/zoho/authorize?companyId={id}
              → Redirect to Zoho with state={companyId}
              → Zoho callback: GET /api/company-portal/zoho/callback?code={code}&state={companyId}
              → Exchange code for tokens
              → Store in CompanyZohoToken
              → Redirect back to portal with success message
```

Each company needs its own Zoho OAuth application (Client ID + Secret). The admin enters these in the company setup wizard. Alternatively, Mottainai can register a single Zoho OAuth app with `access_type=offline` and use the same Client ID/Secret for all companies — only the `organization_id` differs per company.

### 6.3 Invoice Creation Logic (Updated)

When creating a Paystack invoice for a company's billing record:

```typescript
async function createInvoiceForCompany(companyId, billingRecord) {
  // 1. Get company's Paystack split codes
  const company = await Company.findOne({ companyId });
  const splitCode = billingRecord.customerType === 'commercial' 
    ? company.paystackSplitCodeCommercial 
    : company.paystackSplitCodeResidential;

  // 2. Create Paystack invoice (existing logic, unchanged)
  const invoice = await createPaystackInvoice(customer, billingRecord, splitCode);

  // 3. Create Zoho invoice (company's own org, or Mottainai's if not connected)
  const zohoToken = await CompanyZohoToken.findOne({ companyId });
  if (zohoToken) {
    await createZohoInvoice(billingRecord, zohoToken);  // Company's own Zoho
  } else {
    await createZohoInvoice(billingRecord, masterZohoToken);  // Mottainai's Zoho
  }
}
```

---

## 7. Company Portal — Feature Set

### 7.1 Portal URL and Access

```
URL: portal.kowope.xyz  (or admin.kowope.xyz/portal/{companyId})
Auth: PIN-based login (existing mobile app PIN)
Scope: All data filtered to company's own companyId
```

### 7.2 Portal Pages

| Page | Route | Description |
|---|---|---|
| Dashboard | `/portal` | KPI cards: total customers, pickups this month, revenue, outstanding invoices |
| Customers | `/portal/customers` | View-only list of company's customers |
| Pickups | `/portal/pickups` | Pickup history for company's lots |
| Invoices | `/portal/invoices` | All Paystack invoices for company's billing records |
| Payments | `/portal/payments` | Paid vs outstanding, with Paystack payment links |
| Batch Invoice | `/portal/batch-invoice` | Company can trigger batch invoicing for its own yet-to-bill records |
| Webhooks | `/portal/webhooks` | View webhook health for company's lots |
| Settings | `/portal/settings` | Connect Zoho, view Paystack subaccount, update PIN |

### 7.3 Data Scoping Rules

Every tRPC procedure in the company portal enforces:

```typescript
// companyPortalProcedure middleware
const companyPortalProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const token = ctx.req.cookies['company_session'];
  const payload = verifyJWT(token);
  if (!payload?.companyId) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx: { ...ctx, companyId: payload.companyId } });
});

// Example scoped query
getMyCustomers: companyPortalProcedure.query(async ({ ctx }) => {
  return Customer.find({ 
    $or: [
      { ownerCompanyId: ctx.companyId },
      { servingCompanyId: ctx.companyId }
    ]
  });
});
```

**No company can ever see another company's data.** This is enforced at the procedure level, not the UI level.

---

## 8. Dynamic Webhook Registration

### 8.1 Current Webhook Pattern

The backend already supports dynamic split codes in the URL:

```
POST /survey/:splitCodeResidential/:splitCodeCommercial
POST /survey/monthly/:splitCodeResidential/:splitCodeCommercial
```

This means **no backend changes are needed** for the webhook routing. The webhook URL is already dynamic — it just needs to be auto-generated from the stored split codes.

### 8.2 Webhook Auto-Generation

When split codes are stored on a company, the system auto-generates all lot webhook URLs:

```typescript
function generateWebhookUrls(company: ICompany) {
  const base = 'https://upwork.kowope.xyz/survey';
  const token = process.env.WEBHOOK_TOKEN;
  const res = company.paystackSplitCodeResidential;
  const com = company.paystackSplitCodeCommercial;
  
  return company.operationalLots.map(lot => ({
    ...lot,
    paytWebhook:    `${base}/${res}/${com}?token=${token}`,
    monthlyWebhook: `${base}/monthly/${res}/${com}?token=${token}`,
  }));
}
```

### 8.3 Webhook Health Monitoring (Per Company)

The existing `WebhookMonitor` model already stores `companyId`. The company portal's Webhooks page queries:

```typescript
getMyWebhooks: companyPortalProcedure.query(async ({ ctx }) => {
  return WebhookMonitor.find({ companyId: ctx.companyId });
});
```

---

## 9. Implementation Plan — 8 Phases

| Phase | Scope | Files Changed | Effort |
|---|---|---|---|
| **P1** | Extend Company model (Paystack + Zoho fields) | `server/models/Company.ts`, `drizzle/schema.ts` | Small |
| **P2** | New `CompanyZohoToken` model | `server/models/CompanyZohoToken.ts` | Small |
| **P3** | Paystack subaccount + split code creation procedures | `server/routers/companies.ts` (new file) | Medium |
| **P4** | Webhook URL auto-generation on split code save | `server/routers/companies.ts` | Small |
| **P5** | Company Portal tRPC router + JWT middleware | `server/routers/companyPortal.ts` (new file) | Medium |
| **P6** | Zoho OAuth flow per company | `server/routers/companyPortal.ts` | Medium |
| **P7** | Company Portal frontend pages (8 pages) | `client/src/pages/Portal/*.tsx` | Large |
| **P8** | Admin: Paystack setup wizard in Companies page + backfill tool | `client/src/pages/Companies.tsx` | Medium |

**Total estimated effort:** 3–4 development sessions.

---

## 10. What Does NOT Change

- The `monthlybilldatas` collection structure — unchanged
- The `FormSubmission` / pickup flow — unchanged
- The existing webhook URL format on the backend — unchanged
- The admin dashboard pages for admin users — unchanged
- The mobile app — unchanged
- The existing Mottainai Zoho Books org (854644244) — still used as fallback for companies that haven't connected their own

---

## 11. Security Considerations

| Risk | Mitigation |
|---|---|
| Company sees another company's data | `companyPortalProcedure` enforces `companyId` scope on every query |
| Paystack secret key exposed | Stored only in server env, never sent to frontend |
| Zoho client secret exposed | Stored in `CompanyZohoToken` (server-only collection), encrypted at rest |
| Webhook URL token leaked | Token is already a 64-char SHA256 hash; unchanged |
| Company portal PIN brute-force | Rate limit login endpoint (5 attempts / 15 min) |

---

## 12. Questions for Your Instruction

Before implementation begins, please confirm:

1. **Paystack subaccount percentage:** Should all companies default to 80% (company) / 20% (Mottainai), or should this be configurable per company?
2. **Zoho per-company:** Should each company use its own Zoho OAuth app (Client ID/Secret), or should Mottainai register one app and all companies share it (only `organization_id` differs)?
3. **Portal URL:** Should the company portal be at `portal.kowope.xyz` (new subdomain) or at `admin.kowope.xyz/portal` (same server, new route prefix)?
4. **Backfill:** For the 18 existing companies with manually-created split codes, should the admin enter the existing `SPL_*` codes manually, or should we attempt to infer them from `monthlybilldatas`?
5. **Franchisee vs Independent:** Should franchisee companies also get the portal, or only `independent` type companies?
6. **Batch invoicing in portal:** Should company users be able to trigger batch invoicing themselves, or is that admin-only?
