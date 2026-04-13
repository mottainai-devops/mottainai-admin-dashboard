import { useState, useCallback, useRef } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Play,
  Eye,
  RefreshCw,
  Filter,
  MailCheck,
  MailX,
  Phone,
  PhoneOff,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Progress } from "@/components/ui/progress";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | Date | undefined) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type PreviewRecord = {
  _id: string;
  buildingId: string;
  amount: number;
  quantity: number;
  nameBin: string;
  splitCode: string;
  createdAt: string;
  isMonthly: boolean;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  hasValidEmail: boolean;
  hasValidPhone: boolean;
};

export default function BatchReinvoice() {
  // Filters
  const [page, setPage] = useState(1);
  const [splitCode, setSplitCode] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Job tracking
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<any>(null);
  const [isPolling, setIsPolling] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Confirmation dialog
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);

  // Query
  const { data, isLoading, refetch } = trpc.billing.getBatchReinvoicePreview.useQuery({
    page,
    limit: 50,
    splitCode: splitCode || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  // Mutation
  const triggerMutation = trpc.billing.triggerBatchReinvoice.useMutation({
    onSuccess: (result: any) => {
      if (result.jobId) {
        setJobId(result.jobId);
        setJobStatus({ status: "running", total: selectedIds.size, success: 0, failed: 0, skipped: 0 });
        startPolling(result.jobId);
        toast.success(`Batch job started — Job ID: ${result.jobId}`);
      }
    },
    onError: (err: any) => {
      toast.error(`Failed to start batch: ${err.message}`);
    },
  });

  const pollStatusQuery = trpc.billing.getBatchJobStatus.useQuery(
    { jobId: jobId! },
    { enabled: false }
  );

  const startPolling = useCallback((jid: string) => {
    setIsPolling(true);
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const result = await pollStatusQuery.refetch();
        if (result.data?.found && result.data?.job) {
          setJobStatus(result.data.job);
          if (result.data.job.status === "completed") {
            clearInterval(pollIntervalRef.current!);
            setIsPolling(false);
            toast.success(`Batch complete! ${result.data.job.success} invoiced, ${result.data.job.failed} failed, ${result.data.job.skipped} skipped`);
            refetch();
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);
  }, [pollStatusQuery, refetch, toast]);

  const handleSelectAll = () => {
    if (!data?.records) return;
    if (selectedIds.size === data.records.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.records.map((r: PreviewRecord) => r._id)));
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRunBatch = (dry: boolean) => {
    setIsDryRun(dry);
    setShowConfirm(true);
  };

  const handleConfirm = () => {
    setShowConfirm(false);
    triggerMutation.mutate({
      recordIds: Array.from(selectedIds),
      dryRun: isDryRun,
    });
  };

  const selectedRecords = data?.records?.filter((r: PreviewRecord) => selectedIds.has(r._id)) || [];
  const selectedAmount = selectedRecords.reduce((sum: number, r: PreviewRecord) => sum + (r.amount || 0), 0);

  const progressPct = jobStatus
    ? Math.round(((jobStatus.success + jobStatus.failed + jobStatus.skipped) / Math.max(jobStatus.total, 1)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
            <h1 className="text-2xl font-bold text-foreground">Batch Re-Invoicing</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Create Paystack invoices for yet-to-bill records (positive amount, no invoice issued).
            Select records below, then run the batch. Rate-limited to ~1 invoice per 1.5 seconds.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Yet-to-Bill</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {isLoading ? "…" : (data?.total ?? 0).toLocaleString()}
              </div>
              <div className="text-xs text-muted-foreground mt-1">records across all filters</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Amount</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">
                {isLoading ? "…" : formatCurrency(data?.totalAmount ?? 0)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">unbilled revenue</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {selectedIds.size} <span className="text-base font-normal text-muted-foreground">records</span>
              </div>
              <div className="text-xs text-muted-foreground mt-1">{formatCurrency(selectedAmount)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Job Progress */}
        {jobStatus && (
          <Card className="mb-6 border-blue-200 bg-blue-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {isPolling ? (
                  <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                )}
                Batch Job {jobId} — {jobStatus.status === "completed" ? "Completed" : "Running…"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={progressPct} className="mb-3 h-3" />
              <div className="flex gap-6 text-sm">
                <span className="text-green-700 font-medium">✓ {jobStatus.success} invoiced</span>
                <span className="text-red-600 font-medium">✗ {jobStatus.failed} failed</span>
                <span className="text-gray-500">⟳ {jobStatus.skipped} skipped</span>
                <span className="text-muted-foreground">/ {jobStatus.total} total</span>
              </div>
              {jobStatus.errors?.length > 0 && (
                <div className="mt-3 text-xs text-red-600 max-h-24 overflow-y-auto">
                  {jobStatus.errors.slice(0, 5).map((e: any, i: number) => (
                    <div key={i}>{e.buildingId || e.id}: {e.error}</div>
                  ))}
                  {jobStatus.errors.length > 5 && <div>…and {jobStatus.errors.length - 5} more</div>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <div className="w-48">
                <Select value={splitCode || "all"} onValueChange={v => { setSplitCode(v === "all" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Split Code" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Split Codes</SelectItem>
                    {data?.splitCodes?.map((sc: string) => (
                      <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">From:</span>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                  className="h-8 text-xs w-36"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">To:</span>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1); }}
                  className="h-8 text-xs w-36"
                />
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setSplitCode(""); setDateFrom(""); setDateTo(""); setPage(1); }}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRunBatch(true)}
            disabled={selectedIds.size === 0 || triggerMutation.isPending || isPolling}
          >
            <Eye className="h-4 w-4 mr-1" />
            Dry Run ({selectedIds.size})
          </Button>
          <Button
            size="sm"
            onClick={() => handleRunBatch(false)}
            disabled={selectedIds.size === 0 || triggerMutation.isPending || isPolling}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Play className="h-4 w-4 mr-1" />
            Run Batch ({selectedIds.size} records — {formatCurrency(selectedAmount)})
          </Button>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={!!(data?.records?.length && selectedIds.size === data.records.length)}
                        onChange={handleSelectAll}
                        className="rounded"
                      />
                    </TableHead>
                    <TableHead>Building ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Bin Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Split Code</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Loading records…
                      </TableCell>
                    </TableRow>
                  ) : !data?.records?.length ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No yet-to-bill records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.records.map((record: PreviewRecord) => (
                      <TableRow
                        key={record._id}
                        className={selectedIds.has(record._id) ? "bg-amber-50" : ""}
                      >
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(record._id)}
                            onChange={() => handleSelectOne(record._id)}
                            className="rounded"
                          />
                        </TableCell>
                        <TableCell className="font-mono text-xs font-medium">
                          {record.buildingId || "—"}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm font-medium">{record.customerName}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {record.customerEmail || "no email"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {record.hasValidEmail ? (
                              <Badge variant="outline" className="text-xs px-1 py-0 text-green-700 border-green-300">
                                <MailCheck className="h-3 w-3 mr-0.5" /> Email
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1 py-0 text-red-600 border-red-300">
                                <MailX className="h-3 w-3 mr-0.5" /> No Email
                              </Badge>
                            )}
                            {record.hasValidPhone ? (
                              <Badge variant="outline" className="text-xs px-1 py-0 text-green-700 border-green-300">
                                <Phone className="h-3 w-3 mr-0.5" /> SMS
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs px-1 py-0 text-gray-400 border-gray-300">
                                <PhoneOff className="h-3 w-3 mr-0.5" /> No SMS
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">
                          {record.nameBin || "—"}{record.quantity > 1 ? ` ×${record.quantity}` : ""}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(record.amount)}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {record.splitCode ? record.splitCode.slice(-8) : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(record.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <div className="text-xs text-muted-foreground">
                  Page {data.page} of {data.pages} ({data.total.toLocaleString()} records)
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(data.pages, p + 1))}
                    disabled={page === data.pages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {isDryRun ? "Dry Run — Preview Only" : "Confirm Batch Re-Invoicing"}
              </DialogTitle>
              <DialogDescription>
                {isDryRun ? (
                  "This will simulate invoice creation for the selected records without actually calling Paystack. No invoices will be sent."
                ) : (
                  <>
                    You are about to create <strong>{selectedIds.size} Paystack invoices</strong> totalling{" "}
                    <strong>{formatCurrency(selectedAmount)}</strong>. This will:
                    <ul className="list-disc list-inside mt-2 text-sm space-y-1">
                      <li>Create real Paystack payment requests</li>
                      <li>Send email and SMS notifications to customers</li>
                      <li>Update billing records with invoice IDs</li>
                      <li>Take approximately {Math.ceil(selectedIds.size * 1.5 / 60)} minutes to complete</li>
                    </ul>
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded text-amber-800 text-xs">
                      ⚠ This action cannot be undone. Records already invoiced will be skipped automatically.
                    </div>
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowConfirm(false)}>Cancel</Button>
              <Button
                onClick={handleConfirm}
                className={isDryRun ? "" : "bg-amber-600 hover:bg-amber-700 text-white"}
              >
                {isDryRun ? (
                  <><Eye className="h-4 w-4 mr-1" /> Run Dry Run</>
                ) : (
                  <><Play className="h-4 w-4 mr-1" /> Confirm &amp; Run</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
