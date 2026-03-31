import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Building2, ArrowRight, Activity, BarChart3, Wrench, Users, Shield, Cherry,
  UserCheck, Truck, FileText, Webhook, LayoutDashboard, MapPin, ClipboardList,
  PieChart, RefreshCw
} from "lucide-react";
import { APP_TITLE } from "@/const";
import { Link } from "wouter";
import { Header } from "@/components/Header";

export default function Home() {
  const { user } = useAuth();
  const role = (user as any)?.role;
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin' || isSuperAdmin;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            {APP_TITLE}
          </h1>
          <p className="text-xl text-gray-600">
            Waste Management System Administration
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          <Link href="/companies">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-100 rounded-lg">
                    <Building2 className="h-8 w-8 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle>Company Management</CardTitle>
                    <CardDescription>Manage companies and operational lots</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Add, edit, and configure waste management companies with their operational lots and webhook URLs.
                </p>
                <div className="flex items-center text-blue-600 font-medium">
                  Manage Companies
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/testing">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-green-100 rounded-lg">
                    <Activity className="h-8 w-8 text-green-600" />
                  </div>
                  <div>
                    <CardTitle>System Testing & Monitoring</CardTitle>
                    <CardDescription>Test APIs and monitor system health</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Run automated tests on backend APIs, ArcGIS integration, and monitor real-time system health.
                </p>
                <div className="flex items-center text-green-600 font-medium">
                  View Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/analytics">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-purple-100 rounded-lg">
                    <BarChart3 className="h-8 w-8 text-purple-600" />
                  </div>
                  <div>
                    <CardTitle>Analytics Dashboard</CardTitle>
                    <CardDescription>Performance metrics and insights</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View real-time submission statistics, company performance, and system health metrics.
                </p>
                <div className="flex items-center text-purple-600 font-medium">
                  View Analytics
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/qa-tools">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-orange-100 rounded-lg">
                    <Wrench className="h-8 w-8 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>QA Tools</CardTitle>
                    <CardDescription>Testing and troubleshooting</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Test webhooks, validate data integrity, and troubleshoot system issues.
                </p>
                <div className="flex items-center text-orange-600 font-medium">
                  Open Tools
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/users">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 rounded-lg">
                    <Users className="h-8 w-8 text-red-600" />
                  </div>
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>Manage admin users and permissions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Create, edit, and manage admin users with role-based access control.
                </p>
                <div className="flex items-center text-red-600 font-medium">
                  Manage Users
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/cherry-pickers">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-pink-100 rounded-lg">
                    <Shield className="h-8 w-8 text-pink-600" />
                  </div>
                  <div>
                    <CardTitle>Cherry Picker Management</CardTitle>
                    <CardDescription>Manage lot assignments and access</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View lot assignments by company and manage cherry picker users with full access.
                </p>
                <div className="flex items-center text-pink-600 font-medium">
                  View Assignments
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/audit-log">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-slate-100 rounded-lg">
                    <Shield className="h-8 w-8 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle>Audit Log</CardTitle>
                    <CardDescription>Security events and user actions</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Track all user actions, login attempts, and security-related events.
                </p>
                <div className="flex items-center text-slate-600 font-medium">
                  View Logs <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* Admin + SuperAdmin only */}
          <Link href="/customers">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-teal-100 rounded-lg">
                    <UserCheck className="h-8 w-8 text-teal-600" />
                  </div>
                  <div>
                    <CardTitle>Customer Management</CardTitle>
                    <CardDescription>View and manage waste collection customers</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Browse, search, and manage customer records including billing and pickup history.
                </p>
                <div className="flex items-center text-teal-600 font-medium">
                  View Customers <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/pickup-records">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-cyan-100 rounded-lg">
                    <Truck className="h-8 w-8 text-cyan-600" />
                  </div>
                  <div>
                    <CardTitle>Pickup Records</CardTitle>
                    <CardDescription>All waste collection pickup logs</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View all pickup submissions from field workers with date, zone, and billing details.
                </p>
                <div className="flex items-center text-cyan-600 font-medium">
                  View Pickups <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/billing-reports">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-yellow-100 rounded-lg">
                    <FileText className="h-8 w-8 text-yellow-600" />
                  </div>
                  <div>
                    <CardTitle>Billing Reports</CardTitle>
                    <CardDescription>Revenue and invoice summaries</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  View billing summaries, outstanding invoices, and payment status across all customers.
                </p>
                <div className="flex items-center text-yellow-600 font-medium">
                  View Reports <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/webhook-monitoring">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-indigo-100 rounded-lg">
                    <Webhook className="h-8 w-8 text-indigo-600" />
                  </div>
                  <div>
                    <CardTitle>Webhook Monitoring</CardTitle>
                    <CardDescription>Survey123 webhook delivery status</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  Monitor incoming Survey123 webhook deliveries, success rates, and error logs.
                </p>
                <div className="flex items-center text-indigo-600 font-medium">
                  View Webhooks <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* SuperAdmin only */}
          {isSuperAdmin && (
            <Link href="/franchise">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-2 border-amber-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-100 rounded-lg">
                      <LayoutDashboard className="h-8 w-8 text-amber-600" />
                    </div>
                    <div>
                      <CardTitle>Franchise Dashboard</CardTitle>
                      <CardDescription>Admin only — franchise overview</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    High-level franchise performance metrics, revenue breakdown, and operational KPIs.
                  </p>
                  <div className="flex items-center text-amber-600 font-medium">
                    View Dashboard <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {isSuperAdmin && (
            <Link href="/property-enumeration/buildings">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-2 border-amber-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-lime-100 rounded-lg">
                      <MapPin className="h-8 w-8 text-lime-600" />
                    </div>
                    <div>
                      <CardTitle>Buildings Management</CardTitle>
                      <CardDescription>ArcGIS property enumeration buildings</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    View and manage enumerated buildings from ArcGIS field surveys with geographic data.
                  </p>
                  <div className="flex items-center text-lime-600 font-medium">
                    View Buildings <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {isSuperAdmin && (
            <Link href="/property-enumeration/sessions">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-2 border-amber-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-100 rounded-lg">
                      <ClipboardList className="h-8 w-8 text-emerald-600" />
                    </div>
                    <div>
                      <CardTitle>Enumeration Sessions</CardTitle>
                      <CardDescription>Field enumeration session logs</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Track enumeration sessions, field agent activity, and data collection progress.
                  </p>
                  <div className="flex items-center text-emerald-600 font-medium">
                    View Sessions <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {isSuperAdmin && (
            <Link href="/property-enumeration/analytics">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-2 border-amber-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-violet-100 rounded-lg">
                      <PieChart className="h-8 w-8 text-violet-600" />
                    </div>
                    <div>
                      <CardTitle>Property Analytics</CardTitle>
                      <CardDescription>Enumeration data insights</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Analyse property enumeration data with charts, coverage maps, and trend reports.
                  </p>
                  <div className="flex items-center text-violet-600 font-medium">
                    View Analytics <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

          {isSuperAdmin && (
            <Link href="/property-enumeration/sync-monitor">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full border-2 border-amber-200">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-sky-100 rounded-lg">
                      <RefreshCw className="h-8 w-8 text-sky-600" />
                    </div>
                    <div>
                      <CardTitle>ArcGIS Sync Monitor</CardTitle>
                      <CardDescription>ArcGIS data synchronisation status</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 mb-4">
                    Monitor ArcGIS feature layer sync jobs, last-run timestamps, and error alerts.
                  </p>
                  <div className="flex items-center text-sky-600 font-medium">
                    View Sync Status <ArrowRight className="ml-2 h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )}

        </div>
      </div>
    </div>
  );
}
