import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

/**
 * Custom hook for authentication state and operations
 * Uses simple JWT-based authentication
 */
export function useAuth() {
  const { user, loading, error, isAuthenticated, logout } = useSimpleAuth();

  return {
    user,
    isLoading: loading,
    error: error ? new Error(error) : null,
    isAuthenticated,
    isSuperAdmin: user?.role === 'superadmin',
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    logout,
  };
}
