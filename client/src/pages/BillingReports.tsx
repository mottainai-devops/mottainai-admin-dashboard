import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import {
  Download,
  TrendingUp,
  DollarSign,
  CreditCard,
  Calendar,
  CheckCircle2,
  FileText,
  Clock,
} from "lucide-react";
import { BillingCharts } from "@/components/BillingCharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function BillingReports() {
  const [dateRange, setDateRange] = useState({ start: "", end: "" });

  const { data: stats, isLoading: statsLoading } = trpc.billing.getStats.useQuery({
    startDate: dateRange.start || undefined,
    endDate: dateRange.end || undefined,
  });

  const { data: companyBreakdown, isLoading: companyLoading } =
    trpc.billing.getCompanyBreakdown.useQuery();

  const { data: lotBreakdown, isLoading: lotLoading } =
    trpc.billing.getLotBreakdown.useQuery();

  const { data: monthlyTrends, isLoading: trendsLoading } =
    trpc.billing.getMonthlyTrends.useQuery();

  const { data: companyCSVData } = trpc.billing.exportCompanyCSV.useQuery(undefined, {
    enabled: false,
  });

  const utils = trpc.useUtils();

  const handleExportCompanyCSV = async () => {
    const result = await utils.billing.exportCompanyCSV.fetch();
    if (result?.csv) downloadCSV(result.csv, "company-revenue-breakdown.csv");
  };

  const handleExportLotCSV = async () => {
    const result = await utils.billing.exportLotCSV.fetch();
    if (result?.csv) downloadCSV(result.csv, "lot-revenue-breakdown.csv");
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" }).format(amount || 0);

  const formatMonth = (trend: { _id?: { year: number; month: number } }) => {
    if (!trend._id) return "—";
    const { year, month } = trend._id;
    return new Date(year, month - 1).toLocaleDateString("en-NG", {
      month: "short",
      year: "numeric",
    });
  };

  if (statsLoading || companyLoading || lotLoading || trendsLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Loading billing reports...</p>
          </div>
        </div>
      </div>
    );
  }

  // Revenue quality tier percentages
  const total = stats?.totalRevenue || 1;
  const confirmedPct = Math.round(((stats?.confirmedRevenue || 0) / total) * 100);
  const invoicedPct = Math.round(((stats?.invoicedRevenue || 0) / total) * 100);
  const pendingPct = Math.round(((stats?.pendingRevenue || 0) / total) * 100);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto py-8">
        {/* Page header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Billing Reports</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Source: <span className="font-medium">monthlybilldatas</span> — authoritative financial records
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCompanyCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export Company CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLotCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export Lot CSV
            </Button>
          </div>
        </div>

        {/* Date range filter */}
        <Card className="mb-6">
          <CardContent className="pt-4 pb-4">
            <div className="flex gap-4 items-end">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">From</label>
                <input
                  type="date"
                  className="border rounded px-3 py-1.5 text-sm"
                  value={dateRange.start}
                  onChange={(e) => setDateRange((d) => ({ ...d, start: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-1">To</label>
                <input
                  type="date"
                  className="border rounded px-3 py-1.5 text-sm"
                  value={dateRange.end}
                  onChange={(e) => setDateRange((d) => ({ ...d, end: e.target.value }))}
                />
              </div>
              {(dateRange.start || dateRange.end) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange({ start: "", end: "" })}
                >
                  Clear
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top summary: Total, PAYT, Monthly */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Billed Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.totalRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {(stats?.totalTransactions || 0).toLocaleString()} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">PAYT Revenue</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.paytRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">Pay-as-you-throw pickups</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Subscription Revenue</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(stats?.monthlyRevenue || 0)}</div>
              <p className="text-xs text-muted-foreground">Monthly subscription pickups</p>
            </CardContent>
          </Card>
        </div>

        {/* Revenue Quality Tiers */}
        <Card className="mb-6 border-l-4 border-l-blue-500">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Revenue Quality Tiers
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                Based on Paystack transaction status
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Tier 1: Confirmed Paid */}
              <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-semibold text-green-800">Confirmed Paid</span>
                  <Badge className="ml-auto bg-green-100 text-green-800 border-green-300 text-xs">
                    {confirmedPct}%
                  </Badge>
                </div>
                <div className="text-xl font-bold text-green-900">
                  {formatCurrency(stats?.confirmedRevenue || 0)}
                </div>
                <p className="text-xs text-green-700 mt-1">
                  {(stats?.confirmedCount || 0).toLocaleString()} records — status=true + real Paystack ID
                </p>
              </div>

              {/* Tier 2: Invoiced */}
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">Invoiced</span>
                  <Badge className="ml-auto bg-blue-100 text-blue-800 border-blue-300 text-xs">
                    {invoicedPct}%
                  </Badge>
                </div>
                <div className="text-xl font-bold text-blue-900">
                  {formatCurrency(stats?.invoicedRevenue || 0)}
                </div>
                <p className="text-xs text-blue-700 mt-1">
                  {(stats?.invoicedCount || 0).toLocaleString()} records — real Paystack ID, awaiting payment confirmation
                </p>
              </div>

              {/* Tier 3: Pending */}
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  <span className="text-sm font-semibold text-amber-800">Pending</span>
                  <Badge className="ml-auto bg-amber-100 text-amber-800 border-amber-300 text-xs">
                    {pendingPct}%
                  </Badge>
                </div>
                <div className="text-xl font-bold text-amber-900">
                  {formatCurrency(stats?.pendingRevenue || 0)}
                </div>
                <p className="text-xs text-amber-700 mt-1">
                  {(stats?.pendingCount || 0).toLocaleString()} records — not yet invoiced through Paystack
                </p>
              </div>
            </div>

            {/* Stacked progress bar */}
            <div className="mt-4">
              <div className="flex rounded-full overflow-hidden h-2.5 bg-gray-100">
                <div
                  className="bg-green-500 transition-all"
                  style={{ width: `${confirmedPct}%` }}
                  title={`Confirmed: ${confirmedPct}%`}
                />
                <div
                  className="bg-blue-500 transition-all"
                  style={{ width: `${invoicedPct}%` }}
                  title={`Invoiced: ${invoicedPct}%`}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: `${pendingPct}%` }}
                  title={`Pending: ${pendingPct}%`}
                />
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-green-500" /> Confirmed
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-blue-500" /> Invoiced
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400" /> Pending
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts */}
        {stats && companyBreakdown && monthlyTrends && (
          <BillingCharts
            monthlyTrends={monthlyTrends}
            companyBreakdown={companyBreakdown}
            totalPaytRevenue={stats.paytRevenue}
            totalMonthlyRevenue={stats.monthlyRevenue}
          />
        )}

        {/* Company-wise Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Company-wise Revenue Breakdown
              <Badge variant="outline" className="ml-2 text-xs font-normal">
                Attributed via Paystack split codes
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company</TableHead>
                  <TableHead className="text-right">Total Billed</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" /> Confirmed
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <FileText className="h-3 w-3 text-blue-600" /> Invoiced
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-amber-600" /> Pending
                    </span>
                  </TableHead>
                  <TableHead className="text-right">Txns</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyBreakdown && companyBreakdown.length > 0 ? (
                  companyBreakdown.map((company) => (
                    <TableRow key={company.companyId}>
                      <TableCell className="font-medium">{company.companyName}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(company.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right text-green-700">
                        {formatCurrency(company.confirmedRevenue || 0)}
                      </TableCell>
                      <TableCell className="text-right text-blue-700">
                        {formatCurrency(company.invoicedRevenue || 0)}
                      </TableCell>
                      <TableCell className="text-right text-amber-700">
                        {formatCurrency(company.pendingRevenue || 0)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {(company.transactionCount || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
                      No company data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Lot-wise Breakdown */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Lot-wise Revenue Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lot</TableHead>
                    <TableHead className="text-right">Total Billed</TableHead>
                    <TableHead className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <CheckCircle2 className="h-3 w-3 text-green-600" /> Confirmed
                      </span>
                    </TableHead>
                    <TableHead className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <FileText className="h-3 w-3 text-blue-600" /> Invoiced
                      </span>
                    </TableHead>
                    <TableHead className="text-right">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="h-3 w-3 text-amber-600" /> Pending
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Txns</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotBreakdown && lotBreakdown.length > 0 ? (
                    lotBreakdown.map((lot) => (
                      <TableRow key={lot.lotId}>
                        <TableCell className="font-medium">{lot.lotId}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(lot.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right text-green-700">
                          {formatCurrency(lot.confirmedRevenue || 0)}
                        </TableCell>
                        <TableCell className="text-right text-blue-700">
                          {formatCurrency(lot.invoicedRevenue || 0)}
                        </TableCell>
                        <TableCell className="text-right text-amber-700">
                          {formatCurrency(lot.pendingRevenue || 0)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {(lot.transactionCount || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-gray-500">
                        No lot data available
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Monthly Trends */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Revenue Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total Billed</TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-600" /> Confirmed
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <FileText className="h-3 w-3 text-blue-600" /> Invoiced
                    </span>
                  </TableHead>
                  <TableHead className="text-right">
                    <span className="flex items-center justify-end gap-1">
                      <Clock className="h-3 w-3 text-amber-600" /> Pending
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyTrends && monthlyTrends.length > 0 ? (
                  [...monthlyTrends].slice(-12).map((trend, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{formatMonth(trend as any)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(trend.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right text-green-700">
                        {formatCurrency((trend as any).confirmedRevenue || 0)}
                      </TableCell>
                      <TableCell className="text-right text-blue-700">
                        {formatCurrency((trend as any).invoicedRevenue || 0)}
                      </TableCell>
                      <TableCell className="text-right text-amber-700">
                        {formatCurrency((trend as any).pendingRevenue || 0)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
                      No monthly trend data available
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
