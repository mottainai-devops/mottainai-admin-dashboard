import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { billingRouter } from "./routers/billing";
import { pickupsRouter } from "./routers/pickups";
import { mongoAuthRouter } from "./mongoAuthRouter";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const readServerSource = (...segments: string[]) =>
  fs.readFileSync(path.join(serverDirectory, ...segments), "utf8");
const routerContext = (user: unknown) =>
  ({
    user,
    req: { headers: {}, ip: "127.0.0.1" },
    res: {},
    adminToken: null,
  }) as any;

const protectedReadChecks = [
  {
    label: "company document list",
    call: (user: unknown) =>
      appRouter.createCaller(routerContext(user)).companies.list(),
  },
  {
    label: "company document reads",
    call: (user: unknown) =>
      appRouter
        .createCaller(routerContext(user))
        .companies.getById({ id: "test-company" }),
  },
  {
    label: "company PIN lookup",
    call: (user: unknown) =>
      appRouter
        .createCaller(routerContext(user))
        .companies.getByPin({ pin: "1234" }),
  },
  {
    label: "user directory",
    call: (user: unknown) =>
      mongoAuthRouter.createCaller(routerContext(user)).listUsers(),
  },
  {
    label: "pickup list",
    call: (user: unknown) =>
      pickupsRouter
        .createCaller(routerContext(user))
        .list({ page: 1, limit: 50 }),
  },
  {
    label: "pickup detail",
    call: (user: unknown) =>
      pickupsRouter
        .createCaller(routerContext(user))
        .getById({ id: "test-pickup" }),
  },
  {
    label: "pickup map",
    call: (user: unknown) =>
      pickupsRouter.createCaller(routerContext(user)).mapData(),
  },
  {
    label: "pickup CSV export",
    call: (user: unknown) =>
      pickupsRouter.createCaller(routerContext(user)).exportCsv(),
  },
  {
    label: "billing reconciliation",
    call: (user: unknown) =>
      billingRouter.createCaller(routerContext(user)).getReconciliation(),
  },
  {
    label: "billing export",
    call: (user: unknown) =>
      billingRouter.createCaller(routerContext(user)).exportReconciliationCSV(),
  },
  {
    label: "company billing export",
    call: (user: unknown) =>
      billingRouter.createCaller(routerContext(user)).exportCompanyCSV(),
  },
  {
    label: "lot billing export",
    call: (user: unknown) =>
      billingRouter.createCaller(routerContext(user)).exportLotCSV(),
  },
  {
    label: "batch billing preview",
    call: (user: unknown) =>
      billingRouter
        .createCaller(routerContext(user))
        .getBatchReinvoicePreview(),
  },
  {
    label: "batch billing job status",
    call: (user: unknown) =>
      billingRouter
        .createCaller(routerContext(user))
        .getBatchJobStatus({ jobId: "test-job" }),
  },
  {
    label: "monthly billing list",
    call: (user: unknown) =>
      billingRouter
        .createCaller(routerContext(user))
        .listMonthlyBillingRecords(),
  },
];

const publicReadTargets = [
  { file: ["routers.ts"], names: ["list", "getById", "getByPin"] },
  { file: ["mongoAuthRouter.ts"], names: ["listUsers"] },
  {
    file: ["routers", "pickups.ts"],
    names: ["list", "getById", "mapData", "exportCsv"],
  },
  {
    file: ["routers", "billing.ts"],
    names: [
      "exportCompanyCSV",
      "exportLotCSV",
      "getReconciliation",
      "exportReconciliationCSV",
      "getBatchReinvoicePreview",
      "getBatchJobStatus",
      "listMonthlyBillingRecords",
    ],
  },
];

describe("T62-P0 high-severity read authorization and re-login UX", () => {
  it.each(protectedReadChecks)(
    "actual $label route rejects an absent session with 401 and a non-admin role with 403 before reads execute",
    async ({ call }) => {
      await expect(call(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(call({ _id: "user-1", role: "user" })).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
    }
  );

  it("declares every approved P0-read A target as admin-only rather than public", () => {
    for (const group of publicReadTargets) {
      const source = readServerSource(...group.file);
      for (const name of group.names) {
        expect(source).toMatch(new RegExp(`${name}:\\s*adminProcedure\\b`));
        expect(source).not.toMatch(
          new RegExp(`${name}:\\s*publicProcedure\\b`)
        );
      }
    }
  });

  it("turns an expired session into a clear re-login message and preserves a distinct forbidden-role message", () => {
    const client = readServerSource("..", "client", "src", "main.tsx");
    const login = readServerSource(
      "..",
      "client",
      "src",
      "pages",
      "SimpleLogin.tsx"
    );

    expect(client).toContain('errorCode === "UNAUTHORIZED"');
    expect(client).toContain('errorCode === "FORBIDDEN"');
    expect(client).toContain('localStorage.removeItem("auth_token")');
    expect(client).toContain(
      '"Your session has expired. Please sign in again."'
    );
    expect(client).toContain('window.location.assign("/login")');
    expect(login).toContain("mottainai_admin_relogin_notice");
    expect(login).toContain("{reloginNotice}");
  });
});
