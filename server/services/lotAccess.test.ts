import { describe, expect, it } from "vitest";
import {
  listAccessibleLots,
  listLotsForFieldScheduler,
  serviceCredentialMatches,
  type LotAccessDependencies,
} from "./lotAccess";

const parent = { _id: "mottainai-parent", companyType: "franchisor", active: true };
const eligibleCompany = {
  _id: "franchisee-one",
  companyName: "Eligible Franchisee",
  companyType: "franchisee",
  parentCompanyId: "mottainai-parent",
  active: true,
  operationalLots: [{ lotCode: "DAL-414", lotName: "Lot 414", paytWebhook: "payt", monthlyWebhook: "monthly" }],
};

const dependencies: LotAccessDependencies = {
  findMottainaiFranchisor: async () => parent,
  findActiveMottainaiFranchisees: async () => [
    eligibleCompany,
    { ...eligibleCompany, _id: "independent", companyType: "independent" },
    { ...eligibleCompany, _id: "other-parent", parentCompanyId: "other" },
    { ...eligibleCompany, _id: "inactive", active: false },
  ],
  findActiveCompanyForUser: async () => eligibleCompany,
  findActiveCompanyForService: async () => eligibleCompany,
};

describe("authenticated lot access", () => {
  it("limits a cherry picker to active Mottainai-parented franchisees", async () => {
    const lots = await listAccessibleLots({ role: "cherry_picker" }, dependencies);
    expect(lots).toHaveLength(1);
    expect(lots[0]).toMatchObject({ lotCode: "DAL-414", companyId: "franchisee-one" });
  });

  it("preserves the regular user single-company path", async () => {
    const lots = await listAccessibleLots({ role: "user", companyId: "franchisee-one" }, dependencies);
    expect(lots.map(lot => lot.lotCode)).toEqual(["DAL-414"]);
  });

  it("requires an exact configured service credential before a Field Scheduler lookup can run", async () => {
    expect(serviceCredentialMatches("long-random-value", "long-random-value")).toBe(true);
    expect(serviceCredentialMatches("long-random-value", "wrong-value")).toBe(false);
    expect(serviceCredentialMatches(undefined, "long-random-value")).toBe(false);
  });

  it("keeps the Field Scheduler lookup scoped to its requested active company", async () => {
    const lots = await listLotsForFieldScheduler("MOTTAINAI", "414", dependencies);
    expect(lots).toHaveLength(1);
    expect(lots[0]?.lotCode).toBe("DAL-414");
  });
});
