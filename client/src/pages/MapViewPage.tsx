import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PickupFiltersComponent, PickupFilters } from "@/components/PickupFilters";
import { PickupDetailsModal } from "@/components/PickupDetailsModal";
import {
  Layers,
  RefreshCw,
  X,
  MapPin,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Building2,
  Users,
  Flame,
  SlidersHorizontal,
  AlertCircle,
  TrendingUp,
  Package,
  Search,
  Navigation,
  BarChart3,
  List,
  Map as MapIcon,
  Eye,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { buildViewSwitchUrl, paramsToFilters } from "@/lib/filterUrlParams";
import { buildMapDataInput } from "@/lib/mapViewQuery";
import {
  createHeatmapRenderGate,
  determineLayerStatus,
  layerStatusLabel,
  layerStatusTone,
  planHeatmapRender,
  sanitiseLayerFailure,
  shouldLoadLayer,
  type MapLayerStatus,
} from "@/lib/mapViewLayerState";
import { format } from "date-fns";

// ─── ArcGIS Layer Registry ────────────────────────────────────────────────────
// To add a new ArcGIS layer in the future, append an entry here.
// The layer control panel UI is generated automatically from this registry.
const ARCGIS_BROWSER_KEY = import.meta.env.VITE_ARCGIS_BROWSER_KEY || "";
// The Customer view is deliberately supplied at build time. Never fall back to
// the historic public source service; an unset value disables this one layer.
const ARCGIS_CUSTOMER_VIEW_URL = import.meta.env.VITE_ARCGIS_CUSTOMER_VIEW_URL || "";
const GOOGLE_MAPS_BROWSER_KEY = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY || "";
const GOOGLE_MAPS_SCRIPT_URL = GOOGLE_MAPS_BROWSER_KEY
  ? `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(GOOGLE_MAPS_BROWSER_KEY)}&v=weekly&libraries=places`
  : null;

const ARCGIS_LAYER_REGISTRY = [
  {
    id: "building_footprints",
    label: "Building Footprints",
    icon: Building2,
    url: "https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Nigeria_Building_Footprints/FeatureServer/0",
    type: "polygon" as const,
    defaultVisible: true,
    strokeColor: "#4f46e5",
    fillColor: "#6366f1",
    fillOpacity: 0.15,
    strokeWeight: 1.5,
    minZoom: 15,
    description: "Nigeria Building Footprint polygons",
    requiresAuth: false,
    outFields: "building_id,OBJECTID",
  },
  {
    id: "customer_points",
    label: "Customer Points",
    icon: Users,
    url: ARCGIS_CUSTOMER_VIEW_URL,
    type: "point" as const,
    defaultVisible: false,
    strokeColor: "#059669",
    fillColor: "#10b981",
    fillOpacity: 0.9,
    strokeWeight: 1.5,
    minZoom: 13,
    description: "Customer registration points",
    requiresAuth: true,
    outFields: "OBJECTID",
  },
] as const;

type LayerId = (typeof ARCGIS_LAYER_REGISTRY)[number]["id"];

// ─── Constants ────────────────────────────────────────────────────────────────
// Customer data is centred on Ibadan, Oyo State (lat ~7.36, lng ~3.88)
const IBADAN_CENTER = { lat: 7.3775, lng: 3.9470 };

function getMarkerColor(count: number): string {
  if (count >= 50) return "#dc2626";
  if (count >= 20) return "#ea580c";
  if (count >= 10) return "#d97706";
  if (count >= 5) return "#16a34a";
  return "#2563eb";
}

function getMarkerScale(count: number): number {
  if (count >= 50) return 18;
  if (count >= 20) return 15;
  if (count >= 10) return 12;
  if (count >= 5) return 10;
  return 8;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ArcGISFeature {
  attributes: Record<string, unknown>;
  geometry: {
    rings?: number[][][];
    x?: number;
    y?: number;
  };
}

interface ArcGISFeatureResponse {
  features: ArcGISFeature[];
  exceededTransferLimit: boolean;
}

interface LayerRuntime {
  loading: boolean;
  renderedCount: number;
  partial: boolean;
  failure?: string;
}

interface MapMarker {
  buildingId: string;
  latitude: number;
  longitude: number;
  pickupCount: number;
  totalAmount: number;
  lastPickupDate: Date;
  binTypes: string[];
  paytCount: number;
  monthlyCount: number;
  latestPickupId: string;
}

// ─── Google Maps Loader ───────────────────────────────────────────────────────
function loadGoogleMapsScript(scriptUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.google !== "undefined" && window.google.maps) {
      resolve();
      return;
    }
    const existing = document.querySelector(`script[data-maps-loader]`);
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Maps script failed")));
      return;
    }
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.setAttribute("data-maps-loader", "true");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
}

