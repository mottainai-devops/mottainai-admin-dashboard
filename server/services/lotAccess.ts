import { Company } from "../models/Company";

export type AccessibleLot = {
  id: string;
  lotCode: string;
  lotName: string;
  paytWebhook: string | null;
  monthlyWebhook: string | null;
  companyId: string;
  companyName: string;
};

type CompanySource = {
  _id?: unknown;
  companyId?: string | null;
  companyName?: string | null;
  companyType?: string | null;
  parentCompanyId?: unknown;
  active?: boolean;
  operationalLots?: Array<{
    lotCode?: string | null;
    lotName?: string | null;
    paytWebhook?: string | null;
    monthlyWebhook?: string | null;
  }>;
};

export type SurveyLotAccessUser = {
  _id?: unknown;
  role?: string | null;
  companyId?: string | null;
};

export type LotAccessDependencies = {
  findMottainaiFranchisor: () => Promise<CompanySource | null>;
  findActiveMottainaiFranchisees: (parentCompanyId: string) => Promise<CompanySource[]>;
  findActiveCompanyForUser: (companyId: string) => Promise<CompanySource | null>;
  findActiveCompanyForService: (companyId: string) => Promise<CompanySource | null>;
};

const ALL_LOTS_ROLES = new Set(["cherry_picker", "admin"]);
const MOTTAINAI_COMPANY_ID = "MOTTAINAI";

function mapCompanyLots(company: CompanySource): AccessibleLot[] {
  const companyId = String(company._id ?? "");
  const companyName = String(company.companyName ?? "");
  if (!companyId || !companyName) return [];

  return (company.operationalLots ?? [])
    .filter(lot => Boolean(lot?.lotCode))
    .map(lot => ({
      id: `${companyId}_${String(lot.lotCode)}`,
      lotCode: String(lot.lotCode),
      lotName: String(lot.lotName || lot.lotCode),
      paytWebhook: lot.paytWebhook || null,
      monthlyWebhook: lot.monthlyWebhook || null,
      companyId,
      companyName,
    }));
}

const defaultDependencies: LotAccessDependencies = {
  async findMottainaiFranchisor() {
    return await Company.findOne({
      active: true,
      companyType: "franchisor",
      companyId: MOTTAINAI_COMPANY_ID,
    })
      .select("_id companyId companyName companyType active")
      .lean();
  },
  async findActiveMottainaiFranchisees(parentCompanyId) {
    return await Company.find({
      active: true,
      companyType: "franchisee",
      parentCompanyId,
    })
      .select("_id companyId companyName companyType parentCompanyId active operationalLots")
      .lean();
  },
  async findActiveCompanyForUser(companyId) {
    return await Company.findOne({
      active: true,
      $or: [{ _id: companyId }, { companyId }],
    })
      .select("_id companyId companyName companyType active operationalLots")
      .lean();
  },
  async findActiveCompanyForService(companyId) {
    const byBusinessId = await Company.findOne({ active: true, companyId })
      .select("_id companyId companyName companyType active operationalLots")
      .lean();
    if (byBusinessId) return byBusinessId;
    try {
      return await Company.findOne({ active: true, _id: companyId })
        .select("_id companyId companyName companyType active operationalLots")
        .lean();
    } catch {
      return null;
    }
  },
};

function isMottainaiFranchisee(company: CompanySource, parentCompanyId: string): boolean {
  return (
    company.active === true &&
    company.companyType === "franchisee" &&
    String(company.parentCompanyId ?? "") === parentCompanyId
  );
}

/**
 * Resolves only the lots the verified Survey identity can access. All-lots
 * roles are deliberately limited to active Mottainai-parented franchisees.
 */
export async function listAccessibleLots(
  user: SurveyLotAccessUser,
  dependencies: LotAccessDependencies = defaultDependencies,
): Promise<AccessibleLot[]> {
  if (ALL_LOTS_ROLES.has(user.role || "")) {
    const parent = await dependencies.findMottainaiFranchisor();
    if (!parent?._id) return [];
    const parentId = String(parent._id);
    const companies = await dependencies.findActiveMottainaiFranchisees(parentId);
    return companies
      .filter(company => isMottainaiFranchisee(company, parentId))
      .flatMap(mapCompanyLots);
  }

  if (!user.companyId) return [];
  const company = await dependencies.findActiveCompanyForUser(user.companyId);
  return company ? mapCompanyLots(company) : [];
}

/**
 * Field Scheduler may resolve a known company for webhook enrichment only
 * when it presents the dedicated service credential middleware requires.
 */
export async function listLotsForFieldScheduler(
  companyId: string,
  search: string | undefined,
  dependencies: LotAccessDependencies = defaultDependencies,
): Promise<AccessibleLot[]> {
  const company = await dependencies.findActiveCompanyForService(companyId);
  if (!company) return [];
  const query = search?.trim().toLowerCase();
  return mapCompanyLots(company).filter(lot =>
    !query || lot.lotCode.toLowerCase().includes(query) || lot.lotName.toLowerCase().includes(query),
  );
}

export function serviceCredentialMatches(configured: string | undefined, supplied: string | undefined): boolean {
  if (!configured || !supplied || configured.length !== supplied.length) return false;
  let difference = 0;
  for (let index = 0; index < configured.length; index += 1) {
    difference |= configured.charCodeAt(index) ^ supplied.charCodeAt(index);
  }
  return difference === 0;
}
