import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { testingRouter } from "./routers/testing";
import { analyticsRouter } from "./routers/analytics";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";

export const appRouter = router({
    // if you need to use socket.io, read and register route in server/_core/index.ts, all api should start with '/api/' so that the gateway can route correctly
  system: systemRouter,
  testing: testingRouter,
  analytics: analyticsRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Company management router
  companies: router({
    list: publicProcedure.query(async () => {
      // Fetch from production API
      const response = await fetch('http://172.232.24.180:3000/companies/active');
      const data = await response.json();
      return data.data || [];
    }),
    
    getById: publicProcedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const response = await fetch(`http://172.232.24.180:3000/companies/${input.id}`);
        const data = await response.json();
        return data.data;
      }),
    
    create: protectedProcedure
      .input(z.object({
        companyId: z.string(),
        companyName: z.string(),
        operationalLots: z.array(z.object({
          lotCode: z.string(),
          lotName: z.string(),
          paytWebhook: z.string(),
          monthlyWebhook: z.string(),
        })),
      }))
      .mutation(async ({ input }) => {
        const response = await fetch('http://172.232.24.180:3000/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
        const data = await response.json();
        return data.data;
      }),
    
    update: protectedProcedure
      .input(z.object({
        id: z.string(),
        companyId: z.string().optional(),
        companyName: z.string().optional(),
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
        const response = await fetch(`http://172.232.24.180:3000/companies/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        const data = await response.json();
        return data.data;
      }),
    
    delete: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        const response = await fetch(`http://172.232.24.180:3000/companies/${input.id}`, {
          method: 'DELETE',
        });
        const data = await response.json();
        return data;
      }),
  }),
});

export type AppRouter = typeof appRouter;
