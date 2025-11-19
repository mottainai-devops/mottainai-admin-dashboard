import { useState } from "react";
import { Header } from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CheckCircle2, XCircle, AlertTriangle, Play, RefreshCw } from "lucide-react";

export default function SystemTesting() {
  const [isRunning, setIsRunning] = useState(false);
  
  const { data: healthData, refetch: refetchHealth, isLoading: healthLoading } = 
    trpc.testing.getSystemHealth.useQuery(undefined, {
      refetchInterval: 30000, // Refresh every 30 seconds
    });

  const [testResults, setTestResults] = useState<any>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const runAllTestsQuery = trpc.testing.runAllTests.useQuery(undefined, {
    enabled: false,
  });

  const handleRunTests = async () => {
    setIsRunning(true);
    setTestError(null);
    try {
      const results = await runAllTestsQuery.refetch();
      if (results.data) {
        setTestResults(results.data);
      }
    } catch (error: any) {
      setTestError(error.message || 'Failed to run tests');
    } finally {
      setIsRunning(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return 'bg-green-500';
      case 'fail':
      case 'unhealthy':
        return 'bg-red-500';
      case 'warning':
      case 'degraded':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'fail':
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'warning':
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
      <>
        <Header />
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">System Testing & Monitoring</h1>
        <p className="text-muted-foreground mt-2">
          Test backend APIs, integrations, and monitor system health
        </p>
      </div>

      {/* System Health Overview */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Real-time status of all services</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchHealth()}
              disabled={healthLoading}
            >
              {healthLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">Refresh</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {healthData && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${getStatusColor(healthData.status)}`} />
                <span className="font-semibold text-lg">
                  Overall Status: {healthData.status.toUpperCase()}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {healthData.checks.map((check, index) => (
                  <Card key={index}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(check.status)}
                          <div>
                            <p className="font-medium">{check.service}</p>
                            <p className="text-sm text-muted-foreground">
                              {check.status}
                            </p>
                          </div>
                        </div>
                        <Badge variant={check.status === 'healthy' ? 'default' : 'destructive'}>
                          {check.status}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                Last checked: {new Date(healthData.timestamp).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Suite */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Integration Tests</CardTitle>
              <CardDescription>
                Run comprehensive tests on all backend integrations
              </CardDescription>
            </div>
            <Button
              onClick={handleRunTests}
              disabled={isRunning}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              <span className="ml-2">Run All Tests</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {testResults && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold">{testResults.summary.total}</p>
                      <p className="text-sm text-muted-foreground">Total Tests</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-500">
                        {testResults.summary.passed}
                      </p>
                      <p className="text-sm text-muted-foreground">Passed</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-red-500">
                        {testResults.summary.failed}
                      </p>
                      <p className="text-sm text-muted-foreground">Failed</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-yellow-500">
                        {testResults.summary.warnings}
                      </p>
                      <p className="text-sm text-muted-foreground">Warnings</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Test Results */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Test Results</h3>
                {testResults.results.map((result: any, index: number) => (
                  <Alert key={index} className={`border-l-4 ${
                    result.status === 'pass' ? 'border-l-green-500' :
                    result.status === 'fail' ? 'border-l-red-500' :
                    'border-l-yellow-500'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        {getStatusIcon(result.status)}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold">{result.name}</p>
                            <Badge variant={result.status === 'pass' ? 'default' : 'destructive'}>
                              {result.status}
                            </Badge>
                          </div>
                          <AlertDescription>{result.message}</AlertDescription>
                          <p className="text-xs text-muted-foreground mt-1">
                            Duration: {result.duration}ms
                          </p>
                          
                          {result.details && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                                View Details
                              </summary>
                              <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                                {JSON.stringify(result.details, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  </Alert>
                ))}
              </div>

              <p className="text-sm text-muted-foreground">
                Test run completed at: {new Date(testResults.timestamp).toLocaleString()}
              </p>
            </div>
          )}

          {!testResults && !isRunning && (
            <div className="text-center py-12 text-muted-foreground">
              <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Click "Run All Tests" to start testing</p>
            </div>
          )}

          {testError && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                Failed to run tests: {testError}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
