/**
 * Fixed Billing Admin Page
 *
 * Three tabs:
 * 1. Tariff Schedule — manage official approved prices per bin type + frequency
 * 2. Agreements — create/view/terminate per-customer fixed billing agreements
 * 3. Ledger — view monthly charges, outstanding balances, record payments
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  BadgeCheck,
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  XCircle,
} from "lucide-react";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (kobo: number) =>
  `₦${(kobo / 100).toLocaleString("en-NG", { minimumFractionDigits: 2 })}`;

const BIN_TYPES = ["120L", "240L", "660L", "1100L", "sachet", "other"] as const;
const FREQUENCIES = [
  { value: "once_weekly", label: "Once a week" },
  { value: "twice_weekly", label: "Twice a week" },
  { value: "thrice_weekly", label: "Three times a week" },
  { value: "daily", label: "Daily" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
] as const;

const CUSTOMER_TYPES = ["residential", "commercial", "industrial", "all"] as const;

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    paid: "bg-green-100 text-green-800",
    partial: "bg-yellow-100 text-yellow-800",
    unpaid: "bg-red-100 text-red-800",
    waived: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${map[status] ?? "bg-gray-100"}`}>
      {status}
    </span>
  );
};

// ─── Tariff Schedule Tab ──────────────────────────────────────────────────────

function TariffScheduleTab() {
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    tariffCode: "",
    label: "",
    binType: "240L",
    frequency: "once_weekly",
    binsCount: 1,
    monthlyPriceKobo: 0,
    customerType: "all",
    notes: "",
  });

  const { data, isLoading, refetch } = trpc.fixedBilling.listTariffs.useQuery({
    activeOnly: false,
  });

  const createMutation = trpc.fixedBilling.createTariff.useMutation({
    onSuccess: () => {
      toast.success("Tariff created");
      setShowCreate(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.fixedBilling.updateTariff.useMutation({
    onSuccess: () => {
      toast.success("Tariff updated");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Official Tariff Schedule</h2>
          <p className="text-sm text-muted-foreground">
            Approved prices per bin type and pickup frequency
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Add Tariff
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading tariffs…
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Bin Type</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Bins</TableHead>
                <TableHead>Customer Type</TableHead>
                <TableHead className="text-right">Monthly Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((t: any) => (
                <TableRow key={t._id}>
                  <TableCell className="font-mono text-xs">{t.tariffCode}</TableCell>
                  <TableCell>{t.label}</TableCell>
                  <TableCell>{t.binType}</TableCell>
                  <TableCell>
                    {FREQUENCIES.find((f) => f.value === t.frequency)?.label ?? t.frequency}
                  </TableCell>
                  <TableCell>{t.binsCount}</TableCell>
                  <TableCell className="capitalize">{t.customerType}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmt(t.monthlyPriceKobo)}
                  </TableCell>
                  <TableCell>
                    {t.active ? (
                      <Badge variant="outline" className="text-green-700 border-green-300">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-gray-500">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateMutation.mutate({ id: t._id, active: !t.active })
                      }
                    >
                      {t.active ? (
                        <XCircle className="w-4 h-4 text-red-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    No tariffs defined yet. Add the first one.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Create Tariff Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Tariff Schedule Entry</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label>Tariff Code</Label>
              <Input
                placeholder="e.g. RES-240L-2W"
                value={form.tariffCode}
                onChange={(e) => setForm({ ...form, tariffCode: e.target.value.toUpperCase() })}
              />
            </div>
            <div className="space-y-1">
              <Label>Label</Label>
              <Input
                placeholder="e.g. Residential 240L Twice Weekly"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Bin Type</Label>
              <Select
                value={form.binType}
                onValueChange={(v) => setForm({ ...form, binType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BIN_TYPES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Number of Bins</Label>
              <Input
                type="number"
                min={1}
                value={form.binsCount}
                onChange={(e) => setForm({ ...form, binsCount: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Customer Type</Label>
              <Select
                value={form.customerType}
                onValueChange={(v) => setForm({ ...form, customerType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CUSTOMER_TYPES.map((c) => (
                    <SelectItem key={c} value={c} className="capitalize">
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Official Monthly Price (₦)</Label>
              <Input
                type="number"
                min={0}
                placeholder="e.g. 5000"
                value={form.monthlyPriceKobo / 100 || ""}
                onChange={(e) =>
                  setForm({ ...form, monthlyPriceKobo: Math.round(parseFloat(e.target.value || "0") * 100) })
                }
              />
              <p className="text-xs text-muted-foreground">
                Enter in Naira — stored as kobo internally
              </p>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any additional notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate(form as any)}
              disabled={createMutation.isPending || !form.tariffCode || !form.label}
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Tariff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Agreements Tab ───────────────────────────────────────────────────────────

function AgreementsTab() {
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    customerId: "",
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    companyId: "",
    companyName: "",
    lotCode: "",
    tariffCode: "",
    binType: "240L",
    frequency: "once_weekly",
    binsCount: 1,
    officialMonthlyPriceKobo: 0,
    agreedMonthlyPriceKobo: 0,
    priceOverrideReason: "",
    startDate: new Date().toISOString().split("T")[0],
    notifyBySms: true,
    notifyByEmail: true,
    notes: "",
  });

  const { data, isLoading, refetch } = trpc.fixedBilling.listAgreements.useQuery({
    activeOnly: false,
    page,
    limit: 50,
  });

  const { data: tariffs } = trpc.fixedBilling.listTariffs.useQuery({ activeOnly: true });

  const createMutation = trpc.fixedBilling.createAgreement.useMutation({
    onSuccess: () => {
      toast.success("Agreement created");
      setShowCreate(false);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const terminateMutation = trpc.fixedBilling.updateAgreement.useMutation({
    onSuccess: () => {
      toast.success("Agreement terminated");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const isPriceOverride =
    form.agreedMonthlyPriceKobo !== form.officialMonthlyPriceKobo &&
    form.officialMonthlyPriceKobo > 0;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Fixed Billing Agreements</h2>
          <p className="text-sm text-muted-foreground">
            Per-customer agreements with agreed tariff and notification settings
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> New Agreement
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading agreements…
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Lot</TableHead>
                  <TableHead>Tariff</TableHead>
                  <TableHead>Bin / Freq</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead>Notify</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.agreements ?? []).map((a: any) => (
                  <TableRow key={a._id}>
                    <TableCell>
                      <div className="font-medium">{a.customerName}</div>
                      <div className="text-xs text-muted-foreground">{a.customerId}</div>
                    </TableCell>
                    <TableCell>{a.companyName}</TableCell>
                    <TableCell className="font-mono text-xs">{a.lotCode}</TableCell>
                    <TableCell className="font-mono text-xs">{a.tariffCode}</TableCell>
                    <TableCell>
                      {a.binsCount}× {a.binType}
                      <br />
                      <span className="text-xs text-muted-foreground">
                        {FREQUENCIES.find((f) => f.value === a.frequency)?.label ?? a.frequency}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {fmt(a.agreedMonthlyPriceKobo)}
                      {a.agreedMonthlyPriceKobo !== a.officialMonthlyPriceKobo && (
                        <div className="text-xs text-yellow-600">
                          Official: {fmt(a.officialMonthlyPriceKobo)}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {a.notifyBySms && (
                          <Badge variant="outline" className="text-xs">SMS</Badge>
                        )}
                        {a.notifyByEmail && (
                          <Badge variant="outline" className="text-xs">Email</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {a.active ? (
                        <Badge className="bg-green-100 text-green-800 border-0">Active</Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-500">Terminated</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {a.active && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:text-red-700"
                          onClick={() => {
                            if (confirm(`Terminate agreement for ${a.customerName}?`)) {
                              terminateMutation.mutate({
                                id: a._id,
                                active: false,
                                endDate: new Date(),
                              });
                            }
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.agreements ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No agreements yet. Create the first one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {data?.totalPages}
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === data?.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Agreement Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Fixed Billing Agreement</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            {/* Customer Info */}
            <div className="col-span-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Customer Details
              </h3>
            </div>
            <div className="space-y-1">
              <Label>Customer ID</Label>
              <Input
                placeholder="e.g. CUST-001"
                value={form.customerId}
                onChange={(e) => setForm({ ...form, customerId: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Customer Name</Label>
              <Input
                placeholder="Full name"
                value={form.customerName}
                onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Phone Number</Label>
              <Input
                placeholder="08XXXXXXXXX"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="customer@email.com"
                value={form.customerEmail}
                onChange={(e) => setForm({ ...form, customerEmail: e.target.value })}
              />
            </div>

            {/* Company & Lot */}
            <div className="col-span-2 mt-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Company & Location
              </h3>
            </div>
            <div className="space-y-1">
              <Label>Company ID</Label>
              <Input
                placeholder="e.g. IND-001"
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Company Name</Label>
              <Input
                placeholder="Company name"
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Lot Code</Label>
              <Input
                placeholder="e.g. OY-001"
                value={form.lotCode}
                onChange={(e) => setForm({ ...form, lotCode: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              />
            </div>

            {/* Tariff */}
            <div className="col-span-2 mt-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Tariff & Pricing
              </h3>
            </div>
            <div className="space-y-1">
              <Label>Tariff Code</Label>
              <Select
                value={form.tariffCode}
                onValueChange={(v) => {
                  const t = (tariffs ?? []).find((x: any) => x.tariffCode === v);
                  if (t) {
                    setForm({
                      ...form,
                      tariffCode: v,
                      binType: t.binType,
                      frequency: t.frequency,
                      binsCount: t.binsCount,
                      officialMonthlyPriceKobo: t.monthlyPriceKobo,
                      agreedMonthlyPriceKobo: t.monthlyPriceKobo,
                    });
                  } else {
                    setForm({ ...form, tariffCode: v });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tariff…" />
                </SelectTrigger>
                <SelectContent>
                  {(tariffs ?? []).map((t: any) => (
                    <SelectItem key={t.tariffCode} value={t.tariffCode}>
                      {t.tariffCode} — {t.label} ({fmt(t.monthlyPriceKobo)}/mo)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Bin Type</Label>
              <Select
                value={form.binType}
                onValueChange={(v) => setForm({ ...form, binType: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BIN_TYPES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Frequency</Label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm({ ...form, frequency: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Number of Bins</Label>
              <Input
                type="number"
                min={1}
                value={form.binsCount}
                onChange={(e) => setForm({ ...form, binsCount: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-1">
              <Label>Official Monthly Price (₦)</Label>
              <Input
                type="number"
                min={0}
                value={form.officialMonthlyPriceKobo / 100 || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    officialMonthlyPriceKobo: Math.round(parseFloat(e.target.value || "0") * 100),
                  })
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Agreed Monthly Price (₦)</Label>
              <Input
                type="number"
                min={0}
                value={form.agreedMonthlyPriceKobo / 100 || ""}
                onChange={(e) =>
                  setForm({
                    ...form,
                    agreedMonthlyPriceKobo: Math.round(parseFloat(e.target.value || "0") * 100),
                  })
                }
              />
              {isPriceOverride && (
                <p className="text-xs text-yellow-600 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> Price differs from official tariff — reason required
                </p>
              )}
            </div>
            {isPriceOverride && (
              <div className="col-span-2 space-y-1">
                <Label>Price Override Reason *</Label>
                <Input
                  placeholder="Reason for price difference from official tariff"
                  value={form.priceOverrideReason}
                  onChange={(e) => setForm({ ...form, priceOverrideReason: e.target.value })}
                />
              </div>
            )}

            {/* Notifications */}
            <div className="col-span-2 mt-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Notification Settings
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notifyBySms"
                checked={form.notifyBySms}
                onChange={(e) => setForm({ ...form, notifyBySms: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="notifyBySms">Send SMS on every pickup</Label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="notifyByEmail"
                checked={form.notifyByEmail}
                onChange={(e) => setForm({ ...form, notifyByEmail: e.target.checked })}
                className="w-4 h-4"
              />
              <Label htmlFor="notifyByEmail">Send Email on every pickup</Label>
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Notes (optional)</Label>
              <Input
                placeholder="Any notes about this agreement"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                createMutation.mutate({
                  ...form,
                  startDate: new Date(form.startDate),
                } as any)
              }
              disabled={
                createMutation.isPending ||
                !form.customerId ||
                !form.customerName ||
                !form.companyId ||
                !form.lotCode ||
                (isPriceOverride && !form.priceOverrideReason)
              }
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────────

function LedgerTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showPayment, setShowPayment] = useState<any>(null);
  const [paymentForm, setPaymentForm] = useState({
    amountKobo: 0,
    paystackReference: "",
    channel: "paystack",
    notes: "",
  });

  const [generateLoading, setGenerateLoading] = useState(false);

  const { data, isLoading, refetch } = trpc.fixedBilling.listLedger.useQuery({
    status: statusFilter === "all" ? undefined : (statusFilter as any),
    page,
    limit: 50,
  });

  const generateMutation = trpc.fixedBilling.generateMonthlyLedger.useMutation({
    onSuccess: (r) => {
      toast.success(`Ledger generated: ${r.created} new entries, ${r.skipped} skipped`);
      refetch();
      setGenerateLoading(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setGenerateLoading(false);
    },
  });

  const paymentMutation = trpc.fixedBilling.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      setShowPayment(null);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Monthly Billing Ledger</h2>
          <p className="text-sm text-muted-foreground">
            Track monthly charges, outstanding balances, and payments
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="waived">Waived</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            onClick={() => {
              setGenerateLoading(true);
              generateMutation.mutate();
            }}
            disabled={generateLoading}
          >
            {generateLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Generate This Month
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading ledger…
        </div>
      ) : (
        <>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Billing Month</TableHead>
                  <TableHead className="text-right">Charged</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Outstanding</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data?.entries ?? []).map((e: any) => (
                  <TableRow key={e._id}>
                    <TableCell>
                      <div className="font-medium">{e.customerName}</div>
                      <div className="text-xs text-muted-foreground">{e.customerId}</div>
                    </TableCell>
                    <TableCell>{e.companyId}</TableCell>
                    <TableCell>{e.billingMonthLabel}</TableCell>
                    <TableCell className="text-right">{fmt(e.chargedAmountKobo)}</TableCell>
                    <TableCell className="text-right text-green-700">
                      {fmt(e.paidAmountKobo)}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-red-600">
                      {fmt(e.outstandingAmountKobo)}
                    </TableCell>
                    <TableCell>{statusBadge(e.status)}</TableCell>
                    <TableCell>
                      {e.status !== "paid" && e.status !== "waived" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setShowPayment(e);
                            setPaymentForm({
                              amountKobo: e.outstandingAmountKobo,
                              paystackReference: "",
                              channel: "paystack",
                              notes: "",
                            });
                          }}
                        >
                          <CreditCard className="w-4 h-4 mr-1" /> Record Payment
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.entries ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No ledger entries found. Click "Generate This Month" to create entries for all
                      active agreements.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {(data?.totalPages ?? 1) > 1 && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Page {page} of {data?.totalPages} ({data?.total} total entries)
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={page === data?.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Record Payment Dialog */}
      {showPayment && (
        <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="bg-muted rounded-md p-3 text-sm">
                <div className="font-semibold">{showPayment.customerName}</div>
                <div className="text-muted-foreground">{showPayment.billingMonthLabel}</div>
                <div className="mt-1">
                  Outstanding:{" "}
                  <span className="font-bold text-red-600">
                    {fmt(showPayment.outstandingAmountKobo)}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Amount Paid (₦)</Label>
                <Input
                  type="number"
                  min={0}
                  value={paymentForm.amountKobo / 100 || ""}
                  onChange={(e) =>
                    setPaymentForm({
                      ...paymentForm,
                      amountKobo: Math.round(parseFloat(e.target.value || "0") * 100),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Payment Channel</Label>
                <Select
                  value={paymentForm.channel}
                  onValueChange={(v) => setPaymentForm({ ...paymentForm, channel: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paystack">Paystack</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Paystack Reference (optional)</Label>
                <Input
                  placeholder="e.g. T123456789"
                  value={paymentForm.paystackReference}
                  onChange={(e) =>
                    setPaymentForm({ ...paymentForm, paystackReference: e.target.value })
                  }
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPayment(null)}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  paymentMutation.mutate({
                    customerId: showPayment.customerId,
                    billingMonth: showPayment.billingMonth,
                    amountKobo: paymentForm.amountKobo,
                    paystackReference: paymentForm.paystackReference || undefined,
                    channel: paymentForm.channel as any,
                  })
                }
                disabled={paymentMutation.isPending || paymentForm.amountKobo <= 0}
              >
                {paymentMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FixedBilling() {
  return (
    <div className="container py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="p-3 bg-emerald-100 rounded-xl">
          <FileText className="w-6 h-6 text-emerald-700" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Fixed Billing</h1>
          <p className="text-muted-foreground">
            Manage tariff schedules, customer agreements, and monthly billing ledger.
            Pickup notifications are sent automatically via SMS and email.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="tariffs">
        <TabsList>
          <TabsTrigger value="tariffs">
            <Settings className="w-4 h-4 mr-2" /> Tariff Schedule
          </TabsTrigger>
          <TabsTrigger value="agreements">
            <BadgeCheck className="w-4 h-4 mr-2" /> Agreements
          </TabsTrigger>
          <TabsTrigger value="ledger">
            <BookOpen className="w-4 h-4 mr-2" /> Ledger
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tariffs" className="mt-4">
          <TariffScheduleTab />
        </TabsContent>
        <TabsContent value="agreements" className="mt-4">
          <AgreementsTab />
        </TabsContent>
        <TabsContent value="ledger" className="mt-4">
          <LedgerTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
