import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { realWebhookRouter, serializeWebhookHealthForAdmin } from "./routers/realWebhook";
import { serializeWebhookMonitorForAdmin, webhookRouter } from "./routers/webhook";
import { testingRouter } from "./routers/testing";

const serverDirectory = path.dirname(fileURLToPath(import.meta.url));
const readServerSource = (...segments: string[]) =>
  fs.readFileSync(path.join(serverDirectory, ...segments), "utf8");
const routerContext = (user: unknown) =>
  ({ user, req: { headers: {}, ip: "127.0.0.1" }, res: {}, adminToken: null }) as any;

const protectedP0ReadBCalls = [
  { label: "stored webhook status", call: (user: unknown) => webhookRouter.createCaller(routerContext(user)).getAll() },
  { label: "configured webhook targets", call: (user: unknown) => webhookRouter.createCaller(routerContext(user)).getConfiguredTestTargets() },
  { label: "configured webhook test", call: (user: unknown) => webhookRouter.createCaller(routerContext(user)).testConfiguredEndpoint({ companyId: "company-1", lotCode: "LOT-1", webhookType: "payt" }) },
  { label: "real webhook endpoint registry", call: (user: unknown) => realWebhookRouter.createCaller(routerContext(user)).getEndpoints() },
  { label: "real webhook health check", call: (user: unknown) => realWebhookRouter.createCaller(routerContext(user)).checkAll() },
  { label: "testing webhook request", call: (user: unknown) => testingRouter.createCaller(routerContext(user)).testWebhook({ webhookUrl: "https://example.invalid/webhook" }) },
];

describe("T62 P0-read B map credential and webhook response containment", () => {
  it.each(protectedP0ReadBCalls)(
    "actual $label route rejects absent sessions with 401 and non-admin users with 403 before any resolver runs",
    async ({ call }) => {
      await expect(call(null)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
      await expect(call({ _id: "user-1", role: "user" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  );

  it("removes the public Google script-key route and source-embedded ArcGIS credential delivery", () => {
    const rootRouterSource = readServerSource("routers.ts");
    const mapPageSource = readServerSource("..", "client", "src", "pages", "MapViewPage.tsx");
    const testingSource = readServerSource("routers", "testing.ts");

    expect(rootRouterSource).not.toContain("getScriptUrl:");
    expect(mapPageSource).not.toContain("trpc.maps.getScriptUrl");
    expect(mapPageSource).toContain("VITE_GOOGLE_MAPS_BROWSER_KEY");
    expect(mapPageSource).toContain("VITE_ARCGIS_BROWSER_KEY");
    expect(testingSource).toContain("process.env.ARCGIS_SERVER_KEY");
    expect(testingSource).not.toMatch(/ARCGIS_API_KEY\s*=\s*["']/);
  });

  it("returns only redacted webhook monitor and health data", () => {
    const monitor = serializeWebhookMonitorForAdmin({
      companyName: "Test Company",
      webhookType: "payt",
      status: "healthy",
      responseTime: 12,
      lastChecked: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    expect(monitor).not.toHaveProperty("webhookUrl");
    expect(monitor).not.toHaveProperty("companyId");

    const health = serializeWebhookHealthForAdmin({
      id: "monitor-1",
      name: "Test monitor",
      url: "https://private.invalid/hook",
      category: "api",
      status: "unhealthy",
      responseTime: 12,
      checkedAt: new Date(),
      error: "private upstream diagnostic",
    });
    expect(health).not.toHaveProperty("url");
    expect(health.error).toBe("Health check failed");
  });

  it("uses server-resolved configured webhook targets instead of returning webhook URLs to the QA page", () => {
    const qaPage = readServerSource("..", "client", "src", "pages", "QATools.tsx");
    expect(qaPage).toContain("trpc.webhook.getConfiguredTestTargets.useQuery");
    expect(qaPage).toContain("trpc.webhook.testConfiguredEndpoint.useMutation");
    expect(qaPage).not.toContain("handleQuickTest(lot.paytWebhook)");
  });

  it("keeps the public map route absent from the composed application router", () => {
    expect(Object.keys(appRouter._def.procedures)).not.toContain("maps.getScriptUrl");
  });
});
