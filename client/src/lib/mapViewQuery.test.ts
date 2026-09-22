import { describe, expect, it } from "vitest";
import { buildMapDataInput } from "./mapViewQuery";

describe("Map View filter-to-query contract", () => {
  it("carries every supported filter into one protected map-data request", () => {
    const dateFrom = new Date("2026-09-01T00:00:00.000Z");
    const dateTo = new Date("2026-09-21T00:00:00.000Z");

    expect(buildMapDataInput({
      dateFrom,
      dateTo,
      companyId: "company-1",
      fieldWorkerId: "worker-7",
      lotId: "410",
      binType: "240L",
      paymentType: "PAYT",
      source: "field_worker",
      arcgisBuildingId: "building-410",
    })).toEqual({
      dateFrom: dateFrom.toISOString(),
      dateTo: dateTo.toISOString(),
      companyId: "company-1",
      fieldWorkerId: "worker-7",
      lotId: "410",
      binType: "240L",
      paymentType: "PAYT",
      source: "field_worker",
      arcgisBuildingId: "building-410",
    });
  });

  it("clears the all selections instead of sending ambiguous filter values", () => {
    expect(buildMapDataInput({ paymentType: "all", source: "all" })).toEqual({
      dateFrom: undefined,
      dateTo: undefined,
      companyId: undefined,
      fieldWorkerId: undefined,
      lotId: undefined,
      binType: undefined,
      paymentType: undefined,
      source: undefined,
      arcgisBuildingId: undefined,
    });
  });
});
