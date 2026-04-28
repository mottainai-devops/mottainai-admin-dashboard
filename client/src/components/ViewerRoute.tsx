import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useLocation } from "wouter";
import { useEffect } from "react";

interface ViewerRouteProps {
  children: React.ReactNode;
}

/**
 * ViewerRoute — allows access to users with role === 'viewer', 'admin', or 'superadmin'.
 * Pure 'user' and 'cherry_picker' roles are redirected to /login.
 * Unauthenticated users are redirected to /login.
 */
export function ViewerRoute({ children }: ViewerRouteProps) {
  const { user, loading: isLoading, isAuthenticated } = useSimpleAuth();
  const [, setLocation] = useLocation();

  const isViewer = user?.role === 'viewer';
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const hasAccess = isViewer || isAdmin;

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      setLocation("/login");
    }
  }, [isLoading, isAuthenticated, setLocation]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-center px-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold text-foreground">Access Restricted</h1>
        <p className="text-muted-foreground max-w-sm">
          This page is restricted to Viewer, Admin, and Superadmin accounts. You are logged in as{" "}
          <span className="font-semibold">{user?.username || user?.email || "unknown"}</span>{" "}
          with role <span className="font-semibold">{user?.role || "user"}</span>.
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
