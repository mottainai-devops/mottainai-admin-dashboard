import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, TrendingUp, DollarSign, CreditCard, Calendar } from "lucide-react";
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

  // Fetch all billing data
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

  // CSV Export handlers
  const handleExportCompanyCSV = async () => {
    const result = await trpc.billing.exportCompanyCSV.useQuery();
    if (result.data?.csv) {
      downloadCSV(result.data.csv, "company-revenue-breakdown.csv");
    }
  };

  const handleExportLotCSV = async () => {
    const result = await trpc.billing.exportLotCSV.useQuery();
    if (result.data?.csv) {
      downloadCSV(result.data.csv, "lot-revenue-breakdown.csv");
    }
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Billing Reports</h1>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCompanyCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              Export Company CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportLotCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export Lot CSV
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.totalRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.totalTransactions || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                PAYT Revenue
              </CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.paytRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.paytTransactions || 0} transactions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Monthly Revenue
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(stats?.monthlyRevenue || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.monthlyTransactions || 0} transactions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Data Visualization Charts */}
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">PAYT Revenue</TableHead>
                  <TableHead className="text-right">Monthly Revenue</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companyBreakdown && companyBreakdown.length > 0 ? (
                  companyBreakdown.map((company) => (
                    <TableRow key={company.companyId}>
                      <TableCell className="font-medium">
                        {company.companyName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(company.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(company.paytRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(company.monthlyRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {company.transactionCount}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500">
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
                    <TableHead>Lot ID</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                    <TableHead className="text-right">PAYT Revenue</TableHead>
                    <TableHead className="text-right">
                      Monthly Revenue
                    </TableHead>
                    <TableHead className="text-right">Transactions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lotBreakdown && lotBreakdown.length > 0 ? (
                    lotBreakdown.map((lot) => (
                      <TableRow key={lot.lotId}>
                        <TableCell className="font-medium">
                          {lot.lotName}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(lot.totalRevenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(lot.paytRevenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(lot.monthlyRevenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {lot.transactionCount}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-gray-500">
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
                  <TableHead className="text-right">Total Revenue</TableHead>
                  <TableHead className="text-right">PAYT Revenue</TableHead>
                  <TableHead className="text-right">Monthly Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyTrends && monthlyTrends.length > 0 ? (
                  monthlyTrends.slice(-12).map((trend) => (
                    <TableRow key={trend.month}>
                      <TableCell className="font-medium">{trend.month}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trend.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trend.paytRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(trend.monthlyRevenue)}
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-gray-500">
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
