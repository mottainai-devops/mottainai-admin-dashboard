import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const loadJson = (relativePath: string) =>
  JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));

describe("core-green CI boundary", () => {
  it("keeps the core typecheck and visible T63 register in explicit alignment", () => {
    const core = loadJson("ci/core-surface.json");
    const register = loadJson(core.t63Register);
    const nonCoreDebt = loadJson(core.nonCoreTypeDebtRegister);
    const tsconfig = loadJson("tsconfig.core.json");

    expect(register.items).toHaveLength(14);
    expect(new Set(register.items.map((item: { id: string }) => item.id)).size).toBe(14);
    expect(register.items.map((item: { priority: number }) => item.priority).sort((a: number, b: number) => a - b)).toEqual(
      Array.from({ length: 14 }, (_, index) => index + 1)
    );
    expect(
      register.items.every((item: { securityReview: string }) =>
        item.securityReview.startsWith("functional-only")
      )
    ).toBe(true);
    expect(tsconfig.files).toEqual(core.typecheckFiles);
    expect(core.legacyQuarantine).toContain("server/simpleAuthRouter.ts");
    expect(nonCoreDebt.items).toHaveLength(14);
    expect(new Set(nonCoreDebt.items.map((item: { path: string }) => item.path)).size).toBe(14);
    expect(
      nonCoreDebt.items.every((item: { classification: string }) =>
        ["safe-type-drift", "unmounted-legacy"].includes(item.classification)
      )
    ).toBe(true);

    const rootRouter = fs.readFileSync(path.join(projectRoot, "server/routers.ts"), "utf8");
    expect(rootRouter).toContain("simpleAuth: mongoAuthRouter");
    expect(rootRouter).toContain("billing: billingRouter");
    expect(rootRouter).toContain("companiesSetup: companiesSetupRouter");
    expect(rootRouter).toContain("pickups: pickupsRouter");
    expect(rootRouter).toContain("realWebhook: realWebhookRouter");
    expect(rootRouter).toContain("testing: testingRouter");
    expect(rootRouter).toContain("webhook: webhookRouter");
  });
});
