import { trpc } from "@/lib/trpc";
import { useEffect } from "react";
import { useLocation } from "wouter";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: authData, isLoading } = trpc.auth.checkAuth.useQuery();

  useEffect(() => {
    if (!isLoading && authData && !authData.isAuthenticated) {
      setLocation("/login");
    }
  }, [authData, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authData?.isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
