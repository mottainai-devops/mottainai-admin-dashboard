/**
 * customerApp.ts — Admin-side tRPC router for Customer App management
 *
 * Proxies requests to the platform backend (upwork.kowope.xyz) which holds
 * all customer app data (CustomerAccount, PickupRequest, AppInvite).
 */

import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import axios from "axios";

const PLATFORM_API = "https://upwork.kowope.xyz/api/v1";

// Helper: forward admin session cookie as Bearer token for admin endpoints
async function platformAdminRequest(
  method: "get" | "post" | "patch",
  path: string,
  data?: Record<string, unknown>,
  params?: Record<string, unknown>,
  adminToken?: string
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (adminToken) {
    headers["Authorization"] = `Bearer ${adminToken}`;
  }

  const response = await axios({
    method,
    url: `${PLATFORM_API}${path}`,
    data,
    params,
    headers,
    timeout: 15000,
  });
  return response.data;
}

export const customerAppRouter = router({
  /**
   * List all customer app accounts with optional search and pagination.
   */
  listAccounts: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const token = (ctx as any).adminToken;
      const data = await platformAdminRequest(
        "get",
        "/admin/customer-app/accounts",
        undefined,
        { search: input.search, page: input.page, limit: input.limit },
        token
      );
      return data as {
        success: boolean;
        accounts: unknown[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }),

  /**
   * List all sent app invites.
   */
  listInvites: protectedProcedure.query(async ({ ctx }) => {
    const token = (ctx as any).adminToken;
    const data = await platformAdminRequest("get", "/admin/customer-app/invites", undefined, undefined, token);
    return data as { success: boolean; invites: unknown[] };
  }),

  /**
   * Send an app invite SMS to a single customer.
   */
  sendInvite: protectedProcedure
    .input(
      z.object({
        phone: z.string().min(7),
        buildingId: z.string().optional(),
        customerName: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = (ctx as any).adminToken;
      const data = await platformAdminRequest(
        "post",
        "/admin/customer-app/invite",
        { phone: input.phone, buildingId: input.buildingId, customerName: input.customerName },
        undefined,
        token
      );
      return data as { success: boolean; message: string; invite: unknown };
    }),

  /**
   * List customer-submitted pickup requests.
   */
  listPickupRequests: protectedProcedure
    .input(
      z.object({
        status: z.enum(["pending", "confirmed", "cancelled", "all"]).default("pending"),
        page: z.number().int().min(1).default(1),
        limit: z.number().int().min(1).max(200).default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      const token = (ctx as any).adminToken;
      const data = await platformAdminRequest(
        "get",
        "/admin/customer-app/pickup-requests",
        undefined,
        { status: input.status, page: input.page, limit: input.limit },
        token
      );
      return data as {
        success: boolean;
        requests: unknown[];
        pagination: { page: number; limit: number; total: number; pages: number };
      };
    }),

  /**
   * Confirm or cancel a customer pickup request.
   */
  updatePickupRequest: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.enum(["confirmed", "cancelled"]),
        adminNotes: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = (ctx as any).adminToken;
      const data = await platformAdminRequest(
        "patch",
        `/admin/customer-app/pickup-requests/${input.id}`,
        { status: input.status, adminNotes: input.adminNotes },
        undefined,
        token
      );
      return data as { success: boolean; request: unknown };
    }),
});
