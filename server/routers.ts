import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { testingRouter } from "./routers/testing";
import { analyticsRouter } from "./routers/analytics";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  testing: testingRouter,
  analytics: analyticsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({
        username: z.string(),
        password: z.string(),
      }))
      .mutation(({ input, ctx }) => {
        // Simple password check - credentials from environment
        const validUsername = process.env.ADMIN_USERNAME || 'admin';
        const validPassword = process.env.ADMIN_PASSWORD || 'admin123';

        if (input.username !== validUsername || input.password !== validPassword) {
          throw new Error('Invalid credentials');
        }

        // Set session cookie
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie('admin_session', 'authenticated', {
          ...cookieOptions,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        });

        return { success: true };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie('admin_session', { ...cookieOptions, maxAge: -1 });
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
    checkAuth: publicProcedure.query(({ ctx }) => {
      const isAuthenticated = ctx.req.cookies['admin_session'] === 'authenticated';
      return { isAuthenticated };
    }),
  }),

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
});

export type AppRouter = typeof appRouter;
