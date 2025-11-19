import { TRPCError, initTRPC } from '@trpc/server';
import { publicProcedure } from './trpc';
import * as db from '../db';
import type { TrpcContext } from './context';
import superjson from 'superjson';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || "mottainai-secret-key-change-in-production";

// Helper function to get user from JWT token or cookie
async function getUserFromContext(ctx: any) {
  // First, try JWT token from Authorization header
  const authHeader = ctx.req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: number;
        username: string;
        role: string;
      };
      
      // For simple auth, return the decoded user directly
      // In production, you'd look up the user in the database
      return {
        _id: decoded.id.toString(),
        username: decoded.username,
        fullName: decoded.username,
        email: null,
        role: decoded.role,
      };
    } catch (error) {
      // Token invalid, fall through to cookie check
    }
  }
  
  // Fall back to cookie-based session
  const userId = ctx.req.cookies?.session_user_id;
  if (userId) {
    return await db.getUserById(userId);
  }
  
  return null;
}

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

/**
 * Authentication middleware
 * Checks if user is authenticated via session cookie
 */
export const isAuthenticated = t.middleware(async ({ ctx, next }: any) => {
  const user = await getUserFromContext(ctx);

  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated. Please log in.',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
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
  const user = await getUserFromContext(ctx);

  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Not authenticated.',
    });
  }

  if (user.role !== 'admin') {
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
        fullName: user.fullName,
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
  const user = await getUserFromContext(ctx);

  if (!user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'User not found.',
    });
  }

  if (user.role !== 'admin') {
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
        fullName: user.fullName,
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
