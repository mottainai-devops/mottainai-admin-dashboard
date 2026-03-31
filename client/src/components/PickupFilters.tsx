import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Filter, X } from "lucide-react";

export interface PickupFilters {
  paymentType?: "all" | "payt" | "monthly";
  source?: "all" | "survey123" | "manual";
  arcgisBuildingId?: string;
  dateFrom?: string;
  dateTo?: string;
  companyId?: string;
}

interface PickupFiltersComponentProps {
  filters: PickupFilters;
  onFiltersChange: (filters: PickupFilters) => void;
}

export function PickupFiltersComponent({ filters, onFiltersChange }: PickupFiltersComponentProps) {
  const hasActiveFilters =
    (filters.paymentType && filters.paymentType !== "all") ||
    (filters.source && filters.source !== "all") ||
    filters.arcgisBuildingId ||
    filters.dateFrom ||
    filters.dateTo;

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
          <div className="flex flex-col gap-1 min-w-[140px]">
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
                <SelectItem value="survey123">Survey123</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
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
