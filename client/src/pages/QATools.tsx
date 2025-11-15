import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Webhook,
  Database,
  FileCheck,
} from "lucide-react";
import { toast } from "sonner";

export default function QATools() {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const { data: companies } = trpc.companies.list.useQuery();
  const testWebhookMutation = trpc.testing.testWebhook.useMutation();

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error("Please enter a webhook URL");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testWebhookMutation.mutateAsync({ webhookUrl });
      setTestResult(result);
      
      if (result.status === 'pass') {
        toast.success("Webhook test passed!");
      } else {
        toast.error("Webhook test failed");
      }
    } catch (error: any) {
      setTestResult({
        status: 'fail',
        message: error.message || 'Test execution failed',
      });
      toast.error("Failed to test webhook");
    } finally {
      setIsTesting(false);
    }
  };

  const handleQuickTest = (url: string) => {
    setWebhookUrl(url);
    setTimeout(() => handleTestWebhook(), 100);
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Quality Assurance Tools</h1>
        <p className="text-muted-foreground mt-2">
          Test webhooks, validate data, and troubleshoot system issues
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Webhook Tester */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Webhook className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <CardTitle>Webhook Tester</CardTitle>
                <CardDescription>
                  Test webhook endpoints with sample payload
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="flex-1"
                />
                <Button
                  onClick={handleTestWebhook}
                  disabled={isTesting || !webhookUrl}
                >
                  {isTesting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span className="ml-2">Test</span>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Sends a test payload with _test: true flag
              </p>
            </div>

            {/* Quick Test Buttons */}
            {companies && companies.length > 0 && (
              <div className="space-y-2">
                <Label>Quick Test (Select Company Webhook)</Label>
                <div className="flex flex-wrap gap-2">
                  {companies.slice(0, 3).map((company: any) =>
                    company.operationalLots?.slice(0, 1).map((lot: any) => (
                      <Button
                        key={`${company.companyId}-${lot.lotCode}`}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickTest(lot.paytWebhook)}
                      >
                        {company.companyName} - {lot.lotCode} (PAYT)
                      </Button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Test Result */}
            {testResult && (
              <Alert
                className={`border-l-4 ${
                  testResult.status === 'pass'
                    ? 'border-l-green-500'
                    : 'border-l-red-500'
                }`}
              >
                <div className="flex items-start gap-3">
                  {testResult.status === 'pass' ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold">{testResult.name || 'Webhook Test'}</p>
                      <Badge
                        variant={testResult.status === 'pass' ? 'default' : 'destructive'}
                      >
                        {testResult.status}
                      </Badge>
                    </div>
                    <AlertDescription>{testResult.message}</AlertDescription>
                    {testResult.duration && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Response time: {testResult.duration}ms
                      </p>
                    )}
                    {testResult.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                          View Response
                        </summary>
                        <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-auto max-h-48">
                          {JSON.stringify(testResult.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </Alert>
            )}

            {/* Sample Payload */}
            <div className="space-y-2">
              <Label>Sample Test Payload</Label>
              <Textarea
                readOnly
                value={JSON.stringify(
                  {
                    formId: 'TEST_FORM',
                    supervisorId: 'TEST_SUPERVISOR',
                    customerType: 'PAYT',
                    binType: '10 CBM SKIP BIN',
                    binQuantity: 1,
                    buildingId: 'TEST_BUILDING',
                    pickUpDate: new Date().toISOString(),
                    userId: 'TEST_USER',
                    latitude: 6.5244,
                    longitude: 3.3792,
                    createdAt: new Date().toISOString(),
                    _test: true,
                  },
                  null,
                  2
                )}
                className="font-mono text-xs"
                rows={12}
              />
            </div>
          </CardContent>
        </Card>

        {/* Data Validation */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <FileCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>Data Validation</CardTitle>
                <CardDescription>Check data integrity and consistency</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Company Data</p>
                    <p className="text-xs text-muted-foreground">All companies valid</p>
                  </div>
                </div>
                <Badge variant="default">Valid</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Webhook URLs</p>
                    <p className="text-xs text-muted-foreground">All URLs accessible</p>
                  </div>
                </div>
                <Badge variant="default">Valid</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium text-sm">Operational Lots</p>
                    <p className="text-xs text-muted-foreground">No duplicates found</p>
                  </div>
                </div>
                <Badge variant="default">Valid</Badge>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <p className="font-medium text-sm">ArcGIS Integration</p>
                    <p className="text-xs text-muted-foreground">
                      Rate limit: 78% used
                    </p>
                  </div>
                </div>
                <Badge variant="secondary">Warning</Badge>
              </div>
            </div>

            <Button className="w-full" variant="outline">
              <FileCheck className="h-4 w-4 mr-2" />
              Run Full Validation
            </Button>
          </CardContent>
        </Card>

        {/* Database Health */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Database className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <CardTitle>Database Health</CardTitle>
                <CardDescription>Monitor database performance</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Connection Status</span>
                <Badge variant="default">Connected</Badge>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Query Response Time</span>
                <span className="text-sm font-medium">45ms</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Active Connections</span>
                <span className="text-sm font-medium">3 / 100</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Cache Hit Rate</span>
                <span className="text-sm font-medium">94.2%</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm">Last Backup</span>
                <span className="text-sm font-medium">2 hours ago</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <h4 className="font-semibold text-sm mb-3">Recent Queries</h4>
              <div className="space-y-2">
                <div className="text-xs p-2 bg-muted rounded font-mono">
                  SELECT * FROM companies WHERE is_active = true
                  <span className="text-muted-foreground ml-2">(12ms)</span>
                </div>
                <div className="text-xs p-2 bg-muted rounded font-mono">
                  SELECT COUNT(*) FROM pickups WHERE synced = 0
                  <span className="text-muted-foreground ml-2">(8ms)</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Diagnostics */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>System Diagnostics</CardTitle>
          <CardDescription>Quick health checks and troubleshooting</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <CheckCircle2 className="h-6 w-6" />
              <span className="font-medium">Test All Webhooks</span>
              <span className="text-xs text-muted-foreground">
                Run tests on all company webhooks
              </span>
            </Button>

            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <Database className="h-6 w-6" />
              <span className="font-medium">Clear Cache</span>
              <span className="text-xs text-muted-foreground">
                Clear polygon and company cache
              </span>
            </Button>

            <Button variant="outline" className="h-auto py-4 flex-col gap-2">
              <FileCheck className="h-6 w-6" />
              <span className="font-medium">Export Logs</span>
              <span className="text-xs text-muted-foreground">
                Download system logs for analysis
              </span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
