/**
 * Monthly Billing Management Page (Gap 6)
 *
 * Provides admin visibility into all Monthly Billing (isMonthly: true)
 * records from monthlybilldatas, with filters by company/lot split code,
 * billing month, payment status, and building ID search.
 */

import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Search,
  CalendarDays,
  DollarSign,
  Users,
} from "lucide-react";

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

type StatusFilter = "all" | "paid" | "invoiced" | "yet_to_bill";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  paid: {
    label: "Paid",
    color: "bg-green-100 text-green-800 border-green-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  invoiced: {
    label: "Invoiced",
    color: "bg-blue-100 text-blue-800 border-blue-200",
    icon: <Clock className="h-3 w-3" />,
  },
  yet_to_bill: {
    label: "Yet to Bill",
    color: "bg-amber-100 text-amber-800 border-amber-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
};

export default function MonthlyBilling() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [splitCodeFilter, setSplitCodeFilter] = useState<string>("all");
  const [monthFilter, setMonthFilter] = useState<string>("all");
  const [buildingIdInput, setBuildingIdInput] = useState("");
  const [buildingIdSearch, setBuildingIdSearch] = useState("");

  const { data, isLoading } = trpc.billing.listMonthlyBillingRecords.useQuery({
    page,
    limit: 50,
    status: statusFilter === "all" ? "all" : statusFilter,
    splitCode: splitCodeFilter === "all" ? undefined : splitCodeFilter,
    month: monthFilter === "all" ? undefined : monthFilter,
    buildingId: buildingIdSearch || undefined,
  });

  const handleSearch = () => {
    setBuildingIdSearch(buildingIdInput);
    setPage(1);
  };

  const handleFilterChange = (setter: (v: any) => void) => (v: string) => {
    setter(v);
    setPage(1);
  };

  const summary = data?.summary;
  const records = data?.records ?? [];
  const splitCodes = data?.splitCodes ?? [];
  const months = data?.months ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header title="Monthly Billing Management" />

      <div className="container py-6 space-y-6">

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Billed</span>
              </div>
              <p className="text-2xl font-bold">{isLoading ? "…" : formatCurrency(summary?.totalAmount ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">{isLoading ? "" : `${data?.total ?? 0} records`}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Paid</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{isLoading ? "…" : formatCurrency(summary?.paidAmount ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">{isLoading ? "" : `${summary?.paidCount ?? 0} records`}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Invoiced</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{isLoading ? "…" : formatCurrency(summary?.invoicedAmount ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">{isLoading ? "" : `${summary?.invoicedCount ?? 0} records`}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Yet to Bill</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{isLoading ? "…" : formatCurrency(summary?.yetToBillAmount ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-1">{isLoading ? "" : `${summary?.yetToBillCount ?? 0} records`}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end flex-wrap">
          <div className="space-y-1">
            <Label className="text-xs">Status</Label>
            <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="invoiced">Invoiced</SelectItem>
                <SelectItem value="yet_to_bill">Yet to Bill</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Split Code / Company</Label>
            <Select value={splitCodeFilter} onValueChange={handleFilterChange(setSplitCodeFilter)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {splitCodes.map((sc: string) => (
                  <SelectItem key={sc} value={sc}>{sc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Billing Month</Label>
            <Select value={monthFilter} onValueChange={handleFilterChange(setMonthFilter)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {months.map((m: string) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Building ID</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Search building ID…"
                value={buildingIdInput}
                onChange={(e) => setBuildingIdInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="w-48"
              />
              <Button variant="outline" size="icon" onClick={handleSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Records Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Monthly Billing Records
              {!isLoading && (
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  ({data?.total?.toLocaleString() ?? 0} total)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Building ID</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Split Code</TableHead>
                  <TableHead>Month</TableHead>
                  <TableHead>Bin</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paystack ID</TableHead>
                  <TableHead>Zoho Invoice</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      Loading records…
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                      No Monthly Billing records found for the selected filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r: any) => {
                    const config = STATUS_CONFIG[r.billingStatus] ?? STATUS_CONFIG.yet_to_bill;
                    return (
                      <TableRow key={r._id}>
                        <TableCell className="font-mono text-xs">{r.buildingId}</TableCell>
                        <TableCell>
                          <div className="text-xs font-medium">{r.customerName}</div>
                          {r.customerPhone && (
                            <div className="text-xs text-muted-foreground">{r.customerPhone}</div>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{r.splitCode}</TableCell>
                        <TableCell className="text-xs font-medium">{r.month ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-24 truncate">{r.nameBin}</TableCell>
                        <TableCell className="text-right text-xs">{r.quantity}</TableCell>
                        <TableCell className="text-right text-xs font-semibold">
                          {r.amount > 0 ? formatCurrency(r.amount) : "₦0"}
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-xs border flex items-center gap-1 w-fit ${config.color}`}>
                            {config.icon}
                            {config.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.transcationId && r.transcationId !== "000" ? (
                            <span className="text-blue-600">{r.transcationId}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.quickbookInvoices ? (
                            <span className="text-purple-600">{r.quickbookInvoices}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(r.createdAt)}
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
        {(data?.pages ?? 1) > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} of {data?.pages}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(data?.pages ?? 1, p + 1))}
                disabled={page === (data?.pages ?? 1)}
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
