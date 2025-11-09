"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { assignPermissionsToRole } from "@/lib/actions/admin/roles";

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

interface PermissionsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role | null;
  allPermissions: Permission[];
}

export function PermissionsManager({
  open,
  onOpenChange,
  role,
  allPermissions,
}: PermissionsManagerProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Group permissions by resource
  const groupedPermissions = allPermissions.reduce((acc, permission) => {
    if (!acc[permission.resource]) {
      acc[permission.resource] = [];
    }
    acc[permission.resource].push(permission);
    return acc;
  }, {} as Record<string, Permission[]>);

  // Update selected permissions when role changes
  useEffect(() => {
    if (role) {
      const currentPermissionIds = role.rolePermissions.map(
        (rp) => rp.permissionId
      );
      setSelectedPermissions(currentPermissionIds);
    }
  }, [role]);

  const handleTogglePermission = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleToggleResource = (resource: string) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    const resourcePermissionIds = resourcePermissions.map((p) => p.id);

    const allSelected = resourcePermissionIds.every((id) =>
      selectedPermissions.includes(id)
    );

    if (allSelected) {
      // Deselect all from this resource
      setSelectedPermissions((prev) =>
        prev.filter((id) => !resourcePermissionIds.includes(id))
      );
    } else {
      // Select all from this resource
      setSelectedPermissions((prev) => {
        const newSelection = [...prev];
        resourcePermissionIds.forEach((id) => {
          if (!newSelection.includes(id)) {
            newSelection.push(id);
          }
        });
        return newSelection;
      });
    }
  };

  const handleSave = async () => {
    if (!role) return;

    if (selectedPermissions.length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    setIsSubmitting(true);

    const result = await assignPermissionsToRole({
      roleId: role.id,
      permissionIds: selectedPermissions,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Permissions updated successfully");
      onOpenChange(false);
      window.location.reload();
    }

    setIsSubmitting(false);
  };

  const formatResourceName = (resource: string) => {
    return resource
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const formatActionName = (action: string) => {
    return action
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Manage Permissions - {role?.name}
          </DialogTitle>
          <DialogDescription>
            Select the permissions you want to assign to this role.
            {selectedPermissions.length > 0 && (
              <span className="ml-1 font-medium">
                ({selectedPermissions.length} selected)
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([resource, permissions]) => {
              const resourcePermissionIds = permissions.map((p) => p.id);
              const allSelected = resourcePermissionIds.every((id) =>
                selectedPermissions.includes(id)
              );
              const someSelected = resourcePermissionIds.some((id) =>
                selectedPermissions.includes(id)
              );

              return (
                <div key={resource} className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`resource-${resource}`}
                      checked={allSelected}
                      onCheckedChange={() => handleToggleResource(resource)}
                      className={someSelected && !allSelected ? "opacity-50" : ""}
                    />
                    <Label
                      htmlFor={`resource-${resource}`}
                      className="cursor-pointer text-base font-semibold"
                    >
                      {formatResourceName(resource)}
                    </Label>
                  </div>

                  <div className="ml-6 space-y-2">
                    {permissions.map((permission) => (
                      <div key={permission.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={permission.id}
                          checked={selectedPermissions.includes(permission.id)}
                          onCheckedChange={() => handleTogglePermission(permission.id)}
                        />
                        <div className="grid gap-1 leading-none">
                          <Label
                            htmlFor={permission.id}
                            className="cursor-pointer text-sm font-medium"
                          >
                            {formatActionName(permission.action)}
                          </Label>
                          {permission.description && (
                            <p className="text-xs text-muted-foreground">
                              {permission.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator />
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
