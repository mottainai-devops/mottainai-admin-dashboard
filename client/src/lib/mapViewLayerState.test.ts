import { describe, expect, it } from "vitest";
import {
  aggregateHeatmapCells,
  createHeatmapRenderGate,
  determineLayerStatus,
  layerStatusLabel,
  planHeatmapRender,
  sanitiseLayerFailure,
  shouldLoadLayer,
} from "./mapViewLayerState";

describe("Map View layer lifecycle", () => {
  it("does not present a switch as ready before an eligible layer has rendered objects", () => {
    expect(determineLayerStatus({
      enabled: true,
      zoom: 14,
      minZoom: 13,
      hasEndpoint: true,
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

  it("distinguishes ready and partial overlay states", () => {
    const ready = determineLayerStatus({
      enabled: true,
      zoom: 16,
      minZoom: 15,
      hasEndpoint: true,
      renderedCount: 12,
    });
    expect(ready.kind).toBe("ready");
    expect(layerStatusLabel(ready)).toBe("12 loaded");

    expect(determineLayerStatus({
      enabled: true,
      zoom: 16,
      minZoom: 15,
      hasEndpoint: true,
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
});
