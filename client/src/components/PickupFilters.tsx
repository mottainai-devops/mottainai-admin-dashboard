import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";
import { trpc } from "@/lib/trpc";

export interface PickupFilters {
  paymentType?: "all" | "payt" | "monthly";
  source?: "all" | "webapp_current" | "webapp_old" | "mobile_app" | "unknown";
  arcgisBuildingId?: string;
  dateFrom?: string;
  dateTo?: string;
  companyId?: string;
  lotId?: string;
  binType?: string;
}

interface PickupFiltersComponentProps {
  filters: PickupFilters;
  onFiltersChange: (filters: PickupFilters) => void;
}

export function PickupFiltersComponent({ filters, onFiltersChange }: PickupFiltersComponentProps) {
  const { data: filterOptions } = trpc.pickups.getFilterOptions.useQuery();

  const hasActiveFilters =
    (filters.paymentType && filters.paymentType !== "all") ||
    (filters.source && filters.source !== "all") ||
    filters.arcgisBuildingId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.companyId ||
    filters.lotId ||
    filters.binType;

  const clearFilters = () => {
    onFiltersChange({ paymentType: "all", source: "all" });
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-1">
            <Filter className="h-4 w-4" />
            Filters
          </div>

          {/* Payment Type */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <Label className="text-xs text-muted-foreground">Payment Type</Label>
            <Select
              value={filters.paymentType || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, paymentType: v as PickupFilters["paymentType"] })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="payt">PAYT</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          <div className="flex flex-col gap-1 min-w-[150px]">
            <Label className="text-xs text-muted-foreground">Source</Label>
            <Select
              value={filters.source || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, source: v as PickupFilters["source"] })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="webapp_current">Webapp (Current)</SelectItem>
                <SelectItem value="webapp_old">Webapp (Old)</SelectItem>
                <SelectItem value="mobile_app">Mobile App</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Company / MAF */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Company / MAF</Label>
            <Select
              value={filters.companyId || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, companyId: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {(filterOptions?.companies || []).map((c: { id: string; name: string }) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lot */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <Label className="text-xs text-muted-foreground">Lot</Label>
            <Select
              value={filters.lotId || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, lotId: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="All Lots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lots</SelectItem>
                {(filterOptions?.lots || []).map((lot: string) => (
                  <SelectItem key={lot} value={lot}>{lot}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bin Type */}
          <div className="flex flex-col gap-1 min-w-[160px]">
            <Label className="text-xs text-muted-foreground">Bin Type</Label>
            <Select
              value={filters.binType || "all"}
              onValueChange={(v) => onFiltersChange({ ...filters, binType: v === "all" ? undefined : v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="All Bin Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bin Types</SelectItem>
                {(filterOptions?.binTypes || []).map((bt: string) => (
                  <SelectItem key={bt} value={bt}>{bt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Building ID filter */}
          <div className="flex flex-col gap-1 min-w-[180px]">
            <Label className="text-xs text-muted-foreground">Building ID</Label>
            <Input
              className="h-8 text-sm"
              placeholder="e.g. 75541 OYSISW04 223"
              value={filters.arcgisBuildingId || ""}
              onChange={(e) => onFiltersChange({ ...filters, arcgisBuildingId: e.target.value || undefined })}
            />
          </div>

          {/* Date From */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <Label className="text-xs text-muted-foreground">From Date</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={filters.dateFrom || ""}
              onChange={(e) => onFiltersChange({ ...filters, dateFrom: e.target.value || undefined })}
            />
          </div>

          {/* Date To */}
          <div className="flex flex-col gap-1 min-w-[140px]">
            <Label className="text-xs text-muted-foreground">To Date</Label>
            <Input
              type="date"
              className="h-8 text-sm"
              value={filters.dateTo || ""}
              onChange={(e) => onFiltersChange({ ...filters, dateTo: e.target.value || undefined })}
            />
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-muted-foreground" onClick={clearFilters}>
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
