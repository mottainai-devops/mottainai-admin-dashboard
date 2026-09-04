import { describe, expect, it, vi } from "vitest";
import { resolveMobileAssignedLots, type AssignedLotsDependencies } from "./mobileAssignedLots";

function dependencies(overrides: Partial<AssignedLotsDependencies> = {}): AssignedLotsDependencies {
  return {
    getCompanyByCompanyId: vi.fn(async () => null),
    findMottainaiFranchisor: vi.fn(async () => ({ _id: "mottainai-parent" })),
    findActiveFranchisees: vi.fn(async () => []),
    ...overrides,
  };
}

describe("resolveMobileAssignedLots", () => {
  it("returns only active Mottainai-parented Franchisee lots for cherry pickers and excludes Independent sources", async () => {
    const deps = dependencies({
      findActiveFranchisees: vi.fn(async () => [
        {
          active: true,
          companyType: "franchisee",
          parentCompanyId: "mottainai-parent",
          companyName: "Scoped franchisee",
          operationalLots: [{ lotCode: "MOT-001", lotName: "Scoped lot", paytWebhook: "payt", monthlyWebhook: "monthly" }],
        },
        {
          active: true,
          companyType: "independent",
          parentCompanyId: "mottainai-parent",
          companyName: "Must never be included",
          operationalLots: [{ lotCode: "IND-001", lotName: "Independent lot", paytWebhook: "different", monthlyWebhook: "different" }],
        },
        {
          active: false,
          companyType: "franchisee",
          parentCompanyId: "mottainai-parent",
          companyName: "Inactive franchisee",
          operationalLots: [{ lotCode: "MOT-002", lotName: "Inactive lot" }],
        },
        {
          active: true,
          companyType: "franchisee",
          parentCompanyId: "other-parent",
          companyName: "Other tenant franchisee",
          operationalLots: [{ lotCode: "OTH-001", lotName: "Other tenant lot" }],
        },
      ]),
    });

    const result = await resolveMobileAssignedLots({ role: "cherry_picker", companyId: null }, deps);

    expect(result.assignedLots).toEqual([
      expect.objectContaining({ lotCode: "MOT-001", paytWebhook: "payt", monthlyWebhook: "monthly" }),
    ]);
    expect(result.assignedLots.map(lot => lot.lotCode)).not.toContain("IND-001");
    expect(result.assignedLots.map(lot => lot.lotCode)).not.toContain("MOT-002");
    expect(result.assignedLots.map(lot => lot.lotCode)).not.toContain("OTH-001");
  });

  it("uses the exact Franchisee-under-Mottainai query predicate", async () => {
    const findActiveFranchisees = vi.fn(async () => []);
    await resolveMobileAssignedLots({ role: "cherry_picker" }, dependencies({ findActiveFranchisees }));
    expect(findActiveFranchisees).toHaveBeenCalledWith("mottainai-parent");
  });

  it("keeps a regular user scoped to their own company without webhook metadata", async () => {
    const result = await resolveMobileAssignedLots(
      { role: "user", companyId: "COMPANY-A" },
      dependencies({
        getCompanyByCompanyId: vi.fn(async () => ({
          companyName: "Company A",
          operationalLots: [{ lotCode: "A-001", lotName: "A lot" }],
        })),
      }),
    );

    expect(result.assignedLots).toEqual([
      expect.objectContaining({ lotCode: "A-001", companyName: "Company A" }),
    ]);
    expect(result.assignedLots[0]).not.toHaveProperty("paytWebhook");
  });

  it("gives login and /me callers the same resolver result for the same user", async () => {
    const deps = dependencies({
      getCompanyByCompanyId: vi.fn(async () => ({
        companyName: "Company A",
        operationalLots: [{ lotCode: "A-001", lotName: "A lot" }],
      })),
    });
    const user = { role: "user", companyId: "COMPANY-A", defaultLotCode: null };
    await expect(resolveMobileAssignedLots(user, deps)).resolves.toEqual(await resolveMobileAssignedLots(user, deps));
  });
});
