import { trpc } from "@/lib/trpc";

/**
 * Custom hook for authentication state and operations
 */
export function useAuth() {
  const { data: user, isLoading, error } = trpc.auth.me.useQuery();
  const logoutMutation = trpc.auth.logout.useMutation();

  const logout = async () => {
    await logoutMutation.mutateAsync();
    window.location.href = "/login";
  };

  return {
    user,
    isLoading,
    error,
    isAuthenticated: !!user,
    isSuperAdmin: user?.role === 'superadmin',
    isAdmin: user?.role === 'admin' || user?.role === 'superadmin',
    logout,
  };
}
