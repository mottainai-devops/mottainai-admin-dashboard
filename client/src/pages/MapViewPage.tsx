import { useRef, useState, useCallback } from "react";
import { MapView } from "@/components/Map";
import { Header } from "@/components/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Layers, RefreshCw, X, MapPin, Info } from "lucide-react";

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

export default function MapViewPage() {
  const mapRef = useRef<google.maps.Map | null>(null);
  const polylinesRef = useRef<google.maps.Polygon[]>([]);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [featureCount, setFeatureCount] = useState(0);
  const [selectedFeature, setSelectedFeature] = useState<SelectedFeature | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(14);

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

    // Only load features when zoomed in enough to avoid fetching too many
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

        // Add click handler to show building info
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

        // Add minimal label only at high zoom (zoom >= 16)
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

            const marker = new window.google.maps.marker.AdvancedMarkerElement({
              map: mapRef.current,
              position: centroid,
              content: labelDiv,
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

  const handleMapReady = useCallback(
    (map: google.maps.Map) => {
      mapRef.current = map;

      // Center on Lagos
      map.setCenter(LAGOS_CENTER);
      map.setZoom(14);

      // Load features on idle (after pan/zoom)
      map.addListener("idle", () => {
        loadFeatures();
      });
    },
    [loadFeatures]
  );

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
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* Zoom hint */}
        {zoom < 13 && (
          <div className="mb-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            <Info className="h-4 w-4 shrink-0" />
            Zoom in further to load building footprints (current zoom: {zoom}).
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div className="mb-3 flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            <Info className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Map container */}
        <div className="relative rounded-xl overflow-hidden border shadow-sm">
          <MapView
            className="w-full h-[calc(100vh-260px)] min-h-[500px]"
            initialCenter={LAGOS_CENTER}
            initialZoom={14}
            onMapReady={handleMapReady}
          />

          {/* Loading overlay */}
          {isLoading && (
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
