import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCompanyPortal } from '@/contexts/CompanyPortalContext';
import { CompanyPortalLayout } from '@/components/CompanyPortalLayout';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Zap, ChevronLeft, ChevronRight, CheckSquare, Square, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

function formatNaira(amount: number) {
  return `₦${amount.toLocaleString('en-NG')}`;
}

export default function CompanyPortalBatchInvoice() {
  const [, navigate] = useLocation();
  const { token, isAuthenticated } = useCompanyPortal();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDryRun, setIsDryRun] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  if (!isAuthenticated) { navigate('/company-portal'); return null; }

  const { data, isLoading, refetch } = trpc.companyPortal.getBatchPreview.useQuery(
    { portalToken: token!, page, limit: 50 },
    { enabled: !!token }
  );

  const triggerMutation = trpc.companyPortal.triggerBatch.useMutation();

  const { data: jobStatus } = trpc.companyPortal.getBatchJobStatus.useQuery(
    { portalToken: token!, jobId: activeJobId! },
    {
      enabled: !!activeJobId && !!token,
      refetchInterval: activeJobId ? 3000 : false,
    }
  );

  // Stop polling when job is done
  useEffect(() => {
    if (jobStatus?.status === 'done' || jobStatus?.status === 'failed') {
      setTimeout(() => {
        setActiveJobId(null);
        refetch();
        setSelected(new Set());
      }, 2000);
    }
  }, [jobStatus?.status]);

  const records = data?.records || [];
  const pageIds = records.map((r: any) => r._id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id: string) => selected.has(id));

  const toggleAll = () => {
    if (allPageSelected) {
      const next = new Set(selected);
      pageIds.forEach((id: string) => next.delete(id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      pageIds.forEach((id: string) => next.add(id));
      setSelected(next);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const selectedAmount = records
    .filter((r: any) => selected.has(r._id))
    .reduce((sum: number, r: any) => sum + (r.amount || 0), 0);

  const handleRun = async (dryRun: boolean) => {
    setIsDryRun(dryRun);
    setShowConfirm(true);
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    try {
      const result = await triggerMutation.mutateAsync({
        portalToken: token!,
        recordIds: Array.from(selected),
        dryRun: isDryRun,
      });
      if (isDryRun) {
        toast.success(`Dry Run: ${(result as any).eligible} records eligible for ${formatNaira((result as any).totalAmount)}`);
      } else {
        setActiveJobId((result as any).jobId);
        toast.info(`Batch started — ${(result as any).total} records queued`);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const jobProgress = jobStatus
    ? Math.round((jobStatus.processed / Math.max(jobStatus.total, 1)) * 100)
    : 0;

  return (
    <CompanyPortalLayout title="Batch Invoice">
      <div className="space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Yet to Bill</p>
            <p className="text-2xl font-bold text-amber-400">{data?.total?.toLocaleString() ?? '—'}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Total Outstanding</p>
            <p className="text-2xl font-bold text-red-400">{data ? formatNaira(data.totalAmount) : '—'}</p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Selected</p>
            <p className="text-2xl font-bold text-emerald-400">{selected.size}</p>
            {selected.size > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">{formatNaira(selectedAmount)}</p>
            )}
          </div>
        </div>

        {/* Job Progress */}
        {activeJobId && jobStatus && (
          <div className="bg-gray-900 border border-emerald-800/40 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-3">
              {jobStatus.status === 'running' ? (
                <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
              ) : jobStatus.status === 'done' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              <span className="font-semibold text-white">
                {jobStatus.status === 'running' ? 'Processing batch...' :
                 jobStatus.status === 'done' ? 'Batch complete!' : 'Batch failed'}
              </span>
              <span className="ml-auto text-sm text-gray-400">{jobProgress}%</span>
            </div>
            <Progress value={jobProgress} className="h-2 mb-3" />
            <div className="grid grid-cols-4 gap-3 text-center text-xs">
              <div><p className="text-gray-500">Processed</p><p className="font-bold text-white">{jobStatus.processed}/{jobStatus.total}</p></div>
              <div><p className="text-gray-500">Success</p><p className="font-bold text-emerald-400">{jobStatus.success}</p></div>
              <div><p className="text-gray-500">Failed</p><p className="font-bold text-red-400">{jobStatus.failed}</p></div>
              <div><p className="text-gray-500">Skipped</p><p className="font-bold text-gray-400">{jobStatus.skipped}</p></div>
            </div>
            {jobStatus.errors.length > 0 && (
              <div className="mt-3 p-3 bg-red-950/30 rounded-lg text-xs text-red-400 max-h-24 overflow-y-auto">
                {jobStatus.errors.slice(-5).map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleRun(true)}
            disabled={selected.size === 0 || !!activeJobId}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Dry Run ({selected.size})
          </Button>
          <Button
            size="sm"
            onClick={() => handleRun(false)}
            disabled={selected.size === 0 || !!activeJobId}
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Zap className="w-4 h-4 mr-1" />
            Run Batch ({selected.size})
          </Button>
          {selected.size > 0 && (
            <span className="text-sm text-gray-400">= {formatNaira(selectedAmount)}</span>
          )}
        </div>

        {/* Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="px-4 py-3 w-10">
                    <button onClick={toggleAll} className="text-gray-400 hover:text-white">
                      {allPageSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Split Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bin Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-800 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                ) : records.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600 opacity-50" />
                      All records have been billed!
                    </td>
                  </tr>
                ) : (
                  records.map((r: any) => (
                    <tr key={r._id} className={`hover:bg-gray-800/50 transition-colors ${selected.has(r._id) ? 'bg-emerald-950/10' : ''}`}>
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selected.has(r._id)}
                          onCheckedChange={() => toggle(r._id)}
                          className="border-gray-600"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-white text-xs">{r.customerName || r.fullName || '—'}</p>
                        <p className="text-xs text-gray-500">{r.email || ''}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-white">{formatNaira(r.amount || 0)}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-400">{r.splitCode || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{r.binType || r.bin_type || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
              <p className="text-xs text-gray-500">Page {page} of {data.totalPages}</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="border-gray-700 text-gray-400 hover:bg-gray-800"><ChevronLeft className="w-4 h-4" /></Button>
                <Button size="sm" variant="outline" onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
                  className="border-gray-700 text-gray-400 hover:bg-gray-800"><ChevronRight className="w-4 h-4" /></Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{isDryRun ? 'Dry Run Confirmation' : 'Run Batch Invoice'}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {isDryRun
                ? `Simulate invoicing ${selected.size} records (${formatNaira(selectedAmount)}) without sending any invoices.`
                : `This will send Paystack invoices to ${selected.size} customers for a total of ${formatNaira(selectedAmount)}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} className={isDryRun ? 'bg-gray-700 hover:bg-gray-600' : 'bg-emerald-600 hover:bg-emerald-500'}>
              {isDryRun ? 'Run Dry Run' : 'Confirm & Send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </CompanyPortalLayout>
  );
}
