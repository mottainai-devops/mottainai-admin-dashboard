import { TRPCError, initTRPC } from '@trpc/server';
import { publicProcedure } from './trpc';
import * as db from '../db';
import type { TrpcContext } from './context';
import superjson from 'superjson';

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

/**
 * Authentication middleware
 * Checks if user is authenticated via session cookie
 */
export const isAuthenticated = t.middleware(async ({ ctx, next }: any) => {
  const userId = ctx.req.cookies?.session_user_id;

  if (!userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated. Please log in.',
    });
  }

  const user = await db.getUserById(userId);

  if (!user || !user.active) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not found or inactive.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

/**
 * Admin middleware
 * Requires user to be authenticated and have admin or superadmin role
 */
export const isAdmin = t.middleware(async ({ ctx, next }: any) => {
  const userId = ctx.req.cookies?.session_user_id;

  if (!userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated.',
    });
  }

  const user = await db.getUserById(userId);

  if (!user || !user.active) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not found or inactive.',
    });
  }

  if (user.role !== 'admin' && user.role !== 'superadmin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

/**
 * Superadmin middleware
 * Requires user to be authenticated and have superadmin role
 */
export const isSuperAdmin = t.middleware(async ({ ctx, next }: any) => {
  const userId = ctx.req.cookies?.session_user_id;

  if (!userId) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated.',
    });
  }

  const user = await db.getUserById(userId);

  if (!user || !user.active) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not found or inactive.',
    });
  }

  if (user.role !== 'superadmin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Superadmin access required.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: {
        id: user._id,
        username: user.username,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

// Export protected procedures
export const authenticatedProcedure = publicProcedure.use(isAuthenticated);
export const adminProcedure = publicProcedure.use(isAdmin);
export const superAdminProcedure = publicProcedure.use(isSuperAdmin);
