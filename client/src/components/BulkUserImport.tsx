import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

interface BulkUserImportProps {
  onImportComplete: () => void;
}

export function BulkUserImport({ onImportComplete }: BulkUserImportProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const importMutation = trpc.simpleAuth.bulkImportUsers.useMutation({
    onSuccess: (result) => {
      toast.success(`Successfully imported ${result.imported} users. ${result.failed} failed.`);
      setIsOpen(false);
      setFile(null);
      onImportComplete();
    },
    onError: (error) => {
      toast.error(`Import failed: ${error.message}`);
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "text/csv") {
      setFile(selectedFile);
    } else {
      toast.error("Please select a valid CSV file");
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error("CSV file is empty or invalid");
        setImporting(false);
        return;
      }

      // Parse CSV (expecting: username,password,fullName,email,role,companyId)
      const headers = lines[0].split(",").map(h => h.trim());
      const users = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        return {
          username: values[0] || "",
          password: values[1] || "",
          fullName: values[2] || null,
          email: values[3] || null,
          role: (values[4] === "admin" ? "admin" : "user") as "admin" | "user",
          companyId: values[5] || null,
        };
      }).filter(user => user.username && user.password);

      if (users.length === 0) {
        toast.error("No valid users found in CSV");
        setImporting(false);
        return;
      }

      await importMutation.mutateAsync({ users });
    } catch (error) {
      toast.error("Failed to parse CSV file");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = "username,password,fullName,email,role,companyId\njohn.doe,Password123,John Doe,john@example.com,user,\njane.admin,Admin456,Jane Admin,jane@example.com,admin,";
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "user_import_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <Button onClick={() => setIsOpen(true)} variant="outline">
        <Upload className="w-4 h-4 mr-2" />
        Bulk Import
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Import Users</DialogTitle>
            <DialogDescription>
              Upload a CSV file to import multiple users at once
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">CSV Format:</p>
                <p className="text-xs">username,password,fullName,email,role,companyId</p>
                <p className="text-xs mt-1">Role must be either "admin" or "user"</p>
              </div>
            </div>

            <div>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="w-full"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Template
              </Button>
            </div>

            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              {file && (
                <p className="text-sm text-gray-600 mt-2">
                  Selected: {file.name}
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                setFile(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImport}
              disabled={!file || importing}
            >
              {importing ? "Importing..." : "Import Users"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
