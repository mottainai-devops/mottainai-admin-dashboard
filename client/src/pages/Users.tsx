import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, UserPlus, Shield, User as UserIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface User {
  id: string;
  username: string;
  name: string | null;
  email: string | null;
  role: 'superadmin' | 'admin' | 'user';
  active: boolean;
  companyId: string | null;
  loginMethod: 'password' | 'oauth' | null;
  createdAt: Date;
  lastSignedIn: Date;
}

export default function Users() {
  const { user: currentUser, isSuperAdmin } = useAuth();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    username: "",
    password: "",
    name: "",
    email: "",
    role: "admin" as 'superadmin' | 'admin' | 'user',
    companyId: "",
    active: true,
  });

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const { data: companies } = trpc.companies.list.useQuery();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("User created successfully");
      setIsCreateDialogOpen(false);
      resetForm();
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create user");
    },
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("User updated successfully");
      setIsEditDialogOpen(false);
      setSelectedUser(null);
      resetForm();
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update user");
    },
  });

  const deleteMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("User deleted successfully");
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
      utils.users.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete user");
    },
  });

  const resetForm = () => {
    setFormData({
      username: "",
      password: "",
      name: "",
      email: "",
      role: "admin",
      companyId: "",
      active: true,
    });
  };

  const handleCreate = () => {
    if (!formData.username || !formData.password) {
      toast.error("Username and password are required");
      return;
    }
    createMutation.mutate({
      ...formData,
      companyId: formData.companyId || undefined,
    });
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setFormData({
      username: user.username,
      password: "",
      name: user.name || "",
      email: user.email || "",
      role: user.role,
      companyId: user.companyId || "",
      active: user.active,
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedUser) return;
    
    const updateData: any = {
      id: selectedUser.id,
      name: formData.name || null,
      email: formData.email || null,
      role: formData.role,
      companyId: formData.companyId || null,
      active: formData.active,
    };

    // Only include password if it's been changed
    if (formData.password) {
      updateData.password = formData.password;
    }

    updateMutation.mutate(updateData);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!selectedUser) return;
    deleteMutation.mutate({ id: selectedUser.id });
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      superadmin: "destructive",
      admin: "default",
      user: "secondary",
    };
    return (
      <Badge variant={variants[role] || "secondary"}>
        {role === 'superadmin' && <Shield className="w-3 h-3 mr-1" />}
        {role}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-gray-600 mt-1">Manage admin users and their permissions</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="w-4 h-4 mr-2" />
          Add User
        </Button>
      </div>

      <div className="grid gap-4">
        {users?.map((user) => (
          <Card key={user.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <UserIcon className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{user.name || user.username}</CardTitle>
                    <CardDescription>@{user.username}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getRoleBadge(user.role)}
                  {!user.active && <Badge variant="secondary">Inactive</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600 space-y-1">
                  {user.email && <div>Email: {user.email}</div>}
                  {user.companyId && (
                    <div>Company: {companies?.find(c => c._id === user.companyId)?.companyName || 'Unknown'}</div>
                  )}
                  <div>Login Method: {user.loginMethod || 'N/A'}</div>
                  <div>Last Sign In: {new Date(user.lastSignedIn).toLocaleDateString()}</div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(user)}
                    disabled={!isSuperAdmin && user.role === 'superadmin'}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(user)}
                    disabled={user.id === currentUser?.id || (!isSuperAdmin && user.role === 'superadmin')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create User Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the admin dashboard
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="create-username">Username *</Label>
              <Input
                id="create-username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            <div>
              <Label htmlFor="create-password">Password *</Label>
              <Input
                id="create-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter password (min 6 characters)"
              />
            </div>
            <div>
              <Label htmlFor="create-name">Full Name</Label>
              <Input
                id="create-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label htmlFor="create-email">Email</Label>
              <Input
                id="create-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="create-role">Role</Label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && <SelectItem value="superadmin">Super Admin</SelectItem>}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="create-company">Assigned Company (Optional)</Label>
              <Select value={formData.companyId || "none"} onValueChange={(value) => setFormData({ ...formData, companyId: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company._id} value={company._id}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsCreateDialogOpen(false);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Creating..." : "Create User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Username</Label>
              <Input value={formData.username} disabled />
            </div>
            <div>
              <Label htmlFor="edit-password">New Password (leave blank to keep current)</Label>
              <Input
                id="edit-password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password"
              />
            </div>
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <Label htmlFor="edit-role">Role</Label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isSuperAdmin && <SelectItem value="superadmin">Super Admin</SelectItem>}
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-company">Assigned Company (Optional)</Label>
              <Select value={formData.companyId || "none"} onValueChange={(value) => setFormData({ ...formData, companyId: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a company" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {companies?.map((company) => (
                    <SelectItem key={company._id} value={company._id}>
                      {company.companyName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="edit-active">Active</Label>
              <Switch
                id="edit-active"
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsEditDialogOpen(false);
              setSelectedUser(null);
              resetForm();
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedUser?.name || selectedUser?.username}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setIsDeleteDialogOpen(false);
              setSelectedUser(null);
            }}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
