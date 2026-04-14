/**
 * Company Portal Layout
 *
 * Sidebar navigation for the independent company portal.
 * Completely separate from the admin DashboardLayout.
 */

import { Link, useLocation } from 'wouter';
import { useCompanyPortal } from '@/contexts/CompanyPortalContext';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Truck,
  FileText,
  CreditCard,
  Zap,
  Webhook,
  Settings,
  LogOut,
  Building2,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';

const navItems = [
  { href: '/company-portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/company-portal/customers', label: 'Customers', icon: Users },
  { href: '/company-portal/pickups', label: 'Pickups', icon: Truck },
  { href: '/company-portal/invoices', label: 'Invoices', icon: FileText },
  { href: '/company-portal/payments', label: 'Payments', icon: CreditCard },
  { href: '/company-portal/batch-invoice', label: 'Batch Invoice', icon: Zap },
  { href: '/company-portal/fixed-billing', label: 'Fixed Billing', icon: TrendingUp },
  { href: '/company-portal/webhooks', label: 'Webhooks', icon: Webhook },
  { href: '/company-portal/settings', label: 'Settings', icon: Settings },
];

interface CompanyPortalLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function CompanyPortalLayout({ children, title }: CompanyPortalLayoutProps) {
  const [location] = useLocation();
  const { company, logout } = useCompanyPortal();

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Company Portal</p>
              <p className="text-sm font-semibold text-white truncate max-w-[140px]">
                {company?.companyName || 'Loading...'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = location === href || location.startsWith(href + '/');
            return (
              <Link key={href} href={href}>
                <a
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-800">
          <div className="mb-3 px-3 py-2 rounded-lg bg-gray-800/50">
            <p className="text-xs text-gray-500">Company ID</p>
            <p className="text-xs font-mono text-gray-300">{company?.companyId}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="w-full justify-start text-gray-400 hover:text-red-400 hover:bg-red-950/30"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {title && (
          <div className="sticky top-0 z-10 bg-gray-950/80 backdrop-blur border-b border-gray-800 px-8 py-4">
            <h1 className="text-xl font-semibold text-white">{title}</h1>
          </div>
        )}
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
