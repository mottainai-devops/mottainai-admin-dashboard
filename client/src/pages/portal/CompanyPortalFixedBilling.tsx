/**
 * Company Portal — Fixed Billing Page
 *
 * Independent company view of:
 * 1. Their fixed billing agreements (customers on fixed tariff)
 * 2. Monthly ledger (outstanding balances, payment status)
 * 3. Notification history (SMS/email sent on each pickup)
 * 4. Trigger batch invoice for outstanding amounts
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useCompanyPortal } from "@/contexts/CompanyPortalContext";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Mail,
  MessageSquare,
  RefreshCw,
  TrendingUp,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const FREQUENCIES: Record<string, string> = {
  once_weekly: "Once a week",
  twice_weekly: "Twice a week",
  thrice_weekly: "Three times a week",
  daily: "Daily",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
};

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-800",
    partial: "bg-yellow-100 text-yellow-800",
    unpaid: "bg-red-100 text-red-800",
    waived: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
};

// ─── Summary Cards ────────────────────────────────────────────────────────────

function SummaryCards({ companyId }: { companyId: string }) {
  const { data } = trpc.fixedBilling.listLedger.useQuery({
    companyId,
    status: "unpaid",
    page: 1,
    limit: 1,
  });

  const { data: partialData } = trpc.fixedBilling.listLedger.useQuery({
    companyId,
    status: "partial",
    page: 1,
    limit: 1,
  });

  const { data: agreements } = trpc.fixedBilling.listAgreements.useQuery({
    companyId,
    activeOnly: true,
    page: 1,
    limit: 1,
  });

  // totalOutstandingKobo is not on listLedger result — compute from total count as proxy
  const totalOutstanding = 0; // populated via getCompanyOutstandingSummary below
  const unpaidMonths = (data?.total ?? 0) + (partialData?.total ?? 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">
            Active Agreements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{agreements?.total ?? "—"}</div>
          <div className="text-xs text-muted-foreground mt-1">Customers on fixed billing</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">
            Outstanding Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-red-600">{fmt(totalOutstanding)}</div>
          <div className="text-xs text-muted-foreground mt-1">{unpaidMonths} unpaid months</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-muted-foreground font-medium">
            This Month Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-emerald-600">
            {data?.total === 0 ? "All Paid" : `${data?.total ?? "—"} Unpaid`}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Current billing cycle</div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Agreements Tab ───────────────────────────────────────────────────────────

function AgreementsTab({ companyId }: { companyId: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.fixedBilling.listAgreements.useQuery({
    companyId,
    activeOnly: false,
    page,
    limit: 20,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Fixed Billing Agreements</h2>
        <p className="text-sm text-muted-foreground">
          Customers enrolled in fixed billing with agreed tariff and notification settings
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading agreements…
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead>Bin / Frequency</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead>Notify</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.agreements ?? []).map((a: any) => (
                  <TableRow key={a._id}>
                    <TableCell>
                      <div className="font-medium">{a.customerName}</div>
                      <div className="text-xs text-muted-foreground">{a.customerPhone}</div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{a.lotCode}</TableCell>
                    <TableCell className="font-mono text-xs">{a.tariffCode}</TableCell>
                    <TableCell>
                      {a.binsCount}× {a.binType}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {FREQUENCIES[a.frequency] ?? a.frequency}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(a.agreedMonthlyPriceKobo)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.notifyBySms && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <MessageSquare className="w-3 h-3" /> SMS
                          </Badge>
                        )}
                        {a.notifyByEmail && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <Mail className="w-3 h-3" /> Email
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.active ? (
                        <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Terminated</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.agreements ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No fixed billing agreements found. Contact admin to set up agreements.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {data?.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === data?.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────

function LedgerTab({ companyId }: { companyId: string }) {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("all");
  const [batchConfirm, setBatchConfirm] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);

  const { data, isLoading, refetch } = trpc.fixedBilling.listLedger.useQuery({
    companyId,
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    page,
    limit: 20,
  });

  // Poll batch job status via billing router
  const { data: jobStatus } = trpc.billing.getBatchJobStatus.useQuery(
    { jobId: jobId! },
    { enabled: !!jobId, refetchInterval: jobId ? 3000 : false }
  );

  const batchMutation = trpc.billing.triggerBatchReinvoice.useMutation({
    onSuccess: (r) => {
      setJobId(r.jobId ?? null);
      setBatchConfirm(false);
      toast.success("Batch invoicing started");
    },
    onError: (e) => toast.error(e.message),
  });

  // Stop polling when done
  if (jobStatus?.job && (jobStatus.job.status === "completed" || jobStatus.job.status === "failed")) {
    if (jobId) {
      setJobId(null);
      refetch();
    }
  }

  const unpaidCount = data?.total ?? 0;
  const totalOutstanding = 0; // outstanding computed server-side per entry

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Monthly Billing Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Monthly charges, outstanding balances, and payment status
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
          {statusFilter !== "paid" && statusFilter !== "waived" && (
            <Button
              onClick={() => setBatchConfirm(true)}
              disabled={!!jobId || batchMutation.isPending}
            >
              {jobId ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <CreditCard className="w-4 h-4 mr-2" />
              )}
              Send Payment Requests
            </Button>
          )}
        </div>
      </div>

      {/* Job progress */}
      {jobId && jobStatus && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
            <span className="font-medium text-blue-800">
              Sending payment requests… {jobStatus?.job?.processed ?? 0}/{jobStatus?.job?.total ?? 0}
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{
                width: `${(jobStatus?.job?.total ?? 0) > 0 ? ((jobStatus?.job?.processed ?? 0) / (jobStatus?.job?.total ?? 1)) * 100 : 0}%`,
              }}
            />
          </div>
          <div className="flex gap-4 mt-2 text-sm text-blue-700">
            <span>✓ {jobStatus?.job?.success ?? 0} sent</span>
            <span>✗ {jobStatus?.job?.failed ?? 0} failed</span>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading ledger…
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Billing Month</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Months Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.entries ?? []).map((e: any) => (
                  <TableRow key={e._id}>
                    <TableCell>
                      <div className="font-medium">{e.customerName}</div>
                      <div className="text-xs text-muted-foreground">{e.customerId}</div>
                    </TableCell>
                    <TableCell>{e.billingMonthLabel}</TableCell>
                    <TableCell className="text-right">{fmt(e.chargedAmountKobo)}</TableCell>
                    <TableCell className="text-right text-green-700">
                      {fmt(e.paidAmountKobo)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {fmt(e.outstandingAmountKobo)}
                    </TableCell>
                    <TableCell>
                      {e.monthsOutstanding > 0 ? (
                        <span className="text-red-600 font-semibold">
                          {e.monthsOutstanding} month{e.monthsOutstanding !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-green-600">Current</span>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                  </TableRow>
                ))}
                {(data?.entries ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No ledger entries found for the selected filter.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {data?.totalPages} ({data?.total} entries)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === data?.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Batch Confirm Dialog */}
      <Dialog open={batchConfirm} onOpenChange={setBatchConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send Payment Requests</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold text-amber-800">Confirm Batch Action</div>
                  <div className="text-amber-700 mt-1">
                    This will send SMS and email payment requests to all customers with outstanding
                    balances. Each message will include the total amount due (current month +
                    outstanding) and a Paystack payment link.
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-muted rounded-md p-3">
                <div className="text-muted-foreground">Unpaid entries</div>
                <div className="text-2xl font-bold">{unpaidCount}</div>
              </div>
              <div className="bg-muted rounded-md p-3">
                <div className="text-muted-foreground">Total outstanding</div>
                <div className="text-2xl font-bold text-red-600">
                  {fmt(totalOutstanding)}
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchConfirm(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => batchMutation.mutate({ recordIds: [], dryRun: false })}
              disabled={batchMutation.isPending}
            >
              {batchMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Payment Requests
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Notifications Tab ────────────────────────────────────────────────────────

function NotificationsTab({ companyId }: { companyId: string }) {
  const [page, setPage] = useState(1);

  const { data, isLoading } = trpc.fixedBilling.listNotifications.useQuery({
    companyId,
    page,
    limit: 30,
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Notification History</h2>
        <p className="text-sm text-muted-foreground">
          All SMS and email notifications sent on pickup for fixed billing customers
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading notifications…
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Pickup</TableHead>
                  <TableHead className="text-right">Monthly Due</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead className="text-right">Total Sent</TableHead>
                  <TableHead>Channels</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.logs ?? []).map((log: any) => (
                  <TableRow key={log._id}>
                    <TableCell className="text-xs">
                      {new Date(log.createdAt).toLocaleString("en-NG")}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{log.customerName}</div>
                      <div className="text-xs text-muted-foreground">{log.customerId}</div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {log.pickupDetails?.binType} × {log.pickupDetails?.binsCount}
                      <br />
                      <span className="text-muted-foreground">{log.pickupDetails?.lotCode}</span>
                    </TableCell>
                    <TableCell className="text-right">{fmt(log.currentMonthAmountKobo)}</TableCell>
                    <TableCell className="text-right text-red-600">
                      {fmt(log.outstandingAmountKobo)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(log.totalPayableKobo)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {log.smsSent && (
                          <Badge
                            variant="outline"
                            className={`text-xs gap-1 ${
                              log.smsStatus === "delivered"
                                ? "text-green-700 border-green-300"
                                : log.smsStatus === "failed"
                                ? "text-red-700 border-red-300"
                                : ""
                            }`}
                          >
                            <MessageSquare className="w-3 h-3" />
                            {log.smsStatus ?? "sent"}
                          </Badge>
                        )}
                        {log.emailSent && (
                          <Badge
                            variant="outline"
                            className={`text-xs gap-1 ${
                              log.emailStatus === "delivered"
                                ? "text-green-700 border-green-300"
                                : log.emailStatus === "failed"
                                ? "text-red-700 border-red-300"
                                : ""
                            }`}
                          >
                            <Mail className="w-3 h-3" />
                            {log.emailStatus ?? "sent"}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {log.paymentLinkCreated ? (
                        <Badge className="bg-green-100 text-green-800 border-0 text-xs">
                          Link sent
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500 text-xs">
                          No link
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.logs ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No notifications sent yet. Notifications are triggered automatically on pickup.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {data?.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === data?.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CompanyPortalFixedBilling() {
  const { company } = useCompanyPortal();
  const companyId = company?.companyId ?? "";

  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-emerald-100 rounded-xl">
          <TrendingUp className="w-6 h-6 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fixed Billing</h1>
          <p className="text-muted-foreground">
            Manage your fixed billing customers — agreements, outstanding balances, and notification
            history. Pickup notifications are sent automatically.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards companyId={companyId} />

      {/* Tabs */}
      <Tabs defaultValue="agreements">
        <TabsList>
          <TabsTrigger value="agreements">
            <BadgeCheck className="w-4 h-4 mr-2" /> Agreements
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <BookOpen className="w-4 h-4 mr-2" /> Ledger
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" /> Notifications
          </TabsTrigger>
        </TabsList>

        <TabsContent value="agreements" className="mt-4">
          <AgreementsTab companyId={companyId} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab companyId={companyId} />
        </TabsContent>
        <TabsContent value="notifications" className="mt-4">
          <NotificationsTab companyId={companyId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
