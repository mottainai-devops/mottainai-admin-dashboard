import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { trpc } from "@/lib/trpc";

export interface PickupFilters {
  dateFrom?: Date;
  dateTo?: Date;
  companyId?: string;
  fieldWorkerId?: string;
  lotId?: string;
  binType?: string;
  paymentType?: "PAYT" | "Monthly" | "all";
  source?: "webapp_current" | "webapp_old" | "mobile_app" | "unknown" | "all";
  arcgisBuildingId?: string;
}

interface PickupFiltersProps {
  filters: PickupFilters;
  onFiltersChange: (filters: PickupFilters) => void;
}

export function PickupFiltersComponent({ filters, onFiltersChange }: PickupFiltersProps) {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(filters.dateFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(filters.dateTo);

  const { data: companies } = trpc.companies.list.useQuery();
  const { data: filterOptions } = trpc.pickups.getFilterOptions.useQuery();
  
  // Fetch field workers when a company is selected
  const { data: fieldWorkers } = trpc.maf.getFieldWorkers.useQuery(
    { companyId: filters.companyId! },
    { enabled: !!filters.companyId } // Only fetch when company is selected
  );
  
  const binTypes = filterOptions?.binTypes || [];
  const availableLots = filterOptions?.lots || [];

  const handleApplyFilters = () => {
    onFiltersChange({
      ...filters,
      dateFrom,
      dateTo,
    });
  };

  const handleClearFilters = () => {
    setDateFrom(undefined);
    setDateTo(undefined);
    onFiltersChange({
      dateFrom: undefined,
      dateTo: undefined,
      companyId: undefined,
      fieldWorkerId: undefined,
      lotId: undefined,
      binType: undefined,
      paymentType: "all",
      source: "all",
    });
  };

  const hasActiveFilters = 
    dateFrom || dateTo || filters.companyId || filters.fieldWorkerId || filters.lotId || filters.binType || 
    (filters.paymentType && filters.paymentType !== "all") || (filters.source && filters.source !== "all") ||
    filters.arcgisBuildingId;

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Date Range - From */}
          <div className="space-y-2">
            <Label>Date From</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateFrom ? format(dateFrom, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateFrom}
                  onSelect={setDateFrom}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Date Range - To */}
          <div className="space-y-2">
            <Label>Date To</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dateTo ? format(dateTo, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dateTo}
                  onSelect={setDateTo}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Company Filter (MAF) */}
          <div className="space-y-2">
            <Label>Company (MAF)</Label>
            <Select
              value={filters.companyId || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  companyId: value === "all" ? undefined : value,
                  fieldWorkerId: undefined, // Reset field worker when company changes
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {Array.isArray(companies) && companies.map((company) => (
                  <SelectItem key={company._id} value={company._id}>
                    {company.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Field Worker Filter */}
          <div className="space-y-2">
            <Label>Field Worker</Label>
            <Select
              value={filters.fieldWorkerId || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  fieldWorkerId: value === "all" ? undefined : value,
                })
              }
              disabled={!filters.companyId}
            >
              <SelectTrigger>
                <SelectValue placeholder={filters.companyId ? "All Field Workers" : "Select Company First"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Field Workers</SelectItem>
                {Array.isArray(fieldWorkers) && fieldWorkers.map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}>
                    {worker.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Lot Filter */}
          <div className="space-y-2">
            <Label>Lot</Label>
            <Select
              value={filters.lotId || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  lotId: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Lots" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lots</SelectItem>
                {Array.isArray(availableLots) && availableLots.map((lot) => (
                  <SelectItem key={lot} value={lot}>
                    {lot}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Bin Type Filter */}
          <div className="space-y-2">
            <Label>Bin Type</Label>
            <Select
              value={filters.binType || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  binType: value === "all" ? undefined : value,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Bin Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Bin Types</SelectItem>
                {binTypes.map((binType) => (
                  <SelectItem key={binType} value={binType}>
                    {binType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Type Filter */}
          <div className="space-y-2">
            <Label>Payment Type</Label>
            <Select
              value={filters.paymentType || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  paymentType: value as "PAYT" | "Monthly" | "all",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PAYT">PAYT</SelectItem>
                <SelectItem value="Monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* ArcGIS Building ID Filter */}
          <div className="space-y-2">
            <Label>ArcGIS Building ID</Label>
            <Input
              type="text"
              placeholder="e.g. 8038 LASIKA06 006"
              value={filters.arcgisBuildingId || ""}
              onChange={(e) =>
                onFiltersChange({
                  ...filters,
                  arcgisBuildingId: e.target.value || undefined,
                })
              }
            />
          </div>

          {/* Source Filter */}
          <div className="space-y-2">
            <Label>Source</Label>
            <Select
              value={filters.source || "all"}
              onValueChange={(value) =>
                onFiltersChange({
                  ...filters,
                  source: value as "webapp_current" | "webapp_old" | "mobile_app" | "unknown" | "all",
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="All Sources" />
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
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button onClick={handleApplyFilters} className="flex-1 md:flex-none">
            Apply Filters
          </Button>
          {hasActiveFilters && (
            <Button
              variant="outline"
              onClick={handleClearFilters}
              className="flex-1 md:flex-none"
            >
              <X className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          )}
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-4 text-sm text-muted-foreground">
            <span className="font-medium">Active filters:</span>
            {dateFrom && <span className="ml-2">From: {format(dateFrom, "PP")}</span>}
            {dateTo && <span className="ml-2">To: {format(dateTo, "PP")}</span>}
            {filters.companyId && <span className="ml-2">Company selected</span>}
            {filters.lotId && <span className="ml-2">Lot selected</span>}
            {filters.binType && <span className="ml-2">Bin: {filters.binType}</span>}
            {filters.arcgisBuildingId && <span className="ml-2">ArcGIS ID: {filters.arcgisBuildingId}</span>}
            {filters.paymentType && filters.paymentType !== "all" && (
              <span className="ml-2">Type: {filters.paymentType}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
