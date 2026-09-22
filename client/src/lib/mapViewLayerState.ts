export const MAP_LAYER_STATUS_KINDS = [
  "disabled",
  "waiting_for_zoom",
  "loading",
  "ready",
  "empty",
  "partial",
  "unavailable",
  "failed",
] as const;

export type MapLayerStatusKind = (typeof MAP_LAYER_STATUS_KINDS)[number];

export interface MapLayerStatus {
  kind: MapLayerStatusKind;
  count?: number;
  message?: string;
}

export interface LayerStatusInput {
  enabled: boolean;
  zoom: number;
  minZoom: number;
  hasEndpoint: boolean;
  loading?: boolean;
  renderedCount?: number;
  partial?: boolean;
  failedMessage?: string;
}

export function determineLayerStatus({
  enabled,
  zoom,
  minZoom,
  hasEndpoint,
  loading = false,
  renderedCount = 0,
  partial = false,
  failedMessage,
}: LayerStatusInput): MapLayerStatus {
  if (!enabled) return { kind: "disabled", message: "Hidden" };
  if (zoom < minZoom) {
    return { kind: "waiting_for_zoom", message: `Zoom ${minZoom - zoom} more` };
  }
  if (!hasEndpoint) {
    return { kind: "unavailable", message: "Configuration unavailable" };
  }
  if (loading) return { kind: "loading", message: "Loading" };
  if (failedMessage) return { kind: "failed", message: failedMessage };
  if (partial) return { kind: "partial", count: renderedCount, message: "Partial results" };
  if (renderedCount === 0) return { kind: "empty", count: 0, message: "No results in this view" };
  return { kind: "ready", count: renderedCount, message: `${renderedCount} loaded` };
}

export function sanitiseLayerFailure(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const normalized = raw.toLowerCase();

  if (normalized.includes("browser-restricted") || normalized.includes("not configured")) {
    return "Configuration unavailable";
  }
  if (normalized.includes("401") || normalized.includes("403") || normalized.includes("token")) {
    return "Access unavailable";
  }
  if (normalized.includes("abort")) return "Request cancelled";
  if (normalized.includes("network") || normalized.includes("fetch") || normalized.includes("cors")) {
    return "Connection unavailable";
  }
  return "Layer data could not be loaded";
}

export function layerStatusTone(kind: MapLayerStatusKind): string {
  switch (kind) {
    case "ready":
      return "text-green-600";
    case "partial":
    case "waiting_for_zoom":
      return "text-amber-600";
    case "loading":
      return "text-blue-600";
    case "failed":
    case "unavailable":
      return "text-red-600";
    default:
      return "text-gray-500";
  }
}

export function layerStatusLabel(status: MapLayerStatus): string {
  return status.message ?? "Not loaded";
}

export function shouldLoadLayer({
  enabled,
  zoom,
  minZoom,
  hasEndpoint,
}: Pick<LayerStatusInput, "enabled" | "zoom" | "minZoom" | "hasEndpoint">): boolean {
  return enabled && zoom >= minZoom && hasEndpoint;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

export interface HeatmapCell {
  latitude: number;
  longitude: number;
  weight: number;
}

export function aggregateHeatmapCells(
  points: HeatmapPoint[],
  cellSize = 0.006,
): HeatmapCell[] {
  const cells = new Map<string, HeatmapCell>();
  points.forEach((point) => {
    const latitude = Math.round(point.latitude / cellSize) * cellSize;
    const longitude = Math.round(point.longitude / cellSize) * cellSize;
    const key = `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
    const current = cells.get(key) ?? { latitude, longitude, weight: 0 };
    current.weight += point.weight;
    cells.set(key, current);
  });
  return Array.from(cells.values());
}
