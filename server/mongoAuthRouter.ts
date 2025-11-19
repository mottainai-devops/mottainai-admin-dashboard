import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { addAuditLog } from "./auditLog";
import { sendPasswordResetEmail } from "./emailNotification";
import { User } from "./models/User";
import { connectToMongoDB } from "./mongodb";

const JWT_SECRET = process.env.JWT_SECRET || "mottainai-secret-key-change-in-production";

// Connect to MongoDB on startup
(async () => {
  try {
    await connectToMongoDB();
    console.log("[MongoAuth] MongoDB connected successfully");
    
    // Ensure admin user exists
    const adminExists = await User.findOne({ username: "admin" });
    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);
      await User.create({
        username: "admin",
        password: hashedPassword,
        fullName: "Administrator",
        email: "admin@mottainai.com",
        role: "admin",
        companyId: null,
      });
      console.log("[MongoAuth] Default admin user created");
    }
    
    // Log total user count
    const userCount = await User.countDocuments();
    console.log(`[MongoAuth] Total users in database: ${userCount}`);
  } catch (error) {
    console.error("[MongoAuth] MongoDB connection failed:", error);
  }
})();

// Password reset tokens (in-memory storage - could be moved to MongoDB if needed)
type ResetToken = {
  token: string;
  userId: string;
  expiresAt: Date;
};

const RESET_TOKENS: ResetToken[] = [];

