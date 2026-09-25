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
  settled?: boolean;
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
  settled = false,
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
  if (!settled) return { kind: "loading", message: "Waiting for map" };
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

export interface ViewportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/**
 * Rounded map bounds coalesce duplicate Google Maps idle events while retaining
 * enough precision for the dashboard's zoom-gated overlay layers.
 */
export function createViewportSignature(bounds: ViewportBounds, zoom: number, context = ""): string {
  const coordinate = (value: number) => value.toFixed(5);
  return [
    Math.round(zoom * 100) / 100,
    coordinate(bounds.south),
    coordinate(bounds.west),
    coordinate(bounds.north),
    coordinate(bounds.east),
    context,
  ].join("|");
}

/**
 * A repeated idle event must not cancel a request for the same viewport or
 * turn a settled successful result into a false empty status.
 */
export function shouldRequestViewport(input: {
  signature: string;
  inFlightSignature?: string | null;
  completedSignature?: string | null;
  force?: boolean;
}): boolean {
  if (input.signature === input.inFlightSignature) return false;
  if (!input.force && input.signature === input.completedSignature) return false;
  return true;
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

export const DEFAULT_HEATMAP_CELL_SIZE = 0.006;
export const MAX_HEATMAP_RENDERED_CELLS = 160;

export interface HeatmapRenderPlan {
  cells: HeatmapCell[];
  cellSize: number;
  coarsened: boolean;
  capped: boolean;
}

export function aggregateHeatmapCells(
  points: HeatmapPoint[],
  cellSize = DEFAULT_HEATMAP_CELL_SIZE,
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

/**
 * Limits the number of Google Maps objects required for a Heatmap render.
 * The grid is progressively coarsened before the final deterministic cap is
 * applied, so a dense viewport cannot monopolise the browser main thread.
 */
export function planHeatmapRender(
  points: HeatmapPoint[],
  maxCells = MAX_HEATMAP_RENDERED_CELLS,
  initialCellSize = DEFAULT_HEATMAP_CELL_SIZE,
): HeatmapRenderPlan {
  if (!Number.isFinite(maxCells) || maxCells < 1) {
    throw new Error("Heatmap render requires at least one cell");
  }

  let cellSize = initialCellSize;
  let cells = aggregateHeatmapCells(points, cellSize);
  let coarsened = false;

  // Doubling at most eight times prevents an unbounded loop while allowing a
  // wide, dense viewport to collapse naturally into an intelligible overview.
  for (let attempt = 0; cells.length > maxCells && attempt < 8; attempt += 1) {
    cellSize *= 2;
    cells = aggregateHeatmapCells(points, cellSize);
    coarsened = true;
  }

  const capped = cells.length > maxCells;
  return {
    cells: capped
      ? [...cells]
          .sort((left, right) => right.weight - left.weight || left.latitude - right.latitude || left.longitude - right.longitude)
          .slice(0, maxCells)
      : cells,
    cellSize,
    coarsened,
    capped,
  };
}

/**
 * A generation gate makes a scheduled Heatmap batch invalid the moment the
 * layer is turned off, refreshed, or replaced by a newer render.
 */
export function createHeatmapRenderGate() {
  let generation = 0;

  return {
    begin() {
      generation += 1;
      return generation;
    },
    cancel() {
      generation += 1;
    },
    isCurrent(token: number) {
      return generation === token;
    },
  };
}

export interface ArcGISPointGeometry {
  x?: unknown;
  y?: unknown;
}

export interface MapPoint {
  latitude: number;
  longitude: number;
}

// Customer Points is intentionally rendered only inside this operational
// guardrail. It prevents an unexpected spatial reference from placing a point
// somewhere unrelated on the Dashboard map.
const NIGERIA_POINT_BOUNDS = {
  minLatitude: 4,
  maxLatitude: 14,
  minLongitude: 2,
  maxLongitude: 15,
} as const;

const WEB_MERCATOR_WORLD_LIMIT = 20_037_508.342789244;

function isWithinNigeriaBounds(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= NIGERIA_POINT_BOUNDS.minLatitude
    && latitude <= NIGERIA_POINT_BOUNDS.maxLatitude
    && longitude >= NIGERIA_POINT_BOUNDS.minLongitude
    && longitude <= NIGERIA_POINT_BOUNDS.maxLongitude;
}

function webMercatorToWgs84(x: number, y: number): MapPoint | null {
  if (Math.abs(x) > WEB_MERCATOR_WORLD_LIMIT || Math.abs(y) > WEB_MERCATOR_WORLD_LIMIT) {
    return null;
  }

  const longitude = (x / WEB_MERCATOR_WORLD_LIMIT) * 180;
  const latitude = (180 / Math.PI) * (2 * Math.atan(Math.exp((y / WEB_MERCATOR_WORLD_LIMIT) * Math.PI)) - Math.PI / 2);
  return isWithinNigeriaBounds(latitude, longitude) ? { latitude, longitude } : null;
}

/**
 * Converts a queried ArcGIS point into a safe Google Maps position. The view is
 * requested in WGS84, but this fallback safely handles a projected Web Mercator
 * response without relaxing the existing operating-area guardrail.
 */
export function normaliseArcGISPoint(geometry: ArcGISPointGeometry | null | undefined): MapPoint | null {
  const x = geometry?.x;
  const y = geometry?.y;
  if (typeof x !== "number" || typeof y !== "number" || !Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }
  if (x === 0 && y === 0) return null;

  return isWithinNigeriaBounds(y, x)
    ? { latitude: y, longitude: x }
    : webMercatorToWgs84(x, y);
}

// The private browser view exposes these fields only after the owner-approved
// R-077 scope change. Keep this list exact: do not request wildcard fields or
// make a profile attribute available merely because it exists in the source.
export const CUSTOMER_POINT_OUT_FIELDS = [
  "OBJECTID",
  "business_name",
  "address2",
  "user_identification_number",
  "customer_type",
] as const;

export const CUSTOMER_POINT_OUT_FIELDS_PARAMETER = CUSTOMER_POINT_OUT_FIELDS.join(",");

export interface CustomerPointPopupAttributes {
  business_name?: unknown;
  address2?: unknown;
  user_identification_number?: unknown;
  customer_type?: unknown;
}

const CUSTOMER_POINT_POPUP_FIELDS: Array<{
  attribute: keyof CustomerPointPopupAttributes;
  label: string;
}> = [
  { attribute: "business_name", label: "Business name" },
  { attribute: "address2", label: "Address" },
  { attribute: "user_identification_number", label: "User identification number" },
  { attribute: "customer_type", label: "Customer type" },
];

function escapePopupText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function customerPopupValue(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return "Not recorded";
  return escapePopupText(value.trim());
}

/**
 * Renders only the approved Customer Point display attributes as escaped text.
 * It intentionally ignores every unapproved attribute present in a response.
 */
export function buildCustomerPointPopupContent(attributes: CustomerPointPopupAttributes): string {
  const rows = CUSTOMER_POINT_POPUP_FIELDS.map(({ attribute, label }) => `
    <div style="margin-top:4px">
      <dt style="font-weight:600;color:#475569">${label}</dt>
      <dd style="margin:1px 0 0;color:#0f172a">${customerPopupValue(attributes[attribute])}</dd>
    </div>
  `).join("");

  return `
    <div style="font-family:sans-serif;font-size:13px;padding:6px 8px;max-width:260px">
      <div style="font-weight:700;font-size:14px;color:#1e293b">Customer location</div>
      <dl style="margin:6px 0 0">${rows}</dl>
    </div>
  `;
}

/**
 * Produces the owner-approved persistent marker text without widening the
 * private-view field contract. Google Maps treats MarkerLabel text as text,
 * rather than HTML; this helper also avoids whitespace-only labels.
 */
export function customerPointMarkerLabel(attributes: CustomerPointPopupAttributes): string {
  const businessName = attributes.business_name;
  return typeof businessName === "string" && businessName.trim() !== ""
    ? businessName.trim()
    : "Customer";
}

export interface CustomerMarkerLabelCandidate {
  id: string;
  label: string;
  x: number;
  y: number;
}

interface CustomerMarkerLabelBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const CUSTOMER_MARKER_LABEL_FONT_WIDTH = 6.5;
const CUSTOMER_MARKER_LABEL_MIN_WIDTH = 44;
const CUSTOMER_MARKER_LABEL_MAX_WIDTH = 240;
const CUSTOMER_MARKER_LABEL_HEIGHT = 18;
const CUSTOMER_MARKER_LABEL_HORIZONTAL_OFFSET = 9;
const CUSTOMER_MARKER_LABEL_VERTICAL_OFFSET = 14;

function customerMarkerLabelBounds(candidate: CustomerMarkerLabelCandidate): CustomerMarkerLabelBounds {
  const width = Math.min(
    CUSTOMER_MARKER_LABEL_MAX_WIDTH,
    Math.max(CUSTOMER_MARKER_LABEL_MIN_WIDTH, candidate.label.length * CUSTOMER_MARKER_LABEL_FONT_WIDTH + 10),
  );

  return {
    left: candidate.x + CUSTOMER_MARKER_LABEL_HORIZONTAL_OFFSET,
    right: candidate.x + CUSTOMER_MARKER_LABEL_HORIZONTAL_OFFSET + width,
    top: candidate.y - CUSTOMER_MARKER_LABEL_VERTICAL_OFFSET,
    bottom: candidate.y - CUSTOMER_MARKER_LABEL_VERTICAL_OFFSET + CUSTOMER_MARKER_LABEL_HEIGHT,
  };
}

function customerMarkerLabelsOverlap(a: CustomerMarkerLabelBounds, b: CustomerMarkerLabelBounds): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Keeps persistent labels legible in dense views. A deterministic screen-order
 * plan retains the full approved business name when it has room; it never
 * substitutes an available business name with a generic value to resolve a
 * collision. Suppressed labels are recalculated after map movement or zoom.
 */
export function planCustomerMarkerLabelVisibility(
  candidates: CustomerMarkerLabelCandidate[],
): Set<string> {
  const acceptedBounds: CustomerMarkerLabelBounds[] = [];
  const visible = new Set<string>();

  [...candidates]
    .sort((a, b) => a.y - b.y || a.x - b.x || a.id.localeCompare(b.id))
    .forEach((candidate) => {
      const bounds = customerMarkerLabelBounds(candidate);
      if (acceptedBounds.some((existing) => customerMarkerLabelsOverlap(existing, bounds))) return;
      acceptedBounds.push(bounds);
      visible.add(candidate.id);
    });

  return visible;
}

/**
 * Converts the configured Feature Service endpoint into a specific layer-query
 * URL. ArcGIS service roots may return a successful but empty response to a
 * `/query` request, so the customer layer must always target its declared
 * numeric layer. Unsupported endpoint shapes fail closed rather than falling
 * back to an unrelated public service.
 */
export function buildArcGISLayerQueryUrl(endpoint: string, defaultLayerId = 0): string {
  if (!Number.isInteger(defaultLayerId) || defaultLayerId < 0) {
    throw new Error("ArcGIS default layer must be a non-negative integer");
  }

  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    throw new Error("ArcGIS layer endpoint is invalid");
  }

  if (url.protocol !== "https:" || url.search || url.hash) {
    throw new Error("ArcGIS layer endpoint is unsupported");
  }

  const pathname = url.pathname.replace(/\/+$/, "");
  if (/\/FeatureServer$/i.test(pathname)) {
    url.pathname = `${pathname}/${defaultLayerId}/query`;
    return url.toString();
  }

  if (/\/FeatureServer\/\d+$/i.test(pathname)) {
    url.pathname = `${pathname}/query`;
    return url.toString();
  }

  throw new Error("ArcGIS layer endpoint is unsupported");
}
