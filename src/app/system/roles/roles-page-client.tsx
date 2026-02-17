"use client";

import { useState } from "react";
import { Plus, Shield, Users, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RolesTable } from "@/components/admin/RolesTable";
import { RoleDialog } from "@/components/admin/RoleDialog";
import { PermissionsManager } from "@/components/admin/PermissionsManager";

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

interface RolesPageClientProps {
  roles: Role[];
  permissions: Permission[];
}

export function RolesPageClient({ roles, permissions }: RolesPageClientProps) {
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [permissionsDialogOpen, setPermissionsDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");

  const handleCreateRole = () => {
    setSelectedRole(null);
    setDialogMode("create");
    setRoleDialogOpen(true);
  };

  const handleEditRole = (role: Role) => {
    setSelectedRole(role);
    setDialogMode("edit");
    setRoleDialogOpen(true);
  };

  const handleManagePermissions = (role: Role) => {
    setSelectedRole(role);
    setPermissionsDialogOpen(true);
  };

  // Calculate stats
  const totalUsers = roles.reduce((sum, role) => sum + role._count.users, 0);
  const totalPermissions = roles.reduce(
    (sum, role) => sum + role.rolePermissions.length,
    0
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Role Management
          </h2>
          <p className="mt-2 text-muted-foreground">
            Manage roles and their permissions
          </p>
        </div>
        <Button onClick={handleCreateRole}>
          <Plus className="mr-2 h-4 w-4" />
          Create Role
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roles.length}</div>
            <p className="text-xs text-muted-foreground">
              System and custom roles
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Users with role assignments
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Permissions
            </CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPermissions}</div>
            <p className="text-xs text-muted-foreground">
              Total assigned permissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Roles Table */}
      <RolesTable
        roles={roles}
        onEdit={handleEditRole}
        onManagePermissions={handleManagePermissions}
      />

      {/* Dialogs */}
      <RoleDialog
        open={roleDialogOpen}
        onOpenChange={setRoleDialogOpen}
        role={selectedRole}
        mode={dialogMode}
      />

      <PermissionsManager
        open={permissionsDialogOpen}
        onOpenChange={setPermissionsDialogOpen}
        role={selectedRole}
        allPermissions={permissions}
      />
    </div>
  );
}