export const mongoAuthRouter = router({
  // Login with username/password
  login: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await User.findOne({ username: input.username.toLowerCase() });
      
      if (!user) {
        // Log failed login attempt
        addAuditLog({
          action: 'LOGIN_FAILED',
          username: input.username,
          details: `Failed login attempt for username: ${input.username}`,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'],
          success: false,
        });
        
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      // Verify password with bcrypt
      const isPasswordValid = await user.comparePassword(input.password);
      
      if (!isPasswordValid) {
        // Log failed login attempt
        addAuditLog({
          action: 'LOGIN_FAILED',
          userId: user._id.toString(),
          username: user.username || '',
          details: `Failed login attempt (invalid password) for user: ${user.username}`,
          ipAddress: ctx.req.ip,
          userAgent: ctx.req.headers['user-agent'],
          success: false,
        });
        
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      // Log successful login
      addAuditLog({
        action: 'LOGIN_SUCCESS',
        userId: user._id.toString(),
        username: user.username || '',
        details: `Successful login for user: ${user.username}`,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        success: true,
      });

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user._id.toString(),
          username: user.username,
          role: user.role,
        },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return {
        success: true,
        token,
        user: {
          id: user._id.toString(),
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      };
    }),

  // Get current user from token
  me: publicProcedure.query(async ({ ctx }) => {
    const authHeader = ctx.req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        username: string;
        role: string;
      };

      const user = await User.findById(decoded.id);
      
      if (!user) {
        return null;
      }

      return {
        id: user._id.toString(),
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      return null;
    }
  }),

  // Logout (client-side token removal)
  logout: publicProcedure.mutation(() => {
    return { success: true };
  }),

  // List all users (for user management page)
  listUsers: publicProcedure.query(async () => {
    const users = await User.find({}).sort({ createdAt: -1 });
    
    return users.map(u => ({
      id: u._id.toString(),
      username: u.username || '',
      fullName: u.fullName,
      email: u.email,
      phone: u.phone,
      role: u.role,
      companyId: u.companyId,
      monthlyBilling: u.monthlyBilling,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));
  }),

  // Create new user
  createUser: publicProcedure
    .input(
      z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        fullName: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["admin", "user"]).default("user"),
        companyId: z.string().nullable().optional(),
        monthlyBilling: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check if username already exists
      const existingUser = await User.findOne({ username: input.username.toLowerCase() });
      if (existingUser) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Username already exists",
        });
      }

      // Create new user (password will be hashed by pre-save hook)
      const newUser = await User.create({
        username: input.username.toLowerCase(),
        password: input.password,
        fullName: input.fullName,
        email: input.email || null,
        phone: input.phone || null,
        role: input.role,
        companyId: input.companyId || null,
        monthlyBilling: input.monthlyBilling || false,
      });

      // Log user creation
      addAuditLog({
        action: 'USER_CREATED',
        userId: newUser._id.toString(),
        username: newUser.username || '',
        details: `User created: ${newUser.username} (${newUser.role})`,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        success: true,
      });

      return {
        success: true,
        user: {
          id: newUser._id.toString(),
          username: newUser.username,
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
        },
      };
    }),

  // Update user
  updateUser: publicProcedure
    .input(
      z.object({
        id: z.string(),
        username: z.string().min(3).optional(),
        password: z.string().min(6).optional(),
        fullName: z.string().optional(),
        email: z.string().email().nullable().optional(),
        phone: z.string().nullable().optional(),
        role: z.enum(["admin", "user"]).optional(),
        companyId: z.string().nullable().optional(),
        monthlyBilling: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await User.findById(input.id);
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Check if username is being changed and already exists
      if (input.username && input.username.toLowerCase() !== user.username) {
        const existingUser = await User.findOne({ username: input.username.toLowerCase() });
        if (existingUser) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Username already exists",
          });
        }
      }

      // Update user fields
      if (input.username) user.username = input.username.toLowerCase();
      if (input.password) user.password = input.password; // Will be hashed by pre-save hook
      if (input.fullName !== undefined) user.fullName = input.fullName;
      if (input.email !== undefined) user.email = input.email || null;
      if (input.phone !== undefined) user.phone = input.phone || null;
      if (input.role) user.role = input.role;
      if (input.companyId !== undefined) user.companyId = input.companyId || null;
      if (input.monthlyBilling !== undefined) user.monthlyBilling = input.monthlyBilling;

      await user.save();

      // Log user update
      const changes = [];
      if (input.username) changes.push('username');
      if (input.password) changes.push('password');
      if (input.fullName !== undefined) changes.push('fullName');
      if (input.email !== undefined) changes.push('email');
      if (input.phone !== undefined) changes.push('phone');
      if (input.role) changes.push('role');
      if (input.companyId !== undefined) changes.push('companyId');
      if (input.monthlyBilling !== undefined) changes.push('monthlyBilling');
      
      addAuditLog({
        action: 'USER_UPDATED',
        userId: user._id.toString(),
        username: user.username || '',
        details: `User updated: ${user.username} (Changed: ${changes.join(', ')})`,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        success: true,
      });

      return {
        success: true,
        user: {
          id: user._id.toString(),
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      };
    }),

  // Delete user
  deleteUser: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await User.findById(input.id);
      
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Don't allow deleting the last admin
      const adminCount = await User.countDocuments({ role: "admin" });
      if (user.role === "admin" && adminCount === 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the last admin user",
        });
      }

      // Log user deletion
      addAuditLog({
        action: 'USER_DELETED',
        userId: user._id.toString(),
        username: user.username || '',
        details: `User deleted: ${user.username}`,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        success: true,
      });

      await User.findByIdAndDelete(input.id);

      return {
        success: true,
      };
    }),

  // Search users
  searchUsers: publicProcedure
    .input(
      z.object({
        query: z.string(),
      })
    )
    .query(async ({ input }) => {
      const users = await User.find({
        $or: [
          { fullName: { $regex: input.query, $options: 'i' } },
          { username: { $regex: input.query, $options: 'i' } },
          { email: { $regex: input.query, $options: 'i' } },
        ],
      }).limit(50);

      return users.map(u => ({
        id: u._id.toString(),
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        role: u.role,
        companyId: u.companyId,
      }));
    }),

  // Request password reset
  requestPasswordReset: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const user = await User.findOne({ email: input.email });
      
      if (!user) {
        // Don't reveal if email exists
        return { success: true };
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      // Store token
      RESET_TOKENS.push({
        token: resetToken,
        userId: user._id.toString(),
        expiresAt,
      });

      // Send email
      await sendPasswordResetEmail(user.email!, resetToken);

      // Log password reset request
      addAuditLog({
        action: 'PASSWORD_RESET_REQUESTED',
        userId: user._id.toString(),
        username: user.username || '',
        details: `Password reset requested for user: ${user.username}`,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        success: true,
      });

      return { success: true };
    }),

  // Reset password with token
  resetPassword: publicProcedure
    .input(
      z.object({
        token: z.string(),
        newPassword: z.string().min(6),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Find valid token
      const resetToken = RESET_TOKENS.find(
        t => t.token === input.token && t.expiresAt > new Date()
      );

      if (!resetToken) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid or expired reset token",
        });
      }

      // Update password
      const user = await User.findById(resetToken.userId);
      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      user.password = input.newPassword; // Will be hashed by pre-save hook
      await user.save();

      // Remove used token
      const tokenIndex = RESET_TOKENS.findIndex(t => t.token === input.token);
      if (tokenIndex > -1) {
        RESET_TOKENS.splice(tokenIndex, 1);
      }

      // Log password reset
      addAuditLog({
        action: 'PASSWORD_RESET_COMPLETED',
        userId: user._id.toString(),
        username: user.username || '',
        details: `Password reset completed for user: ${user.username}`,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        success: true,
      });

      return { success: true };
    }),

  // Bulk import users from CSV
  bulkImportUsers: publicProcedure
    .input(
      z.object({
        users: z.array(
          z.object({
            username: z.string(),
            password: z.string(),
            fullName: z.string(),
            email: z.string().optional(),
            phone: z.string().optional(),
            role: z.enum(["admin", "user"]).default("user"),
            companyId: z.string().nullable().optional(),
            monthlyBilling: z.boolean().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
      };

      for (const userData of input.users) {
        try {
          // Check if user already exists
          const existingUser = await User.findOne({ username: userData.username.toLowerCase() });
          if (existingUser) {
            results.failed++;
            results.errors.push(`User ${userData.username} already exists`);
            continue;
          }

          // Create user
          await User.create({
            username: userData.username.toLowerCase(),
            password: userData.password, // Will be hashed by pre-save hook
            fullName: userData.fullName,
            email: userData.email || null,
            phone: userData.phone || null,
            role: userData.role,
            companyId: userData.companyId || null,
            monthlyBilling: userData.monthlyBilling || false,
          });

          results.success++;
        } catch (error: any) {
          results.failed++;
          results.errors.push(`Failed to create ${userData.username}: ${error.message}`);
        }
      }

      // Log bulk import
      addAuditLog({
        action: 'BULK_IMPORT',
        details: `Bulk import completed: ${results.success} success, ${results.failed} failed`,
        ipAddress: ctx.req.ip,
        userAgent: ctx.req.headers['user-agent'],
        success: results.failed === 0,
      });

      return results;
    }),
});
