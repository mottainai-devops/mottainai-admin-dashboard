import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Send,
  Clock,
  Server,
  CreditCard,
  FileText,
  MessageSquare,
  Database,
  Globe,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const CATEGORY_ICONS = {
  payment: CreditCard,
  accounting: FileText,
  sms: MessageSquare,
  email: Send,
  database: Database,
  api: Globe,
};

const CATEGORY_LABELS = {
  payment: "Payment Services",
  accounting: "Accounting",
  sms: "SMS Notifications",
  email: "Email",
  database: "Database",
  api: "API Endpoints",
};

export default function WebhookMonitoring() {
  const [testingId, setTestingId] = useState<string | null>(null);
  const [checkingAll, setCheckingAll] = useState(false);

  // Fetch webhook health status
  const {
    data: healthData,
    isLoading,
    refetch,
  } = trpc.realWebhook.checkAll.useQuery(undefined, {
    refetchInterval: 60000, // Refresh every minute
  });

  // Test single webhook mutation
  const testOneMutation = trpc.realWebhook.checkOne.useMutation();

  const handleRefreshAll = async () => {
    setCheckingAll(true);
    try {
      await refetch();
      toast.success("All webhooks refreshed successfully");
    } catch (error) {
      toast.error("Failed to refresh webhooks");
    } finally {
      setCheckingAll(false);
    }
  };

  const handleTestOne = async (id: string, name: string) => {
    setTestingId(id);
    try {
      const result = await testOneMutation.mutateAsync({ id });
      
      if (result.status === "healthy") {
        toast.success(`${name} is healthy`);
      } else if (result.status === "degraded") {
        toast.warning(`${name} is degraded: ${result.error || "Unknown issue"}`);
      } else {
        toast.error(`${name} is down: ${result.error || "Connection failed"}`);
      }
      
      // Refresh all data after test
      await refetch();
    } catch (error: any) {
      toast.error(`Test failed: ${error.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "degraded":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "down":
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Healthy</Badge>;
      case "degraded":
        return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Degraded</Badge>;
      case "down":
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Down</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const formatResponseTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Webhook Monitoring" />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  const { results = [], summary } = healthData || {};

  // Group results by category
  const resultsByCategory = results.reduce((acc: any, result: any) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Webhook Monitoring" />
      
      <div className="container mx-auto py-8 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Services
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{summary?.total || 0}</span>
                <Server className="h-8 w-8 text-gray-400" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Healthy
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-green-600">
                  {summary?.healthy || 0}
                </span>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Degraded
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-yellow-600">
                  {summary?.degraded || 0}
                </span>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Down
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-red-600">
                  {summary?.down || 0}
                </span>
                <XCircle className="h-8 w-8 text-red-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Health Percentage */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>System Health</CardTitle>
                <CardDescription>
                  Overall health percentage across all services
                </CardDescription>
              </div>
              <Button
                onClick={handleRefreshAll}
                disabled={checkingAll}
                variant="outline"
              >
                {checkingAll ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Refresh All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-5xl font-bold">
                  {summary?.healthPercentage || 0}%
                </span>
                <Badge
                  className={
                    (summary?.overallStatus === "healthy"
                      ? "bg-green-100 text-green-800"
                      : summary?.overallStatus === "warning"
                      ? "bg-yellow-100 text-yellow-800"
                      : "bg-red-100 text-red-800") + " hover:bg-current"
                  }
                >
                  {summary?.overallStatus || "unknown"}
                </Badge>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all ${
                    (summary?.healthPercentage || 0) >= 90
                      ? "bg-green-600"
                      : (summary?.healthPercentage || 0) >= 70
                      ? "bg-yellow-600"
                      : "bg-red-600"
                  }`}
                  style={{ width: `${summary?.healthPercentage || 0}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Services by Category */}
        <Card>
          <CardHeader>
            <CardTitle>External Services</CardTitle>
            <CardDescription>
              Real-time health monitoring of all external services
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-7">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="payment">Payment</TabsTrigger>
                <TabsTrigger value="accounting">Accounting</TabsTrigger>
                <TabsTrigger value="sms">SMS</TabsTrigger>
                <TabsTrigger value="database">Database</TabsTrigger>
                <TabsTrigger value="api">API</TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Service</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Last Checked</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((result: any) => {
                      const CategoryIcon = CATEGORY_ICONS[result.category as keyof typeof CATEGORY_ICONS];
                      return (
                        <TableRow key={result.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(result.status)}
                              <div>
                                <div className="font-medium">{result.name}</div>
                                {result.error && (
                                  <div className="text-xs text-red-600">
                                    {result.error}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {CategoryIcon && <CategoryIcon className="h-4 w-4 text-gray-500" />}
                              <span className="text-sm">
                                {CATEGORY_LABELS[result.category as keyof typeof CATEGORY_LABELS]}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(result.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">
                                {formatResponseTime(result.responseTime)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(result.lastChecked).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTestOne(result.id, result.name)}
                              disabled={testingId === result.id}
                            >
                              {testingId === result.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                "Test"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TabsContent>

              {/* Category-specific tabs */}
              {Object.entries(resultsByCategory).map(([category, categoryResults]: [string, any]) => (
                <TabsContent key={category} value={category} className="mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Service</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Response Time</TableHead>
                        <TableHead>Last Checked</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {categoryResults.map((result: any) => (
                        <TableRow key={result.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getStatusIcon(result.status)}
                              <div>
                                <div className="font-medium">{result.name}</div>
                                {result.error && (
                                  <div className="text-xs text-red-600">
                                    {result.error}
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(result.status)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-gray-400" />
                              <span className="text-sm">
                                {formatResponseTime(result.responseTime)}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(result.lastChecked).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleTestOne(result.id, result.name)}
                              disabled={testingId === result.id}
                            >
                              {testingId === result.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                "Test"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
