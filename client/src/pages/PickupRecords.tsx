import { useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Search, Package, ChevronLeft, ChevronRight, Download, Eye } from "lucide-react";
import { SortableTable, Column } from "@/components/SortableTable";
import { Badge } from "@/components/ui/badge";
import { PickupFiltersComponent, PickupFilters } from "@/components/PickupFilters";
import { PickupDetailsModal } from "@/components/PickupDetailsModal";

export default function PickupRecords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);

  // Pre-fill arcgisBuildingId filter from URL query param (drill-down from Buildings page)
  const urlParams = new URLSearchParams(window.location.search);
  const prefilledBuildingId = urlParams.get("arcgisBuildingId") || undefined;

  const [filters, setFilters] = useState<PickupFilters>({
    paymentType: "all",
    source: "all",
    arcgisBuildingId: prefilledBuildingId,
  });
  const limit = 50;

  const { data, isLoading } = trpc.pickups.list.useQuery({
    search: searchTerm,
    page,
    limit,
    dateFrom: filters.dateFrom?.toISOString(),
    dateTo: filters.dateTo?.toISOString(),
    companyId: filters.companyId,
    lotId: filters.lotId,
    binType: filters.binType,
    paymentType: filters.paymentType === "all" ? undefined : filters.paymentType,
    source: filters.source === "all" ? undefined : filters.source,
    arcgisBuildingId: filters.arcgisBuildingId,
  });

  const pickups = data?.pickups || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Pickup Records</h1>
          <p className="text-gray-600">View all pickup records synced from the mobile app</p>
        </div>

        {/* Drill-down banner when navigated from Buildings page */}
        {prefilledBuildingId && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Package className="h-4 w-4" />
              <span>Showing pickups filtered by ArcGIS Building ID: <strong className="font-mono">{prefilledBuildingId}</strong></span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-700 hover:text-blue-900"
              onClick={() => {
                setFilters({ paymentType: "all", source: "all" });
                window.history.replaceState(null, "", "/pickup-records");
              }}
            >
              Clear filter
            </Button>
          </div>
        )}

        {/* Advanced Filters */}
        <PickupFiltersComponent
          filters={filters}
          onFiltersChange={(newFilters) => {
            setFilters(newFilters);
            setPage(1);
          }}
        />

        {/* Search Bar */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                type="text"
                placeholder="Search by building ID, split code, or bin type..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Pickup History ({total.toLocaleString()} records)</CardTitle>
                <CardDescription>All pickup records from mobile app submissions</CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Export current page to CSV
                  const csvHeaders = ["Building ID", "Split Code", "Bin Type", "Quantity", "Amount", "Type", "Source", "Month", "Year", "Status"];
                  const csvRows = pickups.map((pickup: any) => [
                    pickup.buildingId || "",
                    pickup.splitCode || "",
                    pickup.nameBin || "",
                    pickup.quantity || 0,
                    pickup.amount || 0,
                    pickup.isMonthly ? "Monthly" : "PAYT",
                    pickup.source || "unknown",
                    pickup.month || "",
                    pickup.year || "",
                    pickup.status ? "Paid" : "Unpaid",
                  ]);
                  const csv = [csvHeaders, ...csvRows].map(row => row.join(",")).join("\n");
                  const blob = new Blob([csv], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `pickup-records-page-${page}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                disabled={pickups.length === 0}
              >
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading pickup records...</p>
              </div>
            ) : pickups.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No pickup records found</p>
              </div>
            ) : (
              <>
                <SortableTable
                  data={pickups}
                  keyExtractor={(pickup: any) => pickup._id}
                  columns={[
                    {
                      key: "buildingId",
                      label: "Building ID",
                      sortable: true,
                      render: (pickup: any) => pickup.buildingId || "N/A",
                    },
                    {
                      key: "lotCode",
                      label: "Lot",
                      sortable: true,
                      render: (pickup: any) => {
                        // Prefer the dedicated lotCode field; fall back to parsing buildingId
                        if (pickup.lotCode) {
                          return <span className="font-mono text-sm font-semibold">{pickup.lotCode}</span>;
                        }
                        const buildingId = pickup.buildingId || "";
                        const parts = buildingId.trim().split(/\s+/);
                        const lotCode = parts.length >= 3 ? parts[parts.length - 1] : "N/A";
                        return <span className="font-mono text-sm font-semibold">{lotCode}</span>;
                      },
                    },
                    {
                      key: "lgaName",
                      label: "LGA",
                      sortable: true,
                      render: (pickup: any) => pickup.lgaName ? (
                        <span className="text-sm">{pickup.lgaName}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      ),
                    },
                    {
                      key: "wardName",
                      label: "Ward",
                      sortable: true,
                      render: (pickup: any) => pickup.wardName ? (
                        <span className="text-sm">{pickup.wardName}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      ),
                    },
                    {
                      key: "hasPhotos",
                      label: "Photos",
                      sortable: false,
                      render: (pickup: any) => {
                        const hasPhotos = (pickup.firstPhoto && pickup.firstPhoto !== "") || 
                                         (pickup.secondPhoto && pickup.secondPhoto !== "") ||
                                         pickup.firstPhotoUrl || pickup.secondPhotoUrl;
                        return hasPhotos ? (
                          <Badge variant="default" className="bg-green-600">✓</Badge>
                        ) : (
                          <Badge variant="secondary">No photos</Badge>
                        );
                      },
                    },
                    {
                      key: "nameBin",
                      label: "Bin Type",
                      sortable: true,
                      render: (pickup: any) => pickup.nameBin || "N/A",
                    },
                    {
                      key: "quantity",
                      label: "Quantity",
                      sortable: true,
                      render: (pickup: any) => pickup.quantity || 0,
                    },
                    {
                      key: "amount",
                      label: "Amount",
                      sortable: true,
                      render: (pickup: any) => (
                        <span className="font-semibold">₦{(pickup.amount || 0).toFixed(2)}</span>
                      ),
                    },
                    {
                      key: "isMonthly",
                      label: "Type",
                      sortable: true,
                      render: (pickup: any) => (
                        <Badge variant={pickup.isMonthly ? "default" : "secondary"}>
                          {pickup.isMonthly ? "Monthly" : "PAYT"}
                        </Badge>
                      ),
                    },
                    {
                      key: "source",
                      label: "Source",
                      sortable: true,
                      render: (pickup: any) => {
                        const source = pickup.source || "unknown";
                        const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
                          webapp_current: "default",
                          webapp_old: "secondary",
                          mobile_app: "outline",
                          unknown: "destructive",
                        };
                        const labels: Record<string, string> = {
                          webapp_current: "Webapp",
                          webapp_old: "Webapp (Old)",
                          mobile_app: "Mobile App",
                          unknown: "Unknown",
                        };
                        return (
                          <Badge variant={variants[source] || "secondary"}>
                            {labels[source] || source}
                          </Badge>
                        );
                      },
                    },
                    {
                      key: "submittedAt",
                      label: "Date",
                      sortable: true,
                      render: (pickup: any) => {
                        const date = pickup.submittedAt || pickup.pickUpDate || pickup.createdAt;
                        if (!date) return <span className="text-muted-foreground text-xs">—</span>;
                        return (
                          <span className="text-sm whitespace-nowrap">
                            {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        );
                      },
                    },
                    {
                      key: "actions",
                      label: "Actions",
                      sortable: false,
                      render: (pickup: any) => (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedPickupId(pickup._id)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View Details
                        </Button>
                      ),
                    },
                  ]}
                  emptyMessage="No pickup records found"
                />

                <div className="flex items-center justify-between mt-6 pt-6 border-t">
                  <div className="text-sm text-gray-600">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      Next <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pickup Details Modal */}
      <PickupDetailsModal
        pickupId={selectedPickupId}
        open={!!selectedPickupId}
        onClose={() => setSelectedPickupId(null)}
      />
    </div>
  );
}
