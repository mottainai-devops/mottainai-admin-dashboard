import { useRef, useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, RefreshCw, X, MapPin, Info, Loader2 } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ArcGIS Feature Service URL for Nigeria Building Footprints
const ARCGIS_FEATURE_URL =
  "https://services3.arcgis.com/VYBpf26AGQNwssLH/arcgis/rest/services/Nigeria_Building_Footprints/FeatureServer/0";

// Lagos, Nigeria center coordinates
const LAGOS_CENTER = { lat: 6.5244, lng: 3.3792 };

interface BuildingFeature {
  attributes: Record<string, unknown>;
  geometry: {
    rings?: number[][][];
    x?: number;
    y?: number;
  };
}

interface SelectedFeature {
  buildingId: string;
  attributes: Record<string, unknown>;
  position: { lat: number; lng: number };
}

/**
 * Dynamically load the Google Maps JS SDK using a URL obtained from the server.
 * Prevents re-loading if already loaded.
 */
function loadGoogleMapsScript(scriptUrl: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.google !== "undefined" && window.google.maps) {
      resolve();
      return;
    }
    // Check if script is already being loaded
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

/**
 * Fetch building footprint polygons from ArcGIS Feature Service
 * within the current map bounds.
 */
async function fetchBuildingFootprints(bounds: google.maps.LatLngBounds): Promise<BuildingFeature[]> {
  const ne = bounds.getNorthEast();
  const sw = bounds.getSouthWest();
  const envelope = `${sw.lng()},${sw.lat()},${ne.lng()},${ne.lat()}`;

  const params = new URLSearchParams({
    where: "1=1",
    geometry: envelope,
    geometryType: "esriGeometryEnvelope",
    inSR: "4326",
    outSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    outFields: "*",
    returnGeometry: "true",
    f: "json",
    resultRecordCount: "500",
  });

  const res = await fetch(`${ARCGIS_FEATURE_URL}/query?${params}`);
  if (!res.ok) throw new Error("Failed to fetch building footprints");
  const data = await res.json();
  return (data.features || []) as BuildingFeature[];
}

/** Compute the centroid of a polygon ring */
function computeCentroid(ring: number[][]): { lat: number; lng: number } | null {
  if (!ring || ring.length === 0) return null;
  let latSum = 0;
  let lngSum = 0;
  for (const [lng, lat] of ring) {
    latSum += lat;
    lngSum += lng;
  }
  return { lat: latSum / ring.length, lng: lngSum / ring.length };
}

