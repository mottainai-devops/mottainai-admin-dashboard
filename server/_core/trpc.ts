import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { serviceCredentialMatches } from "../services/lotAccess";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

/**
 * Explicit machine identity for the Field Scheduler enrichment call. It is
 * intentionally unavailable until an owner configures the secret at release;
 * anonymous and userId-keyed requests cannot reach this path.
 */
export const fieldSchedulerServiceProcedure = t.procedure.use(
  t.middleware(async opts => {
    const configured = process.env.FIELD_SCHEDULER_LOT_LOOKUP_TOKEN;
    const supplied = opts.ctx.req.header("x-field-scheduler-service-token");
    if (!serviceCredentialMatches(configured, supplied)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Field Scheduler service authorization required" });
    }
    return opts.next();
  }),
);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
    }

    if (ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);
