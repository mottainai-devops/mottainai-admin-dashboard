import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "mottainai-secret-key-change-in-production";

// Simple user database (in production, use a real database)
const USERS = [
  {
    id: 1,
    username: "admin",
    password: "admin123", // In production, use hashed passwords
    name: "Administrator",
    email: "admin@mottainai.com",
    role: "admin" as const,
  },
];

export const simpleAuthRouter = router({
  // Login with username/password
  login: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(({ input }) => {
      const user = USERS.find(
        (u) => u.username === input.username && u.password === input.password
      );

      if (!user) {
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
});
