import React, { createContext, useContext, useState, useEffect } from 'react';
import { trpc } from '@/lib/trpc';

interface User {
  id: string | number; // Support both string (MongoDB) and number (simple auth)
  username: string;
  name: string;
  email: string;
  role: string;
}

interface SimpleAuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const SimpleAuthContext = createContext<SimpleAuthContextType | undefined>(undefined);

export function SimpleAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loginMutation = trpc.simpleAuth.login.useMutation();
  const logoutMutation = trpc.simpleAuth.logout.useMutation();

  // Check if user is logged in on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token by fetching user
      fetch('/api/trpc/simpleAuth.me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
        .then(res => res.json())
        .then(data => {
          if (data.result?.data?.json) {
            setUser(data.result.data.json);
          } else {
            localStorage.removeItem('auth_token');
          }
        })
        .catch(() => {
          localStorage.removeItem('auth_token');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      setError(null);
      
      // Use direct fetch instead of tRPC mutation to avoid batching issues
      const response = await fetch('/api/trpc/simpleAuth.login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          json: { username, password }
        }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      const result = data.result?.data?.json;
      
      if (result && result.success && result.token) {
        localStorage.setItem('auth_token', result.token);
        setUser(result.user);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setUser(null);
    logoutMutation.mutate();
  };

  return (
    <SimpleAuthContext.Provider
      value={{
        user,
        loading,
        error,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </SimpleAuthContext.Provider>
  );
}

export function useSimpleAuth() {
  const context = useContext(SimpleAuthContext);
  if (context === undefined) {
    throw new Error('useSimpleAuth must be used within a SimpleAuthProvider');
  }
  return context;
}
