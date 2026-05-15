import { useState, useEffect } from "react";
import { buildViewSwitchUrl, paramsToFilters } from "@/lib/filterUrlParams";
import { Header } from "@/components/Header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Search, Package, ChevronLeft, ChevronRight, Download, Eye, List, Map } from "lucide-react";
import { SortableTable, Column } from "@/components/SortableTable";
import { Badge } from "@/components/ui/badge";
import { PickupFiltersComponent, PickupFilters } from "@/components/PickupFilters";
import { PickupDetailsModal } from "@/components/PickupDetailsModal";
import { Loader2 } from "lucide-react";

// ── Full-export CSV button ───────────────────────────────────────────────────
function ExportAllCsvButton({ filters, searchTerm, total }: { filters: PickupFilters; searchTerm: string; total: number }) {
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();

  const handleExport = async () => {
    setExporting(true);
    try {
      const result = await utils.pickups.exportCsv.fetch({
        search: searchTerm || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
        companyId: filters.companyId,
        lotId: filters.lotId,
        binType: filters.binType,
        paymentType: filters.paymentType === "all" ? undefined : filters.paymentType,
        source: filters.source === "all" ? undefined : filters.source,
        arcgisBuildingId: filters.arcgisBuildingId,
      });
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().substring(0, 10);
      a.download = `pickup-records-${dateStr}-${result.total}-rows.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("CSV export failed", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting || total === 0}>
      {exporting ? (
        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Exporting {total.toLocaleString()} rows…</>
      ) : (
        <><Download className="h-4 w-4 mr-2" />Export CSV ({total.toLocaleString()})</>
      )}
    </Button>
  );
}
// ────────────────────────────────────────────────────────────────────────────

export default function PickupRecords() {
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const [selectedPickupId, setSelectedPickupId] = useState<string | null>(null);

  // Deserialise all filter params from URL (supports drill-down from Buildings page
  // and round-trip navigation from Map View).
  const [filters, setFilters] = useState<PickupFilters>(() =>
    paramsToFilters(new URLSearchParams(window.location.search))
  );
  // Convenience alias used by the drill-down banner
  const prefilledBuildingId = filters.arcgisBuildingId;
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
          <p className="text-gray-600">View all pickup records from all channels (web form, mobile app, Survey123)</p>
        </div>

        {/* Drill-down banner when navigated from Buildings page */}
        {prefilledBuildingId && (
          <div className="mb-6 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-blue-800">
              <Package className="h-4 w-4" />
              <span>Showing pickups filtered by Customer ID: <strong className="font-mono">{prefilledBuildingId}</strong></span>
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
                placeholder="Search by customer ID, split code, or bin type..."
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
                <CardDescription>All pickup records from all channels (web form, mobile app, Survey123)</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {/* View toggle: List View (active) | Map View */}
                <div className="flex items-center rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                  <span className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white select-none">
                    <List className="h-3.5 w-3.5" />
                    List View
                  </span>
                  <button
                    onClick={() => { window.location.href = buildViewSwitchUrl("/map-view", filters); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-white text-gray-600 hover:bg-gray-50 hover:text-blue-600 transition-colors border-l border-gray-200"
                    title="Switch to Map View (filters are preserved)"
                  >
                    <Map className="h-3.5 w-3.5" />
                    Map View
                  </button>
                </div>

<ExportAllCsvButton filters={filters} searchTerm={searchTerm} total={total} />
              </div>
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
                      label: "Customer ID",
                      sortable: true,
                      render: (pickup: any) => pickup.buildingId || "N/A",
                    },
                    {
                      key: "customerName",
                      label: "Customer / Business Name",
                      sortable: true,
                      render: (pickup: any) => pickup.customerName ? (
                        <span className="text-sm font-medium max-w-[180px] truncate block" title={pickup.customerName}>
                          {pickup.customerName}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      ),
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
                      key: "billingType",
                      label: "Billing Type",
                      sortable: true,
                      render: (pickup: any) => {
                        const bt = pickup.billingType || (pickup.isMonthly ? "Monthly - Residential" : "PAYT - Residential");
                        const isMonthly = bt.startsWith("Monthly");
                        const isBusiness = bt.includes("Business");
                        const isFixed = pickup.isFixedBilling === true;
                        return (
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Badge
                                variant={isMonthly ? "default" : "secondary"}
                                className={isMonthly ? "bg-blue-600 text-white text-xs" : "bg-amber-100 text-amber-800 border-amber-300 text-xs"}
                              >
                                {isMonthly ? "Monthly" : "PAYT"}
                              </Badge>
                              {isFixed && (
                                <Badge className="bg-emerald-600 text-white text-xs" title="Customer has an active Fixed Billing agreement">
                                  Fixed
                                </Badge>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground">{isBusiness ? "Business" : "Residential"}</span>
                          </div>
                        );
                      },
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
                          survey123: "outline",
                          unknown: "destructive",
                        };
                        const labels: Record<string, string> = {
                          webapp_current: "Web Form",
                          webapp_old: "Web Form (Legacy)",
                          mobile_app: "Mobile App",
                          survey123: "Survey123",
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
                        const rawDate = pickup.submittedAt || pickup.pickUpDate || pickup.createdAt;
                        if (!rawDate) return <span className="text-muted-foreground text-xs">—</span>;
                        // Handle Unix timestamp stored as string (e.g. "1774987140000")
                        const dateVal = typeof rawDate === 'string' && /^\d{10,13}$/.test(rawDate.trim())
                          ? new Date(parseInt(rawDate, 10))
                          : new Date(rawDate);
                        if (isNaN(dateVal.getTime())) return <span className="text-muted-foreground text-xs">—</span>;
                        return (
                          <span className="text-sm whitespace-nowrap">
                            {dateVal.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
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
