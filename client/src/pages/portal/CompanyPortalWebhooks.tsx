import { useLocation } from 'wouter';
import { useCompanyPortal } from '@/contexts/CompanyPortalContext';
import { CompanyPortalLayout } from '@/components/CompanyPortalLayout';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertTriangle, XCircle, ExternalLink, Webhook } from 'lucide-react';

export default function CompanyPortalWebhooks() {
  const [, navigate] = useLocation();
  const { token, isAuthenticated } = useCompanyPortal();

  if (!isAuthenticated) { navigate('/company-portal'); return null; }

  const { data, isLoading, refetch, isFetching } = trpc.companyPortal.getWebhookHealth.useQuery(
    { portalToken: token! },
    { enabled: !!token, refetchInterval: 60_000 }
  );

  function StatusIcon({ status }: { status: string }) {
    if (status === 'healthy') return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    if (status === 'degraded') return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    return <XCircle className="w-4 h-4 text-red-400" />;
  }

  function StatusBadge({ status }: { status: string }) {
    const map: Record<string, string> = {
      healthy: 'border-emerald-700 text-emerald-400 bg-emerald-950/30',
      degraded: 'border-amber-700 text-amber-400 bg-amber-950/30',
      unreachable: 'border-red-700 text-red-400 bg-red-950/30',
    };
    return (
      <Badge variant="outline" className={`text-xs capitalize ${map[status] || map.unreachable}`}>
        {status}
      </Badge>
    );
  }

  return (
    <CompanyPortalLayout title="Webhook Health">
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Healthy</p>
            </div>
            <p className="text-2xl font-bold text-emerald-400">{data?.healthy ?? '—'}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Degraded</p>
            </div>
            <p className="text-2xl font-bold text-amber-400">{data?.degraded ?? '—'}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <XCircle className="w-4 h-4 text-red-400" />
              <p className="text-xs text-gray-500 uppercase tracking-wider">Unreachable</p>
            </div>
            <p className="text-2xl font-bold text-red-400">{data?.unreachable ?? '—'}</p>
          </div>
        </div>

        {/* Refresh */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Webhook List */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
              Checking webhook health...
            </div>
          ) : !data?.lots.length ? (
            <div className="p-8 text-center text-gray-500">
              <Webhook className="w-8 h-8 mx-auto mb-2 opacity-30" />
              No webhooks configured
            </div>
          ) : (
            <div className="divide-y divide-gray-800">
              {data.lots.map((lot, i) => (
                <div key={i} className="p-4 flex items-start gap-4">
                  <StatusIcon status={lot.status} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-white text-sm">{lot.lotName || lot.lotCode}</span>
                      <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                        {lot.type === 'payt' ? 'Pay-as-you-throw' : 'Monthly'}
                      </Badge>
                      <StatusBadge status={lot.status} />
                    </div>
                    <p className="text-xs font-mono text-gray-500 truncate">{lot.url}</p>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span>HTTP {lot.httpStatus || '—'}</span>
                      <span>{lot.responseMs}ms</span>
                    </div>
                  </div>
                  <a
                    href={lot.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-300 flex-shrink-0"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-600 text-center">
          Webhook URLs are auto-generated from your Paystack split codes. Contact Mottainai to update them.
        </p>
      </div>
    </CompanyPortalLayout>
  );
}
