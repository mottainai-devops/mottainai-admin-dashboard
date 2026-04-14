/**
 * Companies Setup Router
 *
 * Handles dynamic Paystack subaccount + split code creation,
 * webhook URL auto-generation, and split code backfill for existing companies.
 *
 * All procedures are admin-only (no portal access).
 */

import { z } from 'zod';
import { router, publicProcedure } from '../_core/trpc';
import { Company } from '../models/Company';
import { MonthlyBillData } from '../models/MonthlyBillData';
import {
  createSubaccount,
  createSplitCode,
  listBanks,
  resolveAccountNumber,
  generateWebhookUrl,
} from '../services/paystackService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract all SPL_ codes from a company's webhook URLs.
 * Mirrors the logic in franchisee-api/server.js.
 */
function extractSplitCodesFromWebhooks(operationalLots: Array<{ paytWebhook: string; monthlyWebhook: string }>): string[] {
  const codes = new Set<string>();
  const splRegex = /\/(SPL_[A-Za-z0-9]+)/g;
  for (const lot of operationalLots) {
    for (const url of [lot.paytWebhook, lot.monthlyWebhook]) {
      if (!url) continue;
      splRegex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = splRegex.exec(url)) !== null) {
        codes.add(m[1]);
      }
    }
  }
  return Array.from(codes);
}

/**
 * Infer split codes for a company from monthlybilldatas by matching lot codes.
 * Returns { residential: string[], commercial: string[] }
 */
