import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic } from "./static";
import mobileAuthRouter from "../routers/mobileAuth";
import propertyEnumerationRestRouter from "../routers/propertyEnumerationRest";
import { handleOAuthCallback } from "../services/zohoService";
import { Company } from "../models/Company";

// Catch unhandled promise rejections so they are logged (not silently swallowed)
// but do NOT exit the process — let PM2 decide whether to restart
process.on("unhandledRejection", (reason, promise) => {
  console.error("[Server] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[Server] Uncaught Exception:", err);
  // Exit so PM2 can restart with a clean state
  process.exit(1);
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Mobile app authentication API (REST endpoints)
  app.use("/api/mobile/users", mobileAuthRouter);
  // Property Enumeration REST API (used by mobile app)
  app.use("/api/property-enumeration", propertyEnumerationRestRouter);
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);

  // Zoho Books OAuth callback for independent company portal
  app.get('/api/company-portal/zoho/callback', async (req, res) => {
    try {
      const code = req.query.code as string;
      const state = req.query.state as string;
      const error = req.query.error as string;

      if (error) {
        return res.redirect(`/company-portal/settings?zoho_error=${encodeURIComponent(error)}`);
      }
      if (!code || !state) {
        return res.redirect('/company-portal/settings?zoho_error=missing_params');
      }

      let decoded: { companyId: string };
      try {
        decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf8'));
      } catch {
        return res.redirect('/company-portal/settings?zoho_error=invalid_state');
      }

      const { companyId } = decoded;
      if (!companyId) {
        return res.redirect('/company-portal/settings?zoho_error=invalid_state');
      }

      const company = await Company.findOne({ companyId }).lean() as any;
      const organizationId = company?.zohoOrganizationId || '';

      await handleOAuthCallback(code, companyId, organizationId);
      return res.redirect('/company-portal/settings?zoho_connected=1');
    } catch (err: any) {
      console.error('[Zoho OAuth Callback Error]', err.message);
      return res.redirect(`/company-portal/settings?zoho_error=${encodeURIComponent(err.message)}`);
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // Production mode - serve static files only
  serveStatic(app);
  const port = await findAvailablePort(Number(process.env.PORT) || 3003);
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch((err) => {
  console.error("[Server] Fatal startup error:", err);
  process.exit(1);
});