export default function MapViewPage() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polygon[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [featureCount, setFeatureCount] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(14);
  const [mapsReady, setMapsReady] = useState(false);

  // Fetch the Google Maps script URL from the server
  const { data: mapsConfig, error: mapsConfigError } = trpc.maps.getScriptUrl.useQuery();

  // Load Google Maps script once we have the URL
  useEffect(() => {
    if (!mapsConfig?.scriptUrl) return;
    loadGoogleMapsScript(mapsConfig.scriptUrl)
      .then(() => setMapsReady(true))
      .catch((err) => setError(err.message));
  }, [mapsConfig?.scriptUrl]);

  // Initialise the map once Google Maps SDK is ready
  useEffect(() => {
    if (!mapsReady || !mapContainerRef.current || mapRef.current) return;

    const map = new window.google.maps.Map(mapContainerRef.current, {
      center: LAGOS_CENTER,
      zoom: 14,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true,
    });

    mapRef.current = map;

    map.addListener("idle", () => {
      loadFeatures();
    });
  }, [mapsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  const clearOverlays = useCallback(() => {
    polylinesRef.current.forEach(p => p.setMap(null));
    polylinesRef.current = [];
    markersRef.current.forEach(m => (m.map = null));
    markersRef.current = [];
  }, []);

  const loadFeatures = useCallback(async () => {
    if (!mapRef.current) return;
    const currentZoom = mapRef.current.getZoom() ?? 0;
    setZoom(currentZoom);

    // Only load features when zoomed in enough
    if (currentZoom < 13) {
      clearOverlays();
      setFeatureCount(0);
      return;
    }

    const bounds = mapRef.current.getBounds();
    if (!bounds) return;

    setIsLoading(true);
    setError(null);

    try {
      const features = await fetchBuildingFootprints(bounds);
      clearOverlays();
      setFeatureCount(features.length);

      features.forEach((feature) => {
        if (!feature.geometry?.rings || !mapRef.current) return;

        const rings = feature.geometry.rings;
        const paths = rings.map(ring =>
          ring.map(([lng, lat]) => ({ lat, lng }))
        );

        const polygon = new window.google.maps.Polygon({
          paths,
          map: mapRef.current,
          strokeColor: "#4f46e5",
          strokeOpacity: 0.8,
          strokeWeight: 1.5,
          fillColor: "#6366f1",
          fillOpacity: 0.15,
        });

        polylinesRef.current.push(polygon);

        // Click polygon to show building info
        polygon.addListener("click", (e: google.maps.MapMouseEvent) => {
          const buildingId =
            (feature.attributes?.BuildingID as string) ||
            (feature.attributes?.OBJECTID as string) ||
            "Unknown";
          setSelectedFeature({
            buildingId: String(buildingId),
            attributes: feature.attributes,
            position: { lat: e.latLng?.lat() ?? 0, lng: e.latLng?.lng() ?? 0 },
          });
        });

        // Minimal label only at high zoom (zoom >= 16) — per GIS team preference
        if (currentZoom >= 16 && mapRef.current) {
          const centroid = computeCentroid(rings[0]);
          if (centroid) {
            const buildingId =
              (feature.attributes?.BuildingID as string) ||
              (feature.attributes?.OBJECTID as string) ||
              "";

            const labelDiv = document.createElement("div");
            labelDiv.style.cssText = `
              font-size: 9px;
              color: #3730a3;
              font-weight: 600;
              background: rgba(255,255,255,0.7);
              padding: 1px 3px;
              border-radius: 2px;
              pointer-events: none;
              white-space: nowrap;
            `;
            labelDiv.textContent = String(buildingId).slice(0, 10);

            const marker = new window.google.maps.Marker({
              map: mapRef.current,
              position: centroid,
              label: {
                text: String(buildingId).slice(0, 10),
                fontSize: '9px',
                color: '#3730a3',
              },
              icon: {
                path: window.google.maps.SymbolPath.CIRCLE,
                scale: 0,
              },
            });
            markersRef.current.push(marker);
          }
        }
      });
    } catch (err: any) {
      setError(err.message || "Failed to load map features");
    } finally {
      setIsLoading(false);
    }
  }, [clearOverlays]);

  return (
    <>
      <Header />
      <div className="container py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Layers className="h-6 w-6 text-primary" />
              Geospatial Map View
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Building footprints from ArcGIS Nigeria Building Footprints layer. Zoom in to see polygons.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {featureCount > 0 && (
              <Badge variant="secondary" className="gap-1">
                <MapPin className="h-3 w-3" />
                {featureCount} buildings loaded
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={loadFeatures}
              disabled={isLoading || !mapsReady}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Zoom hint */}
        {mapsReady && zoom < 13 && (
          <div className="mb-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <Info className="h-4 w-4 shrink-0" />
            Zoom in further to load building footprints (current zoom: {zoom}).
          </div>
        )}

        {/* Config error */}
        {mapsConfigError && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <Info className="h-4 w-4 shrink-0" />
            Map configuration error: {mapsConfigError.message}
          </div>
        )}

        {/* Runtime error */}
        {error && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <Info className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Map container */}
        <div className="relative rounded-xl overflow-hidden border shadow-sm bg-muted">
          {/* Map div — Google Maps SDK renders into this */}
          <div
            ref={mapContainerRef}
            className="w-full h-[calc(100vh-260px)] min-h-[500px]"
          />

          {/* Loading overlay while SDK initialises */}
          {!mapsReady && !mapsConfigError && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="text-sm font-medium">Loading map…</span>
              </div>
            </div>
          )}

          {/* Feature loading indicator */}
          {mapsReady && isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm rounded-full px-4 py-1.5 text-sm font-medium shadow flex items-center gap-2">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
              Loading features…
            </div>
          )}
        </div>

        {/* Selected feature info panel */}
        {selectedFeature && (
          <Card className="mt-4">
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-base mb-2 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" />
                    Building ID: {selectedFeature.buildingId}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-1 text-sm">
                    {Object.entries(selectedFeature.attributes)
                      .filter(([k]) => !["Shape__Area", "Shape__Length", "SHAPE_Length", "SHAPE_Area"].includes(k))
                      .slice(0, 12)
                      .map(([key, value]) => (
                        <div key={key} className="flex gap-1">
                          <span className="text-muted-foreground shrink-0">{key}:</span>
                          <span className="font-medium truncate">{String(value ?? "—")}</span>
                        </div>
                      ))}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0"
                  onClick={() => setSelectedFeature(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-3 rounded-sm border border-indigo-500 bg-indigo-200/50" />
            Building footprint polygon
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-indigo-600" />
            Building ID label (zoom ≥ 16)
          </div>
          <span>Click a polygon to view details</span>
        </div>
      </div>
    </>
  );
}
