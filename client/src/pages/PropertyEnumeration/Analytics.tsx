import { Header } from "@/components/Header";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Users,
  Activity,
  TrendingUp,
  MapPin,
  CheckCircle,
  Clock,
  Link as LinkIcon,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

export default function Analytics() {
  const [companyId, setCompanyId] = useState<string>("all");

  // Fetch filter options
  const { data: companies } = trpc.propertyEnumeration.getCompanies.useQuery();

  // Fetch analytics overview
  const { data: overview, isLoading: isLoadingOverview } =
    trpc.propertyEnumeration.getAnalyticsOverview.useQuery({
      companyId: companyId !== "all" ? companyId : undefined,
    });

  // Fetch enumerator performance
  const { data: performance, isLoading: isLoadingPerformance } =
    trpc.propertyEnumeration.getEnumeratorPerformance.useQuery({
      companyId: companyId !== "all" ? companyId : undefined,
    });

  const handleReset = () => {
    setCompanyId("all");
  };

  return (
    <>
      <Header />
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Property Analytics</h1>
        <p className="text-muted-foreground">
          Comprehensive analytics and insights for property enumeration
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1 space-y-2">
              <label className="text-sm font-medium">Company</label>
              <Select value={companyId} onValueChange={setCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="All companies" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All companies</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company} value={company}>
                      {company}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleReset} variant="outline">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoadingOverview ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading analytics...</div>
        </div>
      ) : overview ? (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Buildings
                </CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.summary.totalBuildings}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.summary.syncedBuildings} synced to ArcGIS
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Sessions
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.summary.totalSessions}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.summary.activeSessions} currently active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Customers
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.summary.totalCustomers}
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.summary.linkedCustomers} linked to buildings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Sync Status</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {overview.summary.totalBuildings > 0
                    ? Math.round(
                        (overview.summary.syncedBuildings /
                          overview.summary.totalBuildings) *
                          100
                      )
                    : 0}
                  %
                </div>
                <p className="text-xs text-muted-foreground">
                  {overview.summary.pendingSyncBuildings} pending sync
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1 */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Buildings by Property Type */}
            <Card>
              <CardHeader>
                <CardTitle>Buildings by Property Type</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.buildingsByType.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={overview.buildingsByType}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label
                      >
                        {overview.buildingsByType.map((entry: any, index: number) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={COLORS[index % COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Buildings by Company */}
            <Card>
              <CardHeader>
                <CardTitle>Buildings by Company</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.buildingsByCompany.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={overview.buildingsByCompany}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="companyId" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2 */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top 10 Lots */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Lots by Buildings</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.buildingsByLot.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={overview.buildingsByLot}
                      layout="vertical"
                      margin={{ left: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="lotCode" type="category" />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#00C49F" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Daily Enumeration Trend */}
            <Card>
              <CardHeader>
                <CardTitle>Daily Enumeration Trend (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {overview.dailyTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={overview.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="count"
                        stroke="#8884d8"
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                    No data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Enumerator Performance */}
          {!isLoadingPerformance && performance && performance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Enumerator Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performance.map((enumerator: any) => (
                    <div
                      key={enumerator.enumeratorId}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                          <Users className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">
                            {enumerator.enumeratorName}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {enumerator.enumeratorEmail}
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-6 text-sm">
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {enumerator.buildingsEnumerated}
                          </div>
                          <div className="text-muted-foreground">Buildings</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {enumerator.totalSessions}
                          </div>
                          <div className="text-muted-foreground">Sessions</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {enumerator.totalDuration}
                          </div>
                          <div className="text-muted-foreground">Minutes</div>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-bold">
                            {enumerator.avgBuildingsPerSession}
                          </div>
                          <div className="text-muted-foreground">Avg/Session</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center h-64 space-y-2">
          <TrendingUp className="h-12 w-12 text-muted-foreground" />
          <div className="text-muted-foreground">No analytics data available</div>
        </div>
      )}
    </div>
    </>
  );
}
