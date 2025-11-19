import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Building2, Users } from "lucide-react";
import { Header } from "@/components/Header";

/**
 * Cherry Picker Management Page
 * 
 * Features:
 * - View lot assignments (which lots belong to which companies)
 * - See total cherry pickers in the system
 * - Monitor lot distribution across companies
 */
export default function CherryPickers() {
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null);

  // Fetch lot assignments (admin only)
  const { data: assignments, isLoading: loadingAssignments } = trpc.lots.assignments.useQuery(
    { userId: "admin-placeholder" }, // TODO: Get actual admin user ID from auth
    { enabled: true }
  );

  // Fetch cherry picker users
  const { data: users, isLoading: loadingUsers } = trpc.simpleAuth.listUsers.useQuery(
    { role: "cherry_picker" }
  );

  const cherryPickerCount = users?.users.filter(u => u.role === "cherry_picker").length || 0;

  if (loadingAssignments || loadingUsers) {
    return (
      <>
        <Header />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Cherry Picker Management</h1>
          <p className="text-gray-600 mt-2">
            Manage lot assignments and cherry picker access
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignments?.totalCompanies || 0}</div>
              <p className="text-xs text-muted-foreground">Active companies with lots</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Operational Lots</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{assignments?.totalLots || 0}</div>
              <p className="text-xs text-muted-foreground">Across all companies</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cherry Pickers</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{cherryPickerCount}</div>
              <p className="text-xs text-muted-foreground">Users with full access</p>
            </CardContent>
          </Card>
        </div>

        {/* Lot Assignments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lot Assignments by Company</CardTitle>
            <CardDescription>
              View which operational lots are assigned to each company
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Company Name</TableHead>
                  <TableHead className="text-center">Lot Count</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments?.companies.map((company) => (
                  <>
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{company.lotCount} lots</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => 
                            setExpandedCompany(
                              expandedCompany === company.id ? null : company.id
                            )
                          }
                        >
                          {expandedCompany === company.id ? "Hide" : "View"} Lots
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedCompany === company.id && (
                      <TableRow>
                        <TableCell colSpan={3} className="bg-gray-50">
                          <div className="py-4 px-6">
                            <h4 className="font-semibold mb-3">Operational Lots:</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {company.lots.map((lot, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center gap-2 p-2 bg-white rounded border"
                                >
                                  <MapPin className="h-4 w-4 text-blue-500" />
                                  <div>
                                    <div className="font-medium text-sm">{lot.lotCode}</div>
                                    <div className="text-xs text-gray-600">{lot.lotName}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>

            {(!assignments?.companies || assignments.companies.length === 0) && (
              <div className="text-center py-8 text-gray-500">
                No companies with operational lots found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cherry Picker Users Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Cherry Picker Users</CardTitle>
            <CardDescription>
              Users with access to all operational lots across all companies
            </CardDescription>
          </CardHeader>
          <CardContent>
            {cherryPickerCount === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No cherry picker users found. Assign the "cherry_picker" role in User Management to grant full access.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users?.users
                    .filter(u => u.role === "cherry_picker")
                    .map((user) => (
                      <TableRow key={user._id}>
                        <TableCell className="font-medium">{user.fullName}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Badge variant="default">Cherry Picker</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Info Box */}
        <Card className="mt-8 border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="text-blue-600">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">About Cherry Pickers</h3>
                <p className="text-sm text-blue-800">
                  Cherry pickers are special users who can select from all operational lots across all companies. 
                  Regular users can only see lots assigned to their company. To assign the cherry picker role, 
                  go to User Management and change the user's role to "cherry_picker".
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
