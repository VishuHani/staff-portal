"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Edit, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { deleteRole } from "@/lib/actions/admin/roles";

type Permission = {
  id: string;
  resource: string;
  action: string;
  description: string | null;
};

type RolePermission = {
  id: string;
  permissionId: string;
  permission: Permission;
};

type Role = {
  id: string;
  name: string;
  description: string | null;
  rolePermissions: RolePermission[];
  _count: {
    users: number;
  };
};

interface RolesTableProps {
  roles: Role[];
  onEdit: (role: Role) => void;
  onManagePermissions: (role: Role) => void;
}

export function RolesTable({ roles, onEdit, onManagePermissions }: RolesTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const systemRoles = ["ADMIN", "MANAGER", "STAFF"];

  // Filter roles based on search query
  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = async () => {
    if (!roleToDelete) return;

    setIsDeleting(true);

    const result = await deleteRole({ roleId: roleToDelete.id });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Role deleted successfully");
      setRoleToDelete(null);
      window.location.reload();
    }

    setIsDeleting(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="flex items-center justify-between gap-4">
        <Input
          placeholder="Search roles..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <div className="text-sm text-muted-foreground">
          {filteredRoles.length} role{filteredRoles.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Roles Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredRoles.map((role) => {
          const isSystemRole = systemRoles.includes(role.name);

          return (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-primary" />
                      {role.name}
                    </CardTitle>
                    {isSystemRole && (
                      <Badge variant="secondary" className="text-xs">
                        System Role
                      </Badge>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="sr-only">Open menu</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="12" cy="5" r="1" />
                          <circle cx="12" cy="19" r="1" />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(role)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onManagePermissions(role)}>
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Manage Permissions
                      </DropdownMenuItem>
                      {!isSystemRole && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => setRoleToDelete(role)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Role
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <CardDescription className="line-clamp-2">
                  {role.description || "No description provided"}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Permissions:</span>
                  <span className="font-medium">
                    {role.rolePermissions.length}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="h-4 w-4" />
                    Users:
                  </span>
                  <span className="font-medium">{role._count.users}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredRoles.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <ShieldCheck className="h-12 w-12 text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-semibold">No roles found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {searchQuery
              ? "Try adjusting your search query"
              : "Create your first custom role to get started"}
          </p>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!roleToDelete} onOpenChange={() => setRoleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Role</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the role "{roleToDelete?.name}"?
              This action cannot be undone.
              {roleToDelete && roleToDelete._count.users > 0 && (
                <span className="mt-2 block font-medium text-destructive">
                  Warning: {roleToDelete._count.users} user(s) are currently
                  assigned to this role.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
