import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { IUser as User } from "../models/User";
import { sdk } from "./sdk";
import { parse as parseCookie } from "cookie";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // Parse cookies manually from header
  const cookieHeader = opts.req.headers.cookie || '';
  const cookies = cookieHeader ? parseCookie(cookieHeader) : {};
  
  console.log('[Context] Cookie header:', cookieHeader);
  console.log('[Context] Parsed cookies:', JSON.stringify(cookies));

  // First, try custom session cookie (username/password login)
  const sessionUserId = cookies.session_user_id;
  console.log('[Context] session_user_id cookie value:', sessionUserId);
  
  if (sessionUserId) {
    try {
      const { getUserById } = await import('../db');
      user = await getUserById(sessionUserId);
    } catch (error) {
      console.error('[Auth] Failed to get user by session cookie:', error);
    }
  }

  // If no custom session, try Manus OAuth
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch (error) {
      // Authentication is optional for public procedures.
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
