import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { initializeDatabase } from "../db";
import mobileAuthRouter from "../routers/mobileAuth";
import propertyEnumerationRestRouter from "../routers/propertyEnumerationRest";
import { handleOAuthCallback } from "../services/zohoService";
import { Company } from "../models/Company";

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
  // Initialize MongoDB connection
  try {
    await initializeDatabase();
    console.log('[Server] Database initialized successfully');
  } catch (error) {
    console.error('[Server] Failed to initialize database:', error);
    // Continue server startup even if DB connection fails
  }

  const app = express();
  const server = createServer(app);
  
  // CRITICAL: Parse cookies before any routes
  app.use(cookieParser());
  
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Mobile app authentication API (REST endpoints)
  app.use("/api/mobile/users", mobileAuthRouter);
  // Property Enumeration REST API (used by mobile app)
  app.use("/api/property-enumeration", propertyEnumerationRestRouter);
  
  // OAuth callback under /api/oauth/callback (Manus admin auth)
  registerOAuthRoutes(app);

  // Zoho Books OAuth callback for independent company portal
  // Flow: company clicks "Connect Zoho" → redirected to Zoho → Zoho redirects here
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

      // The company must have entered their Zoho Organization ID in Settings first
      const company = await Company.findOne({ companyId }).lean();
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

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3003");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
