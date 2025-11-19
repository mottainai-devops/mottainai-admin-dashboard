import { useState } from "react";
import { Header } from "@/components/Header";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, RefreshCw, CheckCircle2, AlertCircle, Clock, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

/**
 * Lot Upload Page
 * 
 * Allows administrators to upload new Excel files with lot data
 * and restart the backend to load the new data.
 */
export default function LotUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const uploadMutation = trpc.upload.uploadLotFile.useMutation();
  const restartMutation = trpc.upload.restartBackend.useMutation();
  const backupsQuery = trpc.upload.listBackups.useQuery();
  const restoreMutation = trpc.upload.restoreBackup.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        toast.error("Please select an Excel file (.xlsx or .xls)");
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error("File size must be less than 10MB");
        return;
      }

      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select a file first");
      return;
    }

    setUploading(true);

    try {
      // Read file as base64
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Content = base64.split(",")[1]; // Remove data:... prefix

        try {
          const result = await uploadMutation.mutateAsync({
            fileContent: base64Content,
            fileName: selectedFile.name,
          });

          toast.success(result.message);
          setSelectedFile(null);

          // Refresh backups list
          backupsQuery.refetch();

          // Show restart prompt
          toast.info("Backend restart required to load new data", {
            duration: 5000,
          });
        } catch (error: any) {
          toast.error(error.message || "Failed to upload file");
        } finally {
          setUploading(false);
        }
      };

      reader.onerror = () => {
        toast.error("Failed to read file");
        setUploading(false);
      };

      reader.readAsDataURL(selectedFile);
    } catch (error: any) {
      toast.error(error.message || "Failed to upload file");
      setUploading(false);
    }
  };

  const handleRestart = async () => {
    setRestarting(true);

    try {
      const result = await restartMutation.mutateAsync();
      toast.success(result.message);

      // Show countdown
      toast.info("Backend is restarting... Please wait 5 seconds", {
        duration: 5000,
      });

      // Refresh page after 5 seconds
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    } catch (error: any) {
      toast.error(error.message || "Failed to restart backend");
      setRestarting(false);
    }
  };

  const handleRestore = async (backupFileName: string) => {
    if (!confirm(`Are you sure you want to restore backup: ${backupFileName}?`)) {
      return;
    }

    try {
      const result = await restoreMutation.mutateAsync({ backupFileName });
      toast.success(result.message);
      toast.info("Backend restart required to load restored data");
    } catch (error: any) {
      toast.error(error.message || "Failed to restore backup");
    }
  };

  return (
      <>
        <Header />
    <div className="container mx-auto py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Lot Data Management</h1>
        <p className="text-gray-600">
          Upload new Excel files to update operational lot data
        </p>
      </div>

      {/* Upload Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Upload New Lot Data
          </CardTitle>
          <CardDescription>
            Upload an Excel file (.xlsx or .xls) with updated lot information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Input */}
          <div>
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <FileSpreadsheet className="w-10 h-10 mb-3 text-gray-400" />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500">Excel files only (MAX. 10MB)</p>
              </div>
              <input
                id="file-upload"
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
              />
            </label>
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Selected: <strong>{selectedFile.name}</strong> (
                {(selectedFile.size / 1024).toFixed(2)} KB)
              </AlertDescription>
            </Alert>
          )}

          {/* Upload Button */}
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload File
              </>
            )}
          </Button>

          {/* Info Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Note:</strong> After uploading, you must restart the backend to load
              the new data. The current file will be automatically backed up.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Restart Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5" />
            Restart Backend
          </CardTitle>
          <CardDescription>
            Restart the backend server to load newly uploaded lot data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleRestart}
            disabled={restarting}
            variant="outline"
            className="w-full"
          >
            {restarting ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Restarting...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Restart Backend
              </>
            )}
          </Button>

          <Alert className="mt-4">
            <Clock className="h-4 w-4" />
            <AlertDescription>
              The restart process takes approximately 3-5 seconds. The page will
              automatically reload after restart.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Backups Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Backup Files
          </CardTitle>
          <CardDescription>
            View and restore previous lot data backups
          </CardDescription>
        </CardHeader>
        <CardContent>
          {backupsQuery.isLoading ? (
            <div className="text-center py-4 text-gray-500">Loading backups...</div>
          ) : backupsQuery.data?.backups.length === 0 ? (
            <div className="text-center py-4 text-gray-500">No backups available</div>
          ) : (
            <div className="space-y-2">
              {backupsQuery.data?.backups.map((backup) => (
                <div
                  key={backup.fileName}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium text-sm">{backup.fileName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(backup.createdAt).toLocaleString()} •{" "}
                      {(backup.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRestore(backup.fileName)}
                    disabled={restoreMutation.isPending}
                  >
                    Restore
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
}
