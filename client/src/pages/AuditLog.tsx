import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, FileJson, FileSpreadsheet, Shield, CheckCircle2, XCircle, RefreshCw } from "lucide-react";

type AuditLogEntry = {
  id: number;
  timestamp: Date;
  action: string;
  userId?: number;
  username?: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
};

// Export audit logs to CSV
function exportToCSV(logs: AuditLogEntry[]) {
  const headers = ['Timestamp', 'Action', 'User', 'Details', 'IP Address', 'User Agent', 'Status'];
  const rows = logs.map(log => [
    new Date(log.timestamp).toLocaleString(),
    log.action,
    log.username || 'N/A',
    log.details || '',
    log.ipAddress || 'N/A',
    log.userAgent || 'N/A',
    log.success ? 'Success' : 'Failed',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `audit-log-${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
}

// Export audit logs to JSON
function exportToJSON(logs: AuditLogEntry[]) {
  const jsonContent = JSON.stringify(logs, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `audit-log-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
}

export default function AuditLog() {
  const { data: logs, isLoading, refetch } = trpc.simpleAuth.getAuditLogs.useQuery({ limit: 100 });

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('FAILED')) return 'destructive';
    if (action.includes('DELETED')) return 'destructive';
    if (action.includes('SUCCESS') || action.includes('CREATED')) return 'default';
    return 'secondary';
  };

  const getActionIcon = (success: boolean) => {
    return success ? (
      <CheckCircle2 className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-red-500" />
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-8 w-8" />
              Audit Log
            </h1>
            <p className="text-muted-foreground mt-2">
              Track all user actions and security events
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Audit Log</CardTitle>
            <CardDescription>
              Track all user actions and security events
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(logs || [])}
              disabled={!logs || logs.length === 0}
            >
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportToJSON(logs || [])}
              disabled={!logs || logs.length === 0}
            >
              <FileJson className="h-4 w-4 mr-2" />
              Export JSON
            </Button>
          </div>
        </div>
      </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading audit logs...
              </div>
            ) : !logs || logs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No audit logs found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Status</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log: AuditLogEntry) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          {getActionIcon(log.success)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(log.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getActionBadgeVariant(log.action)}>
                            {log.action.replace(/_/g, ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {log.username || <span className="text-muted-foreground">N/A</span>}
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {log.details}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.ipAddress || 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