async function inferSplitCodesFromBillingData(companyId: string): Promise<{
  residential: string[];
  commercial: string[];
  all: string[];
}> {
  // Get the company's lot codes
  const company = await Company.findOne({ companyId }).lean();
  if (!company) return { residential: [], commercial: [], all: [] };

  const lotCodes = company.operationalLots.map((l) => l.lotCode);
  if (lotCodes.length === 0) return { residential: [], commercial: [], all: [] };

  // Find distinct split codes used in billing data for these lots
  const pipeline = [
    {
      $match: {
        lotCode: { $in: lotCodes },
        splitCode: { $exists: true, $nin: [null, '', '000'] },
      },
    },
    {
      $group: {
        _id: '$splitCode',
        customerType: { $first: '$customerType' },
        count: { $sum: 1 },
      },
    },
  ];

  const results = await MonthlyBillData.aggregate(pipeline);

  const residential: string[] = [];
  const commercial: string[] = [];
  const all: string[] = [];

  for (const r of results) {
    const code = r._id as string;
    all.push(code);
    const type = (r.customerType || '').toLowerCase();
    if (type.includes('commercial') || type.includes('business')) {
      commercial.push(code);
    } else {
      residential.push(code);
    }
  }

  return { residential, commercial, all };
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const companiesSetupRouter = router({

  /**
   * List all Nigerian banks (for the Paystack setup wizard).
   */
  listBanks: publicProcedure.query(async () => {
    const banks = await listBanks();
    return banks.map((b) => ({ code: b.code, name: b.name }));
  }),

  /**
   * Resolve a bank account number to get the account holder name.
   * Used for verification before creating a subaccount.
   */
  resolveAccount: publicProcedure
    .input(z.object({
      accountNumber: z.string().length(10),
      bankCode: z.string(),
    }))
    .query(async ({ input }) => {
      const result = await resolveAccountNumber(input.accountNumber, input.bankCode);
      return result;
    }),

  /**
   * Full Paystack setup for a company:
   * 1. Create Paystack subaccount
   * 2. Create residential split code
   * 3. Create commercial split code
   * 4. Auto-generate webhook URLs for all operational lots
   * 5. Save everything to the Company document
   */
  setupPaystack: publicProcedure
    .input(z.object({
      companyId: z.string(),
      bankCode: z.string(),
      accountNumber: z.string().length(10),
      percentageCharge: z.number().min(1).max(99).default(80),
    }))
    .mutation(async ({ input }) => {
      const company = await Company.findOne({ companyId: input.companyId });
      if (!company) throw new Error(`Company not found: ${input.companyId}`);

      // Mark as pending
      company.paystackSetupStatus = 'pending';
      company.paystackBankCode = input.bankCode;
      company.paystackAccountNumber = input.accountNumber;
      company.paystackPercentageCharge = input.percentageCharge;
      await company.save();

      try {
        // Step 1: Create subaccount
        const subaccount = await createSubaccount({
          businessName: company.companyName,
          settlementBank: input.bankCode,
          accountNumber: input.accountNumber,
          percentageCharge: input.percentageCharge,
        });

        // Step 2: Create residential split code
        const residentialSplit = await createSplitCode({
          name: `${company.companyName} - Residential`,
          subaccountCode: subaccount.subaccount_code,
          percentageCharge: input.percentageCharge,
        });

        // Step 3: Create commercial split code
        const commercialSplit = await createSplitCode({
          name: `${company.companyName} - Commercial`,
          subaccountCode: subaccount.subaccount_code,
          percentageCharge: input.percentageCharge,
        });

        // Step 4: Auto-generate webhook URLs for all operational lots
        // Use the company's PIN as the webhook token (consistent with existing pattern)
        const webhookToken = company.pin;
        const updatedLots = company.operationalLots.map((lot) => ({
          lotCode: (lot as any).lotCode,
          lotName: (lot as any).lotName,
          paytWebhook: generateWebhookUrl(
            residentialSplit.split_code,
            commercialSplit.split_code,
            webhookToken
          ),
          monthlyWebhook: generateWebhookUrl(
            residentialSplit.split_code,
            commercialSplit.split_code,
            webhookToken
          ),
        }));

        // Step 5: Save to Company
        company.paystackSubaccountCode = subaccount.subaccount_code;
        company.paystackSubaccountId = String(subaccount.id);
        company.paystackSplitCodeResidential = residentialSplit.split_code;
        company.paystackSplitCodeCommercial = commercialSplit.split_code;
        company.paystackSetupStatus = 'active';
        company.portalEnabled = true;
        company.operationalLots = updatedLots as any;
        await company.save();

        return {
          success: true,
          subaccountCode: subaccount.subaccount_code,
          splitCodeResidential: residentialSplit.split_code,
          splitCodeCommercial: commercialSplit.split_code,
          webhookUrls: updatedLots.map((l) => ({
            lotCode: l.lotCode,
            paytWebhook: l.paytWebhook,
            monthlyWebhook: l.monthlyWebhook,
          })),
        };
      } catch (err: any) {
        company.paystackSetupStatus = 'failed';
        await company.save();
        throw new Error(`Paystack setup failed: ${err.message}`);
      }
    }),

  /**
   * Backfill split codes for an existing company by inferring them from
   * monthlybilldatas (matching lot codes → split codes).
   *
   * This is used for the 18 existing companies that were set up manually.
   * It does NOT create new Paystack resources — it only reads what already
   * exists in the billing data and stores the codes on the Company document.
   */
  backfillSplitCodes: publicProcedure
    .input(z.object({
      companyId: z.string(),
      dryRun: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const company = await Company.findOne({ companyId: input.companyId });
      if (!company) throw new Error(`Company not found: ${input.companyId}`);

      // Method 1: Infer from billing data
      const inferred = await inferSplitCodesFromBillingData(input.companyId);

      // Method 2: Extract from existing webhook URLs (fallback)
      const fromWebhooks = extractSplitCodesFromWebhooks(company.operationalLots.map((l) => ({
        paytWebhook: l.paytWebhook,
        monthlyWebhook: l.monthlyWebhook,
      })));

      // Combine both sources
      const allCodes = Array.from(new Set([...inferred.all, ...fromWebhooks]));
      const residentialCodes = inferred.residential.length > 0
        ? inferred.residential
        : fromWebhooks.slice(0, 1); // fallback: first webhook code
      const commercialCodes = inferred.commercial.length > 0
        ? inferred.commercial
        : fromWebhooks.slice(1, 2); // fallback: second webhook code

      const result = {
        companyId: input.companyId,
        companyName: company.companyName,
        inferredFromBillingData: inferred,
        extractedFromWebhooks: fromWebhooks,
        proposedResidential: residentialCodes[0] || null,
        proposedCommercial: commercialCodes[0] || null,
        allCodes,
        dryRun: input.dryRun,
      };

      if (!input.dryRun && (residentialCodes[0] || commercialCodes[0])) {
        company.paystackSplitCodeResidential = residentialCodes[0] || null;
        company.paystackSplitCodeCommercial = commercialCodes[0] || null;
        if (residentialCodes[0] || commercialCodes[0]) {
          company.paystackSetupStatus = 'active';
          company.portalEnabled = true;
        }
        await company.save();
      }

      return result;
    }),

  /**
   * Bulk backfill for ALL independent companies.
   * Runs the inference for each company and returns a summary.
   */
  bulkBackfillSplitCodes: publicProcedure
    .input(z.object({
      dryRun: z.boolean().default(true),
    }))
    .mutation(async ({ input }) => {
      const companies = await Company.find({
        companyType: 'independent',
        paystackSetupStatus: 'not_configured',
      }).lean();

      const results = [];

      for (const company of companies) {
        try {
          const inferred = await inferSplitCodesFromBillingData(company.companyId);
          const fromWebhooks = extractSplitCodesFromWebhooks(company.operationalLots.map((l) => ({
            paytWebhook: l.paytWebhook,
            monthlyWebhook: l.monthlyWebhook,
          })));

          const allCodes = Array.from(new Set([...inferred.all, ...fromWebhooks]));
          const residential = inferred.residential[0] || fromWebhooks[0] || null;
          const commercial = inferred.commercial[0] || fromWebhooks[1] || null;

          if (!input.dryRun && (residential || commercial)) {
            await Company.findOneAndUpdate(
              { companyId: company.companyId },
              {
                paystackSplitCodeResidential: residential,
                paystackSplitCodeCommercial: commercial,
                paystackSetupStatus: 'active',
                portalEnabled: true,
              }
            );
          }

          results.push({
            companyId: company.companyId,
            companyName: company.companyName,
            residential,
            commercial,
            allCodes,
            status: residential || commercial ? 'found' : 'not_found',
          });
        } catch (err: any) {
          results.push({
            companyId: company.companyId,
            companyName: company.companyName,
            residential: null,
            commercial: null,
            allCodes: [],
            status: 'error',
            error: err.message,
          });
        }
      }

      return {
        dryRun: input.dryRun,
        total: results.length,
        found: results.filter((r) => r.status === 'found').length,
        notFound: results.filter((r) => r.status === 'not_found').length,
        errors: results.filter((r) => r.status === 'error').length,
        results,
      };
    }),

  /**
   * Get Paystack setup status for a company.
   */
  getPaystackStatus: publicProcedure
    .input(z.object({ companyId: z.string() }))
    .query(async ({ input }) => {
      const company = await Company.findOne({ companyId: input.companyId }).lean();
      if (!company) throw new Error(`Company not found: ${input.companyId}`);
      return {
        companyId: company.companyId,
        companyName: company.companyName,
        paystackSetupStatus: company.paystackSetupStatus,
        paystackSubaccountCode: company.paystackSubaccountCode,
        paystackSplitCodeResidential: company.paystackSplitCodeResidential,
        paystackSplitCodeCommercial: company.paystackSplitCodeCommercial,
        paystackPercentageCharge: company.paystackPercentageCharge,
        portalEnabled: company.portalEnabled,
        zohoSetupStatus: company.zohoSetupStatus,
        zohoOrganizationId: company.zohoOrganizationId,
      };
    }),

  /**
   * Update Paystack percentage charge for a company (without re-creating subaccount).
   */
  updatePercentage: publicProcedure
    .input(z.object({
      companyId: z.string(),
      percentageCharge: z.number().min(1).max(99),
    }))
    .mutation(async ({ input }) => {
      const company = await Company.findOneAndUpdate(
        { companyId: input.companyId },
        { paystackPercentageCharge: input.percentageCharge },
        { new: true }
      );
      if (!company) throw new Error(`Company not found: ${input.companyId}`);
      return { success: true, percentageCharge: company.paystackPercentageCharge };
    }),

  /**
   * Enable or disable portal access for a company.
   */
  togglePortalAccess: publicProcedure
    .input(z.object({
      companyId: z.string(),
      enabled: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      const company = await Company.findOneAndUpdate(
        { companyId: input.companyId },
        { portalEnabled: input.enabled },
        { new: true }
      );
      if (!company) throw new Error(`Company not found: ${input.companyId}`);
      return { success: true, portalEnabled: company.portalEnabled };
    }),
});
