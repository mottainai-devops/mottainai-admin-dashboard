import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, Building2 } from "lucide-react";
import { toast } from "sonner";
import { LotSelector } from "@/components/LotSelector";

interface OperationalLot {
  lotCode: string;
  lotName: string;
  paytWebhook: string;
  monthlyWebhook: string;
}

interface Company {
  _id: string;
  companyId: string;
  companyName: string;
  pin: string; // PIN for mobile app authentication
  operationalLots: OperationalLot[];
  active: boolean;
}

export default function Companies() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [createLots, setCreateLots] = useState<OperationalLot[]>([]);
  const [editLots, setEditLots] = useState<OperationalLot[]>([]);
  
  const utils = trpc.useUtils();
  const { data: companies, isLoading } = trpc.companies.list.useQuery();
  
  const createMutation = trpc.companies.create.useMutation({
    onSuccess: () => {
      toast.success("Company created successfully");
      utils.companies.list.invalidate();
      setIsCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to create company: ${error.message}`);
    },
  });
  
  const updateMutation = trpc.companies.update.useMutation({
    onSuccess: () => {
      toast.success("Company updated successfully");
      utils.companies.list.invalidate();
      setIsEditDialogOpen(false);
      setSelectedCompany(null);
    },
    onError: (error) => {
      toast.error(`Failed to update company: ${error.message}`);
    },
  });
  
  const deleteMutation = trpc.companies.delete.useMutation({
    onSuccess: () => {
      toast.success("Company deleted successfully");
      utils.companies.list.invalidate();
    },
    onError: (error) => {
      toast.error(`Failed to delete company: ${error.message}`);
    },
  });

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (createLots.length === 0) {
      toast.error("Please add at least one operational lot");
      return;
    }
    
    createMutation.mutate({
      companyId: formData.get('companyId') as string,
      companyName: formData.get('companyName') as string,
      pin: formData.get('pin') as string,
      operationalLots: createLots,
    });
  };

  const handleEdit = (company: Company) => {
    setSelectedCompany(company);
    setEditLots(company.operationalLots);
    setIsEditDialogOpen(true);
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedCompany) return;
    
    const formData = new FormData(e.currentTarget);
    
    if (editLots.length === 0) {
      toast.error("Please add at least one operational lot");
      return;
    }
    
    updateMutation.mutate({
      id: selectedCompany._id,
      companyName: formData.get('companyName') as string,
      pin: formData.get('pin') as string,
      operationalLots: editLots,
    });
  };

  const handleDelete = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete ${name}?`)) {
      deleteMutation.mutate({ id });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading companies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Company Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage waste management companies and their operational lots
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Company
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Company</DialogTitle>
              <DialogDescription>
                Add a new waste management company with operational lots
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="companyId">Company ID</Label>
                  <Input id="companyId" name="companyId" required placeholder="e.g., MOTTAINAI" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="companyName">Company Name</Label>
                  <Input id="companyName" name="companyName" required placeholder="e.g., MOTTAINAI" />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN (4-6 digits)</Label>
                  <Input id="pin" name="pin" required placeholder="e.g., 1234" minLength={4} maxLength={6} />
                  <p className="text-sm text-muted-foreground">Used for mobile app authentication</p>
                </div>
                
                <LotSelector selectedLots={createLots} onLotsChange={setCreateLots} />
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Company"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {companies?.map((company: Company) => (
          <Card key={company._id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-8 w-8 text-primary" />
                  <div>
                    <CardTitle>{company.companyName}</CardTitle>
                    <CardDescription className="mt-1">
                      ID: {company.companyId}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(company)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(company._id, company.companyName)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <h4 className="text-sm font-semibold">Operational Lots ({company.operationalLots.length})</h4>
                <div className="grid gap-2">
                  {company.operationalLots.map((lot, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 border rounded">
                      <Badge variant="secondary">{lot.lotCode}</Badge>
                      <span className="text-sm">{lot.lotName}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company information and operational lots
            </DialogDescription>
          </DialogHeader>
          {selectedCompany && (
            <form onSubmit={handleUpdate}>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-companyName">Company Name</Label>
                  <Input
                    id="edit-companyName"
                    name="companyName"
                    defaultValue={selectedCompany.companyName}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-pin">PIN (4-6 digits)</Label>
                  <Input
                    id="edit-pin"
                    name="pin"
                    defaultValue={selectedCompany.pin}
                    required
                    minLength={4}
                    maxLength={6}
                  />
                  <p className="text-sm text-muted-foreground">Used for mobile app authentication</p>
                </div>
                
                <LotSelector selectedLots={editLots} onLotsChange={setEditLots} />
              </div>
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setSelectedCompany(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Updating..." : "Update Company"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
