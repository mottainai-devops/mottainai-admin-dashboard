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
import { RefreshCw, CheckCircle, Clock, AlertCircle, MapPin } from "lucide-react";
import { format } from "date-fns";

export default function SyncMonitor() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [companyId, setCompanyId] = useState<string>("all");
  const [lotCode, setLotCode] = useState<string>("all");

  // Fetch filter options
  const { data: companies } = trpc.propertyEnumeration.getCompanies.useQuery();
  const { data: lotCodes } = trpc.propertyEnumeration.getLotCodes.useQuery();

  // Fetch buildings with sync status
  const { data, isLoading, refetch } = trpc.propertyEnumeration.getBuildings.useQuery({
    page,
    limit,
    companyId: companyId !== "all" ? companyId : undefined,
    lotCode: lotCode !== "all" ? lotCode : undefined,
  });

  const handleReset = () => {
    setCompanyId("all");
    setLotCode("all");
    setPage(1);
  };

  const syncedCount = data?.buildings.filter((b: any) => b.syncedToArcGIS).length || 0;
  const pendingCount = data?.buildings.filter((b: any) => !b.syncedToArcGIS).length || 0;

  return (
    <>
      <Header />
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ArcGIS Sync Monitor</h1>
          <p className="text-muted-foreground">
            Monitor synchronization status between local database and ArcGIS
          </p>
        </div>
        <Button onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Buildings</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.pagination.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Synced</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{syncedCount}</div>
              <p className="text-xs text-muted-foreground">
                {data.pagination.total > 0
                  ? Math.round((syncedCount / data.pagination.total) * 100)
                  : 0}
                % of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Sync</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">
                {data.pagination.total > 0
                  ? Math.round((pendingCount / data.pagination.total) * 100)
                  : 0}
                % of total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Page</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
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
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          <div className="flex gap-2">
            <Button onClick={() => refetch()}>Apply Filters</Button>
            <Button variant="outline" onClick={handleReset}>
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sync Status Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading sync status...</div>
            </div>
          ) : !data || data.buildings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-2">
              <MapPin className="h-12 w-12 text-muted-foreground" />
              <div className="text-muted-foreground">No buildings found</div>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Building ID</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Enumerated At</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Last Sync</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.buildings.map((building: any) => (
                    <TableRow key={building._id}>
                      <TableCell className="font-mono text-xs">
                        {building.buildingId}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {building.address}
                      </TableCell>
                      <TableCell>{building.companyId}</TableCell>
                      <TableCell>{building.lotCode}</TableCell>
                      <TableCell>
                        {format(new Date(building.enumeratedAt), "MMM d, yyyy HH:mm")}
                      </TableCell>
                      <TableCell>
                        {building.syncedToArcGIS ? (
                          <Badge variant="default" className="bg-green-600">
                            <CheckCircle className="mr-1 h-3 w-3" />
                            Synced
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-yellow-600 text-white">
                            <Clock className="mr-1 h-3 w-3" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {building.lastSyncedAt
                          ? format(new Date(building.lastSyncedAt), "MMM d, yyyy HH:mm")
                          : "-"}
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
                  {data.pagination.total} buildings
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

      {/* Sync Information */}
      <Card>
        <CardHeader>
          <CardTitle>Sync Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-medium">About ArcGIS Synchronization</h3>
            <p className="text-sm text-muted-foreground">
              Buildings are automatically synchronized to ArcGIS after enumeration. The sync
              process includes:
            </p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              <li>Building geometry (GPS coordinates)</li>
              <li>Property attributes (type, units, address)</li>
              <li>Customer linkages</li>
              <li>Enumeration metadata</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h3 className="font-medium">Sync Status Indicators</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="bg-green-600">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Synced
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Building data has been successfully synchronized to ArcGIS
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-yellow-600 text-white">
                  <Clock className="mr-1 h-3 w-3" />
                  Pending
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Building is waiting to be synchronized to ArcGIS
                </span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>Note:</strong> Sync operations are performed automatically by the backend
              system. Manual sync triggers are not currently available through this interface.
              Contact system administrators for manual sync requests.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
