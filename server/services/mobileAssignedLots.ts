import { getCompanyByCompanyId } from "../db";
import { Company } from "../models/Company";

export type MobileAssignedLot = {
  lotCode: string;
  lotName: string;
  description: string;
  isActive: boolean;
  companyName: string | null;
  paytWebhook?: string | null;
  monthlyWebhook?: string | null;
};

type CompanyLotSource = {
  _id?: unknown;
  companyId?: string | null;
  companyName?: string | null;
  companyType?: string | null;
  parentCompanyId?: unknown;
  active?: boolean;
  operationalLots?: Array<{
    lotCode?: string | null;
    lotName?: string | null;
    description?: string | null;
    isActive?: boolean | null;
    paytWebhook?: string | null;
    monthlyWebhook?: string | null;
  }>;
};

export type AssignedLotsDependencies = {
  getCompanyByCompanyId: (companyId: string) => Promise<CompanyLotSource | null>;
  findMottainaiFranchisor: () => Promise<CompanyLotSource | null>;
  findActiveFranchisees: (parentCompanyId: string) => Promise<CompanyLotSource[]>;
};

const ALL_LOTS_ROLES = new Set(["cherry_picker", "admin"]);
const MOTTAINAI_COMPANY_ID = "MOTTAINAI";

function mapOperationalLots(company: CompanyLotSource, includeWebhookMetadata: boolean): MobileAssignedLot[] {
  return (company.operationalLots ?? [])
    .filter(lot => Boolean(lot.lotCode))
    .map(lot => ({
      lotCode: String(lot.lotCode),
      lotName: lot.lotName || String(lot.lotCode),
      description: lot.description || "",
      isActive: lot.isActive !== false,
      companyName: company.companyName || null,
      ...(includeWebhookMetadata
        ? {
            paytWebhook: lot.paytWebhook || null,
            monthlyWebhook: lot.monthlyWebhook || null,
          }
        : {}),
    }));
}

async function defaultFindMottainaiFranchisor(): Promise<CompanyLotSource | null> {
  return await Company.findOne({
    active: true,
    companyType: "franchisor",
    companyId: MOTTAINAI_COMPANY_ID,
  })
    .select("_id companyId companyName companyType active")
    .lean();
}

async function defaultFindActiveFranchisees(parentCompanyId: string): Promise<CompanyLotSource[]> {
  return await Company.find({
    active: true,
    companyType: "franchisee",
    parentCompanyId,
  })
    .select("_id companyName companyType parentCompanyId active operationalLots")
    .lean();
}

const defaultDependencies: AssignedLotsDependencies = {
  getCompanyByCompanyId,
  findMottainaiFranchisor: defaultFindMottainaiFranchisor,
  findActiveFranchisees: defaultFindActiveFranchisees,
};

/**
 * Resolves the concrete lot cache returned by Survey login and /me.
 * Cherry pickers and Survey admins are restricted to active Mottainai-owned
 * franchisees; Independent companies are never eligible for this expansion.
 */
export async function resolveMobileAssignedLots(
  user: { role?: string | null; companyId?: string | null; defaultLotCode?: string | null },
  dependencies: AssignedLotsDependencies = defaultDependencies,
): Promise<{ assignedLots: MobileAssignedLot[]; defaultLotCode: string | null }> {
  const persistedDefaultLotCode = user.defaultLotCode || null;

  if (ALL_LOTS_ROLES.has(user.role || "")) {
    const parent = await dependencies.findMottainaiFranchisor();
    if (!parent?._id) {
      return { assignedLots: [], defaultLotCode: persistedDefaultLotCode };
    }

    const parentId = String(parent._id);
    const companies = await dependencies.findActiveFranchisees(parentId);
    // The database predicate above is primary. This defensive filter keeps a
    // malformed or mocked source from ever broadening the tenant boundary.
    const assignedLots = companies
      .filter(
        company =>
          company.active === true &&
          company.companyType === "franchisee" &&
          String(company.parentCompanyId ?? "") === parentId,
      )
      .flatMap(company => mapOperationalLots(company, true));

    return {
      assignedLots,
      defaultLotCode:
        persistedDefaultLotCode || assignedLots.find(lot => lot.isActive)?.lotCode || assignedLots[0]?.lotCode || null,
    };
  }

  if (!user.companyId) {
    return { assignedLots: [], defaultLotCode: persistedDefaultLotCode };
  }

  const company = await dependencies.getCompanyByCompanyId(user.companyId);
  const assignedLots = company ? mapOperationalLots(company, false) : [];
  return {
    assignedLots,
    defaultLotCode:
      persistedDefaultLotCode || assignedLots.find(lot => lot.isActive)?.lotCode || assignedLots[0]?.lotCode || null,
  };
}
