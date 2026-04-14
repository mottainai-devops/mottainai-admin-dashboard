import { useLocation } from 'wouter';
import { useCompanyPortal } from '@/contexts/CompanyPortalContext';
import { CompanyPortalLayout } from '@/components/CompanyPortalLayout';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Users, FileText, CheckCircle2, AlertCircle, TrendingUp,
  Zap, Webhook, Settings, ArrowRight, Building2, CreditCard,
} from 'lucide-react';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: 'Active', className: 'bg-emerald-900/50 text-emerald-400 border-emerald-700' },
    connected: { label: 'Connected', className: 'bg-emerald-900/50 text-emerald-400 border-emerald-700' },
    pending: { label: 'Pending', className: 'bg-yellow-900/50 text-yellow-400 border-yellow-700' },
    not_configured: { label: 'Not Set Up', className: 'bg-gray-800 text-gray-400 border-gray-700' },
    failed: { label: 'Failed', className: 'bg-red-900/50 text-red-400 border-red-700' },
    expired: { label: 'Expired', className: 'bg-orange-900/50 text-orange-400 border-orange-700' },
  };
  const s = map[status] || map.not_configured;
  return <Badge variant="outline" className={`text-xs ${s.className}`}>{s.label}</Badge>;
}

export default function CompanyPortalDashboard() {
  const [, navigate] = useLocation();
  const { token, company, isAuthenticated } = useCompanyPortal();

  if (!isAuthenticated) {
    navigate('/company-portal');
    return null;
  }

  const { data: stats, isLoading } = trpc.companyPortal.dashboardStats.useQuery(
    { portalToken: token! },
    { enabled: !!token, refetchInterval: 60_000 }
  );

  const { data: profile } = trpc.companyPortal.me.useQuery(
    { portalToken: token! },
    { enabled: !!token }
  );

  const kpiCards = [
    {
      title: 'Total Customers',
      value: stats?.totalCustomers?.toLocaleString() ?? '—',
      icon: Users,
      color: 'text-blue-400',
      bg: 'bg-blue-950/30',
    },
    {
      title: 'Billed Records',
      value: stats?.billedCount?.toLocaleString() ?? '—',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-950/30',
    },
    {
      title: 'Yet to Bill',
      value: stats?.yetToBillCount?.toLocaleString() ?? '—',
      icon: AlertCircle,
      color: 'text-amber-400',
      bg: 'bg-amber-950/30',
    },
    {
      title: 'Total Billed',
      value: stats ? formatNaira(stats.totalBilledAmount) : '—',
      icon: CreditCard,
      color: 'text-purple-400',
      bg: 'bg-purple-950/30',
    },
    {
      title: 'Outstanding',
      value: stats ? formatNaira(stats.totalOutstandingAmount) : '—',
      icon: FileText,
      color: 'text-red-400',
      bg: 'bg-red-950/30',
    },
    {
      title: 'Collection Rate',
      value: stats ? `${stats.collectionRate}%` : '—',
      icon: TrendingUp,
      color: 'text-teal-400',
      bg: 'bg-teal-950/30',
    },
  ];

  return (
    <CompanyPortalLayout title="Dashboard">
      {/* Welcome Banner */}
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-gray-900 border border-emerald-800/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-600/30 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Welcome, {company?.companyName}</h2>
            <p className="text-gray-400 text-sm">Here's an overview of your operations</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {kpiCards.map((card) => (
          <Card key={card.title} className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mb-1">{card.title}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>
                    {isLoading ? <span className="animate-pulse text-gray-600">—</span> : card.value}
                  </p>
                </div>
                <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Integration Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300 font-medium">Paystack Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Status</span>
              <StatusBadge status={profile?.paystackSetupStatus || 'not_configured'} />
            </div>
            {profile?.paystackSplitCodeResidential && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Residential Split</span>
                <span className="text-xs font-mono text-gray-300">{profile.paystackSplitCodeResidential}</span>
              </div>
            )}
            {profile?.paystackSplitCodeCommercial && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Commercial Split</span>
                <span className="text-xs font-mono text-gray-300">{profile.paystackSplitCodeCommercial}</span>
              </div>
            )}
            {profile?.paystackPercentageCharge && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Your Revenue Share</span>
                <span className="text-xs font-semibold text-emerald-400">{profile.paystackPercentageCharge}%</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-gray-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-gray-300 font-medium">Zoho Books Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Status</span>
              <StatusBadge status={profile?.zohoSetupStatus || 'not_configured'} />
            </div>
            {profile?.zohoOrganizationId && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">Organization ID</span>
                <span className="text-xs font-mono text-gray-300">{profile.zohoOrganizationId}</span>
              </div>
            )}
            {!profile?.zohoConnected && (
              <Button
                size="sm"
                variant="outline"
                className="w-full mt-2 border-emerald-700/50 text-emerald-400 hover:bg-emerald-950/30"
                onClick={() => navigate('/company-portal/settings')}
              >
                Connect Zoho Books
                <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => navigate('/company-portal/batch-invoice')}
            className="flex items-center gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-emerald-700/50 hover:bg-emerald-950/20 transition-all text-left"
          >
            <Zap className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-sm font-medium text-white">Batch Invoice</p>
              <p className="text-xs text-gray-500">{stats?.yetToBillCount || 0} records pending</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/company-portal/webhooks')}
            className="flex items-center gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-blue-700/50 hover:bg-blue-950/20 transition-all text-left"
          >
            <Webhook className="w-5 h-5 text-blue-400" />
            <div>
              <p className="text-sm font-medium text-white">Webhook Health</p>
              <p className="text-xs text-gray-500">Check integration status</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/company-portal/settings')}
            className="flex items-center gap-3 p-4 rounded-xl bg-gray-900 border border-gray-800 hover:border-gray-600 hover:bg-gray-800/50 transition-all text-left"
          >
            <Settings className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-sm font-medium text-white">Settings</p>
              <p className="text-xs text-gray-500">Zoho, PIN, preferences</p>
            </div>
          </button>
        </div>
      </div>
    </CompanyPortalLayout>
  );
}
