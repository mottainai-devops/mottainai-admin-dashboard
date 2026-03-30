import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { 
  Package, 
  TrendingUp, 
  Activity, 
  DollarSign,
  AlertCircle,
  CheckCircle,
  Calendar,
  MapPin,
  ChevronRight,
  X
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { useState, useMemo } from "react";

// Quick preset ranges
const PRESETS = [
  { label: "Today", days: 0 },
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
];

function getPresetRange(days: number): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (days > 0) from.setDate(from.getDate() - days);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
}

export function DashboardWidgets() {
  // Fetch today's pickups
  const today = new Date();
  const todayStr = today.toISOString();
  const { data: pickupsData } = trpc.pickups.list.useQuery({
    dateFrom: todayStr,
    dateTo: todayStr,
    page: 1,
    limit: 1,
  });

  // Fetch revenue stats
  const { data: revenueStats } = trpc.billing.getStats.useQuery({});

  // Date range state for Pickups by Polygon
  const [polygonDateFrom, setPolygonDateFrom] = useState<string>("");
  const [polygonDateTo, setPolygonDateTo] = useState<string>("");
  const [activePreset, setActivePreset] = useState<number | null>(null);

  const polygonQueryInput = useMemo(() => {
    const input: { limit: number; dateFrom?: string; dateTo?: string } = { limit: 10 };
    if (polygonDateFrom) input.dateFrom = polygonDateFrom;
    if (polygonDateTo) input.dateTo = polygonDateTo;
    return input;
  }, [polygonDateFrom, polygonDateTo]);

  // Fetch top polygons
  const { data: topPolygons, isFetching: polygonsFetching } = trpc.pickups.topPolygons.useQuery(polygonQueryInput);

  // Fetch webhook health
  const { data: webhooks } = trpc.webhook.getAll.useQuery();

  // Calculate webhook health
  const webhookHealth = webhooks
    ? {
        total: webhooks.length,
        healthy: webhooks.filter((w) => w.isHealthy).length,
        unhealthy: webhooks.filter((w) => !w.isHealthy).length,
      }
    : { total: 0, healthy: 0, unhealthy: 0 };

  const healthPercentage = webhookHealth.total > 0
    ? Math.round((webhookHealth.healthy / webhookHealth.total) * 100)
    : 0;

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `₦${(amount / 1000).toFixed(1)}K`;
    return `₦${amount.toLocaleString()}`;
  };

  const applyPreset = (days: number, idx: number) => {
    const range = getPresetRange(days);
    setPolygonDateFrom(range.from);
    setPolygonDateTo(range.to);
    setActivePreset(idx);
  };

  const clearDateFilter = () => {
    setPolygonDateFrom("");
    setPolygonDateTo("");
    setActivePreset(null);
  };

  const hasDateFilter = polygonDateFrom || polygonDateTo;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {/* Today's Pickups */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today's Pickups</CardTitle>
          <Package className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {pickupsData?.total.toLocaleString() || "0"}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <Calendar className="inline h-3 w-3 mr-1" />
            {today.toLocaleDateString("en-GB", { 
              month: "short", 
              day: "numeric", 
              year: "numeric" 
            })}
          </p>
        </CardContent>
      </Card>

      {/* Total Revenue */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {formatCompactCurrency(revenueStats?.totalRevenue || 0)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {revenueStats?.totalTransactions.toLocaleString() || "0"} transactions
          </p>
        </CardContent>
      </Card>

      {/* Revenue Trend */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">PAYT vs Monthly</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold">
              {revenueStats 
                ? Math.round((revenueStats.paytRevenue / (revenueStats.totalRevenue || 1)) * 100)
                : 0}%
            </div>
            <span className="text-sm text-muted-foreground">PAYT</span>
          </div>
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant="outline" className="text-xs">
              PAYT: {formatCompactCurrency(revenueStats?.paytRevenue || 0)}
            </Badge>
            <Badge variant="outline" className="text-xs">
              Monthly: {formatCompactCurrency(revenueStats?.monthlyRevenue || 0)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Health */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Webhook Health</CardTitle>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="text-2xl font-bold">{healthPercentage}%</div>
            {healthPercentage === 100 ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <AlertCircle className="h-5 w-5 text-yellow-600" />
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {webhookHealth.healthy}/{webhookHealth.total} webhooks healthy
          </p>
          {webhookHealth.unhealthy > 0 && (
            <Badge variant="destructive" className="mt-2 text-xs">
              {webhookHealth.unhealthy} unhealthy
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Pickups by Polygon — full-width card with date range picker */}
      <Card className="col-span-1 md:col-span-2 lg:col-span-4">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              Top ArcGIS Polygons by Pickup Frequency
              {polygonsFetching && (
                <span className="text-xs text-muted-foreground font-normal ml-1">Loading...</span>
              )}
            </CardTitle>
            <Link href="/pickup-records">
              <span className="text-xs text-blue-600 flex items-center gap-1 hover:underline cursor-pointer shrink-0">
                View all <ChevronRight className="h-3 w-3" />
              </span>
            </Link>
          </div>

          {/* Date range controls */}
          <div className="flex flex-wrap items-end gap-3 pt-2">
            {/* Quick presets */}
            <div className="flex gap-1 flex-wrap">
              {PRESETS.map((p, idx) => (
                <Button
                  key={p.label}
                  variant={activePreset === idx ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs px-2"
                  onClick={() => applyPreset(p.days, idx)}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Custom date inputs */}
            <div className="flex items-end gap-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  value={polygonDateFrom}
                  onChange={(e) => { setPolygonDateFrom(e.target.value); setActivePreset(null); }}
                  className="h-7 text-xs w-36"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  value={polygonDateTo}
                  onChange={(e) => { setPolygonDateTo(e.target.value); setActivePreset(null); }}
                  className="h-7 text-xs w-36"
                />
              </div>
              {hasDateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  onClick={clearDateFilter}
                >
                  <X className="h-3 w-3 mr-1" /> Clear
                </Button>
              )}
            </div>

            {hasDateFilter && (
              <Badge variant="secondary" className="text-xs h-7">
                {polygonDateFrom && polygonDateTo
                  ? `${polygonDateFrom} → ${polygonDateTo}`
                  : polygonDateFrom
                  ? `From ${polygonDateFrom}`
                  : `To ${polygonDateTo}`}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {!topPolygons || topPolygons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {hasDateFilter
                ? "No pickups found in this date range."
                : "No polygon data available yet. Pickups with ArcGIS Building IDs will appear here."}
            </p>
          ) : (
            <div className="space-y-1">
              {topPolygons.map((polygon, idx) => (
                <div
                  key={polygon.arcgisBuildingId}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-bold text-muted-foreground w-6 shrink-0 text-right">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="font-mono text-sm font-semibold truncate block">
                        {polygon.arcgisBuildingId}
                      </span>
                      {polygon.companyName && (
                        <span className="text-xs text-muted-foreground">{polygon.companyName}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-bold">
                        {polygon.count.toLocaleString()} pickups
                      </div>
                      {polygon.totalAmount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {formatCompactCurrency(polygon.totalAmount)}
                        </div>
                      )}
                    </div>
                    {polygon.lastPickup && (
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {new Date(polygon.lastPickup).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "2-digit",
                        })}
                      </Badge>
                    )}
                    <Link
                      href={`/pickup-records?arcgis=${encodeURIComponent(polygon.arcgisBuildingId)}`}
                    >
                      <ChevronRight className="h-4 w-4 text-muted-foreground hover:text-foreground cursor-pointer" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
