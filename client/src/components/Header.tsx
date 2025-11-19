import { Button } from "@/components/ui/button";
import { LogOut, Home as HomeIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Link, useLocation } from "wouter";
import { APP_TITLE } from "@/const";

export function Header() {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const isHomePage = location === "/";

  const handleLogout = () => {
    logout();
    window.location.href = "/login";
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">{APP_TITLE}</h1>
            {!isHomePage && (
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <HomeIcon className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
            )}
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <>
                <div className="text-sm text-gray-600">
                  <span className="font-medium">{user.fullName || user.username}</span>
                  {user.role === 'admin' && (
                    <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      Admin
                    </span>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleLogout}
                  className="gap-2"
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
