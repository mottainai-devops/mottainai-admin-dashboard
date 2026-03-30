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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, User, Calendar, Download, Search, Filter, Pencil, Check, X, Package } from "lucide-react";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { toast } from "sonner";

function ViewPickupsButton({ arcgisBuildingId }: { arcgisBuildingId: string }) {
  const [, setLocation] = useLocation();
  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={() => setLocation(`/pickup-records?arcgisBuildingId=${encodeURIComponent(arcgisBuildingId)}`)}
    >
      <Package className="mr-2 h-4 w-4" />
      View Pickup Records for this Building
    </Button>
  );
}

export default function Buildings() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [search, setSearch] = useState("");
  const [companyId, setCompanyId] = useState<string>("");
  const [lotCode, setLotCode] = useState<string>("");
  const [propertyType, setPropertyType] = useState<string>("");
  const [syncStatus, setSyncStatus] = useState<"synced" | "pending" | "all">("all");
  const [selectedBuilding, setSelectedBuilding] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingArcgisId, setEditingArcgisId] = useState(false);
  const [arcgisIdInput, setArcgisIdInput] = useState("");

  const utils = trpc.useUtils();

  const updateBuildingMutation = trpc.propertyEnumeration.updateBuilding.useMutation({
    onSuccess: (updated) => {
      toast.success("ArcGIS Building ID updated successfully");
      setEditingArcgisId(false);
      // Update the selectedBuilding so the modal reflects the new value immediately
      setSelectedBuilding((prev: any) => prev ? { ...prev, arcgisBuildingId: updated.arcgisBuildingId } : prev);
      utils.propertyEnumeration.getBuildings.invalidate();
      utils.propertyEnumeration.getBuildingById.invalidate({ buildingId: selectedBuilding?._id || "" });
    },
    onError: (err) => {
      toast.error(`Failed to update: ${err.message}`);
    },
  });

  // Fetch buildings
  const { data, isLoading, refetch } = trpc.propertyEnumeration.getBuildings.useQuery({
    page,
    limit,
    search: search || undefined,
    companyId: companyId || undefined,
    lotCode: lotCode || undefined,
    propertyType: propertyType || undefined,
    syncStatus: syncStatus !== "all" ? syncStatus : undefined,
  });

  // Fetch building details
  const { data: buildingDetails, isLoading: isLoadingDetails } =
    trpc.propertyEnumeration.getBuildingById.useQuery(
      { buildingId: selectedBuilding?._id || "" },
      { enabled: !!selectedBuilding }
    );

  // Export buildings
  const exportMutation = trpc.propertyEnumeration.exportBuildings.useMutation({
    onSuccess: (data) => {
      // Convert to CSV
      if (data.length === 0) {
        toast.error("No buildings to export");
        return;
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(","),
        ...data.map((row: any) =>
          headers.map((header) => {
            const value = row[header];
            // Escape commas and quotes
            if (typeof value === "string" && (value.includes(",") || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(",")
        ),
      ].join("\n");

      // Download
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buildings_${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);

      toast.success("Buildings exported successfully");
    },
    onError: (error) => {
      toast.error(`Export failed: ${error.message}`);
    },
  });

  const handleExport = () => {
    exportMutation.mutate({
      companyId: companyId || undefined,
      lotCode: lotCode || undefined,
      propertyType: propertyType || undefined,
    });
  };

  const handleReset = () => {
    setSearch("");
    setCompanyId("");
    setLotCode("");
    setPropertyType("");
    setSyncStatus("all");
    setPage(1);
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Buildings Management</h1>
          <p className="text-muted-foreground">
            View and manage enumerated buildings
          </p>
        </div>
        <Button onClick={handleExport} disabled={exportMutation.isPending}>
          <Download className="mr-2 h-4 w-4" />
          {exportMutation.isPending ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Buildings</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.pagination.total}</div>
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
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Showing</CardTitle>
              <Filter className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data.buildings.length} buildings</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Filters</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              {showFilters ? "Hide" : "Show"} Filters
            </Button>
          </div>
        </CardHeader>
        {showFilters && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Search</label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="ArcGIS ID, Building ID, address..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Input
                  placeholder="Company ID"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Lot Code</label>
                <Input
                  placeholder="Lot code"
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Property Type</label>
                <Select value={propertyType} onValueChange={setPropertyType}>
                  <SelectTrigger>
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All types</SelectItem>
                    <SelectItem value="Residential">Residential</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                    <SelectItem value="Industrial">Industrial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">ArcGIS Sync Status</label>
                <Select value={syncStatus} onValueChange={(v: any) => setSyncStatus(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="synced">Synced</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
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
        )}
      </Card>

      {/* Buildings Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading buildings...</div>
            </div>
          ) : !data || data.buildings.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-2">
              <Building2 className="h-12 w-12 text-muted-foreground" />
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
                    <TableHead>Type</TableHead>
                    <TableHead>Units</TableHead>
                    <TableHead>Enumerator</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Sync Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.buildings.map((building: any) => (
                    <TableRow key={building._id}>
                      <TableCell className="font-mono text-xs">
                        {building.arcgisBuildingId ? (
                          <span title={`Legacy ID: ${building.buildingId}`}>
                            {building.arcgisBuildingId}
                          </span>
                        ) : (
                          building.buildingId
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {building.address}
                      </TableCell>
                      <TableCell>{building.companyId}</TableCell>
                      <TableCell>{building.lotCode}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{building.propertyType}</Badge>
                      </TableCell>
                      <TableCell>{building.numberOfUnits}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {building.enumerator?.fullName || "Unknown"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(building.enumeratedAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={building.syncedToArcGIS ? "default" : "secondary"}
                        >
                          {building.syncedToArcGIS ? "Synced" : "Pending"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedBuilding(building)}
                        >
                          View Details
                        </Button>
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

      {/* Building Details Dialog */}
      <Dialog open={!!selectedBuilding} onOpenChange={() => setSelectedBuilding(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Building Details</DialogTitle>
          </DialogHeader>

          {isLoadingDetails ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-muted-foreground">Loading details...</div>
            </div>
          ) : buildingDetails ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-medium text-muted-foreground">ArcGIS Building ID</div>
                    {!editingArcgisId && (
                      <button
                        onClick={() => {
                          setArcgisIdInput(buildingDetails.arcgisBuildingId || "");
                          setEditingArcgisId(true);
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit ArcGIS Building ID"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {editingArcgisId ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={arcgisIdInput}
                        onChange={(e) => setArcgisIdInput(e.target.value)}
                        placeholder="e.g. 8038 LASIKA06 006"
                        className="font-mono h-8 text-sm"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            updateBuildingMutation.mutate({
                              buildingId: buildingDetails._id,
                              arcgisBuildingId: arcgisIdInput.trim() || null,
                            });
                          }
                          if (e.key === "Escape") setEditingArcgisId(false);
                        }}
                      />
                      <button
                        onClick={() =>
                          updateBuildingMutation.mutate({
                            buildingId: buildingDetails._id,
                            arcgisBuildingId: arcgisIdInput.trim() || null,
                          })
                        }
                        disabled={updateBuildingMutation.isPending}
                        className="text-green-600 hover:text-green-700 disabled:opacity-50"
                        title="Save"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setEditingArcgisId(false)}
                        className="text-muted-foreground hover:text-foreground"
                        title="Cancel"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="font-mono">
                      {buildingDetails.arcgisBuildingId || (
                        <span className="text-muted-foreground italic">Not assigned — click pencil to set</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Legacy Building ID
                  </div>
                  <div className="font-mono text-sm text-muted-foreground">{buildingDetails.buildingId}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Company
                  </div>
                  <div>{buildingDetails.companyId}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Lot Code
                  </div>
                  <div>{buildingDetails.lotCode}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Property Type
                  </div>
                  <div>
                    <Badge variant="outline">{buildingDetails.propertyType}</Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    Number of Units
                  </div>
                  <div>{buildingDetails.numberOfUnits}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-muted-foreground">
                    ArcGIS Sync Status
                  </div>
                  <div>
                    <Badge
                      variant={buildingDetails.syncedToArcGIS ? "default" : "secondary"}
                    >
                      {buildingDetails.syncedToArcGIS ? "Synced" : "Pending"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  Address
                </div>
                <div>{buildingDetails.address}</div>
                {buildingDetails.buildingName && (
                  <div className="text-sm text-muted-foreground">
                    {buildingDetails.buildingName}
                  </div>
                )}
              </div>

              {/* GPS Coordinates */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">
                  GPS Coordinates
                </div>
                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <span className="text-sm text-muted-foreground">Latitude: </span>
                    {buildingDetails.gpsLatitude}
                  </div>
                  <div>
                    <span className="text-sm text-muted-foreground">Longitude: </span>
                    {buildingDetails.gpsLongitude}
                  </div>
                </div>
              </div>

              {/* Enumerator */}
              {buildingDetails.enumerator && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <User className="h-4 w-4" />
                    Enumerator
                  </div>
                  <div>
                    <div>{buildingDetails.enumerator.fullName}</div>
                    <div className="text-sm text-muted-foreground">
                      {buildingDetails.enumerator.email}
                    </div>
                  </div>
                </div>
              )}

              {/* Enumeration Date */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Enumeration Date
                </div>
                <div>
                  {format(new Date(buildingDetails.enumeratedAt), "PPpp")}
                </div>
              </div>

              {/* Photos */}
              {buildingDetails.photoUrls && buildingDetails.photoUrls.length > 0 && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">
                    Photos ({buildingDetails.photoUrls.length})
                  </div>
                  <div className="grid gap-2 md:grid-cols-3">
                    {buildingDetails.photoUrls.map((url: string, index: number) => (
                      <a
                        key={index}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block aspect-square rounded-lg overflow-hidden border hover:opacity-80 transition-opacity"
                      >
                        <img
                          src={url}
                          alt={`Building photo ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Customers */}
              {buildingDetails.linkedCustomers &&
                buildingDetails.linkedCustomers.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      Linked Customers ({buildingDetails.linkedCustomers.length})
                    </div>
                    <div className="space-y-2">
                      {buildingDetails.linkedCustomers.map((customer: any) => (
                        <div
                          key={customer.customerId}
                          className="p-3 border rounded-lg"
                        >
                          <div className="font-medium">{customer.customerName}</div>
                          <div className="text-sm text-muted-foreground">
                            {customer.customerId}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Notes */}
              {buildingDetails.notes && (
                <div className="space-y-2">
                  <div className="text-sm font-medium text-muted-foreground">Notes</div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {buildingDetails.notes}
                  </div>
                </div>
              )}
              {/* Pickups Drill-Down */}
              {buildingDetails.arcgisBuildingId && (
                <div className="pt-2 border-t">
                  <ViewPickupsButton arcgisBuildingId={buildingDetails.arcgisBuildingId} />
                </div>
              )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
