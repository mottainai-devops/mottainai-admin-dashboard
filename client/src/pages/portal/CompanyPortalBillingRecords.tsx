import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCompanyPortal } from '@/contexts/CompanyPortalContext';
import { CompanyPortalLayout } from '@/components/CompanyPortalLayout';
import { trpc } from '@/lib/trpc';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

interface Props { mode: 'invoices' | 'payments' }

export default function CompanyPortalBillingRecords({ mode }: Props) {
  const [, navigate] = useLocation();
  const { token, isAuthenticated } = useCompanyPortal();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'all' | 'billed' | 'yet_to_bill'>(
    mode === 'invoices' ? 'billed' : 'all'
  );

  if (!isAuthenticated) { navigate('/company-portal'); return null; }

  const { data, isLoading } = trpc.companyPortal.getBillingRecords.useQuery(
    { portalToken: token!, page, limit: 50, status },
    { enabled: !!token }
  );

  const title = mode === 'invoices' ? 'Invoices' : 'Payments';

  return (
    <CompanyPortalLayout title={title}>
      <div className="space-y-6">
        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={(v) => { setStatus(v as any); setPage(1); }}>
            <SelectTrigger className="w-44 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all">All Records</SelectItem>
              <SelectItem value="billed">Billed</SelectItem>
              <SelectItem value="yet_to_bill">Yet to Bill</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-gray-500">{data?.total?.toLocaleString() ?? '—'} records</span>
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Split Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Transaction ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-800 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : data?.records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No records found
                    </td>
                  </tr>
                ) : (
                  data?.records.map((r: any) => {
                    const isBilled = r.transcationId && r.transcationId !== '000';
                    return (
                      <tr key={r._id} className="hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-white text-xs">{r.customerName || r.fullName || '—'}</p>
                          <p className="text-xs text-gray-500">{r.email || ''}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-white">{formatNaira(r.amount || 0)}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.splitCode || '—'}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={`text-xs ${isBilled
                            ? 'border-emerald-700 text-emerald-400 bg-emerald-950/30'
                            : 'border-amber-700 text-amber-400 bg-amber-950/30'}`}>
                            {isBilled ? 'Billed' : 'Yet to Bill'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-400">
                          {isBilled ? r.transcationId : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-400">
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <p className="text-xs text-gray-500">Page {page} of {data.totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="border-gray-700 text-gray-400 hover:bg-gray-800">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                  className="border-gray-700 text-gray-400 hover:bg-gray-800">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </CompanyPortalLayout>
  );
}
