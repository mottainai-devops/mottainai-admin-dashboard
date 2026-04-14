import { useState } from "react";
import { Header } from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Edit, Trash2, Building2, Zap, RefreshCw, CheckCircle2,
  AlertCircle, ExternalLink, CreditCard, Settings2, Loader2, Copy, Eye, EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { LotSelector } from "@/components/LotSelector";

interface OperationalLot {
  lotCode: string;
  lotName: string;
  paytWebhook: string;
  monthlyWebhook: string;
}

interface Company {
  _id: string;
  companyId: string;
  companyName: string;
  companyType?: string;
  pin: string;
  portalPin?: string;
  operationalLots: OperationalLot[];
  active: boolean;
  paystackSetupStatus?: string;
  paystackSubaccountCode?: string;
  paystackSplitCodeResidential?: string;
  paystackSplitCodeCommercial?: string;
  paystackPercentageCharge?: number;
  zohoSetupStatus?: string;
  zohoOrganizationId?: string;
  zohoConnected?: boolean;
}

// ── Paystack Setup Wizard ─────────────────────────────────────────────────────
function PaystackSetupWizard({ company, onClose }: { company: Company; onClose: () => void }) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<'config' | 'running' | 'done'>('config');
  const [percentage, setPercentage] = useState(company.paystackPercentageCharge ?? 80);
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [result, setResult] = useState<any>(null);

  const setupMutation = trpc.companiesSetup.setupPaystack.useMutation({
    onSuccess: (data) => {
      setResult(data);
      setStep('done');
      utils.companies.list.invalidate();
      toast.success('Paystack setup complete!');
    },
    onError: (err) => {
      toast.error(err.message);
      setStep('config');
    },
  });

  const verifyMutation = trpc.companiesSetup.verifyBankAccount.useMutation({
    onSuccess: (data) => {
      setAccountName((data as any).account_name);
      toast.success(`Account verified: ${(data as any).account_name}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleVerify = async () => {
    if (!bankCode || !accountNumber) { toast.error('Enter bank code and account number'); return; }
    setIsVerifying(true);
    try {
      await verifyMutation.mutateAsync({ bankCode, accountNumber });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSetup = () => {
    setStep('running');
    setupMutation.mutate({
      companyId: company.companyId,
      bankCode,
      accountNumber,
      percentageCharge: percentage,
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied!');
  };

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-emerald-600" />
          Paystack Setup — {company.companyName}
        </DialogTitle>
        <DialogDescription>
          Creates a Paystack subaccount and two split codes (residential + commercial)
        </DialogDescription>
      </DialogHeader>

      {step === 'config' && (
        <div className="space-y-4 py-2">
          {company.paystackSetupStatus === 'active' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>Paystack is already configured. Running setup again will create new split codes and overwrite existing ones.</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Bank Code <span className="text-xs text-muted-foreground">(e.g. 058 for GTBank)</span></Label>
            <Input value={bankCode} onChange={(e) => setBankCode(e.target.value)} placeholder="058" />
          </div>

          <div className="space-y-2">
            <Label>Account Number</Label>
            <div className="flex gap-2">
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="0123456789" />
              <Button variant="outline" size="sm" onClick={handleVerify} disabled={verifyMutation.isPending}>
                {verifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
              </Button>
            </div>
            {accountName && (
              <p className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> {accountName}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Company Revenue Share: <span className="font-bold text-emerald-600">{percentage}%</span></Label>
            <input
              type="range"
              min={50}
              max={95}
              step={5}
              value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
              className="w-full accent-emerald-600"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>50% (min)</span>
              <span>Mottainai gets {100 - percentage}%</span>
              <span>95% (max)</span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={handleSetup}
              disabled={!bankCode || !accountNumber || !accountName}
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
            >
              <Zap className="w-4 h-4 mr-2" />
              Create Subaccount & Split Codes
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === 'running' && (
        <div className="py-8 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mx-auto" />
          <p className="font-medium">Setting up Paystack...</p>
          <p className="text-sm text-muted-foreground">Creating subaccount and split codes</p>
        </div>
      )}

      {step === 'done' && result && (
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Setup Complete!
          </div>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Subaccount Code', value: result.subaccountCode },
              { label: 'Residential Split Code', value: result.splitCodeResidential },
              { label: 'Commercial Split Code', value: result.splitCodeCommercial },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                <span className="text-muted-foreground">{label}</span>
                <div className="flex items-center gap-2">
                  <code className="font-mono text-xs">{value}</code>
                  <button onClick={() => copyToClipboard(value)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Webhook URLs have been auto-generated using these split codes and saved to the company's operational lots.
          </p>
          <DialogFooter>
            <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-500 text-white">Done</Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

// ── Backfill Tool ─────────────────────────────────────────────────────────────
function BackfillTool({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const [step, setStep] = useState<'preview' | 'running' | 'done'>('preview');
  const [results, setResults] = useState<any[]>([]);

  const { data: preview, isLoading } = trpc.companiesSetup.previewBackfill.useQuery();

  const backfillMutation = trpc.companiesSetup.runBackfill.useMutation({
    onSuccess: (data) => {
      setResults((data as any).results || []);
      setStep('done');
      utils.companies.list.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-blue-600" />
          Auto-Infer Split Codes from Billing Data
        </DialogTitle>
        <DialogDescription>
          Scans monthlybilldatas to match split codes to companies via lot codes, then saves them automatically.
        </DialogDescription>
      </DialogHeader>

      {step === 'preview' && (
        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
              Scanning billing data...
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground">
                Found <strong>{preview?.matches?.length || 0}</strong> companies with inferable split codes.
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {preview?.matches?.map((m: any) => (
                  <div key={m.companyId} className="flex items-start justify-between p-3 border rounded-lg text-sm">
                    <div>
                      <p className="font-medium">{m.companyName}</p>
                      <p className="text-xs text-muted-foreground">{m.companyId} · {m.lotCodes?.join(', ')}</p>
                    </div>
                    <div className="text-right text-xs space-y-0.5">
                      {m.splitCodeResidential && (
                        <p className="font-mono text-emerald-600">{m.splitCodeResidential} (res)</p>
                      )}
                      {m.splitCodeCommercial && (
                        <p className="font-mono text-blue-600">{m.splitCodeCommercial} (com)</p>
                      )}
                    </div>
                  </div>
                ))}
                {!preview?.matches?.length && (
                  <p className="text-center text-muted-foreground py-4">
                    No companies found needing backfill, or all are already configured.
                  </p>
                )}
              </div>
            </>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button
              onClick={() => { setStep('running'); backfillMutation.mutate(); }}
              disabled={!preview?.matches?.length || backfillMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Run Backfill ({preview?.matches?.length || 0} companies)
            </Button>
          </DialogFooter>
        </div>
      )}

      {step === 'running' && (
        <div className="py-8 text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-blue-600 mx-auto" />
          <p className="font-medium">Running backfill...</p>
        </div>
      )}

      {step === 'done' && (
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Backfill Complete — {results.filter((r) => r.success).length}/{results.length} companies updated
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((r: any) => (
              <div key={r.companyId} className={`flex items-center justify-between p-2 rounded-lg text-sm ${r.success ? 'bg-emerald-50' : 'bg-red-50'}`}>
                <span className="font-medium">{r.companyName}</span>
                <Badge variant={r.success ? 'default' : 'destructive'} className="text-xs">
                  {r.success ? 'Updated' : r.error}
                </Badge>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={onClose} className="bg-emerald-600 hover:bg-emerald-500 text-white">Done</Button>
          </DialogFooter>
        </div>
      )}
    </DialogContent>
  );
}

// ── Main Companies Page ───────────────────────────────────────────────────────
export default function Companies() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isPaystackWizardOpen, setIsPaystackWizardOpen] = useState(false);
  const [isBackfillOpen, setIsBackfillOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [createLots, setCreateLots] = useState<OperationalLot[]>([]);
  const [editLots, setEditLots] = useState<OperationalLot[]>([]);
  const [showPins, setShowPins] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState('all');

  const utils = trpc.useUtils();
  const { data: companies, isLoading } = trpc.companies.list.useQuery();

  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      toast.success("Company created successfully");
      utils.companies.list.invalidate();
      setIsCreateDialogOpen(false);
      setCreateLots([]);
    },
    onError: (error) => toast.error(`Failed to create company: ${error.message}`),
  });

  const updateMutation = trpc.companies.update.useMutation({
    onSuccess: () => {
      toast.success("Company updated successfully");
      utils.companies.list.invalidate();
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error) => toast.error(`Failed to update company: ${error.message}`),
  });

  const deleteMutation = trpc.companies.delete.useMutation({
    onSuccess: () => {
      toast.success("Company deleted successfully");
      utils.companies.list.invalidate();
    },
    onError: (error) => toast.error(`Failed to delete company: ${error.message}`),
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (createLots.length === 0) { toast.error("Please add at least one operational lot"); return; }
    createMutation.mutate({
      companyId: formData.get('companyId') as string,
      companyName: formData.get('companyName') as string,
      pin: formData.get('pin') as string,
      operationalLots: createLots,
    });
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setEditLots(company.operationalLots);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCompany) return;
    const formData = new FormData(e.currentTarget);
    if (editLots.length === 0) { toast.error("Please add at least one operational lot"); return; }
    updateMutation.mutate({
      id: selectedCompany._id,
      companyName: formData.get('companyName') as string,
      pin: formData.get('pin') as string,
      operationalLots: editLots,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate({ id });
    }
  };

  const openPaystackWizard = (company: Company) => {
    setSelectedCompany(company);
    setIsPaystackWizardOpen(true);
  };

  const filteredCompanies = (companies || []).filter((c: Company) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'independent') return c.companyType === 'independent';
    if (activeTab === 'franchisee') return c.companyType === 'franchisee';
    if (activeTab === 'paystack_pending') return c.companyType === 'independent' && c.paystackSetupStatus !== 'active';
    return true;
  });

  const independentCount = (companies || []).filter((c: Company) => c.companyType === 'independent').length;
  const paystackPendingCount = (companies || []).filter((c: Company) => c.companyType === 'independent' && c.paystackSetupStatus !== 'active').length;

  function PaystackStatusBadge({ status }: { status?: string }) {
    if (status === 'active') return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Paystack ✓</Badge>;
    if (status === 'pending') return <Badge variant="outline" className="border-amber-300 text-amber-600 text-xs">Paystack Pending</Badge>;
    return <Badge variant="outline" className="border-gray-300 text-gray-500 text-xs">Paystack Not Set</Badge>;
  }

  if (isLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8 flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto py-8">
        {/* Page Header */}
        <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold">Company Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage waste management companies, Paystack setup, and portal access
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {paystackPendingCount > 0 && (
              <Dialog open={isBackfillOpen} onOpenChange={setIsBackfillOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="border-blue-300 text-blue-600 hover:bg-blue-50">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Auto-Infer Split Codes ({paystackPendingCount})
                  </Button>
                </DialogTrigger>
                <BackfillTool onClose={() => setIsBackfillOpen(false)} />
              </Dialog>
            )}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Company
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Company</DialogTitle>
                  <DialogDescription>Add a new waste management company with operational lots</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreate}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyId">Company ID</Label>
                      <Input id="companyId" name="companyId" required placeholder="e.g., MOTTAINAI" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input id="companyName" name="companyName" required placeholder="e.g., MOTTAINAI" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pin">Mobile App PIN (4-6 digits)</Label>
                      <Input id="pin" name="pin" required placeholder="e.g., 1234" minLength={4} maxLength={6} />
                    </div>
                    <LotSelector selectedLots={createLots} onLotsChange={setCreateLots} />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "Creating..." : "Create Company"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList>
            <TabsTrigger value="all">All ({companies?.length || 0})</TabsTrigger>
            <TabsTrigger value="independent">Independent ({independentCount})</TabsTrigger>
            <TabsTrigger value="franchisee">Franchisee</TabsTrigger>
            {paystackPendingCount > 0 && (
              <TabsTrigger value="paystack_pending" className="text-amber-600">
                Paystack Pending ({paystackPendingCount})
              </TabsTrigger>
            )}
          </TabsList>
        </Tabs>

        {/* Company Cards */}
        <div className="grid gap-4">
          {filteredCompanies.map((company: Company) => (
            <Card key={company._id}>
              <CardHeader>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-8 w-8 text-primary flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle>{company.companyName}</CardTitle>
                        {company.companyType && (
                          <Badge variant="outline" className="text-xs capitalize">{company.companyType}</Badge>
                        )}
                        {company.companyType === 'independent' && (
                          <PaystackStatusBadge status={company.paystackSetupStatus} />
                        )}
                      </div>
                      <CardDescription className="mt-1">ID: {company.companyId}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {company.companyType === 'independent' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openPaystackWizard(company)}
                        className={company.paystackSetupStatus === 'active'
                          ? 'border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                          : 'border-amber-300 text-amber-600 hover:bg-amber-50'}
                      >
                        <CreditCard className="h-4 w-4 mr-1" />
                        {company.paystackSetupStatus === 'active' ? 'Reconfigure Paystack' : 'Setup Paystack'}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => handleEdit(company)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDelete(company._id, company.companyName)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Operational Lots */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold">Operational Lots ({company.operationalLots.length})</h4>
                    <div className="grid gap-1.5">
                      {company.operationalLots.map((lot, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 border rounded text-sm">
                          <Badge variant="secondary" className="text-xs">{lot.lotCode}</Badge>
                          <span className="text-sm truncate">{lot.lotName}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Paystack Details (independent only) */}
                  {company.companyType === 'independent' && company.paystackSetupStatus === 'active' && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-1">
                        <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                        Paystack Integration
                      </h4>
                      <div className="space-y-1 text-xs">
                        {company.paystackSubaccountCode && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Subaccount</span>
                            <code className="font-mono">{company.paystackSubaccountCode}</code>
                          </div>
                        )}
                        {company.paystackSplitCodeResidential && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Residential Split</span>
                            <code className="font-mono">{company.paystackSplitCodeResidential}</code>
                          </div>
                        )}
                        {company.paystackSplitCodeCommercial && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Commercial Split</span>
                            <code className="font-mono">{company.paystackSplitCodeCommercial}</code>
                          </div>
                        )}
                        {company.paystackPercentageCharge && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Revenue Share</span>
                            <span className="font-semibold text-emerald-600">{company.paystackPercentageCharge}%</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Portal PIN for independent companies */}
                {company.companyType === 'independent' && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Settings2 className="w-3.5 h-3.5" />
                      <span>Portal PIN:</span>
                      <code className="font-mono">
                        {showPins[company._id] ? (company.portalPin || company.pin) : '••••••'}
                      </code>
                      <button
                        onClick={() => setShowPins(p => ({ ...p, [company._id]: !p[company._id] }))}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        {showPins[company._id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <a
                        href={`/company-portal?companyId=${company.companyId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-blue-500 hover:underline"
                      >
                        Open Portal <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Company</DialogTitle>
              <DialogDescription>Update company information and operational lots</DialogDescription>
            </DialogHeader>
            {selectedCompany && (
              <form onSubmit={handleUpdate}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-companyName">Company Name</Label>
                    <Input id="edit-companyName" name="companyName" defaultValue={selectedCompany.companyName} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-pin">Mobile App PIN</Label>
                    <Input id="edit-pin" name="pin" defaultValue={selectedCompany.pin} required minLength={4} maxLength={8} />
                  </div>
                  <LotSelector selectedLots={editLots} onLotsChange={setEditLots} />
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsEditDialogOpen(false); setSelectedCompany(null); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? "Updating..." : "Update Company"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* Paystack Setup Wizard */}
        {selectedCompany && (
          <Dialog open={isPaystackWizardOpen} onOpenChange={setIsPaystackWizardOpen}>
            <PaystackSetupWizard
              company={selectedCompany}
              onClose={() => { setIsPaystackWizardOpen(false); setSelectedCompany(null); }}
            />
          </Dialog>
        )}
      </div>
    </>
  );
}
