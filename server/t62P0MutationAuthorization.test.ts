import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { adminProcedure, router } from "./_core/trpc";
import { appRouter } from "./routers";
import { billingRouter } from "./routers/billing";
import { companiesSetupRouter } from "./routers/companiesSetup";
import { pickupsRouter } from "./routers/pickups";
import { webhookRouter } from "./routers/webhook";
import { mongoAuthRouter } from "./mongoAuthRouter";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const readServerSource = (...segments: string[]) =>
  fs.readFileSync(path.join(serverDirectory, ...segments), "utf8");

const p0AuthorizationProbe = router({
  mutate: adminProcedure
    .input(z.object({ requestedActorId: z.string().optional() }))
    .mutation(({ ctx, input }) => ({
      actorId: String(ctx.user!._id),
      requestedActorId: input.requestedActorId ?? null,
    })),
});

const callerFor = (user: unknown) =>
  p0AuthorizationProbe.createCaller({
    user,
    req: {},
    res: {},
    adminToken: null,
  } as any);

const routerContext = (user: unknown) =>
  ({
    user,
    req: { headers: {}, ip: "127.0.0.1" },
    res: {},
    adminToken: null,
  }) as any;

const mutationGroups = [
  {
    file: ["routers.ts"],
    label: "company lifecycle",
    names: ["create", "update", "delete"],
  },
  {
    file: ["routers", "companiesSetup.ts"],
    label: "company setup",
    names: [
      "setupPaystack",
      "backfillSplitCodes",
      "bulkBackfillSplitCodes",
      "updatePercentage",
      "togglePortalAccess",
    ],
  },
  {
    file: ["routers", "billing.ts"],
    label: "batch invoicing",
    names: ["triggerBatchReinvoice"],
  },
  {
    file: ["routers", "pickups.ts"],
    label: "pickup maintenance",
    names: ["updateStatus", "backfillDinoBinAmount"],
  },
  {
    file: ["mongoAuthRouter.ts"],
    label: "user lifecycle",
    names: ["createUser", "updateUser", "deleteUser", "bulkImportUsers"],
  },
  {
    file: ["routers", "webhook.ts"],
    label: "webhook operations",
    names: ["testEndpoint", "checkAll", "sendAlerts"],
  },
];

const protectedRouteChecks = [
  {
    label: "company lifecycle",
    call: (user: unknown) =>
      appRouter.createCaller(routerContext(user)).companies.create({
        companyId: "test-company",
        companyName: "Test Company",
        pin: "1234",
        operationalLots: [],
      }),
  },
  {
    label: "company setup",
    call: (user: unknown) =>
      companiesSetupRouter
        .createCaller(routerContext(user))
        .togglePortalAccess({
          companyId: "test-company",
          enabled: true,
        }),
  },
  {
    label: "batch invoicing",
    call: (user: unknown) =>
      billingRouter.createCaller(routerContext(user)).triggerBatchReinvoice({
        recordIds: ["000000000000000000000000"],
        dryRun: true,
      }),
  },
  {
    label: "pickup maintenance",
    call: (user: unknown) =>
      pickupsRouter
        .createCaller(routerContext(user))
        .updateStatus({ id: "test-pickup", status: true }),
  },
  {
    label: "user lifecycle",
    call: (user: unknown) =>
      mongoAuthRouter.createCaller(routerContext(user)).createUser({
        username: "test-user",
        password: "test-password",
        fullName: "Test User",
      }),
  },
  {
    label: "webhook operations",
    call: (user: unknown) =>
      webhookRouter.createCaller(routerContext(user)).checkAll(),
  },
];

describe("T62-P0 pure-mutation authorization boundary", () => {
  it.each(protectedRouteChecks)(
    "actual $label procedure denies unauthenticated and non-admin callers before side effects",
    async ({ call }) => {
      await expect(call(null)).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(call({ _id: "user-1", role: "user" })).rejects.toMatchObject(
        { code: "FORBIDDEN" }
      );
    }
  );

  it.each(mutationGroups)(
    "$label mutations deny unauthenticated and non-admin callers but permit a verified admin",
    async () => {
      await expect(
        callerFor(null).mutate({ requestedActorId: "attacker" })
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
      });

      await expect(
        callerFor({ _id: "user-1", role: "user" }).mutate({
          requestedActorId: "attacker",
        })
      ).rejects.toMatchObject({ code: "FORBIDDEN" });

      await expect(
        callerFor({ _id: "admin-1", role: "admin" }).mutate({
          requestedActorId: "attacker",
        })
      ).resolves.toEqual({ actorId: "admin-1", requestedActorId: "attacker" });
    }
  );

  it("declares every owner-listed P0 pure mutation as admin-only, never public", () => {
    for (const group of mutationGroups) {
      const source = readServerSource(...group.file);
      for (const name of group.names) {
        expect(source).toMatch(new RegExp(`${name}:\\s*adminProcedure\\b`));
        expect(source).not.toMatch(
          new RegExp(`${name}:\\s*publicProcedure\\b`)
        );
      }
    }
  });

  it("keeps the company portal batch action on a verified, server-scoped portal contract", () => {
    const client = readServerSource(
      "..",
      "client",
      "src",
      "pages",
      "portal",
      "CompanyPortalFixedBilling.tsx"
    );
    const portalRouter = readServerSource("routers", "companyPortal.ts");
    const adminClient = readServerSource("..", "client", "src", "main.tsx");
    const adminBatchPage = readServerSource(
      "..",
      "client",
      "src",
      "pages",
      "BatchReinvoice.tsx"
    );
    const triggerBlock = portalRouter
      .split("triggerBatch:")[1]
      .split("getBatchJobStatus:")[0];

    expect(adminClient).toContain("localStorage.getItem('auth_token')");
    expect(adminClient).toContain("Authorization: `Bearer ${token}`");
    expect(adminBatchPage).toContain(
      "trpc.billing.triggerBatchReinvoice.useMutation"
    );
    expect(client).toContain("trpc.companyPortal.triggerBatch.useMutation");
    expect(client).not.toContain(
      "trpc.billing.triggerBatchReinvoice.useMutation"
    );
    expect(client).toContain("recordIds: eligibleRecordIds");
    expect(client).toContain('portalToken: token ?? ""');
    expect(triggerBlock).toContain("verifyPortalToken(input.portalToken)");
    expect(triggerBlock).toContain("getCompanyScope(companyId)");
    expect(triggerBlock).toContain("splitCode: { $in: splitCodes }");
    expect(triggerBlock).not.toContain("input.companyId");
  });
});
