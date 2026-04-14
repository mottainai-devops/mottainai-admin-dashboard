import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useCompanyPortal } from '@/contexts/CompanyPortalContext';
import { CompanyPortalLayout } from '@/components/CompanyPortalLayout';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ExternalLink, CheckCircle2, AlertCircle, Lock, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function CompanyPortalSettings() {
  const [location, navigate] = useLocation();
  const { token, isAuthenticated } = useCompanyPortal();

  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [zohoOrgId, setZohoOrgId] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  if (!isAuthenticated) { navigate('/company-portal'); return null; }

  // Check for Zoho OAuth callback result in URL
  const searchParams = new URLSearchParams(location.split('?')[1] || '');
  const zohoConnected = searchParams.get('zoho_connected');
  const zohoError = searchParams.get('zoho_error');

  useEffect(() => {
    if (zohoConnected) toast.success('Zoho Books connected successfully!');
    if (zohoError) toast.error(`Zoho connection failed: ${zohoError}`);
  }, [zohoConnected, zohoError]);

  const { data: profile, refetch: refetchProfile } = trpc.companyPortal.me.useQuery(
    { portalToken: token! },
    { enabled: !!token }
  );

  const { data: zohoAuthUrl } = trpc.companyPortal.getZohoAuthUrl.useQuery(
    { portalToken: token! },
    { enabled: !!token && !!zohoOrgId }
  );

  const changePinMutation = trpc.companyPortal.changePin.useMutation();

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) { toast.error('New PINs do not match'); return; }
    if (newPin.length < 6) { toast.error('New PIN must be at least 6 characters'); return; }
    setIsChangingPin(true);
    try {
      await changePinMutation.mutateAsync({ portalToken: token!, currentPin, newPin });
      toast.success('PIN changed successfully');
      setCurrentPin(''); setNewPin(''); setConfirmPin('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsChangingPin(false);
    }
  };

  return (
    <CompanyPortalLayout title="Settings">
      <div className="max-w-2xl space-y-6">

        {/* Company Info */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-gray-400" />
              <CardTitle className="text-sm text-gray-300">Company Information</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-gray-500 mb-1">Company Name</p>
                <p className="text-white font-medium">{profile?.companyName || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Company ID</p>
                <p className="text-white font-mono">{profile?.companyId || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Operational Lots</p>
                <p className="text-white">{profile?.lotCodes?.length || 0} lots</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Split Codes</p>
                <p className="text-white">{profile?.splitCodes?.length || 0} codes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Zoho Books */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm text-gray-300">Zoho Books Integration</CardTitle>
                <CardDescription className="text-xs text-gray-500 mt-1">
                  Connect your Zoho Books account to sync invoices and payments
                </CardDescription>
              </div>
              {profile?.zohoConnected ? (
                <Badge variant="outline" className="border-emerald-700 text-emerald-400 bg-emerald-950/30">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Connected
                </Badge>
              ) : (
                <Badge variant="outline" className="border-gray-700 text-gray-400">
                  Not Connected
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profile?.zohoConnected ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Organization ID</span>
                  <span className="font-mono text-gray-300">{profile.zohoOrganizationId}</span>
                </div>
                <p className="text-xs text-gray-600">
                  To reconnect with a different organization, enter a new Organization ID below and click Connect.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 bg-amber-950/30 border border-amber-800/40 rounded-lg text-xs text-amber-400">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>
                  You need to connect Zoho Books to view invoices and payments from your accounting system.
                  Enter your Zoho Organization ID below, then click Connect.
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-300 text-xs">Zoho Organization ID</Label>
              <Input
                placeholder="e.g. 123456789"
                value={zohoOrgId}
                onChange={(e) => setZohoOrgId(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
              <p className="text-xs text-gray-600">
                Find this in Zoho Books → Settings → Organization Profile → Organization ID
              </p>
            </div>

            <Button
              disabled={!zohoOrgId || !zohoAuthUrl?.url}
              onClick={() => {
                if (zohoAuthUrl?.url) window.location.href = zohoAuthUrl.url;
              }}
              className="bg-blue-600 hover:bg-blue-500 text-white"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              {profile?.zohoConnected ? 'Reconnect Zoho Books' : 'Connect Zoho Books'}
            </Button>
          </CardContent>
        </Card>

        {/* Change PIN */}
        <Card className="bg-gray-900 border-gray-800">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <CardTitle className="text-sm text-gray-300">Change PIN</CardTitle>
            </div>
            <CardDescription className="text-xs text-gray-500">
              Your PIN must be 6–8 characters. Keep it secure.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleChangePin} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">Current PIN</Label>
                <Input
                  type="password"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">New PIN (min 6 characters)</Label>
                <Input
                  type="password"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  minLength={6}
                  maxLength={8}
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-xs">Confirm New PIN</Label>
                <Input
                  type="password"
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  required
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <Button
                type="submit"
                disabled={isChangingPin || !currentPin || !newPin || !confirmPin}
                className="bg-gray-700 hover:bg-gray-600 text-white"
              >
                {isChangingPin ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Changing...</> : 'Change PIN'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </CompanyPortalLayout>
  );
}
