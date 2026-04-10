import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface SuperAdminRouteProps {
  children: React.ReactNode;
}

/**
 * SuperAdminRoute — guards a route so only users with role === 'superadmin' can access it.
 * All other authenticated users see a clear "Superadmin Access Required" message.
 * Unauthenticated users are redirected to /login.
 */
export function SuperAdminRoute({ children }: SuperAdminRouteProps) {
  const { user, loading, isAuthenticated, isSuperAdmin } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [loading, isAuthenticated, setLocation]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold text-foreground">Superadmin Access Required</h1>
        <p className="text-muted-foreground max-w-sm">
          This page is restricted to superadmin accounts only. You are logged in as{" "}
          <span className="font-semibold">{user?.username || user?.email || "unknown"}</span>{" "}
          with role <span className="font-semibold">{user?.role || "admin"}</span>.
        </p>
        <button
          className="mt-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
          onClick={() => setLocation("/")}
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
