import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  appRouter,
  mergeOperationalLotsForAdminUpdate,
  serializeCompanyForAdminRead,
} from "./routers";
import {
  billingRouter,
  serializeBatchJobForAdmin,
  serializeBatchReinvoicePreviewRecord,
} from "./routers/billing";
import {
  pickupsRouter,
  serializePickupDetailForAdmin,
  serializePickupMapMarkerForAdmin,
} from "./routers/pickups";
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

  it("returns only allowlisted company, pickup, map, and billing fields", () => {
    const company = serializeCompanyForAdminRead({
      _id: "company-1",
      companyId: "COMPANY-1",
      companyName: "Test Company",
      companyType: "franchisee",
      active: true,
      pin: "private-pin",
      portalPin: "private-portal-pin",
      paystackBankCode: "private-bank-code",
      paystackAccountNumber: "private-account-number",
      paystackSubaccountId: "private-subaccount-id",
      zohoOrganizationId: "private-zoho-organization-id",
      operationalLots: [
        {
          lotCode: "LOT-1",
          lotName: "Test Lot",
          paytWebhook: "private-webhook",
          monthlyWebhook: "private-webhook",
        },
      ],
    });
    expect(company).toEqual(
      expect.objectContaining({
        _id: "company-1",
        companyId: "COMPANY-1",
        companyName: "Test Company",
        operationalLots: [{ lotCode: "LOT-1", lotName: "Test Lot" }],
      })
    );
    for (const hiddenField of [
      "pin",
      "portalPin",
      "paystackBankCode",
      "paystackAccountNumber",
      "paystackSubaccountId",
      "zohoOrganizationId",
    ]) {
      expect(company).not.toHaveProperty(hiddenField);
    }
    expect(company.operationalLots[0]).not.toHaveProperty("paytWebhook");
    expect(company.operationalLots[0]).not.toHaveProperty("monthlyWebhook");

    const preservedLots = mergeOperationalLotsForAdminUpdate(
      [{ lotCode: "LOT-1", lotName: "Renamed Lot" }],
      [
        {
          lotCode: "LOT-1",
          lotName: "Test Lot",
          paytWebhook: "server-managed-webhook",
          monthlyWebhook: "server-managed-webhook",
        },
      ]
    );
    expect(preservedLots[0]).toEqual(
      expect.objectContaining({
        lotCode: "LOT-1",
        lotName: "Renamed Lot",
        paytWebhook: "server-managed-webhook",
        monthlyWebhook: "server-managed-webhook",
      })
    );

    const pickup = serializePickupDetailForAdmin({
      _id: "pickup-1",
      buildingId: "BUILDING-1",
      customerName: "Test Customer",
      customerPhone: "0000000000",
      customerEmail: "test@example.invalid",
      customerAddress: "Test Address",
      customerType: "Monthly Billing - Residential",
      binType: "120L",
      binQuantity: 1,
      amount: 1,
      zohoInvoiceId: "invoice-1",
      firstPhotoUrl: "photo-reference",
      firstPhoto: "duplicate-photo-reference",
      secondPhoto: "second-photo-reference",
      incidentReport: "Test incident",
      pickUpDate: "2026-09-05",
      pickupDate: new Date("2026-09-05T00:00:00Z"),
      lotCode: "LOT-1",
      lgaName: "LGA",
      wardName: "Ward",
      stateCode: "OY",
      country: "Nigeria",
      createdAt: new Date("2026-09-05T00:00:00Z"),
      userId: "internal-user-id",
      companyId: "internal-company-id",
      companyName: "Internal Company",
      transactionId: "internal-transaction-id",
      socioClass: "internal-classification",
    });
    expect(pickup).toEqual(
      expect.objectContaining({
        _id: "pickup-1",
        firstPhoto: "photo-reference",
        secondPhoto: "second-photo-reference",
      })
    );
    for (const hiddenField of [
      "userId",
      "companyId",
      "companyName",
      "transactionId",
      "socioClass",
      "splitCode",
      "firstPhotoUrl",
      "secondPhotoUrl",
    ]) {
      expect(pickup).not.toHaveProperty(hiddenField);
    }

    const marker = serializePickupMapMarkerForAdmin({
      _id: "BUILDING-1",
      latitude: 1,
      longitude: 2,
      pickupCount: 1,
      totalAmount: 1,
      lastPickupDate: new Date("2026-09-05T00:00:00Z"),
      binTypes: ["120L"],
      paytCount: 1,
      monthlyCount: 0,
      latestPickupId: "pickup-1",
      arcgisBuildingId: "internal-arcgis-id",
      customerName: "Test Customer",
    });
    expect(marker).not.toHaveProperty("arcgisBuildingId");
    expect(marker).not.toHaveProperty("customerName");

    const preview = serializeBatchReinvoicePreviewRecord(
      {
        _id: { toString: () => "record-1" },
        buildingId: "BUILDING-1",
        amount: 1,
        quantity: 1,
        nameBin: "120L",
        splitCode: "split-1",
        createdAt: new Date("2026-09-05T00:00:00Z"),
        isMonthly: true,
      },
      {
        fullName: "Test Customer",
        email: "test@example.invalid",
        phone: "0000000000",
      }
    );
    expect(preview).not.toHaveProperty("customerEmail");
    expect(preview).not.toHaveProperty("customerPhone");

    const batchJob = serializeBatchJobForAdmin({
      status: "failed",
      startedAt: new Date("2026-09-05T00:00:00Z"),
      total: 1,
      processed: 1,
      success: 0,
      failed: 1,
      skipped: 0,
      dryRun: false,
      errors: [
        {
          id: "record-1",
          buildingId: "BUILDING-1",
          error: "upstream provider detail",
        },
      ],
    });
    expect(batchJob.errors).toEqual([
      {
        id: "record-1",
        buildingId: "BUILDING-1",
        error: "Invoice request failed",
      },
    ]);
  });
});
