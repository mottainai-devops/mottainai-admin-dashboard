import { Header } from "@/components/Header";
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, User, Calendar, Activity } from "lucide-react";
import { format } from "date-fns";

export default function Sessions() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [companyId, setCompanyId] = useState<string>("all");
  const [lotCode, setLotCode] = useState<string>("all");
  const [isActive, setIsActive] = useState<boolean | undefined>(undefined);

  // Fetch filter options
  const { data: companies } = trpc.propertyEnumeration.getCompanies.useQuery();
  const { data: lotCodes } = trpc.propertyEnumeration.getLotCodes.useQuery();

  // Fetch sessions
  const { data, isLoading } = trpc.propertyEnumeration.getSessions.useQuery({
    page,
    limit,
    companyId: companyId !== "all" ? companyId : undefined,
    lotCode: lotCode !== "all" ? lotCode : undefined,
    isActive,
  });

  const handleReset = () => {
    setCompanyId("all");
    setLotCode("all");
    setIsActive(undefined);
    setPage(1);
  };

  return (
    <>
      <Header />
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Enumeration Sessions</h1>
        <p className="text-muted-foreground">
          Track and monitor field enumeration sessions
        </p>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
              <Clock className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.sessions.filter((s: any) => s.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.sessions.filter((s: any) => !s.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Page</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {data.pagination.page} / {data.pagination.pages}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
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

            <div className="space-y-2">
              <label className="text-sm font-medium">Lot Code</label>
              <Select value={lotCode} onValueChange={setLotCode}>
                <SelectTrigger>
                  <SelectValue placeholder="All lot codes" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All lot codes</SelectItem>
                  {lotCodes?.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="flex gap-2">
                <Button
                  variant={isActive === true ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsActive(true)}
                >
                  Active
                </Button>
                <Button
                  variant={isActive === false ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsActive(false)}
                >
                  Completed
                </Button>
                <Button
                  variant={isActive === undefined ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsActive(undefined)}
                >
                  All
                </Button>
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleReset} variant="outline">
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading sessions...</div>
            </div>
          ) : !data || data.sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-2">
              <Activity className="h-12 w-12 text-muted-foreground" />
              <div className="text-muted-foreground">No sessions found</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Enumerator</TableHead>
                    <TableHead>Start Time</TableHead>
                    <TableHead>End Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Buildings</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sessions.map((session: any) => (
                    <TableRow key={session._id}>
                      <TableCell className="font-mono text-xs">
                        {session._id.slice(-8)}
                      </TableCell>
                      <TableCell>{session.companyId}</TableCell>
                      <TableCell>{session.lotCode}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {session.user?.fullName || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(session.startTime), "MMM d, HH:mm")}
                      </TableCell>
                      <TableCell>
                        {session.endTime
                          ? format(new Date(session.endTime), "MMM d, HH:mm")
                          : "-"}
                      </TableCell>
                      <TableCell>
                        {session.durationMinutes
                          ? `${session.durationMinutes} min`
                          : "-"}
                      </TableCell>
                      <TableCell>{session.buildingsEnumerated || 0}</TableCell>
                      <TableCell>
                        <Badge variant={session.isActive ? "default" : "secondary"}>
                          {session.isActive ? "Active" : "Completed"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <div className="text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to{" "}
                  {Math.min(page * limit, data.pagination.total)} of{" "}
                  {data.pagination.total} sessions
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= data.pagination.pages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
