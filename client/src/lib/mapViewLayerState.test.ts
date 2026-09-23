import { describe, expect, it } from "vitest";
import {
  aggregateHeatmapCells,
  createViewportSignature,
  createHeatmapRenderGate,
  determineLayerStatus,
  layerStatusLabel,
  normaliseArcGISPoint,
  planHeatmapRender,
  sanitiseLayerFailure,
  shouldLoadLayer,
  shouldRequestViewport,
} from "./mapViewLayerState";

describe("Map View layer lifecycle", () => {
  it("does not present a request that has not settled as an empty layer", () => {
    expect(determineLayerStatus({
      enabled: true,
      zoom: 14,
      minZoom: 13,
      hasEndpoint: true,
      renderedCount: 0,
    })).toMatchObject({ kind: "loading", message: "Waiting for map" });

    expect(determineLayerStatus({
      enabled: true,
      zoom: 14,
      minZoom: 13,
      hasEndpoint: true,
      settled: true,
      renderedCount: 0,
    })).toMatchObject({ kind: "empty", message: "No results in this view" });

    expect(determineLayerStatus({
      enabled: true,
      zoom: 14,
      minZoom: 15,
      hasEndpoint: true,
    })).toMatchObject({ kind: "waiting_for_zoom", message: "Zoom 1 more" });
  });

  it("reports configuration and request outcomes without exposing raw error details", () => {
    expect(determineLayerStatus({
      enabled: true,
      zoom: 15,
      minZoom: 13,
      hasEndpoint: false,
    })).toMatchObject({ kind: "unavailable", message: "Configuration unavailable" });

    const raw = "ArcGIS fetch failed: 403 https://private.invalid/query?token=secret";
    const sanitised = sanitiseLayerFailure(raw);
    expect(sanitised).toBe("Access unavailable");
    expect(sanitised).not.toContain("private.invalid");
    expect(sanitised).not.toContain("secret");
  });

  it("reports an explicit loading state while an eligible layer request is in flight", () => {
    const status = determineLayerStatus({
      enabled: true,
      zoom: 15,
      minZoom: 15,
      hasEndpoint: true,
      loading: true,
    });

    expect(status).toMatchObject({ kind: "loading", message: "Loading" });
    expect(layerStatusLabel(status)).toBe("Loading");
  });

  it("distinguishes ready and partial overlay states", () => {
    const ready = determineLayerStatus({
      enabled: true,
      zoom: 16,
      minZoom: 15,
      hasEndpoint: true,
      settled: true,
      renderedCount: 12,
    });
    expect(ready.kind).toBe("ready");
    expect(layerStatusLabel(ready)).toBe("12 loaded");

    expect(determineLayerStatus({
      enabled: true,
      zoom: 16,
      minZoom: 15,
      hasEndpoint: true,
      settled: true,
      renderedCount: 500,
      partial: true,
    })).toMatchObject({ kind: "partial", message: "Partial results" });
  });

  it("only loads a layer after it is enabled, in range, and configured", () => {
    expect(shouldLoadLayer({ enabled: true, zoom: 13, minZoom: 13, hasEndpoint: true })).toBe(true);
    expect(shouldLoadLayer({ enabled: false, zoom: 16, minZoom: 13, hasEndpoint: true })).toBe(false);
    expect(shouldLoadLayer({ enabled: true, zoom: 12, minZoom: 13, hasEndpoint: true })).toBe(false);
    expect(shouldLoadLayer({ enabled: true, zoom: 16, minZoom: 13, hasEndpoint: false })).toBe(false);
  });

  it("coalesces duplicate idle requests but permits a completed viewport to refresh deliberately", () => {
    const signature = createViewportSignature({
      south: 6.590001,
      west: 3.345001,
      north: 6.600001,
      east: 3.355001,
    }, 19);

    expect(shouldRequestViewport({ signature, inFlightSignature: signature })).toBe(false);
    expect(shouldRequestViewport({ signature, inFlightSignature: signature, force: true })).toBe(false);
    expect(shouldRequestViewport({ signature, completedSignature: signature })).toBe(false);
    expect(shouldRequestViewport({ signature, completedSignature: signature, force: true })).toBe(true);
    expect(shouldRequestViewport({
      signature,
      completedSignature: createViewportSignature({ south: 6.59, west: 3.34, north: 6.60, east: 3.35 }, 19),
    })).toBe(true);
    expect(createViewportSignature({ south: 6.59, west: 3.34, north: 6.60, east: 3.35 }, 19, "customer:on"))
      .not.toBe(createViewportSignature({ south: 6.59, west: 3.34, north: 6.60, east: 3.35 }, 19, "customer:off"));
  });

  it("aggregates pickup intensity into bounded local heatmap cells", () => {
    const cells = aggregateHeatmapCells([
      { latitude: 7.3771, longitude: 3.9471, weight: 2 },
      { latitude: 7.3773, longitude: 3.9473, weight: 3 },
      { latitude: 7.3900, longitude: 3.9600, weight: 1 },
    ]);

    expect(cells).toHaveLength(2);
    expect(cells.map((cell) => cell.weight).sort((a, b) => a - b)).toEqual([1, 5]);
  });

  it("coarsens and caps a dense Heatmap plan before it can create unbounded map objects", () => {
    const densePoints = Array.from({ length: 400 }, (_, index) => ({
      latitude: 5 + Math.floor(index / 20) * 2,
      longitude: 2 + (index % 20) * 2,
      weight: 1,
    }));

    const plan = planHeatmapRender(densePoints, 24);

    expect(plan.coarsened).toBe(true);
    expect(plan.capped).toBe(true);
    expect(plan.cells).toHaveLength(24);
  });

  it("invalidates a scheduled Heatmap render when the layer is turned off", () => {
    const renderGate = createHeatmapRenderGate();
    const scheduledRender = renderGate.begin();
    expect(renderGate.isCurrent(scheduledRender)).toBe(true);

    renderGate.cancel();
    expect(renderGate.isCurrent(scheduledRender)).toBe(false);

    const replacementRender = renderGate.begin();
    expect(renderGate.isCurrent(replacementRender)).toBe(true);
  });

  it("keeps an in-bounds WGS84 Customer Point unchanged", () => {
    expect(normaliseArcGISPoint({ x: 3, y: 6 })).toEqual({ latitude: 6, longitude: 3 });
  });

  it("converts a recognised Web Mercator Customer Point before rendering", () => {
    const worldLimit = 20_037_508.342789244;
    const latitude = 6;
    const longitude = 3;
    const projected = {
      x: (longitude / 180) * worldLimit,
      y: Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI / 180) / 2)) * worldLimit / Math.PI,
    };

    const point = normaliseArcGISPoint(projected);
    expect(point?.latitude).toBeCloseTo(latitude, 6);
    expect(point?.longitude).toBeCloseTo(longitude, 6);
  });

  it("rejects malformed, zero, and out-of-area Customer Point geometry", () => {
    expect(normaliseArcGISPoint(undefined)).toBeNull();
    expect(normaliseArcGISPoint({ x: "3", y: 6 })).toBeNull();
    expect(normaliseArcGISPoint({ x: 0, y: 0 })).toBeNull();
    expect(normaliseArcGISPoint({ x: 50, y: 30 })).toBeNull();
    expect(normaliseArcGISPoint({ x: 30_000_000, y: 0 })).toBeNull();
  });
});
