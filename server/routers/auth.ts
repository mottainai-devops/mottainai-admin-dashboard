import { z } from 'zod';
import { publicProcedure, protectedProcedure, router } from '../_core/trpc';
import * as db from '../db';
import { TRPCError } from '@trpc/server';

/**
 * Authentication Router
 * Handles login, logout, and session management
 */
export const authRouter = router({
  /**
   * Login with username and password
   */
  login: publicProcedure
    .input(z.object({
      username: z.string().min(3, 'Username must be at least 3 characters'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
    }))
    .mutation(async ({ input, ctx }) => {
      console.log('[Auth] Login attempt:', { username: input?.username, hasPassword: !!input?.password });
      const { username, password } = input;

      // Find user by username
      const user = await db.getUserByUsername(username);
      console.log('[Auth] User lookup result:', !!user, user ? { id: user._id, username: user.username, hasPassword: !!user.password, active: user.active } : null);
      
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
      }

      // Check if user is active
      if (!user.active) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Your account has been disabled. Please contact an administrator.',
        });
      }

      // Verify password
      console.log('[Auth] Comparing password...');
      const isValid = await user.comparePassword(password);
      console.log('[Auth] Password comparison result:', isValid);
      
      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid username or password',
        });
      }

      // Update last signed in
      console.log('[Auth] Updating lastSignedIn...');
      await db.updateUser(user._id, { lastSignedIn: new Date() });
      console.log('[Auth] Updated successfully');

      // Set session cookie (using user ID as session identifier)
      console.log('[Auth] Setting session cookie...');
      ctx.res.cookie('session_user_id', user._id.toString(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
        domain: undefined, // Let browser determine domain
      });
      
      // Also log the cookie value for debugging
      console.log('[Auth] Cookie set with value:', user._id.toString().substring(0, 8) + '...');

      console.log('[Auth] Login successful, returning response');
      return {
        success: true,
        user: {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

  /**
   * Logout (clear session)
   */
  logout: publicProcedure
    .mutation(({ ctx }) => {
      ctx.res.clearCookie('session_user_id', {
        httpOnly: true,
        secure: true, // Always use secure for HTTPS
        sameSite: 'lax',
        path: '/',
      });

      return { success: true };
    }),

  /**
   * Get current user (check session)
   */
  me: publicProcedure
    .query(async ({ ctx }) => {
      const userId = ctx.req.cookies?.session_user_id;

      if (!userId) {
        return null;
      }

      try {
        const user = await db.getUserById(userId);

        if (!user || !user.active) {
          return null;
        }

        return {
          id: user._id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      } catch (error) {
        console.error('[Auth] me query failed:', error);
        // Return null if database is unavailable (dev environment)
        return null;
      }
    }),

  /**
   * Change own password
   */
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.req.cookies?.session_user_id;

      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Not authenticated',
        });
      }

      const user = await db.getUserById(userId);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Verify current password
      const isValid = await user.comparePassword(input.currentPassword);

      if (!isValid) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Current password is incorrect',
        });
      }

      // Update password
      await db.updateUser(userId, { password: input.newPassword });

      return { success: true };
    }),
});
