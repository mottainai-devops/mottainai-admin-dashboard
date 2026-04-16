import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Smartphone, Send, Users, ClipboardList, CheckCircle2, XCircle, Loader2, RefreshCw, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

// ── Types ─────────────────────────────────────────────────────────────────────
interface CustomerAccount {
  _id: string;
  phone: string;
  fullName?: string;
  email?: string;
  buildingIds?: string[];
  activeBuildingId?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface PickupRequest {
  _id: string;
  customerAccountId: string;
  buildingId?: string;
  binType: string;
  quantity: number;
  preferredDate: string;
  notes?: string;
  status: "pending" | "confirmed" | "cancelled";
  createdAt: string;
  adminNotes?: string;
}

interface AppInvite {
  _id: string;
  phone: string;
  buildingId?: string;
  customerName?: string;
  sentBy: string;
  status: "sent" | "failed";
  createdAt: string;
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function CustomerApp() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Smartphone className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer App</h1>
            <p className="text-sm text-muted-foreground">
              Manage customer app accounts, pickup requests, and send app invites
            </p>
          </div>
        </div>

        <Tabs defaultValue="accounts">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="accounts">
              <Users className="h-4 w-4 mr-2" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="pickup-requests">
              <ClipboardList className="h-4 w-4 mr-2" />
              Pickup Requests
            </TabsTrigger>
            <TabsTrigger value="invites">
              <Send className="h-4 w-4 mr-2" />
              Send Invites
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="mt-4">
            <AccountsTab />
          </TabsContent>
          <TabsContent value="pickup-requests" className="mt-4">
            <PickupRequestsTab />
          </TabsContent>
          <TabsContent value="invites" className="mt-4">
            <InvitesTab />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

// ── Accounts Tab ──────────────────────────────────────────────────────────────
function AccountsTab() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, refetch } = trpc.customerApp.listAccounts.useQuery(
    { search: debouncedSearch, page: 1, limit: 100 },
    { refetchOnWindowFocus: false }
  );

  const handleSearch = (value: string) => {
    setSearch(value);
    const t = setTimeout(() => setDebouncedSearch(value), 400);
    return () => clearTimeout(t);
  };

