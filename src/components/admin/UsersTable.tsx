"use client";

import { useState } from "react";
import {
  Edit,
  Trash2,
  UserPlus,
  MoreVertical,
  Shield,
  Power,
  Building2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Input } from "@/components/ui/input";
import { UserDialog } from "./UserDialog";
import { VenuePermissionsDialog } from "./VenuePermissionsDialog";
import { toggleUserActive, deleteUser } from "@/lib/actions/admin/users";
import { toast } from "sonner";

interface User {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  active: boolean;
  role: {
    id: string;
    name: string;
    rolePermissions: any[];
  };
  store: {
    id: string;
    name: string;
  } | null;
  venues?: Array<{
    venue: {
      id: string;
      name: string;
      code: string;
      active: boolean;
    };
    isPrimary: boolean;
  }>;
}

interface Role {
  id: string;
  name: string;
}

interface Store {
  id: string;
  name: string;
}

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface UsersTableProps {
  users: User[];
  roles: Role[];
  stores: Store[];
  venues: Venue[];
  currentUser: {
    id: string;
    role: {
      name: string;
    };
  };
}

export function UsersTable({ users, roles, stores, venues, currentUser }: UsersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterVenue, setFilterVenue] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [permissionsUser, setPermissionsUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [processing, setProcessing] = useState(false);

  // Helper function to check if current user can manage permissions for target user
  const canManagePermissions = (targetUser: User): boolean => {
    const isAdmin = currentUser.role.name === "ADMIN";
    const isSelfView = targetUser.id === currentUser.id;
    const targetIsAdmin = targetUser.role.name === "ADMIN";
    const targetIsManager = targetUser.role.rolePermissions.some(
      (rp: any) => rp.permission?.action === "manage"
    );

    // Admins can manage everyone except themselves
    if (isAdmin) {
      return !isSelfView; // Admins can't edit their own permissions
    }

    // Non-admins can't manage anyone (managers will see view-only in the dialog)
    // The dialog itself will enforce read-only mode
    // So we allow managers to VIEW their own and staff permissions
    return isSelfView || (!targetIsAdmin && !targetIsManager);
  };

  // Get label for permissions menu item
  const getPermissionsMenuLabel = (targetUser: User): string => {
    const isSelfView = targetUser.id === currentUser.id;
    if (isSelfView) {
      return "View My Permissions";
    }
    return "Manage Venue Permissions";
  };

  // Filter users
  const filteredUsers = users.filter((user) => {
    const fullName = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`.toLowerCase()
      : "";
    const matchesSearch =
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      fullName.includes(searchQuery.toLowerCase());
    const matchesRole = filterRole === "all" || user.role.id === filterRole;
    const matchesStatus =
      filterStatus === "all" ||
      (filterStatus === "active" && user.active) ||
      (filterStatus === "inactive" && !user.active);
    const matchesVenue =
      filterVenue === "all" ||
      (user.venues?.some((v) => v.venue.id === filterVenue) ?? false);

    return matchesSearch && matchesRole && matchesStatus && matchesVenue;
  });

  const handleCreateUser = () => {
    setSelectedUser(null);
    setDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setDialogOpen(true);
  };

  const handleToggleActive = async (user: User) => {
    setProcessing(true);
    const result = await toggleUserActive({ userId: user.id });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `User ${user.active ? "deactivated" : "activated"} successfully`
      );
      // Refresh the page
      window.location.reload();
    }

    setProcessing(false);
  };

  const handleDeleteUser = async () => {
    if (!deletingUser) return;

    setProcessing(true);
    const result = await deleteUser({ userId: deletingUser.id });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("User deleted successfully");
      setDeleteDialogOpen(false);
      setDeletingUser(null);
      // Refresh the page
      window.location.reload();
    }

    setProcessing(false);
  };

  const openDeleteDialog = (user: User) => {
    setDeletingUser(user);
    setDeleteDialogOpen(true);
  };

  const handleManagePermissions = (user: User) => {
    setPermissionsUser(user);
    setPermissionsDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Filters and Search */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-wrap gap-2">
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />

            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Roles</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>

            <select
              value={filterVenue}
              onChange={(e) => setFilterVenue(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Venues</option>
              {venues.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <Button onClick={handleCreateUser}>
            <UserPlus className="mr-2 h-4 w-4" />
            Create User
          </Button>
        </div>

        {/* Users List */}
        <div className="space-y-2">
          {filteredUsers.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No users found matching your filters
              </p>
            </div>
          ) : (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.email}
                    </p>
                    {!user.active && (
                      <Badge variant="destructive">Inactive</Badge>
                    )}
                  </div>
                  {user.firstName && user.lastName && (
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  )}
                  <div className="flex items-center flex-wrap gap-2 text-sm">
                    <Badge variant="secondary">
                      <Shield className="mr-1 h-3 w-3" />
                      {user.role.name}
                    </Badge>

                    {/* Venue Badges */}
                    {user.venues && user.venues.length > 0 && (
                      <>
                        {user.venues.map((userVenue) => (
                          <Badge
                            key={userVenue.venue.id}
                            variant={userVenue.isPrimary ? "default" : "outline"}
                            className="flex items-center gap-1"
                          >
                            <Building2 className="h-3 w-3" />
                            {userVenue.venue.code}
                            {userVenue.isPrimary && (
                              <Star className="h-3 w-3 fill-current" />
                            )}
                          </Badge>
                        ))}
                      </>
                    )}

                    {/* Legacy store display */}
                    {user.store && (!user.venues || user.venues.length === 0) && (
                      <Badge variant="outline" className="text-xs">
                        <Building2 className="mr-1 h-3 w-3" />
                        {user.store.name} (Legacy)
                      </Badge>
                    )}
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={processing}
                    >
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditUser(user)}>
                      <Edit className="mr-2 h-4 w-4" />
                      Edit User
                    </DropdownMenuItem>
                    {canManagePermissions(user) && (
                      <DropdownMenuItem onClick={() => handleManagePermissions(user)}>
                        <Shield className="mr-2 h-4 w-4" />
                        {getPermissionsMenuLabel(user)}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleToggleActive(user)}>
                      <Power className="mr-2 h-4 w-4" />
                      {user.active ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(user)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete User
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))
          )}
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </div>

      {/* User Dialog */}
      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        roles={roles}
        stores={stores}
        venues={venues}
      />

      {/* Venue Permissions Dialog */}
      {permissionsUser && (
        <VenuePermissionsDialog
          open={permissionsDialogOpen}
          onOpenChange={setPermissionsDialogOpen}
          user={permissionsUser}
          venues={venues}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deletingUser?.email}? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={processing}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={processing}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {processing ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
