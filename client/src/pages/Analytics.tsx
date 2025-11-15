import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  TrendingUp, 
  Users, 
  Building2, 
  Activity, 
  CheckCircle2, 
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Analytics() {
  const { data: metrics, refetch: refetchMetrics, isLoading: metricsLoading } = 
    trpc.analytics.getSystemMetrics.useQuery(undefined, {
      refetchInterval: 30000, // Refresh every 30 seconds
    });

  const { data: companyStats, isLoading: statsLoading } = 
    trpc.analytics.getCompanyStats.useQuery(undefined, {
      refetchInterval: 60000,
    });

  const { data: timeline, isLoading: timelineLoading } = 
    trpc.analytics.getSubmissionTimeline.useQuery(undefined, {
      refetchInterval: 300000, // 5 minutes
    });

  const { data: topCompanies, isLoading: topLoading } = 
    trpc.analytics.getTopCompanies.useQuery({ limit: 5, sortBy: 'submissions' });

  const { data: recentErrors, isLoading: errorsLoading } = 
    trpc.analytics.getRecentErrors.useQuery({ limit: 5 });

  const isLoading = metricsLoading || statsLoading || timelineLoading;

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
            <p className="text-muted-foreground mt-2">
              Real-time monitoring and performance metrics
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchMetrics()}
            disabled={metricsLoading}
          >
            {metricsLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="ml-2">Refresh</span>
          </Button>
        </div>
      </div>

      {/* System Overview Cards */}
      {metrics && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Submissions</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.submissions.total.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +{metrics.submissions.today} today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.companies.active}</div>
              <p className="text-xs text-muted-foreground">
                {metrics.operationalLots.total} operational lots
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Sync Success Rate</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.performance.syncSuccessRate}%</div>
              <p className="text-xs text-muted-foreground">
                {metrics.performance.uptime}% uptime
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics.performance.avgResponseTime}ms</div>
              <p className="text-xs text-muted-foreground">
                Last 24 hours
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Submission by Type */}
        {metrics && (
          <Card>
            <CardHeader>
              <CardTitle>Submissions by Type</CardTitle>
              <CardDescription>PAYT vs Monthly Billing distribution</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">PAYT</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.submissions.byType.payt.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{
                        width: `${(metrics.submissions.byType.payt / metrics.submissions.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Monthly Billing</span>
                    <span className="text-sm text-muted-foreground">
                      {metrics.submissions.byType.monthly.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{
                        width: `${(metrics.submissions.byType.monthly / metrics.submissions.total) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Performing Companies */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performing Companies</CardTitle>
            <CardDescription>By submission count</CardDescription>
          </CardHeader>
          <CardContent>
            {topLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : topCompanies && topCompanies.length > 0 ? (
              <div className="space-y-3">
                {topCompanies.map((company: any, index: number) => (
                  <div key={company.companyId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-semibold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{company.companyName}</p>
                        <p className="text-xs text-muted-foreground">
                          {company.submissions} submissions
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline">
                      {company.successRate.toFixed(1)}% success
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                No data available
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Submission Timeline */}
      {timeline && timeline.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Submission Timeline</CardTitle>
            <CardDescription>Last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timeline.map((day) => (
                <div key={day.date} className="flex items-center gap-4">
                  <div className="w-24 text-sm text-muted-foreground">
                    {new Date(day.date).toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric' 
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{
                            width: `${(day.payt / day.submissions) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-12 text-right">
                        {day.submissions}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>PAYT: {day.payt}</span>
                      <span>Monthly: {day.monthly}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Errors */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Errors</CardTitle>
          <CardDescription>Last 5 system errors and warnings</CardDescription>
        </CardHeader>
        <CardContent>
          {errorsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : recentErrors && recentErrors.length > 0 ? (
            <div className="space-y-3">
              {recentErrors.map((error) => (
                <Alert
                  key={error.id}
                  className={`border-l-4 ${
                    error.severity === 'error' ? 'border-l-red-500' : 'border-l-yellow-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      {error.severity === 'error' ? (
                        <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm">{error.type}</p>
                          <Badge
                            variant={error.severity === 'error' ? 'destructive' : 'secondary'}
                          >
                            {error.severity}
                          </Badge>
                        </div>
                        <AlertDescription className="text-sm">
                          {error.message}
                        </AlertDescription>
                        <p className="text-xs text-muted-foreground mt-1">
                          {error.company} - {error.lot} •{' '}
                          {new Date(error.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
              <p className="text-sm text-muted-foreground">No recent errors</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Company Statistics Table */}
      {companyStats && companyStats.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Company Statistics</CardTitle>
            <CardDescription>Detailed breakdown by company</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Company</th>
                    <th className="text-right py-3 px-4 font-medium">Total</th>
                    <th className="text-right py-3 px-4 font-medium">PAYT</th>
                    <th className="text-right py-3 px-4 font-medium">Monthly</th>
                    <th className="text-right py-3 px-4 font-medium">Success Rate</th>
                    <th className="text-right py-3 px-4 font-medium">Last Submission</th>
                  </tr>
                </thead>
                <tbody>
                  {companyStats.map((company) => (
                    <tr key={company.companyId} className="border-b last:border-0">
                      <td className="py-3 px-4 font-medium">{company.companyName}</td>
                      <td className="text-right py-3 px-4">{company.totalSubmissions}</td>
                      <td className="text-right py-3 px-4">{company.paytSubmissions}</td>
                      <td className="text-right py-3 px-4">{company.monthlySubmissions}</td>
                      <td className="text-right py-3 px-4">
                        <Badge variant={company.successRate >= 95 ? 'default' : 'destructive'}>
                          {company.successRate.toFixed(1)}%
                        </Badge>
                      </td>
                      <td className="text-right py-3 px-4 text-sm text-muted-foreground">
                        {company.lastSubmission
                          ? new Date(company.lastSubmission).toLocaleDateString()
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
