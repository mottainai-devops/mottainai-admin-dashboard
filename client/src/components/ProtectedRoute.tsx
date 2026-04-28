import { useSimpleAuth } from "@/contexts/SimpleAuthContext";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { user, loading, isAuthenticated } = useSimpleAuth();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      setLocation("/login");
    } else if (!loading && isAuthenticated && user?.role === 'viewer') {
      // Viewer-role users should not access admin pages — redirect to their dashboard
      setLocation("/viewer-dashboard");
    }
  }, [isAuthenticated, loading, setLocation, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (user?.role === 'viewer') {
    return null; // Will be redirected by useEffect above
  }

  return <>{children}</>;
}
