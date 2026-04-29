/**
 * filterUrlParams.ts
 *
 * Serialises and deserialises PickupFilters to/from URL query parameters so
 * that filter state is preserved when navigating between List View and Map View.
 *
 * Serialised keys (all optional):
 *   df   – dateFrom  (ISO 8601 date string, e.g. "2026-01-01")
 *   dt   – dateTo
 *   co   – companyId
 *   fw   – fieldWorkerId
 *   lo   – lotId
 *   bt   – binType
 *   pt   – paymentType  ("PAYT" | "Monthly" | "all")
 *   src  – source
 *   bid  – arcgisBuildingId
 */

import type { PickupFilters } from "@/components/PickupFilters";

/** Serialise a PickupFilters object into a URLSearchParams instance. */
export function filtersToParams(filters: PickupFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (filters.dateFrom) p.set("df", filters.dateFrom.toISOString().slice(0, 10));
  if (filters.dateTo) p.set("dt", filters.dateTo.toISOString().slice(0, 10));
  if (filters.companyId) p.set("co", filters.companyId);
  if (filters.fieldWorkerId) p.set("fw", filters.fieldWorkerId);
  if (filters.lotId) p.set("lo", filters.lotId);
  if (filters.binType) p.set("bt", filters.binType);
  if (filters.paymentType && filters.paymentType !== "all") p.set("pt", filters.paymentType);
  if (filters.source && filters.source !== "all") p.set("src", filters.source);
  if (filters.arcgisBuildingId) p.set("bid", filters.arcgisBuildingId);
  return p;
}

/** Deserialise a URLSearchParams instance into a PickupFilters object. */
export function paramsToFilters(params: URLSearchParams): PickupFilters {
  const filters: PickupFilters = {
    paymentType: "all",
    source: "all",
  };
  const df = params.get("df");
  if (df) filters.dateFrom = new Date(df);
  const dt = params.get("dt");
  if (dt) filters.dateTo = new Date(dt);
  const co = params.get("co");
  if (co) filters.companyId = co;
  const fw = params.get("fw");
  if (fw) filters.fieldWorkerId = fw;
  const lo = params.get("lo");
  if (lo) filters.lotId = lo;
  const bt = params.get("bt");
  if (bt) filters.binType = bt;
  const pt = params.get("pt");
  if (pt === "PAYT" || pt === "Monthly") filters.paymentType = pt;
  const src = params.get("src");
  if (src) filters.source = src as PickupFilters["source"];
  const bid = params.get("bid");
  if (bid) filters.arcgisBuildingId = bid;
  return filters;
}

/**
 * Build the URL for the opposite view, carrying over the current filters.
 * @param targetPath  "/map-view" or "/pickup-records"
 * @param filters     Current active filters
 */
export function buildViewSwitchUrl(targetPath: string, filters: PickupFilters): string {
  const params = filtersToParams(filters);
  const qs = params.toString();
  return qs ? `${targetPath}?${qs}` : targetPath;
}
