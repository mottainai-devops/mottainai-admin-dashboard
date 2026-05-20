import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, UserPlus, Smartphone, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

/**
 * FieldUsers — Manage mobile app field workers (property enumeration enumerators).
 * These users are stored in MongoDB (platform backend) and are distinct from the
 * admin dashboard login users managed by simpleAuth.
 *
 * Key feature: defaultLotCode is auto-populated from the selected company's first
 * operational lot, fixing the "No lots assigned to your account" bug for new users.
 * (Part B fix v4.5.4 — Joint API Contract §2.1)
 */

interface FieldUser {
  id: string;
  username: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  companyId: string | null;
  defaultLotCode: string | null;
  monthlyBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const EMPTY_FORM = {
  fullName: "",
  username: "",
  password: "",
  email: "",
  phone: "",
  role: "user" as const,
  companyId: "",
  defaultLotCode: "",
};

export default function FieldUsers() {
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<FieldUser | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const { data: companies } = trpc.companies.list.useQuery();

  // Helper: auto-derive defaultLotCode from a company's first operational lot
  const getDefaultLotForCompany = (companyId: string): string => {
    if (!companyId || companyId === "none") return "";
    const company = companies?.find((c: any) => c._id === companyId);
    const firstLot = (company as any)?.operationalLots?.[0];
    return firstLot?.lotCode ?? "";
  };

  const resetForm = () => setFormData(EMPTY_FORM);

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Field user created successfully");
      setIsCreateOpen(false);
      resetForm();
      utils.users.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to create user"),
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Field user updated successfully");
      setIsEditOpen(false);
      setSelectedUser(null);
      resetForm();
      utils.users.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to update user"),
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Field user deleted successfully");
      setIsDeleteOpen(false);
      setSelectedUser(null);
      utils.users.list.invalidate();
    },
    onError: (err) => toast.error(err.message || "Failed to delete user"),
  });

  const handleCreate = () => {
    if (!formData.fullName || !formData.password) {
      toast.error("Full name and password are required");
      return;
    }
    createMutation.mutate({
      fullName: formData.fullName,
      username: formData.username || undefined,
      password: formData.password,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      role: formData.role,
      companyId: formData.companyId || undefined,
      defaultLotCode: formData.defaultLotCode || undefined,
    });
  };

  const handleEdit = (user: FieldUser) => {
    setSelectedUser(user);
    setFormData({
      fullName: user.fullName || "",
      username: user.username || "",
      password: "",
      email: user.email || "",
      phone: user.phone || "",
      role: (user.role as any) || "user",
      companyId: user.companyId || "",
      defaultLotCode: user.defaultLotCode || getDefaultLotForCompany(user.companyId || ""),
    });
    setIsEditOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedUser) return;
    const updateData: any = {
      id: selectedUser.id,
      fullName: formData.fullName || undefined,
      email: formData.email || undefined,
      phone: formData.phone || undefined,
      role: formData.role,
      companyId: formData.companyId || undefined,
      defaultLotCode: formData.defaultLotCode || null,
    };
    if (formData.password) updateData.password = formData.password;
    updateMutation.mutate(updateData);
  };

  const filteredUsers = (users as FieldUser[] | undefined)?.filter((u) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q);
    const matchesCompany = companyFilter === "all" || u.companyId === companyFilter;
    return matchesSearch && matchesCompany;
  }) ?? [];

  const CompanySelector = ({
    id,
    value,
    onChange,
  }: {
    id: string;
    value: string;
    onChange: (companyId: string, autoLot: string) => void;
  }) => (
    <Select
      value={value || "none"}
      onValueChange={(v) => {
        const newId = v === "none" ? "" : v;
        onChange(newId, getDefaultLotForCompany(newId));
      }}
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select a company" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {companies?.map((c: any) => (
          <SelectItem key={c._id} value={c._id}>
            {c.companyName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-gray-600">Loading field users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Smartphone className="h-7 w-7 text-blue-600" />
            Field Users
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage mobile app enumerators. Default lot code is auto-assigned from the company's first operational lot.
          </p>
        </div>
        <Button onClick={() => { resetForm(); setIsCreateOpen(true); }}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Field User
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Search by name, email, username, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies?.map((c: any) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.companyName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Users</p>
            <p className="text-2xl font-bold">{users?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">With Lot Assigned</p>
            <p className="text-2xl font-bold text-green-600">
              {(users as FieldUser[] | undefined)?.filter((u) => u.defaultLotCode).length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">No Lot (At Risk)</p>
            <p className="text-2xl font-bold text-red-600">
              {(users as FieldUser[] | undefined)?.filter((u) => !u.defaultLotCode).length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Showing</p>
            <p className="text-2xl font-bold">{filteredUsers.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      {filteredUsers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No field users found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => {
            const company = companies?.find((c: any) => c._id === user.companyId);
            return (
              <Card key={user.id} className="hover:shadow-md transition-shadow">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{user.fullName || user.username}</span>
                        {user.username && user.fullName && (
                          <span className="text-xs text-muted-foreground">@{user.username}</span>
                        )}
                        <Badge variant={user.defaultLotCode ? "default" : "destructive"} className="text-xs">
                          {user.defaultLotCode ? `Lot: ${user.defaultLotCode}` : "No Lot ⚠"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                        {user.email && <span>{user.email}</span>}
                        {user.phone && <span>{user.phone}</span>}
                        {company && <span className="text-blue-600">{(company as any).companyName}</span>}
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleEdit(user)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => { setSelectedUser(user); setIsDeleteOpen(true); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Field User</DialogTitle>
            <DialogDescription>Create a new mobile app enumerator account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name *</Label>
              <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} placeholder="e.g. John Adeyemi" />
            </div>
            <div>
              <Label>Username (Optional)</Label>
              <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} placeholder="Auto-generated if blank" />
            </div>
            <div>
              <Label>Password *</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Min 6 characters" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="user@example.com" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="+234..." />
            </div>
            <div>
              <Label>Assigned Company</Label>
              <CompanySelector
                id="create-company"
                value={formData.companyId}
                onChange={(companyId, autoLot) => setFormData({ ...formData, companyId, defaultLotCode: autoLot })}
              />
            </div>
            <div>
              <Label>Default Lot Code</Label>
              <Input
                value={formData.defaultLotCode}
                onChange={(e) => setFormData({ ...formData, defaultLotCode: e.target.value })}
                placeholder="Auto-filled from company (e.g. 6)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-populated from the company's first operational lot. Override if needed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsCreateOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Field User</DialogTitle>
            <DialogDescription>Update field worker details and lot assignment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} />
            </div>
            <div>
              <Label>New Password (leave blank to keep current)</Label>
              <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} placeholder="Enter new password" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <div>
              <Label>Assigned Company</Label>
              <CompanySelector
                id="edit-company"
                value={formData.companyId}
                onChange={(companyId, autoLot) => setFormData({ ...formData, companyId, defaultLotCode: autoLot })}
              />
            </div>
            <div>
              <Label>Default Lot Code</Label>
              <Input
                value={formData.defaultLotCode}
                onChange={(e) => setFormData({ ...formData, defaultLotCode: e.target.value })}
                placeholder="e.g. 6"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Auto-populated from the company's first operational lot. Override if needed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditOpen(false); setSelectedUser(null); resetForm(); }}>Cancel</Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Field User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.fullName || selectedUser?.username}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsDeleteOpen(false); setSelectedUser(null); }}>Cancel</Button>
            <Button variant="destructive" onClick={() => selectedUser && deleteMutation.mutate({ id: selectedUser.id })} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
