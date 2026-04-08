import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { IUser as User } from "../models/User";
import { sdk } from "./sdk";
import { parse as parseCookie } from "cookie";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "mottainai-secret-key-change-in-production";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Try JWT Bearer token from Authorization header (MongoDB auth)
  const authHeader = opts.req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    try {
      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, JWT_SECRET) as {
        id: string;
        username: string;
        role: string;
      };
      user = {
        _id: decoded.id,
        username: decoded.username,
        fullName: decoded.username,
        email: null,
        role: decoded.role,
      } as unknown as User;
    } catch (error) {
      // Token invalid, fall through
    }
  }

  // 2. Try session_user_id cookie (cookie-based login)
  if (!user) {
  // Parse cookies manually from header
  const cookieHeader = opts.req.headers.cookie || '';
  const cookies = cookieHeader ? parseCookie(cookieHeader) : {};
  
  console.log('[Context] Cookie header:', cookieHeader);
  console.log('[Context] Parsed cookies:', JSON.stringify(cookies));

  // First, try custom session cookie (username/password login)
  const sessionUserId = cookies.session_user_id;
  
  if (sessionUserId) {
    try {
      const { getUserById } = await import('../db');
      user = await getUserById(sessionUserId);
    } catch (error) {
      console.error('[Auth] Failed to get user by session cookie:', error);
    }
  }
  } // end cookie block

  // 3. Fall back to Manus OAuth
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
