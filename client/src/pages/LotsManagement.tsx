import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { MapPin, Building2, Search, Loader2 } from "lucide-react";

export default function LotsManagement() {
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Fetch all companies for the filter dropdown
  const { data: companies, isLoading: loadingCompanies } = trpc.companies.list.useQuery();

  // Fetch lots filtered by selected company
  const { data: lotsData, isLoading: loadingLots } = trpc.lots.adminList.useQuery(
    {
      companyId: selectedCompanyId === "all" ? undefined : selectedCompanyId,
    },
    { keepPreviousData: true }
  );

  const lots = lotsData?.lots ?? [];

  // Client-side search filter on top of server-side company filter
  const filteredLots = lots.filter((lot) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      lot.lotCode.toLowerCase().includes(q) ||
      lot.lotName.toLowerCase().includes(q) ||
      lot.companyName.toLowerCase().includes(q)
    );
  });

  const selectedCompanyName =
    selectedCompanyId === "all"
      ? "All Companies"
      : (companies as any[])?.find((c: any) => c._id === selectedCompanyId)?.companyName ?? "Selected Company";

  return (
    <DashboardLayout>
      <div className="container py-6 space-y-6">
        {/* Page Header */}
        <div className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Lots Management</h1>
            <p className="text-muted-foreground text-sm">
              View and filter operational lots by company
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Lots</CardDescription>
              <CardTitle className="text-3xl">
                {loadingLots ? <Loader2 className="w-6 h-6 animate-spin" /> : lotsData?.totalCount ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Filtered Lots</CardDescription>
              <CardTitle className="text-3xl">
                {loadingLots ? <Loader2 className="w-6 h-6 animate-spin" /> : filteredLots.length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Companies</CardDescription>
              <CardTitle className="text-3xl">
                {loadingCompanies ? <Loader2 className="w-6 h-6 animate-spin" /> : (companies as any[])?.length ?? 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Company Filter */}
              <div className="space-y-1.5">
                <Label>Company</Label>
                <Select
                  value={selectedCompanyId}
                  onValueChange={(val) => setSelectedCompanyId(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {Array.isArray(companies) &&
                      (companies as any[]).map((company: any) => (
                        <SelectItem key={company._id} value={company._id}>
                          {company.companyName}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search Filter */}
              <div className="space-y-1.5">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    placeholder="Search by lot code or name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Active filter badge */}
            {selectedCompanyId !== "all" && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Showing lots for:</span>
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {selectedCompanyName}
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lots Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Operational Lots
              {!loadingLots && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({filteredLots.length} {filteredLots.length === 1 ? "lot" : "lots"})
                </span>
              )}
            </CardTitle>
            <CardDescription>
              {lotsData?.message ?? "Operational lots from all active companies"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingLots ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading lots...</span>
              </div>
            ) : filteredLots.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MapPin className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="font-medium">No lots found</p>
                <p className="text-sm">
                  {selectedCompanyId !== "all"
                    ? "This company has no operational lots assigned."
                    : "No operational lots are configured yet."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lot Code</TableHead>
                      <TableHead>Lot Name</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Payt Webhook</TableHead>
                      <TableHead>Monthly Webhook</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLots.map((lot) => (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {lot.lotCode}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">{lot.lotName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-sm">{lot.companyName}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {lot.paytWebhook ? (
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px] block">
                              {lot.paytWebhook}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lot.monthlyWebhook ? (
                            <span className="text-xs font-mono text-muted-foreground truncate max-w-[180px] block">
                              {lot.monthlyWebhook}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">Not set</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
