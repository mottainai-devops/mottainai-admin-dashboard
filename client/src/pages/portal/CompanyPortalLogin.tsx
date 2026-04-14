import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCompanyPortal } from '@/contexts/CompanyPortalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, Lock, AlertCircle, Loader2 } from 'lucide-react';

export default function CompanyPortalLogin() {
  const [, navigate] = useLocation();
  const { login, isLoggingIn, loginError, isAuthenticated } = useCompanyPortal();
  const [companyId, setCompanyId] = useState('');
  const [pin, setPin] = useState('');

  if (isAuthenticated) {
    navigate('/company-portal/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(companyId.trim().toUpperCase(), pin.trim());
      navigate('/company-portal/dashboard');
    } catch {
      // Error is shown via loginError
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-600 mb-4">
            <Building2 className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Company Portal</h1>
          <p className="text-gray-400 mt-1">Mottainai Independent Partner Access</p>
        </div>

        {/* Login Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="companyId" className="text-gray-300 text-sm font-medium">
                Company ID
              </Label>
              <Input
                id="companyId"
                type="text"
                placeholder="e.g. MOTTAINAI-001"
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                required
                autoComplete="username"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20 font-mono uppercase"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pin" className="text-gray-300 text-sm font-medium">
                PIN
              </Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <Input
                  id="pin"
                  type="password"
                  placeholder="Enter your PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="pl-10 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500 focus:ring-emerald-500/20"
                />
              </div>
            </div>

            {loginError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800/50 text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{loginError}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={isLoggingIn || !companyId || !pin}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-11"
            >
              {isLoggingIn ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-800 text-center">
            <p className="text-xs text-gray-500">
              Need access? Contact{' '}
              <a href="mailto:support@mottainai.africa" className="text-emerald-400 hover:underline">
                support@mottainai.africa
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">
          © {new Date().getFullYear()} Mottainai Africa. All rights reserved.
        </p>
      </div>
    </div>
  );
}
