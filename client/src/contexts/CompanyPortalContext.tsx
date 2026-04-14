/**
 * Company Portal Auth Context
 *
 * Manages PIN-based JWT authentication for independent company portal.
 * Token is stored in sessionStorage (cleared on tab close for security).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';

interface CompanyInfo {
  companyId: string;
  companyName: string;
  paystackSetupStatus: string;
  zohoSetupStatus: string;
  portalEnabled: boolean;
}

interface CompanyPortalContextType {
  token: string | null;
  company: CompanyInfo | null;
  isAuthenticated: boolean;
  login: (companyId: string, pin: string) => Promise<void>;
  logout: () => void;
  isLoggingIn: boolean;
  loginError: string | null;
}

const CompanyPortalContext = createContext<CompanyPortalContextType | null>(null);

const TOKEN_KEY = 'mottainai_company_portal_token';
const COMPANY_KEY = 'mottainai_company_portal_info';

export function CompanyPortalProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem(TOKEN_KEY));
  const [company, setCompany] = useState<CompanyInfo | null>(() => {
    const stored = sessionStorage.getItem(COMPANY_KEY);
    return stored ? JSON.parse(stored) : null;
  });
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loginMutation = trpc.companyPortal.login.useMutation();

  const login = useCallback(async (companyId: string, pin: string) => {
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      const result = await loginMutation.mutateAsync({ companyId, pin });
      setToken(result.token);
      setCompany(result.company);
      sessionStorage.setItem(TOKEN_KEY, result.token);
      sessionStorage.setItem(COMPANY_KEY, JSON.stringify(result.company));
    } catch (err: any) {
      setLoginError(err.message || 'Login failed. Please check your credentials.');
      throw err;
    } finally {
      setIsLoggingIn(false);
    }
  }, [loginMutation]);

  const logout = useCallback(() => {
    setToken(null);
    setCompany(null);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(COMPANY_KEY);
  }, []);

  return (
    <CompanyPortalContext.Provider value={{
      token,
      company,
      isAuthenticated: !!token && !!company,
      login,
      logout,
      isLoggingIn,
      loginError,
    }}>
      {children}
    </CompanyPortalContext.Provider>
  );
}

export function useCompanyPortal() {
  const ctx = useContext(CompanyPortalContext);
  if (!ctx) throw new Error('useCompanyPortal must be used within CompanyPortalProvider');
  return ctx;
}