  const accounts: CustomerAccount[] = data?.accounts ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Customer App Accounts</CardTitle>
            <CardDescription>
              {data?.pagination?.total ?? 0} registered accounts
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by phone, name, or building ID..."
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Smartphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p>No customer app accounts yet</p>
            <p className="text-sm mt-1">Send invites to get customers onboarded</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Building IDs</TableHead>
                <TableHead>Registered</TableHead>
                <TableHead>Last Login</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((acc) => (
                <TableRow key={acc._id}>
                  <TableCell className="font-mono text-sm">{acc.phone}</TableCell>
                  <TableCell>{acc.fullName || <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(acc.buildingIds ?? []).map((id) => (
                        <Badge key={id} variant="secondary" className="text-xs">
                          {id}
                        </Badge>
                      ))}
                      {(!acc.buildingIds || acc.buildingIds.length === 0) && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(acc.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {acc.lastLoginAt
                      ? new Date(acc.lastLoginAt).toLocaleDateString()
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── Pickup Requests Tab ───────────────────────────────────────────────────────
function PickupRequestsTab() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "confirmed" | "cancelled" | "all">("pending");
  const [selectedRequest, setSelectedRequest] = useState<PickupRequest | null>(null);
  const [dialogAction, setDialogAction] = useState<"confirm" | "cancel" | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const { data, isLoading, refetch } = trpc.customerApp.listPickupRequests.useQuery(
    { status: statusFilter, page: 1, limit: 100 },
    { refetchOnWindowFocus: false }
  );

  const updateMutation = trpc.customerApp.updatePickupRequest.useMutation({
    onSuccess: () => {
      toast.success(`Request ${dialogAction === "confirm" ? "confirmed" : "cancelled"} successfully.`);
      setSelectedRequest(null);
      setDialogAction(null);
      setAdminNotes("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const requests: PickupRequest[] = data?.requests ?? [];

  const statusBadge = (status: string) => {
    if (status === "pending") return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Pending</Badge>;
    if (status === "confirmed") return <Badge variant="outline" className="border-green-500 text-green-600">Confirmed</Badge>;
    return <Badge variant="outline" className="border-red-500 text-red-600">Cancelled</Badge>;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Customer Pickup Requests</CardTitle>
              <CardDescription>
                Review and action pickup requests submitted via the customer app
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            {(["pending", "confirmed", "cancelled", "all"] as const).map((s) => (
              <Button
                key={s}
                variant={statusFilter === s ? "default" : "outline"}
                size="sm"
                onClick={() => setStatusFilter(s)}
                className="capitalize"
              >
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No {statusFilter === "all" ? "" : statusFilter} pickup requests</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Building ID</TableHead>
                  <TableHead>Bin Type</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Preferred Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.map((req) => (
                  <TableRow key={req._id}>
                    <TableCell className="font-mono text-sm">{req.buildingId || "—"}</TableCell>
                    <TableCell>{req.binType}</TableCell>
                    <TableCell>{req.quantity}</TableCell>
                    <TableCell>{new Date(req.preferredDate).toLocaleDateString()}</TableCell>
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {req.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-green-500 text-green-600 hover:bg-green-50"
                            onClick={() => { setSelectedRequest(req); setDialogAction("confirm"); }}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                            Confirm
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-400 text-red-500 hover:bg-red-50"
                            onClick={() => { setSelectedRequest(req); setDialogAction("cancel"); }}
                          >
                            <XCircle className="h-3.5 w-3.5 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Confirm / Cancel Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => { setSelectedRequest(null); setDialogAction(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogAction === "confirm" ? "Confirm Pickup Request" : "Cancel Pickup Request"}
            </DialogTitle>
            <DialogDescription>
              {dialogAction === "confirm"
                ? "This will confirm the pickup request and notify the customer."
                : "This will cancel the pickup request and notify the customer."}
            </DialogDescription>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span className="text-muted-foreground">Building ID</span>
                <span className="font-mono">{selectedRequest.buildingId || "—"}</span>
                <span className="text-muted-foreground">Bin Type</span>
                <span>{selectedRequest.binType}</span>
                <span className="text-muted-foreground">Preferred Date</span>
                <span>{new Date(selectedRequest.preferredDate).toLocaleDateString()}</span>
              </div>
              <div className="space-y-1">
                <Label htmlFor="adminNotes">Admin Notes (optional)</Label>
                <Input
                  id="adminNotes"
                  placeholder="Add a note for the customer..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedRequest(null); setDialogAction(null); }}>
              Back
            </Button>
            <Button
              variant={dialogAction === "confirm" ? "default" : "destructive"}
              disabled={updateMutation.isPending}
              onClick={() => {
                if (!selectedRequest || !dialogAction) return;
                updateMutation.mutate({
                  id: selectedRequest._id,
                  status: dialogAction === "confirm" ? "confirmed" : "cancelled",
                  adminNotes,
                });
              }}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {dialogAction === "confirm" ? "Confirm Request" : "Cancel Request"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Invites Tab ───────────────────────────────────────────────────────────────
function InvitesTab() {
  const [phone, setPhone] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const { data: invitesData, isLoading: invitesLoading, refetch } = trpc.customerApp.listInvites.useQuery(
    undefined,
    { refetchOnWindowFocus: false }
  );

  const sendMutation = trpc.customerApp.sendInvite.useMutation({
    onSuccess: (data: any) => {
      toast.success(`App invite sent to ${data.invite?.phone}`);
      setPhone("");
      setBuildingId("");
      setCustomerName("");
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const invites: AppInvite[] = invitesData?.invites ?? [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Send Invite Form */}
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-base">Send App Invite</CardTitle>
          <CardDescription>
            Send an SMS with the app download link to a customer
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="invitePhone">Phone Number *</Label>
            <Input
              id="invitePhone"
              placeholder="e.g. 08012345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Nigerian format (08xx, 07xx, 234xx)</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inviteBuildingId">Building ID (optional)</Label>
            <Input
              id="inviteBuildingId"
              placeholder="e.g. LGA-001-R1"
              value={buildingId}
              onChange={(e) => setBuildingId(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inviteName">Customer Name (optional)</Label>
            <Input
              id="inviteName"
              placeholder="e.g. Mr. Adeyemi"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            disabled={!phone || sendMutation.isPending}
            onClick={() => sendMutation.mutate({ phone, buildingId: buildingId || undefined, customerName: customerName || undefined })}
          >
            {sendMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Send Invite
          </Button>
        </CardContent>
      </Card>

      {/* Invite History */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Invite History</CardTitle>
              <CardDescription>{invites.length} invites sent</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {invitesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : invites.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p>No invites sent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Phone</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Building ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((inv) => (
                  <TableRow key={inv._id}>
                    <TableCell className="font-mono text-sm">{inv.phone}</TableCell>
                    <TableCell>{inv.customerName || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{inv.buildingId || "—"}</TableCell>
                    <TableCell>
                      {inv.status === "sent" ? (
                        <Badge variant="outline" className="border-green-500 text-green-600">Sent</Badge>
                      ) : (
                        <Badge variant="outline" className="border-red-400 text-red-500">Failed</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
