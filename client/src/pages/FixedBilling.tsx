/**
 * Fixed Billing Admin Page
 *
 * Three tabs:
 * 1. Tariff Schedule — manage official approved prices per bin type + frequency
 * 2. Agreements — create/view/terminate per-customer fixed billing agreements
 * 3. Ledger — view monthly charges, outstanding balances, record payments
 */

import { useState, useRef } from "react";
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
  Download,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
  Upload,
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
  const [showBulk, setShowBulk] = useState(false);

  // ── Company scope state (Gaps 1 & 3) ──────────────────────────────────────
  const [scopeCompanyId, setScopeCompanyId] = useState("");
  const [scopeFranchiseeId, setScopeFranchiseeId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);

  // ── Bulk upload state (Gap 5) ─────────────────────────────────────────────
  const [bulkScopeCompanyId, setBulkScopeCompanyId] = useState("");
  const [bulkScopeFranchiseeId, setBulkScopeFranchiseeId] = useState("");
  const [bulkRows, setBulkRows] = useState<any[]>([]);
  const [bulkParseError, setBulkParseError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    openingBalanceKobo: 0,
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

  // ── Company lists for scope selectors ────────────────────────────────────
  const { data: allCompanies } = trpc.companies.list.useQuery();
  const independentCompanies = (allCompanies ?? []).filter((c: any) => c.companyType === 'independent');
  const franchisorCompanies = (allCompanies ?? []).filter((c: any) => c.companyType === 'franchisor');
  const scopeCompany = (allCompanies ?? []).find((c: any) => c.companyId === scopeCompanyId);
  const bulkScopeCompany = (allCompanies ?? []).find((c: any) => c.companyId === bulkScopeCompanyId);

  // ── Franchisees under selected scope company ──────────────────────────────
  const { data: franchisees } = trpc.fixedBilling.listFranchisees.useQuery(
    { franchisorId: scopeCompanyId },
    { enabled: !!scopeCompanyId && scopeCompany?.companyType === 'franchisor' }
  );
  const { data: bulkFranchisees } = trpc.fixedBilling.listFranchisees.useQuery(
    { franchisorId: bulkScopeCompanyId },
    { enabled: !!bulkScopeCompanyId && bulkScopeCompany?.companyType === 'franchisor' }
  );

  // ── Template customers: all customers in bulk scope for CSV template generation ──
  const { data: templateCustomers, isFetching: templateFetching } = trpc.fixedBilling.searchCustomersForAgreement.useQuery(
    {
      companyId: bulkScopeCompanyId,
      franchiseeId: bulkScopeFranchiseeId || undefined,
      limit: 100,
    },
    { enabled: !!bulkScopeCompanyId }
  );

  // ── Customer search scoped to company (Gap 1 & 3) ─────────────────────────
  const { data: customerResults, isFetching: customerSearching } = trpc.fixedBilling.searchCustomersForAgreement.useQuery(
    {
      companyId: scopeCompanyId,
      franchiseeId: scopeFranchiseeId || undefined,
      search: customerSearch || undefined,
      limit: 30,
    },
    { enabled: !!scopeCompanyId }
  );

  // ── Download CSV template for bulk upload ────────────────────────────────
  const handleDownloadTemplate = () => {
    const today = new Date().toISOString().slice(0, 10);
    const tariffCodes = (tariffs ?? []).map((t: any) => t.tariffCode).join(' | ');
    const scopeLabel = bulkScopeCompany?.companyName ?? 'Company';
    const rows: string[][] = [];
    rows.push([
      'customerId', 'customerName', 'tariffCode', 'binType',
      'frequency', 'binsCount', 'agreedMonthlyPrice', 'openingBalance',
      'startDate', 'notifyBySms', 'notifyByEmail', 'notes',
    ]);
    rows.push([
      `# Customer IDs for ${scopeLabel}`,
      '# Full name (auto-filled from system)',
      `# Options: ${tariffCodes || 'see Tariff Schedule tab'}`,
      '# 240L | 360L | 1100L',
      '# Once a week | Twice a week | Three times a week | Daily',
      '# Number of bins (default 1)',
      '# Agreed price in Naira e.g. 10500.00',
      '# Pre-existing Zoho balance in Naira (0 if none)',
      '# YYYY-MM-DD',
      '# TRUE or FALSE',
      '# TRUE or FALSE',
      '# Optional notes',
    ]);
    (templateCustomers ?? []).forEach((c: any) => {
      rows.push([
        c.customerId, c.customerName, '', '240L',
        'Once a week', '1', '', '0',
        today, 'TRUE', 'TRUE', '',
      ]);
    });
    const csv = rows
      .map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fixed-billing-template-${scopeLabel.replace(/\s+/g, '-').toLowerCase()}-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const createMutation = trpc.fixedBilling.createAgreement.useMutation({
    onSuccess: () => {
      toast.success("Agreement created");
      setShowCreate(false);
      setSelectedCustomer(null);
      setScopeCompanyId("");
      setScopeFranchiseeId("");
      setCustomerSearch("");
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkMutation = trpc.fixedBilling.bulkCreateAgreements.useMutation({
    onSuccess: (r) => {
      toast.success(`Bulk upload: ${r.successCount} created, ${r.failCount} failed`);
      if (r.failCount > 0) {
        const errors = r.results.filter((x: any) => !x.success).map((x: any) => `${x.customerId}: ${x.error}`).join('\n');
        console.warn('Bulk upload errors:\n' + errors);
      }
      setShowBulk(false);
      setBulkRows([]);
      setBulkScopeCompanyId("");
      setBulkScopeFranchiseeId("");
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

  // ── Auto-fill form when a customer is selected from dropdown ─────────────
  const handleSelectCustomer = (customer: any) => {
    setSelectedCustomer(customer);
    setCustomerDropdownOpen(false);
    setCustomerSearch(customer.customerName);
    setForm((prev) => ({
      ...prev,
      customerId: customer.customerId,
      customerName: customer.customerName,
      customerPhone: customer.phone || "",
      customerEmail: customer.email || "",
      companyId: customer.ownerCompanyId,
      companyName: customer.ownerCompanyName,
      lotCode: customer.lotCode || "",
    }));
  };

  // ── CSV parse for bulk upload ─────────────────────────────────────────────
  const handleCsvFile = (file: File) => {
    setBulkParseError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const rows = lines.slice(1).map((line, i) => {
          const cols = line.split(',').map(c => c.trim());
          const row: Record<string, any> = {};
          headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
          return {
            customerId: row['customerid'] || row['customer_id'] || '',
            tariffCode: row['tariffcode'] || row['tariff_code'] || '',
            binType: row['bintype'] || row['bin_type'] || '240L',
            frequency: row['frequency'] || 'once_weekly',
            binsCount: parseInt(row['binscount'] || row['bins_count'] || '1') || 1,
            agreedMonthlyPriceKobo: Math.round(parseFloat(row['agreedmonthlyprice'] || row['agreed_monthly_price'] || '0') * 100),
            openingBalanceKobo: Math.round(parseFloat(row['openingbalance'] || row['opening_balance'] || '0') * 100),
            startDate: row['startdate'] || row['start_date'] || new Date().toISOString().split('T')[0],
            notifyBySms: (row['notifybysms'] || row['notify_sms'] || 'true').toLowerCase() !== 'false',
            notifyByEmail: (row['notifybyemail'] || row['notify_email'] || 'true').toLowerCase() !== 'false',
            notes: row['notes'] || '',
          };
        }).filter(r => r.customerId);
        if (rows.length === 0) { setBulkParseError('No valid rows found. Check CSV format.'); return; }
        setBulkRows(rows);
      } catch (err: any) {
        setBulkParseError('Failed to parse CSV: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  // ── Check if customer has Monthly Billing records ─────────────────────────
  const { data: billingTypeCheck } = trpc.fixedBilling.checkCustomerBillingType.useQuery(
    { customerId: form.customerId },
    { enabled: form.customerId.trim().length >= 2 }
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold">Fixed Billing Agreements</h2>
          <p className="text-sm text-muted-foreground">
            Per-customer agreements with agreed tariff and notification settings
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowBulk(true)}>
            <Upload className="w-4 h-4 mr-2" /> Bulk Upload
          </Button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4 mr-2" /> New Agreement
          </Button>
        </div>
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
      <Dialog open={showCreate} onOpenChange={(open) => {
        setShowCreate(open);
        if (!open) { setSelectedCustomer(null); setScopeCompanyId(""); setScopeFranchiseeId(""); setCustomerSearch(""); }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Fixed Billing Agreement</DialogTitle>
          </DialogHeader>

          {/* Monthly Billing supersession warning */}
          {billingTypeCheck?.hasMonthlyBilling && (
            <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div>
                <p className="font-semibold">Monthly Billing customer detected</p>
                <p className="mt-0.5">
                  This customer has <strong>{billingTypeCheck.monthlyCount}</strong> Monthly Billing
                  record{billingTypeCheck.monthlyCount !== 1 ? 's' : ''} on file. Creating a Fixed
                  Billing agreement will <strong>supersede Monthly Billing</strong> for all future
                  pickups.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 py-2">

            {/* ── STEP 1: Company Scope (Gaps 1 & 3) ── */}
            <div className="col-span-2">
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                Step 1 — Select Company Scope
              </h3>
            </div>
            <div className="space-y-1">
              <Label>Company Type</Label>
              <Select
                value={scopeCompany?.companyType || ""}
                onValueChange={(type) => {
                  setScopeCompanyId("");
                  setScopeFranchiseeId("");
                  setSelectedCustomer(null);
                  setCustomerSearch("");
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select type…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="independent">Independent Company</SelectItem>
                  <SelectItem value="franchisor">Franchisor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Company</Label>
              <Select
                value={scopeCompanyId}
                onValueChange={(v) => { setScopeCompanyId(v); setScopeFranchiseeId(""); setSelectedCustomer(null); setCustomerSearch(""); }}
              >
                <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                <SelectContent>
                  {independentCompanies.map((c: any) => (
                    <SelectItem key={c.companyId} value={c.companyId}>{c.companyName}</SelectItem>
                  ))}
                  {franchisorCompanies.map((c: any) => (
                    <SelectItem key={c.companyId} value={c.companyId}>{c.companyName} (Franchisor)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Franchisee selector — only shown when a franchisor is selected */}
            {scopeCompany?.companyType === 'franchisor' && (
              <div className="col-span-2 space-y-1">
                <Label>Franchisee <span className="text-muted-foreground font-normal">(optional — leave blank for all)</span></Label>
                <Select
                  value={scopeFranchiseeId}
                  onValueChange={(v) => { setScopeFranchiseeId(v); setSelectedCustomer(null); setCustomerSearch(""); }}
                >
                  <SelectTrigger><SelectValue placeholder="All franchisees" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All franchisees</SelectItem>
                    {(franchisees ?? []).map((f: any) => (
                      <SelectItem key={f.companyId} value={f.companyId}>{f.companyName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── STEP 2: Customer Search Dropdown (Gap 1) ── */}
            {scopeCompanyId && (
              <>
                <div className="col-span-2 mt-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                    Step 2 — Select Customer
                  </h3>
                </div>
                <div className="col-span-2 space-y-1 relative">
                  <Label>Search Customer</Label>
                  <div className="relative">
                    <Input
                      placeholder="Type name, ID, or phone…"
                      value={customerSearch}
                      onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); setSelectedCustomer(null); }}
                      onFocus={() => setCustomerDropdownOpen(true)}
                      autoComplete="off"
                    />
                    {customerSearching && (
                      <Loader2 className="absolute right-3 top-2.5 w-4 h-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  {customerDropdownOpen && (customerResults ?? []).length > 0 && (
                    <div className="absolute z-50 w-full bg-white border rounded-md shadow-lg max-h-56 overflow-y-auto mt-1">
                      {(customerResults ?? []).map((c: any) => (
                        <button
                          key={c.customerId}
                          type="button"
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                          onClick={() => handleSelectCustomer(c)}
                        >
                          <span className="font-medium">{c.customerName}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{c.customerId}</span>
                          {c.phone && <span className="text-muted-foreground ml-2 text-xs">{c.phone}</span>}
                          <div className="text-xs text-muted-foreground">{c.address}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {customerDropdownOpen && !customerSearching && scopeCompanyId && (customerResults ?? []).length === 0 && customerSearch && (
                    <div className="absolute z-50 w-full bg-white border rounded-md shadow p-3 text-sm text-muted-foreground mt-1">
                      No customers found for "{customerSearch}"
                    </div>
                  )}
                </div>

                {/* Auto-filled customer details (read-only) */}
                {selectedCustomer && (
                  <div className="col-span-2 rounded-md border bg-muted/40 px-4 py-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">ID:</span> <strong>{selectedCustomer.customerId}</strong></div>
                    <div><span className="text-muted-foreground">Name:</span> {selectedCustomer.customerName}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {selectedCustomer.phone || '—'}</div>
                    <div><span className="text-muted-foreground">Email:</span> {selectedCustomer.email || '—'}</div>
                    <div><span className="text-muted-foreground">Lot:</span> {selectedCustomer.lotCode}</div>
                    <div><span className="text-muted-foreground">Company:</span> {selectedCustomer.ownerCompanyName}</div>
                  </div>
                )}
              </>
            )}

            {/* ── STEP 3: Start Date & Opening Balance (Gap 4) ── */}
            {selectedCustomer && (
              <>
                <div className="col-span-2 mt-2">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-2">
                    Step 3 — Agreement Terms
                  </h3>
                </div>
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>
                    Opening Balance (₦)
                    <span className="ml-1 text-xs text-muted-foreground font-normal">— pre-existing Zoho balance at agreement start</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    value={form.openingBalanceKobo / 100 || ""}
                    onChange={(e) =>
                      setForm({ ...form, openingBalanceKobo: Math.round(parseFloat(e.target.value || "0") * 100) })
                    }
                  />
                  {form.openingBalanceKobo > 0 && (
                    <p className="text-xs text-blue-600">This amount will be added to the customer's outstanding balance from day one.</p>
                  )}
                </div>
              </>
            )}

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
                !selectedCustomer ||
                !form.customerId ||
                !form.customerName ||
                !form.companyId ||
                !form.lotCode ||
                !form.tariffCode ||
                (isPriceOverride && !form.priceOverrideReason)
              }
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Agreement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Upload Dialog (Gap 5) ── */}
      <Dialog open={showBulk} onOpenChange={(open) => {
        setShowBulk(open);
        if (!open) { setBulkRows([]); setBulkScopeCompanyId(""); setBulkScopeFranchiseeId(""); setBulkParseError(""); }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Upload Fixed Billing Agreements</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Scope selector */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Step 1 — Select Company Scope</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>Company</Label>
                  <Select value={bulkScopeCompanyId} onValueChange={(v) => { setBulkScopeCompanyId(v); setBulkScopeFranchiseeId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select company…" /></SelectTrigger>
                    <SelectContent>
                      {(allCompanies ?? []).map((c: any) => (
                        <SelectItem key={c.companyId} value={c.companyId}>
                          {c.companyName} {c.companyType === 'franchisor' ? '(Franchisor)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {bulkScopeCompany?.companyType === 'franchisor' && (
                  <div className="space-y-1">
                    <Label>Franchisee <span className="text-muted-foreground font-normal">(optional)</span></Label>
                    <Select value={bulkScopeFranchiseeId} onValueChange={setBulkScopeFranchiseeId}>
                      <SelectTrigger><SelectValue placeholder="All franchisees" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All franchisees</SelectItem>
                        {(bulkFranchisees ?? []).map((f: any) => (
                          <SelectItem key={f.companyId} value={f.companyId}>{f.companyName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>

            {/* Download Template banner — appears once company scope is selected */}
            {bulkScopeCompanyId && (
              <div className="flex items-center justify-between rounded-md bg-blue-50 border border-blue-200 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-blue-800">Download a pre-filled template</p>
                  <p className="text-xs text-blue-600 mt-0.5">
                    {templateFetching
                      ? 'Loading customers…'
                      : `${(templateCustomers ?? []).length} customer${(templateCustomers ?? []).length !== 1 ? 's' : ''} in scope — fill in tariff & pricing columns then re-upload`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-1.5 shrink-0"
                  disabled={templateFetching || !templateCustomers}
                  onClick={handleDownloadTemplate}
                >
                  {templateFetching
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <Download className="w-4 h-4" />}
                  Download Template
                </Button>
              </div>
            )}

            {/* CSV upload */}
            <div>
              <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-3">Step 2 — Upload CSV</h3>
              <div
                className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer hover:bg-muted/30"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f); }}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">Drag & drop a CSV file here, or click to browse</p>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCsvFile(f); }} />
              </div>
              {bulkParseError && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {bulkParseError}</p>
              )}
            </div>

            {/* CSV format guide */}
            <div className="rounded-md bg-muted/40 border px-4 py-3 text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Required CSV columns:</p>
              <code>customerId, tariffCode, agreedMonthlyPrice, openingBalance, startDate, notifyBySms, notifyByEmail, notes</code>
              <p className="mt-1">Optional: binType, frequency, binsCount. Prices in Naira (e.g. 10500.00). Dates as YYYY-MM-DD.</p>
              <p className="mt-1 text-blue-600">Customer IDs must exist in the system under the selected company scope.</p>
            </div>

            {/* Preview table */}
            {bulkRows.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">{bulkRows.length} row{bulkRows.length !== 1 ? 's' : ''} ready to upload</p>
                <div className="rounded-md border overflow-x-auto max-h-48">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer ID</TableHead>
                        <TableHead>Tariff</TableHead>
                        <TableHead>Agreed Price</TableHead>
                        <TableHead>Opening Bal.</TableHead>
                        <TableHead>Start Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkRows.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-mono text-xs">{r.customerId}</TableCell>
                          <TableCell className="font-mono text-xs">{r.tariffCode}</TableCell>
                          <TableCell>{fmt(r.agreedMonthlyPriceKobo)}</TableCell>
                          <TableCell>{r.openingBalanceKobo > 0 ? fmt(r.openingBalanceKobo) : '—'}</TableCell>
                          <TableCell className="text-xs">{r.startDate}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulk(false)}>Cancel</Button>
            <Button
              disabled={!bulkScopeCompanyId || bulkRows.length === 0 || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate({
                scopeCompanyId: bulkScopeCompanyId,
                scopeFranchiseeId: bulkScopeFranchiseeId || undefined,
                rows: bulkRows,
              } as any)}
            >
              {bulkMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Upload {bulkRows.length > 0 ? `${bulkRows.length} Agreements` : 'Agreements'}
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
  const [showWaive, setShowWaive] = useState<any>(null);
  const [waiveReason, setWaiveReason] = useState("");
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

  const waiveMutation = trpc.fixedBilling.waiveLedgerEntry.useMutation({
    onSuccess: () => {
      toast.success("Ledger entry waived");
      setShowWaive(null);
      setWaiveReason("");
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
                  <TableHead className="text-right">Pickups</TableHead>
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
                    <TableCell className="text-right">
                      <span className="font-mono text-sm">{e.pickupCount ?? 0}</span>
                    </TableCell>
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
                        <div className="flex gap-1">
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-amber-600 border-amber-300 hover:bg-amber-50"
                            onClick={() => { setShowWaive(e); setWaiveReason(""); }}
                          >
                            Waive
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {(data?.entries ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
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

      {/* Waive / Write-off Dialog */}
      {showWaive && (
        <Dialog open={!!showWaive} onOpenChange={() => setShowWaive(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Waive Charge</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
                <div className="font-semibold">{showWaive.customerName}</div>
                <div className="text-muted-foreground">{showWaive.billingMonthLabel}</div>
                <div className="mt-1">
                  Outstanding:{" "}
                  <span className="font-bold text-red-600">{fmt(showWaive.outstandingAmountKobo)}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Waiving this charge will set the outstanding balance to ₦0 and mark the entry as <strong>Waived</strong>. This action cannot be undone.
              </p>
              <div className="space-y-1">
                <Label>Reason for waiver <span className="text-red-500">*</span></Label>
                <Input
                  placeholder="e.g. Customer dispute resolved, service not rendered"
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowWaive(null)}>Cancel</Button>
              <Button
                variant="destructive"
                disabled={waiveMutation.isPending || !waiveReason.trim()}
                onClick={() =>
                  waiveMutation.mutate({
                    customerId: showWaive.customerId,
                    billingMonth: showWaive.billingMonth,
                    waivedReason: waiveReason,
                  })
                }
              >
                {waiveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Confirm Waiver
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
