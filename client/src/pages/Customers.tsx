import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTable } from "@/components/SortableTable";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Upload, Download, ArrowLeftRight, User, Building2, MapPin, Eye } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Customer {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  address: string;
  lotCode: string;
  companyId: string;
  companyName?: string;
  status: 'active' | 'inactive';
  totalPickups: number;
  lastPickupDate?: Date;
  createdAt: Date;
  arcgisBuildingId?: string;
  linkedBuildingId?: string;
  lgaName?: string;
  lgaCode?: string;
  stateCode?: string;
  country?: string;
  wardCode?: string;
  wardName?: string;
}

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedLot, setSelectedLot] = useState<string>("all");
  const [arcgisFilter, setArcgisFilter] = useState<string>("");
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);
  const [drillDownBuildingId, setDrillDownBuildingId] = useState<string | null>(null);
  const PAGE_SIZE = 50;
  const [location, setLocation] = useLocation();

  // Read arcgisBuildingId from URL query params on mount (drill-down from Buildings page)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const buildingId = params.get("arcgisBuildingId");
    if (buildingId) {
      setArcgisFilter(buildingId);
      setDrillDownBuildingId(buildingId);
      setCurrentPage(1);
    }
  }, []);

  const utils = trpc.useUtils();
  
  // Fetch customers with filters
  const { data: customersData, isLoading } = trpc.customers.list.useQuery({
    search: searchQuery || undefined,
    companyId: selectedCompany !== "all" ? selectedCompany : undefined,
    lotCode: selectedLot !== "all" ? selectedLot : undefined,
    arcgisBuildingId: arcgisFilter || undefined,
    page: currentPage,
    limit: PAGE_SIZE,
  });

  const totalPages = customersData?.totalPages ?? 1;

  // Fetch companies for filter dropdown
  const { data: companies } = trpc.companies.list.useQuery();

  // Get unique lots from customers
  // Unwrap paginated response — the router returns { customers, total, page, ... }
  const customers = customersData?.customers;
  const customersTotal = customersData?.total ?? 0;

  const uniqueLots = Array.from(new Set(customers?.map(c => c.lotCode) || []));

  const bulkUploadMutation = trpc.customers.bulkUpload.useMutation({
    onSuccess: (result) => {
      toast.success(`Bulk upload complete: ${result.created} created, ${result.updated} updated`);
      utils.customers.list.invalidate();
      setIsUploadDialogOpen(false);
      setCsvFile(null);
    },
    onError: (error) => {
      toast.error(`Bulk upload failed: ${error.message}`);
    },
  });

  const transferMutation = trpc.customers.transfer.useMutation({
    onSuccess: () => {
      toast.success("Customer transferred successfully");
      utils.customers.list.invalidate();
      setIsTransferDialogOpen(false);
      setSelectedCustomer(null);
    },
    onError: (error) => {
      toast.error(`Transfer failed: ${error.message}`);
    },
  });

  const handleBulkUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!csvFile) {
      toast.error("Please select a CSV file");
      return;
    }

    const text = await csvFile.text();
    bulkUploadMutation.mutate({ csvData: text });
  };

  const handleTransfer = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCustomer) return;

    const formData = new FormData(e.currentTarget);
    const targetCompanyId = formData.get('targetCompanyId') as string;

    transferMutation.mutate({
      customerId: selectedCustomer._id,
      targetCompanyId,
    });
  };

  const downloadTemplate = () => {
    const template = "name,email,phone,address,lotCode,companyId\nJohn Doe,john@example.com,+2348012345678,123 Main St,LOT-221,MOTTAINAI\n";
    const blob = new Blob([template], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customer_upload_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading customers...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto py-8">
        {drillDownBuildingId && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="flex-1">
              Showing customers for building: <strong>{drillDownBuildingId}</strong>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-blue-700 hover:bg-blue-100"
              onClick={() => {
                setDrillDownBuildingId(null);
                setArcgisFilter("");
                setCurrentPage(1);
                setLocation("/customers");
              }}
            >
              Clear filter
            </Button>
          </div>
        )}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold">Customer Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage customers, bulk uploads, and transfers
            </p>
          </div>

          <div className="flex gap-2">
            <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Bulk Upload
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Bulk Upload Customers</DialogTitle>
                  <DialogDescription>
                    Upload a CSV file to create or update multiple customers at once
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleBulkUpload}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="csvFile">CSV File</Label>
                      <Input
                        id="csvFile"
                        type="file"
                        accept=".csv"
                        onChange={(e) => setCsvFile(e.target.files?.[0] || null)}
                        required
                      />
                      <p className="text-sm text-muted-foreground">
                        Required columns: name, address, lotCode, companyId
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={downloadTemplate}
                      className="w-full"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download CSV Template
                    </Button>
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsUploadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={bulkUploadMutation.isPending}>
                      {bulkUploadMutation.isPending ? "Uploading..." : "Upload"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  placeholder="Search by name, email, phone..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company-filter">Company</Label>
                <Select value={selectedCompany} onValueChange={(v) => { setSelectedCompany(v); setCurrentPage(1); }}>
                  <SelectTrigger id="company-filter">
                    <SelectValue placeholder="All Companies" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Companies</SelectItem>
                    {companies?.map(company => (
                      <SelectItem key={company.companyId} value={company.companyId}>
                        {company.companyName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lot-filter">Lot</Label>
                <Select value={selectedLot} onValueChange={(v) => { setSelectedLot(v); setCurrentPage(1); }}>
                  <SelectTrigger id="lot-filter">
                    <SelectValue placeholder="All Lots" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Lots</SelectItem>
                    {uniqueLots.map(lot => (
                      <SelectItem key={lot} value={lot}>
                        {lot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="arcgis-filter" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-blue-500" />
                  ArcGIS Building ID
                </Label>
                <Input
                  id="arcgis-filter"
                  placeholder="e.g. 8038 LASIKA06 006"
                  value={arcgisFilter}
                  onChange={(e) => { setArcgisFilter(e.target.value); setCurrentPage(1); }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Customers</CardTitle>
              <User className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{customersTotal}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
              <User className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {customers?.filter(c => c.status === 'active').length || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(customers?.map(c => c.companyId)).size || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customer Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customers ({customersTotal})</CardTitle>
          </CardHeader>
          <CardContent>
            <SortableTable
              data={customers || []}
              keyExtractor={(customer) => customer._id}
              columns={[
                {
                  key: "name",
                  label: "Name",
                  sortable: true,
                  render: (customer) => <span className="font-medium">{customer.name}</span>,
                },
                {
                  key: "email",
                  label: "Contact",
                  sortable: true,
                  render: (customer) => (
                    <div className="text-sm">
                      {customer.email && <div>{customer.email}</div>}
                      {customer.phone && <div className="text-muted-foreground">{customer.phone}</div>}
                    </div>
                  ),
                },
                {
                  key: "address",
                  label: "Address",
                  sortable: true,
                  render: (customer) => <span className="max-w-xs truncate block">{customer.address}</span>,
                },
                {
                  key: "lotCode",
                  label: "Lot",
                  sortable: true,
                  render: (customer) => <Badge variant="outline">{customer.lotCode}</Badge>,
                },
                {
                  key: "companyName",
                  label: "Company",
                  sortable: true,
                  render: (customer) => customer.companyName || customer.companyId,
                },
                {
                  key: "totalPickups",
                  label: "Pickups",
                  sortable: true,
                  render: (customer) => customer.totalPickups,
                },
                {
                  key: "status",
                  label: "Status",
                  sortable: true,
                  render: (customer) => (
                    <Badge variant={customer.status === "active" ? "default" : "secondary"}>
                      {customer.status}
                    </Badge>
                  ),
                },
                {
                  key: "arcgisBuildingId",
                  label: "ArcGIS Building ID",
                  sortable: true,
                  render: (customer) => customer.arcgisBuildingId ? (
                    <span className="font-mono text-xs flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-blue-500 shrink-0" />
                      {customer.arcgisBuildingId}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  ),
                },
                {
                  key: "createdAt",
                  label: "Registered",
                  sortable: true,
                  render: (customer) => customer.createdAt ? (
                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(customer.createdAt), "MMM d, yyyy")}
                    </span>
                  ) : "—",
                },
                {
                  key: "lastPickupDate",
                  label: "Last Pickup",
                  sortable: true,
                  render: (customer) => customer.lastPickupDate ? (
                    <span className="text-sm whitespace-nowrap">
                      {format(new Date(customer.lastPickupDate), "MMM d, yyyy")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-xs">Never</span>
                  ),
                },
                {
                  key: "actions",
                  label: "Actions",
                  sortable: false,
                  render: (customer) => (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setDetailCustomer(customer);
                          setIsDetailDialogOpen(true);
                        }}
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setIsTransferDialogOpen(true);
                        }}
                        title="Transfer customer"
                      >
                        <ArrowLeftRight className="h-4 w-4" />
                      </Button>
                    </div>
                  ),
                },
              ]}
              emptyMessage="No customers found"
            />

            {customersTotal === 0 && !isLoading && (
              <div className="text-center py-8 text-muted-foreground">
                No customers found. Upload customers using the Bulk Upload button.
              </div>
            )}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} &mdash; {customersTotal} total customers
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Customer Detail Dialog */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Customer Details</DialogTitle>
              <DialogDescription>Full record for {detailCustomer?.name}</DialogDescription>
            </DialogHeader>
            {detailCustomer && (
              <div className="space-y-3 py-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-muted-foreground">Name</span><p className="font-medium">{detailCustomer.name}</p></div>
                  <div><span className="text-muted-foreground">Status</span><p><Badge variant={detailCustomer.status === 'active' ? 'default' : 'secondary'}>{detailCustomer.status}</Badge></p></div>
                  <div><span className="text-muted-foreground">Email</span><p className="font-medium">{detailCustomer.email || '—'}</p></div>
                  <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{detailCustomer.phone || '—'}</p></div>
                  <div className="col-span-2"><span className="text-muted-foreground">Address</span><p className="font-medium">{detailCustomer.address}</p></div>
                  <div><span className="text-muted-foreground">Lot Code</span><p className="font-medium"><Badge variant="outline">{detailCustomer.lotCode}</Badge></p></div>
                  <div><span className="text-muted-foreground">Company</span><p className="font-medium">{detailCustomer.companyName || detailCustomer.companyId}</p></div>
                  <div><span className="text-muted-foreground">Total Pickups</span><p className="font-medium">{detailCustomer.totalPickups}</p></div>
                  <div><span className="text-muted-foreground">Last Pickup</span><p className="font-medium">{detailCustomer.lastPickupDate ? format(new Date(detailCustomer.lastPickupDate), 'MMM d, yyyy') : '—'}</p></div>
                  <div><span className="text-muted-foreground">Registered</span><p className="font-medium">{detailCustomer.createdAt ? format(new Date(detailCustomer.createdAt), 'MMM d, yyyy') : '—'}</p></div>
                  <div><span className="text-muted-foreground">Customer ID</span><p className="font-mono text-xs">{detailCustomer._id}</p></div>
                </div>
                {/* ArcGIS Building ID */}
                <div className="rounded-md border p-3 bg-muted/40">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">ArcGIS Building ID</span>
                  </div>
                  {detailCustomer.arcgisBuildingId ? (
                    <p className="font-mono text-sm text-blue-700 break-all">{detailCustomer.arcgisBuildingId}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not linked to any ArcGIS polygon</p>
                  )}
                  {detailCustomer.linkedBuildingId && (
                    <p className="text-xs text-muted-foreground mt-1">Linked Building: {detailCustomer.linkedBuildingId}</p>
                  )}
                </div>
                {/* Geographic Fields */}
                {(detailCustomer.lgaName || detailCustomer.wardName || detailCustomer.stateCode) && (
                  <div className="rounded-md border p-3 bg-muted/40">
                    <div className="flex items-center gap-2 mb-2">
                      <MapPin className="h-4 w-4 text-green-500" />
                      <span className="text-sm font-medium">Geographic Information</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {detailCustomer.lgaName && (
                        <div>
                          <span className="text-muted-foreground">LGA</span>
                          <p className="font-medium">{detailCustomer.lgaName}{detailCustomer.lgaCode ? ` (${detailCustomer.lgaCode})` : ""}</p>
                        </div>
                      )}
                      {detailCustomer.wardName && (
                        <div>
                          <span className="text-muted-foreground">Ward</span>
                          <p className="font-medium">{detailCustomer.wardName}{detailCustomer.wardCode ? ` (${detailCustomer.wardCode})` : ""}</p>
                        </div>
                      )}
                      {detailCustomer.stateCode && (
                        <div>
                          <span className="text-muted-foreground">State</span>
                          <p className="font-medium">{detailCustomer.stateCode}</p>
                        </div>
                      )}
                      {detailCustomer.country && (
                        <div>
                          <span className="text-muted-foreground">Country</span>
                          <p className="font-medium">{detailCustomer.country}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
              {detailCustomer && (
                <Button onClick={() => {
                  setIsDetailDialogOpen(false);
                  setSelectedCustomer(detailCustomer);
                  setIsTransferDialogOpen(true);
                }}>Transfer Customer</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Transfer Dialog */}
        <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Transfer Customer</DialogTitle>
              <DialogDescription>
                Transfer {selectedCustomer?.name} to a different company
              </DialogDescription>
            </DialogHeader>
            {selectedCustomer && (
              <form onSubmit={handleTransfer}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Current Company</Label>
                    <Input value={selectedCustomer.companyName || selectedCustomer.companyId} disabled />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="targetCompanyId">Target Company *</Label>
                    <Select name="targetCompanyId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target company" />
                      </SelectTrigger>
                      <SelectContent>
                        {companies
                          ?.filter(c => c.companyId !== selectedCustomer.companyId)
                          .map(company => (
                            <SelectItem key={company.companyId} value={company.companyId}>
                              {company.companyName} ({company.companyId})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Customer will be permanently transferred to the selected company
                    </p>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsTransferDialogOpen(false);
                      setSelectedCustomer(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={transferMutation.isPending}>
                    {transferMutation.isPending ? "Transferring..." : "Transfer Customer"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
