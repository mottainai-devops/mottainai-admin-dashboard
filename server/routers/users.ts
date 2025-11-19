import { z } from 'zod';
import { publicProcedure, router } from '../_core/trpc';
import { authenticatedProcedure, adminProcedure, superAdminProcedure } from '../_core/authMiddleware';
import * as db from '../db';
import { TRPCError } from '@trpc/server';

/**
 * Users Router
 * Handles user management operations (CRUD)
 * Requires authentication
 */
export const usersRouter = router({
  /**
   * List all users
   */
  list: adminProcedure
    .query(async () => {
      try {
        // Add timeout to prevent hanging
        const usersPromise = db.getAllUsers();
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Database timeout')), 2000)
        );
        
        const users = await Promise.race([usersPromise, timeoutPromise]);
        return users.map(user => ({
          id: user._id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          companyId: user.companyId,
          monthlyBilling: user.monthlyBilling,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        }));
      } catch (error) {
        console.error('[Users] Failed to get users from database:', error);
        // Return empty array if database is not available
        return [];
      }
    }),

  /**
   * Get user by ID
   */
  getById: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .query(async ({ input }) => {
      const user = await db.getUserById(input.id);

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return {
        id: user._id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        companyId: user.companyId,
        monthlyBilling: user.monthlyBilling,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };
    }),

  /**
   * Create new user
   */
  create: adminProcedure
    .input(z.object({
      fullName: z.string().min(1, 'Full name is required'),
      username: z.string().min(3, 'Username must be at least 3 characters').optional(),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      role: z.enum(['admin', 'user']).default('user'),
      companyId: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await db.createUser({
          fullName: input.fullName,
          username: input.username,
          password: input.password,
          email: input.email || null,
          phone: input.phone || null,
          role: input.role,
          companyId: input.companyId || null,
        });

        return {
          success: true,
          user: {
            id: user._id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
          },
        };
      } catch (error: any) {
        if (error.message === 'Username already exists') {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'Username already exists',
          });
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create user',
        });
      }
    }),

  /**
   * Update user
   */
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      fullName: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
      role: z.enum(['admin', 'user']).optional(),
      companyId: z.string().optional(),
      password: z.string().min(6).optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...updateData } = input;

      try {
        const user = await db.updateUser(id, updateData);

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        return {
          success: true,
          user: {
            id: user._id,
            username: user.username,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            phone: user.phone,
          },
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user',
        });
      }
    }),

  /**
   * Delete user
   */
  delete: adminProcedure
    .input(z.object({
      id: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Prevent deleting admin users (optional safety check)
      const targetUser = await db.getUserById(input.id);
      if (targetUser?.role === 'admin') {
        // Count remaining admins
        const allUsers = await db.getAllUsers();
        const adminCount = allUsers.filter(u => u.role === 'admin').length;
        if (adminCount <= 1) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Cannot delete the last admin user',
          });
        }
      }
      const success = await db.deleteUser(input.id);

      if (!success) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return { success: true };
    }),
});
