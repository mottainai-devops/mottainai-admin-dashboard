export interface MapViewFilterState {
  dateFrom?: Date;
  dateTo?: Date;
  companyId?: string;
  fieldWorkerId?: string;
  lotId?: string;
  binType?: string;
  paymentType?: "PAYT" | "Monthly" | "all";
  source?: "webapp_current" | "webapp_old" | "mobile_app" | "field_worker" | "survey123" | "unknown" | "all";
  arcgisBuildingId?: string;
}

export function buildMapDataInput(filters: MapViewFilterState) {
  return {
    dateFrom: filters.dateFrom?.toISOString(),
    dateTo: filters.dateTo?.toISOString(),
    companyId: filters.companyId,
    fieldWorkerId: filters.fieldWorkerId,
    lotId: filters.lotId,
    binType: filters.binType,
    paymentType: filters.paymentType === "all" ? undefined : filters.paymentType,
    source: filters.source === "all" ? undefined : filters.source,
    arcgisBuildingId: filters.arcgisBuildingId,
  };
}