// ─── ArcGIS Fetcher (with token as query param + outSR=4326 for correct coords) ─
async function fetchArcGISFeatures(
  url: string,
  bounds: google.maps.LatLngBounds,
  maxRecords = 500,
  requiresAuth = false,
  outFields = "*",
  signal?: AbortSignal,
): Promise<ArcGISFeatureResponse> {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const envelope = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;

  const body = new URLSearchParams({
    where: "1=1",
    geometry: envelope,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",   // ← request WGS84 so x/y are lng/lat degrees, not Web Mercator metres
    spatialRel: "esriSpatialRelIntersects",
    outFields,
    returnGeometry: "true",
    f: "json",
    resultRecordCount: String(maxRecords),
  });

  // ArcGIS requires token as a body param (not Authorization header) for API keys
  if (requiresAuth) {
    if (!ARCGIS_BROWSER_KEY) {
      throw new Error("The browser-restricted ArcGIS key is not configured");
    }
    body.set("token", ARCGIS_BROWSER_KEY);
  }

  const res = await fetch(`${url}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    signal,
  });
  if (!res.ok) throw new Error(`ArcGIS fetch failed: ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`ArcGIS error: ${data.error.message}`);
  return {
    features: (data.features || []) as ArcGISFeature[],
    exceededTransferLimit: data.exceededTransferLimit === true,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MapViewPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const arcgisPolygonsRef = useRef<Map<LayerId, google.maps.Polygon[]>>(new Map());
  const arcgisMarkersRef = useRef<Map<LayerId, google.maps.Marker[]>>(new Map());
  const pickupMarkersRef = useRef<google.maps.Marker[]>([]);
  const heatmapCirclesRef = useRef<google.maps.Circle[]>([]);
  const heatmapRenderFrameRef = useRef<number | null>(null);
  const heatmapRenderGateRef = useRef(createHeatmapRenderGate());
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const searchBoxRef = useRef<google.maps.places.SearchBox | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const arcgisLoadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arcgisRequestControllerRef = useRef<AbortController | null>(null);
  const arcgisRequestVersionRef = useRef(0);
  const mapListenersRef = useRef<google.maps.MapsEventListener[]>([]);
  // Stable ref that always points to the latest loadArcGISLayers without
  // causing the idle listener to become stale when layerVisible/layerOpacity change.
  const loadArcGISLayersRef = useRef<() => Promise<void>>(async () => {});

  const [mapsReady, setMapsReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [arcgisLoading, setArcgisLoading] = useState(false);
  const [layerRuntime, setLayerRuntime] = useState<Record<LayerId, LayerRuntime>>(() =>
    Object.fromEntries(
      ARCGIS_LAYER_REGISTRY.map((layer) => [
        layer.id,
        { loading: false, renderedCount: 0, partial: false },
      ]),
    ) as Record<LayerId, LayerRuntime>,
  );
  const [currentZoom, setCurrentZoom] = useState(14);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [streetViewEnabled, setStreetViewEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "filters" | "legend">("stats");

  const [layerVisible, setLayerVisible] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = { pickup_markers: true, heatmap: false };
    ARCGIS_LAYER_REGISTRY.forEach((l) => { init[l.id] = l.defaultVisible; });
    return init;
  });

  const [layerOpacity, setLayerOpacity] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = { pickup_markers: 100 };
    ARCGIS_LAYER_REGISTRY.forEach((l) => { init[l.id] = 70; });
    return init;
  });

  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const arcgisVisibilitySignature = ARCGIS_LAYER_REGISTRY
    .map((layer) => `${layer.id}:${layerVisible[layer.id] ?? layer.defaultVisible}`)
    .join("|");
  // Deserialise filter params from URL (round-trip from /pickup-records)
  const [filters, setFilters] = useState<PickupFilters>(() =>
    paramsToFilters(new URLSearchParams(window.location.search))
  );
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);
  const [stats, setStats] = useState({ buildings: 0, totalPickups: 0, unlocated: 0, totalAmount: 0 });

  const clearArcGISLayerObjects = useCallback((layerId: LayerId) => {
    arcgisPolygonsRef.current.get(layerId)?.forEach((polygon) => polygon.setMap(null));
    arcgisMarkersRef.current.get(layerId)?.forEach((marker) => marker.setMap(null));
    arcgisPolygonsRef.current.set(layerId, []);
    arcgisMarkersRef.current.set(layerId, []);
  }, []);

  const cancelHeatmapRender = useCallback(() => {
    heatmapRenderGateRef.current.cancel();
    if (heatmapRenderFrameRef.current !== null) {
      window.cancelAnimationFrame(heatmapRenderFrameRef.current);
      heatmapRenderFrameRef.current = null;
    }
  }, []);

  const clearHeatmap = useCallback(() => {
    cancelHeatmapRender();
    heatmapCirclesRef.current.forEach((circle) => circle.setMap(null));
    heatmapCirclesRef.current = [];
  }, [cancelHeatmapRender]);

  // Google removed the legacy visualization HeatmapLayer. Render a bounded,
  // coarsened circle grid in short animation-frame batches so a dense viewport
  // cannot monopolise the browser main thread. Turning the layer off cancels
  // the active generation and removes every partial circle immediately.
  const buildHeatmap = useCallback((markers: MapMarker[]) => {
    if (!mapRef.current || !window.google?.maps) return;
    clearHeatmap();

    const renderToken = heatmapRenderGateRef.current.begin();
    const { cells } = planHeatmapRender(markers.map((marker) => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
      weight: marker.pickupCount,
    })));
    const maximumWeight = Math.max(1, ...cells.map((cell) => cell.weight));
    const batchSize = 20;
    let nextCell = 0;

    const renderNextBatch = () => {
      const activeMap = mapRef.current;
      if (!heatmapRenderGateRef.current.isCurrent(renderToken) || !activeMap) return;

      const batchEnd = Math.min(nextCell + batchSize, cells.length);
      for (; nextCell < batchEnd; nextCell += 1) {
        const cell = cells[nextCell];
        const intensity = cell.weight / maximumWeight;
        const circle = new window.google.maps.Circle({
          center: { lat: cell.latitude, lng: cell.longitude },
          map: activeMap,
          radius: 85 + intensity * 250,
          strokeColor: "#f97316",
          strokeOpacity: 0.18 + intensity * 0.28,
          strokeWeight: 1,
          fillColor: "#f97316",
          fillOpacity: 0.08 + intensity * 0.28,
          clickable: false,
          zIndex: 20,
        });
        heatmapCirclesRef.current.push(circle);
      }

      if (nextCell < cells.length && heatmapRenderGateRef.current.isCurrent(renderToken)) {
        heatmapRenderFrameRef.current = window.requestAnimationFrame(renderNextBatch);
      } else {
        heatmapRenderFrameRef.current = null;
      }
    };

    heatmapRenderFrameRef.current = window.requestAnimationFrame(renderNextBatch);
  }, [clearHeatmap]);

  // ── tRPC ───────────────────────────────────────────────────────────────────
  const mapDataInput = useMemo(() => buildMapDataInput(filters), [filters]);

  const { data: mapData, isLoading: mapDataLoading, refetch: refetchMapData } = trpc.pickups.mapData.useQuery(
    mapDataInput,
    {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
    }
  );

  // ── Load Google Maps SDK ───────────────────────────────────────────────────
  useEffect(() => {
    if (!GOOGLE_MAPS_SCRIPT_URL) {
      setMapError("The browser-restricted Google Maps key is not configured");
      return;
    }
    loadGoogleMapsScript(GOOGLE_MAPS_SCRIPT_URL)
      .then(() => setMapsReady(true))
      .catch((err) => setMapError(err.message));
  }, []);

  // ── Initialise map ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || mapRef.current) return;
    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: IBADAN_CENTER,
      zoom: 14,
      mapTypeControl: true,
      mapTypeControlOptions: { position: window.google.maps.ControlPosition.TOP_RIGHT },
      streetViewControl: false,
      fullscreenControl: true,
      fullscreenControlOptions: { position: window.google.maps.ControlPosition.RIGHT_BOTTOM },
      zoomControl: true,
      zoomControlOptions: { position: window.google.maps.ControlPosition.RIGHT_CENTER },
      styles: [
        { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
      ],
    });
    mapRef.current = map;
    infoWindowRef.current = new window.google.maps.InfoWindow();
    // Street View is off by default; toggled via the toolbar button
    map.setOptions({ streetViewControl: false });
    mapListenersRef.current = [
      map.addListener("zoom_changed", () => setCurrentZoom(map.getZoom() ?? 14)),
    ];

    // Debounced ArcGIS load on idle — uses ref so the listener always calls the
    // latest version of loadArcGISLayers without becoming stale.
    mapListenersRef.current.push(map.addListener("idle", () => {
      if (arcgisLoadTimerRef.current) clearTimeout(arcgisLoadTimerRef.current);
      arcgisLoadTimerRef.current = setTimeout(() => loadArcGISLayersRef.current(), 600);
    }));

    // ── Places SearchBox ──────────────────────────────────────────────────
    if (searchInputRef.current && window.google.maps.places) {
      const searchBox = new window.google.maps.places.SearchBox(searchInputRef.current);
      searchBoxRef.current = searchBox;
      mapListenersRef.current.push(map.addListener("bounds_changed", () => {
        searchBox.setBounds(map.getBounds() as google.maps.LatLngBounds);
      }));
      mapListenersRef.current.push(searchBox.addListener("places_changed", () => {
        const places = searchBox.getPlaces();
        if (!places || places.length === 0) return;
        const bounds = new window.google.maps.LatLngBounds();
        places.forEach((place) => {
          if (!place.geometry || !place.geometry.location) return;
          if (place.geometry.viewport) {
            bounds.union(place.geometry.viewport);
          } else {
            bounds.extend(place.geometry.location);
          }
        });
        map.fitBounds(bounds);
      }));
    }

    return () => {
      if (arcgisLoadTimerRef.current) clearTimeout(arcgisLoadTimerRef.current);
      arcgisRequestControllerRef.current?.abort();
      mapListenersRef.current.forEach((listener) => listener.remove());
      mapListenersRef.current = [];
      pickupMarkersRef.current.forEach((marker) => marker.setMap(null));
      pickupMarkersRef.current = [];
      ARCGIS_LAYER_REGISTRY.forEach((layer) => clearArcGISLayerObjects(layer.id));
      clearHeatmap();
      infoWindowRef.current?.close();
      infoWindowRef.current = null;
      searchBoxRef.current = null;
      mapRef.current = null;
    };
  }, [mapsReady, clearArcGISLayerObjects, clearHeatmap]);

  // ── Render pickup markers when mapData changes ─────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapsReady) return;
    renderPickupMarkers(mapData?.markers ?? []);
    if (mapData) {
      setStats({
        buildings: mapData.markers.length,
        totalPickups: mapData.totalCount,
        unlocated: mapData.unlocatedCount,
        totalAmount: mapData.markers.reduce((s: number, m: MapMarker) => s + (m.totalAmount ?? 0), 0),
      });
    }
  }, [mapData, mapsReady, layerVisible.pickup_markers]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    pickupMarkersRef.current.forEach((m) => m.setVisible(layerVisible.pickup_markers));
  }, [layerVisible.pickup_markers]);

  useEffect(() => {
    if (!mapRef.current || !mapsReady) return;
    if (layerVisible.heatmap) {
      buildHeatmap(mapData?.markers ?? []);
    } else {
      clearHeatmap();
    }
  }, [layerVisible.heatmap, mapData, mapsReady, buildHeatmap, clearHeatmap]);

  useEffect(() => {
    ARCGIS_LAYER_REGISTRY.forEach((layer) => {
      const visible = layerVisible[layer.id] ?? layer.defaultVisible;
      arcgisPolygonsRef.current.get(layer.id as LayerId)?.forEach((p) => p.setVisible(visible));
      arcgisMarkersRef.current.get(layer.id as LayerId)?.forEach((m) => m.setVisible(visible));
    });
  }, [layerVisible]);

  // ── Render pickup markers ──────────────────────────────────────────────────
  const renderPickupMarkers = useCallback((markers: MapMarker[]) => {
    if (!mapRef.current) return;
    pickupMarkersRef.current.forEach((m) => m.setMap(null));
    pickupMarkersRef.current = [];
    if (!layerVisible.pickup_markers) return;

    markers.forEach((data) => {
      const marker = new window.google.maps.Marker({
        position: { lat: data.latitude, lng: data.longitude },
        map: mapRef.current!,
        icon: {
          path: window.google.maps.SymbolPath.CIRCLE,
          fillColor: getMarkerColor(data.pickupCount),
          fillOpacity: 0.9,
          strokeColor: "#ffffff",
          strokeWeight: 1.5,
          scale: getMarkerScale(data.pickupCount),
        },
        title: data.buildingId,
        visible: layerVisible.pickup_markers,
        zIndex: 100 + data.pickupCount,
      });

      marker.addListener("click", () => {
        infoWindowRef.current?.setContent(buildPickupInfoWindowContent(data));
        infoWindowRef.current?.open(mapRef.current!, marker);
        setTimeout(() => {
          const btn = document.getElementById(`view-details-${data.latestPickupId}`);
          if (btn) {
            btn.addEventListener("click", () => {
              setSelectedPickupId(data.latestPickupId);
              infoWindowRef.current?.close();
            });
          }
        }, 100);
      });

      pickupMarkersRef.current.push(marker);
    });
  }, [layerVisible.pickup_markers]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load ArcGIS Layers ─────────────────────────────────────────────────────
  const loadArcGISLayers = useCallback(async () => {
    if (!mapRef.current) return;
    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    const zoom = mapRef.current.getZoom() ?? 0;
    const requestVersion = arcgisRequestVersionRef.current + 1;
    arcgisRequestVersionRef.current = requestVersion;
    arcgisRequestControllerRef.current?.abort();
    const controller = new AbortController();
    arcgisRequestControllerRef.current = controller;
    const isCurrentRequest = () =>
      !controller.signal.aborted && arcgisRequestVersionRef.current === requestVersion;

    const immediatelyUnavailable = ARCGIS_LAYER_REGISTRY.filter((layer) => {
      const enabled = layerVisible[layer.id] ?? layer.defaultVisible;
      return !shouldLoadLayer({ enabled, zoom, minZoom: layer.minZoom, hasEndpoint: Boolean(layer.url) });
    });

    immediatelyUnavailable.forEach((layer) => {
      clearArcGISLayerObjects(layer.id);
      const enabled = layerVisible[layer.id] ?? layer.defaultVisible;
      setLayerRuntime((previous) => ({
        ...previous,
        [layer.id]: {
          loading: false,
          renderedCount: 0,
          partial: false,
          failure: !enabled ? undefined : (!layer.url ? "Configuration unavailable" : undefined),
        },
      }));
    });

    const eligibleLayers = ARCGIS_LAYER_REGISTRY.filter((layer) => {
      const enabled = layerVisible[layer.id] ?? layer.defaultVisible;
      return shouldLoadLayer({ enabled, zoom, minZoom: layer.minZoom, hasEndpoint: Boolean(layer.url) });
    });
    if (eligibleLayers.length === 0) return;

    setArcgisLoading(true);
    eligibleLayers.forEach((layer) => {
      setLayerRuntime((previous) => ({
        ...previous,
        [layer.id]: { ...previous[layer.id], loading: true, failure: undefined },
      }));
    });

    try {
      await Promise.all(eligibleLayers.map(async (layer) => {
        try {
          const response = await fetchArcGISFeatures(
            layer.url,
            bounds,
            500,
            layer.requiresAuth,
            layer.outFields,
            controller.signal,
          );
          if (!isCurrentRequest() || !mapRef.current) return;

          const newPolygons: google.maps.Polygon[] = [];
          const newMarkers: google.maps.Marker[] = [];
          const opacityFactor = (layerOpacity[layer.id] ?? 70) / 100;

          response.features.forEach((feature) => {
            if (layer.type === "polygon" && feature.geometry?.rings?.length) {
              const polygon = new window.google.maps.Polygon({
                paths: feature.geometry.rings.map((ring) => ring.map(([lng, lat]) => ({ lat, lng }))),
                map: mapRef.current!,
                strokeColor: layer.strokeColor,
                strokeOpacity: 0.8,
                strokeWeight: layer.strokeWeight,
                fillColor: layer.fillColor,
                fillOpacity: layer.fillOpacity * opacityFactor,
                zIndex: 10,
              });
              polygon.addListener("click", (event: google.maps.MapMouseEvent) => {
                const id = String(feature.attributes?.building_id || feature.attributes?.OBJECTID || "");
                infoWindowRef.current?.setContent(`<div style="font-family:sans-serif;font-size:13px;padding:4px"><strong>Building ID:</strong> ${id}</div>`);
                infoWindowRef.current?.setPosition(event.latLng!);
                infoWindowRef.current?.open(mapRef.current!);
              });
              newPolygons.push(polygon);
              return;
            }

            if (layer.type !== "point") return;
            // Query output is explicitly WGS84. Use geometry only: the private
            // browser view exposes no customer profile fields to the dashboard.
            const lat = feature.geometry?.y;
            const lng = feature.geometry?.x;
            if (typeof lat !== "number" || typeof lng !== "number" || (lat === 0 && lng === 0)) return;
            if (lat < 4 || lat > 14 || lng < 2 || lng > 15) return;

            const currentZoomLevel = mapRef.current?.getZoom() ?? 0;
            const marker = new window.google.maps.Marker({
              position: { lat, lng },
              map: mapRef.current!,
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                fillColor: layer.fillColor,
                fillOpacity: layer.fillOpacity,
                strokeColor: layer.strokeColor,
                strokeWeight: layer.strokeWeight,
                scale: 6,
              },
              label: currentZoomLevel >= 16 ? {
                text: "Customer",
                color: "#1e3a5f",
                fontSize: "10px",
                fontWeight: "600",
                className: "customer-point-label",
              } : undefined,
              zIndex: 50,
              title: "Customer location",
            });
            marker.addListener("click", () => {
              infoWindowRef.current?.setContent(`
                <div style="font-family:sans-serif;font-size:13px;padding:6px 8px">
                  <div style="font-weight:700;font-size:14px;color:#1e293b">Customer location</div>
                </div>
              `);
              infoWindowRef.current?.open(mapRef.current!, marker);
            });
            newMarkers.push(marker);
          });

          if (!isCurrentRequest()) {
            newPolygons.forEach((polygon) => polygon.setMap(null));
            newMarkers.forEach((marker) => marker.setMap(null));
            return;
          }
          clearArcGISLayerObjects(layer.id);
          arcgisPolygonsRef.current.set(layer.id, newPolygons);
          arcgisMarkersRef.current.set(layer.id, newMarkers);
          setLayerRuntime((previous) => ({
            ...previous,
            [layer.id]: {
              loading: false,
              renderedCount: newPolygons.length + newMarkers.length,
              partial: response.exceededTransferLimit,
            },
          }));
        } catch (error) {
          if (!isCurrentRequest()) return;
          clearArcGISLayerObjects(layer.id);
          setLayerRuntime((previous) => ({
            ...previous,
            [layer.id]: {
              ...previous[layer.id],
              loading: false,
              failure: sanitiseLayerFailure(error),
            },
          }));
        }
      }));
    } finally {
      if (isCurrentRequest()) setArcgisLoading(false);
    }
  }, [clearArcGISLayerObjects, layerOpacity, layerVisible]);

  // Keep the ref in sync so the idle listener always calls the latest version
  // without the listener itself needing to be re-registered on every render.
  useEffect(() => {
    loadArcGISLayersRef.current = loadArcGISLayers;
  }, [loadArcGISLayers]);

  // A switch is an explicit user intent: do not wait for a later map-idle event
  // before loading an eligible overlay. Zoom changes use the same path.
  useEffect(() => {
    if (!mapsReady || !mapRef.current) return;
    void loadArcGISLayersRef.current();
  }, [mapsReady, currentZoom, arcgisVisibilitySignature]);

  // Opacity changes apply to already-rendered polygons without issuing another
  // provider request or waiting for the map to move.
  useEffect(() => {
    ARCGIS_LAYER_REGISTRY.filter((layer) => layer.type === "polygon").forEach((layer) => {
      const opacityFactor = (layerOpacity[layer.id] ?? 70) / 100;
      arcgisPolygonsRef.current.get(layer.id)?.forEach((polygon) => {
        polygon.setOptions({ fillOpacity: layer.fillOpacity * opacityFactor });
      });
    });
  }, [layerOpacity]);

  const layerStatuses = useMemo(() =>
    Object.fromEntries(ARCGIS_LAYER_REGISTRY.map((layer) => {
      const runtime = layerRuntime[layer.id];
      const enabled = layerVisible[layer.id] ?? layer.defaultVisible;
      return [layer.id, determineLayerStatus({
        enabled,
        zoom: currentZoom,
        minZoom: layer.minZoom,
        hasEndpoint: Boolean(layer.url),
        loading: runtime.loading,
        renderedCount: runtime.renderedCount,
        partial: runtime.partial,
        failedMessage: runtime.failure,
      })];
    })) as Record<LayerId, MapLayerStatus>,
  [currentZoom, layerRuntime, layerVisible]);

  const loadingLayerLabels = ARCGIS_LAYER_REGISTRY
    .filter((layer) => layerStatuses[layer.id].kind === "loading")
    .map((layer) => layer.label);
  const isMapLoading = mapDataLoading || arcgisLoading;
  const loadingMessage = mapDataLoading
    ? "Updating pickup markers…"
    : loadingLayerLabels.length === 1
      ? `Loading ${loadingLayerLabels[0]}…`
      : loadingLayerLabels.length > 1
        ? `Loading ${loadingLayerLabels.length} map layers…`
        : "Refreshing map layers…";

  const waitingLayer = ARCGIS_LAYER_REGISTRY.find(
    (layer) => layerStatuses[layer.id].kind === "waiting_for_zoom",
  );

  // ── GPS / My Location ──────────────────────────────────────────────────────
  const handleMyLocation = useCallback(() => {
    if (!mapRef.current || !navigator.geolocation) return;
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        mapRef.current!.panTo(loc);
        mapRef.current!.setZoom(16);
        new window.google.maps.Marker({
          position: loc,
          map: mapRef.current!,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 3,
            scale: 8,
          },
          title: "Your location",
          zIndex: 999,
        });
        setGpsLoading(false);
      },
      () => setGpsLoading(false),
      { timeout: 8000, enableHighAccuracy: true }
    );
  }, []);

  // ── Info window content ────────────────────────────────────────────────────
  function buildPickupInfoWindowContent(data: MapMarker): string {
    const lastDate = data.lastPickupDate ? format(new Date(data.lastPickupDate), "dd MMM yyyy") : "—";
    const amount = data.totalAmount ? `₦${data.totalAmount.toLocaleString()}` : "—";
    const bins = data.binTypes.filter(Boolean).join(", ") || "—";
    return `
      <div style="font-family:sans-serif;font-size:13px;min-width:210px;padding:4px">
        <div style="font-weight:700;font-size:14px;margin-bottom:6px;color:#1e293b">${data.buildingId || "Unknown Building"}</div>
        <table style="border-collapse:collapse;width:100%">
          <tr><td style="color:#64748b;padding:2px 8px 2px 0">Pickups</td><td style="font-weight:600">${data.pickupCount}</td></tr>
          <tr><td style="color:#64748b;padding:2px 8px 2px 0">Revenue</td><td style="font-weight:600">${amount}</td></tr>
          <tr><td style="color:#64748b;padding:2px 8px 2px 0">Last Pickup</td><td>${lastDate}</td></tr>
          <tr><td style="color:#64748b;padding:2px 8px 2px 0">Bin Types</td><td style="font-size:11px">${bins}</td></tr>
          <tr><td style="color:#64748b;padding:2px 8px 2px 0">PAYT / Monthly</td><td>${data.paytCount} / ${data.monthlyCount}</td></tr>
        </table>
        ${data.latestPickupId ? `<button id="view-details-${data.latestPickupId}" style="margin-top:8px;width:100%;padding:5px 0;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">View Latest Pickup Details</button>` : ""}
      </div>
    `;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    refetchMapData();
    loadArcGISLayers();
  }, [refetchMapData, loadArcGISLayers]);

  const handleToggleStreetView = useCallback(() => {
    if (!mapRef.current) return;
    const next = !streetViewEnabled;
    setStreetViewEnabled(next);
    // Show/hide the pegman drag handle on the map
    mapRef.current.setOptions({ streetViewControl: next });
    // If turning off, also exit any active Street View panorama
    if (!next) {
      const panorama = mapRef.current.getStreetView();
      if (panorama.getVisible()) panorama.setVisible(false);
    }
  }, [streetViewEnabled]);

  const toggleLayer = useCallback((id: string) => {
    setLayerVisible((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      <Header />

      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Left Sidebar ─────────────────────────────────────────────── */}
        <div
          className={`flex flex-col bg-white border-r border-gray-200 shadow-sm transition-all duration-300 z-20 flex-shrink-0 ${
            sidebarOpen ? "w-96" : "w-0 overflow-hidden"
          }`}
        >
          {sidebarOpen && (
            <div className="flex flex-col h-full min-w-0">
              {/* Sidebar Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0 bg-gradient-to-r from-blue-600 to-blue-700">
                <div className="flex items-center gap-2.5">
                  <MapPin className="h-5 w-5 text-white flex-shrink-0" />
                  <div>
                    <span className="font-bold text-white text-sm leading-tight block">Pickup Map View</span>
                    <span className="text-blue-200 text-xs leading-tight block">Geographic overview</span>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)} className="h-7 w-7 p-0 text-white hover:bg-blue-500 flex-shrink-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>

              {/* View toggle: List View | Map View (active) */}
              <div className="flex items-center px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
                <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden shadow-sm w-full">
                  <button
                    onClick={() => { window.location.href = buildViewSwitchUrl("/pickup-records", filters); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors"
                    title="Switch to List View (filters are preserved)"
                  >
                    <List className="h-3.5 w-3.5" />
                    List View
                  </button>
                  <span className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white select-none border-l border-blue-500">
                    <MapIcon className="h-3.5 w-3.5" />
                    Map View
                  </span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="flex border-b border-gray-100 flex-shrink-0 bg-gray-50">
                {([
                  { id: "stats" as const, icon: BarChart3, label: "Stats" },
                  { id: "filters" as const, icon: SlidersHorizontal, label: "Filters" },
                  { id: "legend" as const, icon: Layers, label: "Legend" },
                ]).map(({ id, icon: Icon, label }) => (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                      activeTab === id
                        ? "border-blue-600 text-blue-600 bg-white"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-hidden">

                {/* Stats Tab */}
                {activeTab === "stats" && (
                  <div className="h-full flex flex-col">
                    <div className="grid grid-cols-2 gap-3 p-4 border-b border-gray-100 flex-shrink-0">
                      {[
                        { icon: Building2, label: "Located Buildings", value: stats.buildings.toLocaleString(), bg: "bg-blue-50", border: "border-blue-100", iconCls: "text-blue-500", valCls: "text-blue-800", subtext: "with GPS coordinates" },
                        { icon: Package, label: "Total Pickups", value: stats.totalPickups.toLocaleString(), bg: "bg-green-50", border: "border-green-100", iconCls: "text-green-500", valCls: "text-green-800", subtext: "all time" },
                        { icon: TrendingUp, label: "Total Revenue", value: stats.totalAmount >= 1_000_000 ? `₦${(stats.totalAmount / 1_000_000).toFixed(1)}M` : `₦${(stats.totalAmount / 1000).toFixed(0)}k`, bg: "bg-purple-50", border: "border-purple-100", iconCls: "text-purple-500", valCls: "text-purple-800", subtext: "from located pickups" },
                        { icon: AlertCircle, label: "Unlocated", value: stats.unlocated.toLocaleString(), bg: "bg-orange-50", border: "border-orange-100", iconCls: "text-orange-500", valCls: "text-orange-800", subtext: "missing GPS data" },
                      ].map(({ icon: Icon, label, value, bg, border, iconCls, valCls, subtext }) => (
                        <div key={label} className={`${bg} border ${border} rounded-xl p-3`}>
                          <div className="flex items-center gap-1.5 mb-2">
                            <Icon className={`h-4 w-4 ${iconCls} flex-shrink-0`} />
                            <span className={`text-xs ${iconCls} font-semibold`}>{label}</span>
                          </div>
                          <div className={`text-2xl font-bold ${valCls} leading-none mb-1`}>{value}</div>
                          <div className="text-xs text-gray-400">{subtext}</div>
                        </div>
                      ))}
                    </div>
                    {mapDataLoading && (
                      <div className="flex items-center gap-2 px-4 py-3 text-sm text-gray-500 border-b border-gray-100">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500 flex-shrink-0" />
                        Loading pickup data…
                      </div>
                    )}
                    <div className="p-4 flex-shrink-0">
                      <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current Map View</div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Zoom level</span>
                          <span className="font-semibold text-gray-800">{currentZoom}</span>
                        </div>
                        {ARCGIS_LAYER_REGISTRY.map((layer) => {
                          const status = layerStatuses[layer.id];
                          return (
                            <div key={layer.id} className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-gray-500">{layer.label}</span>
                              <span className={`font-semibold text-right ${layerStatusTone(status.kind)}`}>
                                {layerStatusLabel(status)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="px-4 pb-4 mt-auto">
                      <Button variant="outline" className="w-full gap-2" onClick={handleRefresh} disabled={mapDataLoading || arcgisLoading}>
                        <RefreshCw className={`h-4 w-4 ${(mapDataLoading || arcgisLoading) ? "animate-spin" : ""}`} />
                        Refresh All Data
                      </Button>
                    </div>
                  </div>
                )}

                {/* Filters Tab */}
                {activeTab === "filters" && (
                  <ScrollArea className="h-full">
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-4">
                        <SlidersHorizontal className="h-4 w-4 text-blue-500" />
                        <span className="text-sm font-semibold text-gray-700">Filter Pickup Data</span>
                      </div>
                      <PickupFiltersComponent filters={filters} onFiltersChange={setFilters} />
                      {Object.keys(filters).some((k) => filters[k as keyof PickupFilters] !== undefined) && (
                        <Button variant="outline" size="sm" className="w-full mt-4 text-red-600 border-red-200 hover:bg-red-50" onClick={() => setFilters({})}>
                          Clear All Filters
                        </Button>
                      )}
                    </div>
                  </ScrollArea>
                )}

                {/* Legend Tab */}
                {activeTab === "legend" && (
                  <ScrollArea className="h-full">
                    <div className="p-4 space-y-5">
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Pickup Marker Density</div>
                        <div className="space-y-2">
                          {[
                            { color: "#dc2626", label: "50+ pickups", desc: "High density" },
                            { color: "#ea580c", label: "20–49 pickups", desc: "Medium-high" },
                            { color: "#d97706", label: "10–19 pickups", desc: "Medium" },
                            { color: "#16a34a", label: "5–9 pickups", desc: "Low-medium" },
                            { color: "#2563eb", label: "1–4 pickups", desc: "Low density" },
                          ].map(({ color, label, desc }) => (
                            <div key={label} className="flex items-center gap-3 py-1">
                              <div className="w-4 h-4 rounded-full border-2 border-white shadow flex-shrink-0" style={{ background: color }} />
                              <div>
                                <div className="text-sm font-medium text-gray-700">{label}</div>
                                <div className="text-xs text-gray-400">{desc}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">ArcGIS Layers</div>
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-4 rounded border-2 flex-shrink-0" style={{ borderColor: "#4f46e5", background: "rgba(99,102,241,0.15)" }} />
                            <div>
                              <div className="text-sm font-medium text-gray-700">Building Footprints</div>
                              <div className="text-xs text-gray-400">Visible at zoom 15+</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-4 h-4 rounded-full border-2 flex-shrink-0" style={{ borderColor: "#059669", background: "#10b981" }} />
                            <div>
                              <div className="text-sm font-medium text-gray-700">Customer Points</div>
                              <div className="text-xs text-gray-400">Visible at zoom 13+</div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                        <div className="text-xs font-semibold text-blue-700 mb-2">Zoom Guide</div>
                        <div className="space-y-1.5 text-xs text-blue-600">
                          <div className="flex justify-between"><span>Zoom 13+</span><span>Customer Points load</span></div>
                          <div className="flex justify-between"><span>Zoom 15+</span><span>Building Footprints load</span></div>
                          <div className="flex justify-between"><span>Any zoom</span><span>Pickup Markers visible</span></div>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar toggle when closed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-30 bg-white border border-gray-200 shadow-md rounded-r-lg p-2 hover:bg-gray-50"
          >
            <ChevronRight className="h-4 w-4 text-gray-600" />
          </button>
        )}

        {/* ── Map Area ─────────────────────────────────────────────────── */}
        <div className="flex-1 relative min-w-0">
          <div ref={mapContainerRef} className="w-full h-full" />

          {/* ── Location Search Bar (top-left of map) ────────────────── */}
          {mapsReady && (
            <div className="absolute top-3 left-3 z-30 flex items-center gap-1.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search address or place…"
                  className="h-9 pl-8 pr-3 text-sm bg-white border border-gray-200 rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                />
              </div>
            </div>
          )}

          {/* Loading indicator — stays visible while a request is in flight and
              identifies the active layer instead of making the map appear stalled. */}
          {isMapLoading && (
            <div
              className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-white/95 backdrop-blur-sm rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-gray-700 pointer-events-none"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="relative flex h-4 w-4" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-60" />
                <Loader2 className="relative h-4 w-4 animate-spin text-blue-600" />
              </span>
              <span>{loadingMessage}</span>
            </div>
          )}

          {/* Error banner */}
          {mapError && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-red-50 border border-red-200 rounded-lg px-4 py-2 shadow-lg flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {mapError}
            </div>
          )}

          {/* Zoom hint for ArcGIS layers */}
          {waitingLayer && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-30 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 shadow text-xs text-amber-700 pointer-events-none">
              Zoom in to load {waitingLayer.label}
            </div>
          )}

          {/* Map not loaded yet */}
          {!mapsReady && !mapError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="text-sm">Loading map…</span>
              </div>
            </div>
          )}

          {/* ── Top-right Controls ──────────────────────────────────────── */}
          <div className="absolute top-3 right-14 z-30 flex flex-col gap-2">
            {/* GPS / My Location */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleMyLocation}
              className="bg-white shadow-md h-9 w-9 p-0"
              title="My location"
              disabled={gpsLoading}
            >
              {gpsLoading
                ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                : <Navigation className="h-4 w-4 text-blue-600" />
              }
            </Button>

            {/* Refresh */}
            <Button
              size="sm"
              variant="outline"
              onClick={handleRefresh}
              className="bg-white shadow-md h-9 w-9 p-0"
              title="Refresh data"
            >
              <RefreshCw className={`h-4 w-4 ${(arcgisLoading || mapDataLoading) ? "animate-spin" : ""}`} />
            </Button>

            {/* Layers toggle */}
            <Button
              size="sm"
              variant={layerPanelOpen ? "default" : "outline"}
              onClick={() => setLayerPanelOpen((p) => !p)}
              className={`shadow-md h-9 w-9 p-0 ${layerPanelOpen ? "" : "bg-white"}`}
              title="Layers"
            >
              <Layers className="h-4 w-4" />
            </Button>
            {/* Street View toggle */}
            <Button
              size="sm"
              variant={streetViewEnabled ? "default" : "outline"}
              onClick={handleToggleStreetView}
              className={`shadow-md h-9 w-9 p-0 ${streetViewEnabled ? "bg-orange-500 border-orange-500 hover:bg-orange-600" : "bg-white"}`}
              title={streetViewEnabled ? "Street View ON — drag the pegman onto the map, or click to disable" : "Enable Street View"}
            >
              <Eye className={`h-4 w-4 ${streetViewEnabled ? "text-white" : "text-orange-500"}`} />
            </Button>
          </div>

          {/* ── Layer Control Panel ─────────────────────────────────────── */}
          {layerPanelOpen && (
            <div className="absolute top-3 right-24 z-40 w-72 bg-white rounded-xl shadow-xl border border-gray-200 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-gray-600" />
                  <span className="font-semibold text-sm text-gray-800">Map Layers</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setLayerPanelOpen(false)} className="h-6 w-6 p-0">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="p-3 space-y-0.5">
                {/* Pickup Markers */}
                <LayerRow
                  icon={<MapPin className="h-4 w-4 text-blue-600" />}
                  label="Pickup Markers"
                  description="One marker per building, colour-coded by density"
                  visible={layerVisible.pickup_markers}
                  onToggle={() => toggleLayer("pickup_markers")}
                  colorSwatch="#2563eb"
                />

                {/* Heatmap */}
                <LayerRow
                  icon={<Flame className="h-4 w-4 text-orange-500" />}
                  label="Heatmap"
                  description="Pickup density heat overlay"
                  visible={layerVisible.heatmap}
                  onToggle={() => toggleLayer("heatmap")}
                  colorSwatch="#f97316"
                />

                {/* ArcGIS section divider */}
                <div className="pt-3 pb-1">
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1">ArcGIS Layers</div>
                </div>

                {/* Dynamic ArcGIS layers from registry */}
                {ARCGIS_LAYER_REGISTRY.map((layer) => {
                  const Icon = layer.icon;
                  const visible = layerVisible[layer.id] ?? layer.defaultVisible;
                  return (
                    <div key={layer.id}>
                      <LayerRow
                        icon={<Icon className="h-4 w-4" style={{ color: layer.strokeColor }} />}
                        label={layer.label}
                        description={`${layer.description} · zoom ${layer.minZoom}+`}
                        visible={visible}
                        status={layerStatuses[layer.id]}
                        onToggle={() => toggleLayer(layer.id)}
                        colorSwatch={layer.fillColor}
                      />
                      {/* Opacity slider for polygon layers */}
                      {layer.type === "polygon" && visible && (
                        <div className="flex items-center gap-3 px-2 pb-2 ml-7">
                          <span className="text-xs text-gray-400 w-12 flex-shrink-0">Opacity</span>
                          <Slider
                            min={10}
                            max={100}
                            step={5}
                            value={[layerOpacity[layer.id] ?? 70]}
                            onValueChange={([v]) => setLayerOpacity((prev) => ({ ...prev, [layer.id]: v }))}
                            className="flex-1"
                          />
                          <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">{layerOpacity[layer.id] ?? 70}%</span>
                        </div>
                      )}
                    </div>
                  );
                })}

                {waitingLayer && (
                  <div className="mt-2 text-xs text-amber-600 bg-amber-50 rounded px-2 py-1.5 flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                    Zoom in to load {waitingLayer.label}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pickup Details Modal */}
      {selectedPickupId && (
        <PickupDetailsModal
          pickupId={selectedPickupId}
          open={!!selectedPickupId}
          onClose={() => setSelectedPickupId(null)}
        />
      )}
    </div>
  );
}

// ─── LayerRow Sub-component ───────────────────────────────────────────────────
interface LayerRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  visible: boolean;
  status?: MapLayerStatus;
  onToggle: () => void;
  colorSwatch: string;
}

function LayerRow({ icon, label, description, visible, status, onToggle, colorSwatch }: LayerRowProps) {
  const isLoading = status?.kind === "loading";

  return (
    <div
      className={`flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors ${isLoading ? "bg-blue-50/60" : ""}`}
      aria-busy={isLoading || undefined}
    >
      <div
        className={`w-3 h-3 rounded-sm flex-shrink-0 ${isLoading ? "animate-pulse" : ""}`}
        style={{ background: colorSwatch, opacity: 0.85 }}
      />
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {icon}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800 truncate">{label}</div>
          <p className="text-xs text-gray-400 truncate">{description}</p>
          {status && (
            <p className={`text-xs truncate flex items-center gap-1 ${layerStatusTone(status.kind)}`} aria-live="polite">
              {isLoading && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" aria-hidden="true" />}
              <span>{layerStatusLabel(status)}</span>
            </p>
          )}
        </div>
      </div>
      <Switch
        checked={visible}
        onCheckedChange={onToggle}
        className="flex-shrink-0"
      />
    </div>
  );
}
