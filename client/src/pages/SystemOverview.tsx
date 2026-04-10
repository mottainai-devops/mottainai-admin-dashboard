import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Server, Database, Webhook, Activity } from "lucide-react";
import { useState } from "react";

/**
 * SystemOverview — superadmin-only page showing live system health,
 * webhook status, and infrastructure metrics.
 */
export default function SystemOverview() {
  const [backfillDryRun, setBackfillDryRun] = useState(true);
  const [backfillResult, setBackfillResult] = useState<any>(null);

  const webhookHealth = trpc.analytics.getWebhookHealth.useQuery(undefined, {
    refetchInterval: 60_000,
  });

  const systemMetrics = trpc.analytics.getSystemMetrics.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const geoBackfillMutation = trpc.superAdmin.triggerGeoBackfill.useMutation({
    onSuccess: (data) => setBackfillResult(data),
  });

  const handleGeoBackfill = () => {
    geoBackfillMutation.mutate({ dryRun: backfillDryRun, batchSize: 100 });
  };

  return (
    <div className="container py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">System Overview</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Superadmin — live infrastructure health and maintenance tools
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            webhookHealth.refetch();
            systemMetrics.refetch();
          }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {
            label: "Total Pickups",
            value: systemMetrics.data?.submissions?.total?.toLocaleString() ?? "—",
            icon: <Activity className="h-4 w-4" />,
          },
          {
            label: "Companies",
            value: systemMetrics.data?.companies?.total ?? "—",
            icon: <Server className="h-4 w-4" />,
          },
          {
            label: "Operational Lots",
            value: systemMetrics.data?.operationalLots?.total ?? "—",
            icon: <Database className="h-4 w-4" />,
          },
          {
            label: "Uptime",
            value: systemMetrics.data?.performance?.uptime
              ? `${systemMetrics.data.performance.uptime}%`
              : "—",
            icon: <Webhook className="h-4 w-4" />,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </div>
              <div className="text-2xl font-bold">{item.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Webhook Health */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Webhook className="h-4 w-4" />
            Webhook Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          {webhookHealth.isLoading ? (
            <p className="text-sm text-muted-foreground">Checking webhooks…</p>
          ) : webhookHealth.data?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No webhooks configured.</p>
          ) : (
            <div className="space-y-2">
              {webhookHealth.data?.map((wh) => (
                <div
                  key={wh.url}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <span className="text-sm font-mono truncate max-w-xs">{wh.url}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{wh.responseTime}ms</span>
                    <Badge
                      variant={wh.status === "active" ? "default" : "destructive"}
                      className="text-xs"
                    >
                      {wh.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geo Backfill Tool */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Database className="h-4 w-4" />
            Geographic Backfill
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Backfill <code>stateCode</code>, <code>lotCode</code>, and <code>country</code> fields
            for pickup records that have an <code>arcgisBuildingId</code> but are missing geographic
            data. Processes up to 100 records per run.
          </p>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={backfillDryRun}
                onChange={(e) => setBackfillDryRun(e.target.checked)}
                className="rounded"
              />
              Dry run (preview only, no changes)
            </label>
            <Button
              size="sm"
              onClick={handleGeoBackfill}
              disabled={geoBackfillMutation.isPending}
            >
              {geoBackfillMutation.isPending
                ? "Running…"
                : backfillDryRun
                ? "Preview"
                : "Run Backfill"}
            </Button>
          </div>
          {backfillResult && (
            <div className="rounded bg-muted p-3 text-sm space-y-1">
              <p className="font-semibold">{backfillResult.message}</p>
              {!backfillResult.dryRun && (
                <>
                  <p>Updated: {backfillResult.updated}</p>
                  <p>Failed: {backfillResult.failed}</p>
                </>
              )}
              {backfillResult.dryRun && (
                <p>Eligible records: {backfillResult.totalEligible}</p>
              )}
              {backfillResult.errors?.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Show errors ({backfillResult.errors.length})
                  </summary>
                  <ul className="mt-1 space-y-1">
                    {backfillResult.errors.map((e: string, i: number) => (
                      <li key={i} className="text-xs text-destructive font-mono">
                        {e}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
