import { useState } from "react";
import { Header } from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Trash2,
  AlertCircle,
  TrendingUp,
  Database,
  FileX,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function PickupVerification() {
  const [resyncingId, setResyncingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null);

  // Fetch unsynced pickups
  const {
    data: unsyncedPickups,
    isLoading,
    refetch,
  } = trpc.pickupVerification.getUnsynced.useQuery();

  // Fetch statistics
  const { data: stats } = trpc.pickupVerification.getStatistics.useQuery();

  // Mutations
  const resyncMutation = trpc.pickupVerification.resync.useMutation();
  const deleteMutation = trpc.pickupVerification.deleteSubmission.useMutation();

  const handleResync = async (submissionId: string, buildingId: string) => {
    setResyncingId(submissionId);
    try {
      const result = await resyncMutation.mutateAsync({ submissionId });
      
      if (result.success) {
        toast.success(`Successfully re-synced pickup for building ${buildingId}`);
        await refetch();
      } else {
        toast.error(`Re-sync failed: ${result.error || "Unknown error"}`);
      }
    } catch (error: any) {
      toast.error(`Re-sync failed: ${error.message}`);
    } finally {
      setResyncingId(null);
    }
  };

  const handleDeleteClick = (submissionId: string) => {
    setSelectedSubmission(submissionId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedSubmission) return;
    
    setDeletingId(selectedSubmission);
    try {
      const result = await deleteMutation.mutateAsync({ submissionId: selectedSubmission });
      
      if (result.success) {
        toast.success("Submission deleted successfully");
        await refetch();
      } else {
        toast.error(`Delete failed: ${result.error || "Unknown error"}`);
      }
    } catch (error: any) {
      toast.error(`Delete failed: ${error.message}`);
    } finally {
      setDeletingId(null);
      setDeleteDialogOpen(false);
      setSelectedSubmission(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header title="Pickup Verification" />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header title="Pickup Verification" />
      
      <div className="container mx-auto py-8 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Submissions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{stats?.totalSubmissions || 0}</span>
                <Database className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                From mobile app
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Successfully Synced
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-green-600">
                  {stats?.totalSynced || 0}
                </span>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                In database
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Unsynced
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold text-red-600">
                  {stats?.totalUnsynced || 0}
                </span>
                <FileX className="h-8 w-8 text-red-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Requires attention
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Sync Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">
                  {stats?.syncRate || "0"}%
                </span>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Success rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alert Banner */}
        {unsyncedPickups && unsyncedPickups.length > 0 && (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-yellow-900">
                    {unsyncedPickups.length} Unsynced Pickup{unsyncedPickups.length !== 1 ? "s" : ""} Found
                  </h3>
                  <p className="text-sm text-yellow-800 mt-1">
                    These pickups were submitted from the mobile app but failed to sync to the database.
                    Use the "Re-sync" button to manually process them.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Unsynced Pickups Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Unsynced Pickups</CardTitle>
                <CardDescription>
                  Pickups that need manual verification and re-sync
                </CardDescription>
              </div>
              <Button
                onClick={() => refetch()}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!unsyncedPickups || unsyncedPickups.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  All Pickups Synced!
                </h3>
                <p className="text-gray-600">
                  There are no unsynced pickups at the moment.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Building ID</TableHead>
                    <TableHead>Bin Type</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Pickup Date</TableHead>
                    <TableHead>Customer Type</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead>Supervisor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unsyncedPickups.map((pickup) => (
                    <TableRow key={pickup.id}>
                      <TableCell className="font-medium">{pickup.buildingId}</TableCell>
                      <TableCell>{pickup.binType}</TableCell>
                      <TableCell>{pickup.quantity}</TableCell>
                      <TableCell>{pickup.pickUpDate}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {pickup.customerType}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(pickup.submittedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>{pickup.supervisorId}</TableCell>
                      <TableCell>
                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          {pickup.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleResync(pickup.id, pickup.buildingId)}
                            disabled={resyncingId === pickup.id}
                          >
                            {resyncingId === pickup.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="h-3 w-3 mr-1" />
                                Re-sync
                              </>
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteClick(pickup.id)}
                            disabled={deletingId === pickup.id}
                          >
                            {deletingId === pickup.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <Trash2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">How Pickup Verification Works</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  1
                </div>
                <p>
                  <strong>Detection:</strong> The system compares mobile app submissions against the database to identify pickups that failed to sync.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  2
                </div>
                <p>
                  <strong>Re-sync:</strong> Click the "Re-sync" button to manually process a failed pickup and add it to the database.
                </p>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-semibold">
                  3
                </div>
                <p>
                  <strong>Delete:</strong> If a submission was made by mistake, use the delete button to remove it from the queue.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Submission?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this submission from the system. This action cannot be undone.
              Only delete submissions that were made by mistake.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
