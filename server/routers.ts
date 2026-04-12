import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { testingRouter } from "./routers/testing";
import { analyticsRouter } from "./routers/analytics";
import { authRouter } from "./routers/auth";
import { usersRouter } from "./routers/users";
import { uploadRouter } from "./uploadRouter";
import { mongoAuthRouter } from "./mongoAuthRouter";
import { lotsRouter } from "./routers/lots";
import { pickupsRouter } from "./routers/pickups";
import { mafRouter } from "./routers/maf";
import { customersRouter } from "./routers/customers";
import { propertyEnumerationRouter } from "./routers/propertyEnumeration";
import { billingRouter } from "./routers/billing";
import { webhookRouter } from "./routers/webhook";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import activeLots from "../shared/active_lots.json";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  testing: testingRouter,
  analytics: analyticsRouter,
  auth: authRouter,
  simpleAuth: mongoAuthRouter, // MongoDB-based username/password auth
  users: usersRouter,
  upload: uploadRouter,

  // Operational lots with role-based filtering
  lots: lotsRouter,
  // Pickup records from form submissions
  pickups: pickupsRouter,
  // MAF (company) and field worker statistics
  maf: mafRouter,
  // Customer management
  customers: customersRouter,
  // Property enumeration and geographic backfill
  propertyEnumeration: propertyEnumerationRouter,
  // Billing analytics and reports
  billing: billingRouter,
  // Webhook monitoring
  webhook: webhookRouter,

  // Company management router - now using MongoDB directly
  companies: router({
    list: publicProcedure.query(async () => {
      const companies = await db.getAllCompanies();
      return companies;
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const company = await db.getCompanyById(input.id);
        return company;
      }),
    
    getByPin: publicProcedure
      .input(z.object({ pin: z.string() }))
      .query(async ({ input }) => {
        const company = await db.getCompanyByPin(input.pin);
        return company;
      }),
    
    create: publicProcedure
      .input(z.object({
        companyId: z.string(),
        companyName: z.string(),
        pin: z.string().min(4).max(6),
        operationalLots: z.array(z.object({
          lotCode: z.string(),
          lotName: z.string(),
          paytWebhook: z.string(),
          monthlyWebhook: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const company = await db.createCompany(input);
        return company;
      }),
    
    update: publicProcedure
      .input(z.object({
        id: z.string(),
        companyId: z.string().optional(),
        companyName: z.string().optional(),
        pin: z.string().min(4).max(6).optional(),
        operationalLots: z.array(z.object({
          lotCode: z.string(),
          lotName: z.string(),
          paytWebhook: z.string(),
          monthlyWebhook: z.string(),
        })).optional(),
        active: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...updateData } = input;
        const company = await db.updateCompany(id, updateData);
        return company;
      }),
    
    delete: publicProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const success = await db.deleteCompany(input.id);
        return { success };
      }),
    
    statistics: publicProcedure.query(async () => {
      const stats = await db.getCompanyStatistics();
      return stats;
    }),
  }),

  // Super-admin only operations
  superAdmin: router({
    triggerGeoBackfill: protectedProcedure
      .input(z.object({
        dryRun: z.boolean().default(false),
        batchSize: z.number().min(1).max(500).default(100),
      }).optional())
      .mutation(async ({ input }) => {
        const { FormSubmission } = await import('./models/FormSubmission');
        const dryRun = input?.dryRun ?? false;
        const batchSize = input?.batchSize ?? 100;

        // Find records with arcgisBuildingId but missing lgaName
        const eligible = await FormSubmission.find({
          arcgisBuildingId: { $exists: true, $nin: [null, ''] },
          lgaName: { $in: [null, undefined, ''] },
        }).limit(batchSize).lean();

        if (dryRun) {
          return {
            success: true,
            dryRun: true,
            totalEligible: eligible.length,
            message: `Dry run: ${eligible.length} records eligible for geo backfill`,
          };
        }

        let updated = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const record of eligible) {
          try {
            const bid: string = (record as any).arcgisBuildingId || '';
            const parts = bid.trim().split(/\s+/);
            if (parts.length >= 3) {
              const middlePart = parts[1]; // e.g. OYSISW08
              const lastPart = parts[2];   // e.g. 410
              const stateCode = middlePart.substring(0, 2);
              const lotCode = lastPart.padStart(3, '0');
              await FormSubmission.findByIdAndUpdate((record as any)._id, {
                $set: { stateCode, lotCode, country: 'Nigeria' },
              });
              updated++;
            } else {
              errors.push(`Skipped ${(record as any)._id}: unexpected format "${bid}"`);
              failed++;
            }
          } catch (err: any) {
            errors.push(`Error on ${(record as any)._id}: ${err.message}`);
            failed++;
          }
        }

        return {
          success: true,
          dryRun: false,
          totalEligible: eligible.length,
          processed: eligible.length,
          updated,
          failed,
          errors: errors.slice(0, 10),
          message: `Geo backfill complete: ${updated} updated, ${failed} failed`,
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
