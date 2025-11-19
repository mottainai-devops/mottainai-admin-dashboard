import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, ArrowRight, Activity, BarChart3, Wrench, Users, Shield, Cherry } from "lucide-react";
import { APP_LOGO, APP_TITLE } from "@/const";
import { Link } from "wouter";
import { Header } from "@/components/Header";

/**
 * All content in this page are only for example, replace with your own feature implementation
 * When building pages, remember your instructions in Frontend Workflow, Frontend Best Practices, Design Guide and Common Pitfalls
 */
export default function Home() {
  // The userAuth hooks provides authentication state
  // To implement login/logout functionality, simply call logout() or redirect to getLoginUrl()
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  // If theme is switchable in App.tsx, we can implement theme toggling like this:
  // const { theme, toggleTheme } = useTheme();

  // Use APP_LOGO (as image src) and APP_TITLE if needed

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
                  View Logs
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
