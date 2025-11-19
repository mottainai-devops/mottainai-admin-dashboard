import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";

const JWT_SECRET = process.env.JWT_SECRET || "mottainai-secret-key-change-in-production";

// Simple user database (in production, use a real database)
type SimpleUser = {
  id: number;
  username: string;
  password: string;
  name: string | null;
  email: string | null;
  role: "admin" | "user";
  active: boolean;
  companyId: string | null;
  createdAt: Date;
  lastSignedIn: Date;
};

// Initialize with hashed password for admin user
const USERS: SimpleUser[] = [];

// Initialize admin user with hashed password
(async () => {
  if (USERS.length === 0) {
    USERS.push({
      id: 1,
      username: "admin",
      password: await bcrypt.hash("admin123", 10),
      name: "Administrator",
      email: "admin@mottainai.com",
      role: "admin",
      active: true,
      companyId: null,
      createdAt: new Date(),
      lastSignedIn: new Date(),
    });
  }
})();

let nextUserId = 2;

export const simpleAuthRouter = router({
  // Login with username/password
  login: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const user = USERS.find((u) => u.username === input.username);

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      // Verify password using bcrypt
      const passwordMatch = await bcrypt.compare(input.password, user.password);
      
      if (!passwordMatch) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid username or password",
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        {
          id: user.id,
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
          id: user.id,
          username: user.username,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }),

  // Get current user from token
  me: publicProcedure.query(({ ctx }) => {
    const authHeader = ctx.req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }

    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: number;
        username: string;
        role: string;
      };

      const user = USERS.find((u) => u.id === decoded.id);
      
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        username: user.username,
        name: user.name,
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
  listUsers: publicProcedure.query(() => {
    return USERS.map(u => ({
      id: String(u.id),
      username: u.username,
      name: u.name,
      email: u.email,
      role: u.role,
      active: u.active,
      companyId: u.companyId,
      createdAt: u.createdAt,
      lastSignedIn: u.lastSignedIn,
    }));
  }),

  // Create new user
  createUser: publicProcedure
    .input(
      z.object({
        username: z.string().min(3),
        password: z.string().min(6),
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "user"]).default("user"),
        companyId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if username already exists
      if (USERS.find(u => u.username === input.username)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Username already exists",
        });
      }

      // Hash password before storing
      const hashedPassword = await bcrypt.hash(input.password, 10);

      const newUser: SimpleUser = {
        id: nextUserId++,
        username: input.username,
        password: hashedPassword,
        name: input.name || null,
        email: input.email || null,
        role: input.role,
        active: true,
        companyId: input.companyId || null,
        createdAt: new Date(),
        lastSignedIn: new Date(),
      };

      USERS.push(newUser);

      return {
        success: true,
        user: {
          id: String(newUser.id),
          username: newUser.username,
          name: newUser.name,
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
        name: z.string().optional(),
        email: z.string().email().optional(),
        role: z.enum(["admin", "user"]).optional(),
        active: z.boolean().optional(),
        companyId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const userIndex = USERS.findIndex(u => String(u.id) === input.id);
      
      if (userIndex === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Check if username is being changed and already exists
      if (input.username && input.username !== USERS[userIndex].username) {
        if (USERS.find(u => u.username === input.username)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Username already exists",
          });
        }
      }

      // Update user fields
      if (input.username) USERS[userIndex].username = input.username;
      if (input.password) {
        // Hash password before updating
        USERS[userIndex].password = await bcrypt.hash(input.password, 10);
      }
      if (input.name !== undefined) USERS[userIndex].name = input.name || null;
      if (input.email !== undefined) USERS[userIndex].email = input.email || null;
      if (input.role) USERS[userIndex].role = input.role;
      if (input.active !== undefined) USERS[userIndex].active = input.active;
      if (input.companyId !== undefined) USERS[userIndex].companyId = input.companyId || null;

      return {
        success: true,
        user: {
          id: String(USERS[userIndex].id),
          username: USERS[userIndex].username,
          name: USERS[userIndex].name,
          email: USERS[userIndex].email,
          role: USERS[userIndex].role,
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
    .mutation(async ({ input }) => {
      const userIndex = USERS.findIndex(u => String(u.id) === input.id);
      
      if (userIndex === -1) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Don't allow deleting the last admin
      const adminCount = USERS.filter(u => u.role === "admin").length;
      if (USERS[userIndex].role === "admin" && adminCount === 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete the last admin user",
        });
      }

      USERS.splice(userIndex, 1);

      return { success: true };
    }),
});
