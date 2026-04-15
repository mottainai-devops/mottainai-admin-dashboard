import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  Download,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Gift,
  Search,
  ChevronLeft,
  ChevronRight,
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

type StatusFilter = "all" | "paid" | "invoiced" | "yet_to_bill" | "not_billed" | "free";
type BillingTypeFilter = "all" | "payt" | "monthly";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode; description: string }> = {
  paid: {
    label: "Paid",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 className="h-4 w-4" />,
    description: "Invoice sent and payment confirmed",
  },
  invoiced: {
    label: "Invoiced (Unpaid)",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Clock className="h-4 w-4" />,
    description: "Paystack invoice sent, awaiting payment",
  },
  yet_to_bill: {
    label: "Yet to Bill",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <AlertTriangle className="h-4 w-4" />,
    description: "Pickup done, billing record exists but no Paystack invoice",
  },
  not_billed: {
    label: "Not Billed",
    color: "bg-red-100 text-red-800 border-red-200",
    icon: <XCircle className="h-4 w-4" />,
    description: "Pickup done, no billing record at all",
  },
  free: {
    label: "Free / Zero",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    icon: <Gift className="h-4 w-4" />,
    description: "Free-service zone (e.g. LASIKA06) or zero-amount record",
  },
};

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
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default function BillingReconciliation() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [billingTypeFilter, setBillingTypeFilter] = useState<BillingTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [buildingIdSearch, setBuildingIdSearch] = useState("");
  const [buildingIdInput, setBuildingIdInput] = useState("");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const { data, isLoading } = trpc.billing.getReconciliation.useQuery({
    page,
    limit: 50,
    status: statusFilter === "all" ? undefined : statusFilter,
    buildingId: buildingIdSearch || undefined,
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
    billingType: billingTypeFilter === "all" ? undefined : billingTypeFilter,
  });

  const utils = trpc.useUtils();

  const handleExportCSV = async () => {
    const result = await utils.billing.exportReconciliationCSV.fetch({
      status: statusFilter === "all" ? undefined : statusFilter,
      buildingId: buildingIdSearch || undefined,
      startDate: dateRange.start || undefined,
      endDate: dateRange.end || undefined,
      billingType: billingTypeFilter === "all" ? undefined : billingTypeFilter,
    });
    if (!result?.csv) return;
    const blob = new Blob([result.csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reconciliation-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSearch = () => {
    setBuildingIdSearch(buildingIdInput);
    setPage(1);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val as StatusFilter);
    setPage(1);
  };

  const summary = data?.summary;
  const records = data?.records || [];
  const pagination = data?.pagination;

  const totalBillable = (summary?.paid?.totalAmount || 0) +
    (summary?.invoiced?.totalAmount || 0) +
    (summary?.yet_to_bill?.totalAmount || 0) +
    (summary?.not_billed?.totalAmount || 0);

  return (
    <div className="min-h-screen bg-background">
      <Header title="Billing Reconciliation" />

      <div className="container py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const stat = summary?.[key];
            return (
              <Card
                key={key}
                className={`cursor-pointer border-2 transition-all ${
                  statusFilter === key ? "ring-2 ring-primary" : ""
                }`}
                onClick={() => handleStatusChange(key)}
              >
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${config.color}`}>
                      {config.icon}
                      {config.label}
                    </span>
                  </div>
                  <p className="text-2xl font-bold">
                    {isLoading ? "..." : (stat?.count || 0).toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {isLoading ? "" : formatCurrency(stat?.totalAmount || 0)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Revenue Summary Bar */}
        {!isLoading && summary && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Revenue Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Total Billable</p>
                  <p className="text-xl font-bold text-foreground">{formatCurrency(totalBillable)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Collected (Paid)</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(summary.paid?.totalAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Outstanding (Invoiced)</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(summary.invoiced?.totalAmount || 0)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unbilled Gap</p>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency((summary.yet_to_bill?.totalAmount || 0) + (summary.not_billed?.totalAmount || 0))}
                  </p>
                </div>
              </div>
              {/* Collection rate bar */}
              {totalBillable > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Collection Rate</span>
                    <span>{Math.round(((summary.paid?.totalAmount || 0) / totalBillable) * 100)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                    <div
                      className="bg-green-500 h-full"
                      style={{ width: `${((summary.paid?.totalAmount || 0) / totalBillable) * 100}%` }}
                    />
                    <div
                      className="bg-blue-400 h-full"
                      style={{ width: `${((summary.invoiced?.totalAmount || 0) / totalBillable) * 100}%` }}
                    />
                    <div
                      className="bg-amber-400 h-full"
                      style={{ width: `${((summary.yet_to_bill?.totalAmount || 0) / totalBillable) * 100}%` }}
                    />
                    <div
                      className="bg-red-400 h-full"
                      style={{ width: `${((summary.not_billed?.totalAmount || 0) / totalBillable) * 100}%` }}
                    />
                  </div>
                  <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Paid</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> Invoiced</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Yet to Bill</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Not Billed</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Billing Type Tabs (Gap 4) */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {(["all", "payt", "monthly"] as BillingTypeFilter[]).map((bt) => (
            <button
              key={bt}
              onClick={() => { setBillingTypeFilter(bt); setPage(1); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                billingTypeFilter === bt
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {bt === "all" ? "All Billing Types" : bt === "payt" ? "PAYT Only" : "Monthly Billing Only"}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="invoiced">Invoiced (Unpaid)</SelectItem>
              <SelectItem value="yet_to_bill">Yet to Bill</SelectItem>
              <SelectItem value="not_billed">Not Billed</SelectItem>
              <SelectItem value="free">Free / Zero</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Input
              placeholder="Search building ID..."
              value={buildingIdInput}
              onChange={(e) => setBuildingIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="w-52"
            />
            <Button variant="outline" size="icon" onClick={handleSearch}>
              <Search className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-2 items-center">
            <Input
              type="date"
              value={dateRange.start}
              onChange={(e) => { setDateRange(d => ({ ...d, start: e.target.value })); setPage(1); }}
              className="w-36"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={dateRange.end}
              onChange={(e) => { setDateRange(d => ({ ...d, end: e.target.value })); setPage(1); }}
              className="w-36"
            />
          </div>

          <Button variant="outline" onClick={handleExportCSV} className="ml-auto">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>

        {/* Records Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Building ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Bin</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Pickup Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paystack ID</TableHead>
                  <TableHead>Zoho Invoice</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      Loading records...
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No records found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((record: any) => {
                    const config = STATUS_CONFIG[record.billingStatus] || STATUS_CONFIG.not_billed;
                    const billingAmount = record.billingRecord?.amount ?? record.amount ?? 0;
                    const txnId = record.billingRecord?.transcationId;
                    const zohoId = record.billingRecord?.quickbookInvoices;
                    return (
                      <TableRow key={record._id?.toString()}>
                        <TableCell className="font-mono text-xs">{record.buildingId}</TableCell>
                        <TableCell className="text-xs max-w-24 truncate">{record.customerType}</TableCell>
                        <TableCell className="text-xs max-w-28 truncate">{record.binType}</TableCell>
                        <TableCell className="text-right text-xs">{record.binQuantity}</TableCell>
                        <TableCell className="text-right text-xs font-medium">
                          {billingAmount > 0 ? formatCurrency(billingAmount) : "₦0"}
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(record.pickUpDate)}</TableCell>
                        <TableCell>
                          <Badge className={`text-xs border ${config.color} flex items-center gap-1 w-fit`}>
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {txnId && txnId !== "000" ? (
                            <span className="text-blue-600">{txnId}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {zohoId ? (
                            <span className="text-purple-600">{zohoId}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {((page - 1) * pagination.limit) + 1}–{Math.min(page * pagination.limit, pagination.total)} of {pagination.total.toLocaleString()} records
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="flex items-center text-sm px-2">
                Page {page} of {pagination.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
