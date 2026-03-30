import { useState } from "react";
import { Header } from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Building2, Users, TrendingUp, AlertCircle, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { useSimpleAuth } from "@/contexts/SimpleAuthContext";

interface FranchiseeStats {
  companyId: string;
  companyName: string;
  totalCustomers: number;
  activeCustomers: number;
  totalPickups: number;
  operationalLots: number;
  interventions: number; // Customers cherry-picked by franchisor
}

export default function FranchiseDashboard() {
  const { user } = useSimpleAuth();
  const utils = trpc.useUtils();

  // Fetch all companies
  const { data: companies, isLoading: companiesLoading } = trpc.companies.list.useQuery();

  // Fetch all customers — response is paginated: { customers, total, page, limit, totalPages }
  const { data: customersData, isLoading: customersLoading } = trpc.customers.list.useQuery({ limit: 10000 });
  const customers = customersData?.customers || [];

  // Check if current user is admin or their company is a franchisor
  const currentCompany = companies?.find(c => c.companyId === user?.companyId);
  const isAdmin = user?.role === 'admin';
  const isFranchisor = currentCompany?.companyType === 'franchisor';
  const hasAccess = isAdmin || isFranchisor;

  // Get franchisees under this franchisor (or all companies if admin)
  const franchisees = isAdmin
    ? companies || [] // Admin sees all companies
    : companies?.filter(c => 
        c.parentCompanyId === currentCompany?.companyId
      ) || [];

  // Calculate stats for each franchisee
  const franchiseeStats: FranchiseeStats[] = franchisees.map(franchisee => {
    const franchiseeCustomers = customers.filter(c => c.companyId === franchisee.companyId);
    const totalPickups = franchiseeCustomers.reduce((sum, c) => sum + (c.totalPickups || 0), 0);

    return {
      companyId: franchisee.companyId,
      companyName: franchisee.companyName,
      totalCustomers: franchiseeCustomers.length,
      activeCustomers: franchiseeCustomers.filter(c => c.status === 'active').length,
      totalPickups,
      operationalLots: franchisee.operationalLots?.length || 0,
      interventions: 0, // TODO: Track interventions from pickup history
    };
  });

  // Calculate franchisor's own stats
  const franchisorCustomers = customers.filter(c => c.companyId === currentCompany?.companyId);
  const franchisorStats = {
    totalCustomers: franchisorCustomers.length,
    activeCustomers: franchisorCustomers.filter(c => c.status === 'active').length,
    totalPickups: franchisorCustomers.reduce((sum, c) => sum + (c.totalPickups || 0), 0),
  };

  // Overall network stats
  const networkStats = {
    totalFranchisees: franchisees.length,
    totalCustomers: customersData?.total || 0,
    totalActiveCustomers: customers.filter(c => c.status === 'active').length,
    totalPickups: customers.reduce((sum, c) => sum + (c.totalPickups || 0), 0),
  };

  // Temporarily show debug info instead of blocking access
  const showDebugInfo = !hasAccess;

  if (companiesLoading || customersLoading) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading franchise data...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto py-8">
        {/* Debug Info Banner */}
        {showDebugInfo && (
          <Card className="mb-6 border-yellow-500 bg-yellow-50">
            <CardHeader>
              <CardTitle className="text-yellow-800">Debug Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><strong>User Role:</strong> {user?.role || 'undefined'}</p>
              <p><strong>Is Admin:</strong> {isAdmin ? 'Yes' : 'No'}</p>
              <p><strong>Company ID:</strong> {user?.companyId || 'undefined'}</p>
              <p><strong>Current Company:</strong> {currentCompany?.companyName || 'Not found'}</p>
              <p><strong>Company Type:</strong> {currentCompany?.companyType || 'unknown'}</p>
              <p><strong>Is Franchisor:</strong> {isFranchisor ? 'Yes' : 'No'}</p>
              <p><strong>Has Access:</strong> {hasAccess ? 'Yes' : 'No'}</p>
              <p className="text-yellow-700 mt-2">Note: Showing dashboard anyway for debugging</p>
            </CardContent>
          </Card>
        )}

        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">Franchise Dashboard</h1>
            <Badge variant="default" className="bg-purple-600">Franchisor</Badge>
          </div>
          <p className="text-muted-foreground">
            Overview of your franchise network and performance metrics
          </p>
        </div>

        {/* Network Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Franchisees</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{networkStats.totalFranchisees}</div>
              <p className="text-xs text-muted-foreground mt-1">Active franchise locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Network Customers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{networkStats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {networkStats.totalActiveCustomers} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Pickups</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{networkStats.totalPickups}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all locations</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Your Customers</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{franchisorStats.totalCustomers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {franchisorStats.activeCustomers} active • {franchisorStats.totalPickups} pickups
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Franchisee Performance Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Franchisee Performance</CardTitle>
            <CardDescription>
              Detailed metrics for each franchisee location
            </CardDescription>
          </CardHeader>
          <CardContent>
            {franchisees.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>No franchisees found</p>
                <p className="text-sm mt-1">Add franchisees in Company Management</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Franchisee</TableHead>
                    <TableHead>Operational Lots</TableHead>
                    <TableHead>Total Customers</TableHead>
                    <TableHead>Active Customers</TableHead>
                    <TableHead>Total Pickups</TableHead>
                    <TableHead>Interventions</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {franchiseeStats.map((stats) => (
                    <TableRow key={stats.companyId}>
                      <TableCell className="font-medium">
                        <div>
                          <div>{stats.companyName}</div>
                          <div className="text-sm text-muted-foreground">{stats.companyId}</div>
                        </div>
                      </TableCell>
                      <TableCell>{stats.operationalLots}</TableCell>
                      <TableCell>{stats.totalCustomers}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-green-50">
                          {stats.activeCustomers}
                        </Badge>
                      </TableCell>
                      <TableCell>{stats.totalPickups}</TableCell>
                      <TableCell>
                        {stats.interventions > 0 ? (
                          <Badge variant="outline" className="border-orange-600 text-orange-600">
                            {stats.interventions}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={stats.activeCustomers > 0 ? "default" : "secondary"}>
                          {stats.activeCustomers > 0 ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Franchisor's Direct Customers */}
        {franchisorCustomers.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Direct Customers</CardTitle>
                  <CardDescription>
                    Customers managed directly by {currentCompany?.companyName}
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-green-600 text-green-600">
                  {franchisorCustomers.length} customers
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Lot</TableHead>
                    <TableHead>Pickups</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {franchisorCustomers.slice(0, 10).map((customer) => (
                    <TableRow key={customer._id}>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {customer.email && <div>{customer.email}</div>}
                          {customer.phone && <div className="text-muted-foreground">{customer.phone}</div>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{customer.lotCode}</Badge>
                      </TableCell>
                      <TableCell>{customer.totalPickups}</TableCell>
                      <TableCell>
                        <Badge variant={customer.status === 'active' ? 'default' : 'secondary'}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            toast.info("Transfer to franchisee - Coming soon");
                          }}
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {franchisorCustomers.length > 10 && (
                <div className="text-center mt-4 text-sm text-muted-foreground">
                  Showing 10 of {franchisorCustomers.length} customers
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Alerts/Interventions Section */}
        {franchisees.length > 0 && (
          <Card className="mt-6 border-orange-200 bg-orange-50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-600" />
                <CardTitle className="text-orange-900">Intervention Opportunities</CardTitle>
              </div>
              <CardDescription className="text-orange-700">
                Monitor franchisee performance and intervene when needed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {franchiseeStats
                  .filter(s => s.activeCustomers === 0 && s.totalCustomers > 0)
                  .map(stats => (
                    <div key={stats.companyId} className="flex items-center justify-between p-3 bg-white rounded-lg border border-orange-200">
                      <div>
                        <p className="font-medium text-orange-900">{stats.companyName}</p>
                        <p className="text-sm text-orange-700">
                          {stats.totalCustomers} inactive customers - may need support
                        </p>
                      </div>
                      <Button variant="outline" size="sm" className="border-orange-600 text-orange-600">
                        Review
                      </Button>
                    </div>
                  ))}
                {franchiseeStats.every(s => s.activeCustomers > 0 || s.totalCustomers === 0) && (
                  <p className="text-sm text-orange-700 text-center py-4">
                    No interventions needed - all franchisees performing well
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  );
}
