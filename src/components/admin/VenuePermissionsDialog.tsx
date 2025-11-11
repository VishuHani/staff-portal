"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Shield, Check, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAvailablePermissions,
  getUserEffectiveVenuePermissions,
  bulkUpdateUserVenuePermissions,
} from "@/lib/actions/admin/venue-permissions";
import type { PermissionResource } from "@/lib/rbac/permissions";

interface VenuePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    role: {
      name: string;
    };
  };
  venues: Array<{
    id: string;
    name: string;
    code: string;
    active: boolean;
  }>;
}

interface Permission {
  id: string;
  resource: PermissionResource;
  action: string;
  description: string;
}

// Resource display names for better UX
const RESOURCE_LABELS: Record<PermissionResource, string> = {
  users: "Users",
  roles: "Roles",
  stores: "Stores/Venues",
  availability: "Availability",
  timeoff: "Time Off",
  posts: "Posts",
  messages: "Messages",
  notifications: "Notifications",
  audit: "Audit Logs",
  channels: "Channels",
  reports: "Reports",
  schedules: "Schedules",
  settings: "Settings",
  admin: "Admin Functions",
};

// Icons for each resource category
const RESOURCE_ICONS: Record<PermissionResource, string> = {
  users: "👥",
  roles: "🛡️",
  stores: "🏢",
  availability: "📅",
  timeoff: "🏖️",
  posts: "📝",
  messages: "💬",
  notifications: "🔔",
  audit: "📋",
  channels: "📢",
  reports: "📊",
  schedules: "⏰",
  settings: "⚙️",
  admin: "👑",
};

export function VenuePermissionsDialog({
  open,
  onOpenChange,
  user,
  venues,
}: VenuePermissionsDialogProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [allPermissions, setAllPermissions] = useState<
    Record<PermissionResource, Permission[]>
  >({} as any);
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set()
  );
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(
    new Set()
  );
  const [venuePermissions, setVenuePermissions] = useState<Set<string>>(
    new Set()
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load available permissions on mount
  useEffect(() => {
    if (open) {
      loadPermissions();
    }
  }, [open]);

  // Load user's effective permissions when venue changes
  useEffect(() => {
    if (selectedVenueId && open) {
      loadUserPermissions();
    }
  }, [selectedVenueId, open]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const result = await getAvailablePermissions();
      if (result.success && result.permissions) {
        setAllPermissions(result.permissions);
      } else {
        toast.error("Failed to load permissions");
      }
    } catch (error) {
      console.error("Error loading permissions:", error);
      toast.error("Failed to load permissions");
    } finally {
      setLoading(false);
    }
  };

  const loadUserPermissions = async () => {
    if (!selectedVenueId) return;

    setLoading(true);
    try {
      const result = await getUserEffectiveVenuePermissions(
        user.id,
        selectedVenueId
      );

      if (result.success && result.rolePermissions && result.venuePermissions) {
        // Track role-based permissions (read-only, shown as disabled checkboxes)
        const rolePerms = new Set(
          result.rolePermissions.map((p) => `${p.resource}:${p.action}`)
        );
        setRolePermissions(rolePerms);

        // Track venue-specific permissions (editable)
        const venuePerms = new Set(
          result.venuePermissions.map((p) => `${p.resource}:${p.action}`)
        );
        setVenuePermissions(venuePerms);

        // Selected permissions = venue permissions only
        // (role permissions are shown but not selectable)
        setSelectedPermissions(venuePerms);
      } else {
        toast.error("Failed to load user permissions");
      }
    } catch (error) {
      console.error("Error loading user permissions:", error);
      toast.error("Failed to load user permissions");
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: string, key: string) => {
    // Don't allow toggling if it's a role permission
    if (rolePermissions.has(key)) {
      return;
    }

    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSelectAllResource = (resource: PermissionResource) => {
    const resourcePerms = allPermissions[resource] || [];
    const allKeys = resourcePerms.map((p) => `${p.resource}:${p.action}`);
    const editableKeys = allKeys.filter((key) => !rolePermissions.has(key));

    setSelectedPermissions((prev) => {
      const newSet = new Set(prev);
      const allSelected = editableKeys.every((key) => newSet.has(key));

      if (allSelected) {
        // Deselect all
        editableKeys.forEach((key) => newSet.delete(key));
      } else {
        // Select all
        editableKeys.forEach((key) => newSet.add(key));
      }

      return newSet;
    });
  };

  const handleSave = async () => {
    if (!selectedVenueId) {
      toast.error("Please select a venue");
      return;
    }

    setSaving(true);
    try {
      // Get permission IDs for selected venue permissions
      const permissionIds: string[] = [];
      Object.values(allPermissions)
        .flat()
        .forEach((perm) => {
          const key = `${perm.resource}:${perm.action}`;
          if (selectedPermissions.has(key) && !rolePermissions.has(key)) {
            permissionIds.push(perm.id);
          }
        });

      const result = await bulkUpdateUserVenuePermissions(
        user.id,
        selectedVenueId,
        permissionIds
      );

      if (result.success) {
        toast.success(result.message || "Permissions updated successfully");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Failed to update permissions");
      }
    } catch (error) {
      console.error("Error saving permissions:", error);
      toast.error("Failed to update permissions");
    } finally {
      setSaving(false);
    }
  };

  const userName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.email;

  const selectedVenue = venues.find((v) => v.id === selectedVenueId);

  // Calculate summary stats
  const totalVenuePermissions = Array.from(selectedPermissions).filter(
    (key) => !rolePermissions.has(key)
  ).length;
  const totalRolePermissions = rolePermissions.size;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Manage Venue Permissions
          </DialogTitle>
          <DialogDescription>
            Configure venue-specific permissions for {userName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* User Info */}
          <div className="p-3 bg-muted rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">User:</span>
              <span className="text-sm">{userName}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Role:</span>
              <Badge variant="secondary">{user.role.name}</Badge>
            </div>
          </div>

          {/* Venue Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Venue</label>
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a venue" />
              </SelectTrigger>
              <SelectContent>
                {venues.map((venue) => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name} ({venue.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedVenueId && (
            <>
              {/* Permission Summary */}
              <div className="flex gap-4 p-3 bg-muted rounded-lg">
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {totalRolePermissions}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    From Role
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {totalVenuePermissions}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Venue-Specific
                  </div>
                </div>
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {totalRolePermissions + totalVenuePermissions}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Total Active
                  </div>
                </div>
              </div>

              {/* Permissions List */}
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="flex-1 min-h-0 pr-4">
                  <Accordion type="multiple" className="space-y-2">
                    {Object.entries(allPermissions).map(
                      ([resource, permissions]) => {
                        const resourceKey = resource as PermissionResource;
                        const resourcePerms = permissions.map(
                          (p) => `${p.resource}:${p.action}`
                        );
                        const editablePerms = resourcePerms.filter(
                          (key) => !rolePermissions.has(key)
                        );
                        const selectedCount = resourcePerms.filter(
                          (key) =>
                            selectedPermissions.has(key) ||
                            rolePermissions.has(key)
                        ).length;
                        const venueOnlyCount = editablePerms.filter((key) =>
                          selectedPermissions.has(key)
                        ).length;

                        return (
                          <AccordionItem
                            key={resource}
                            value={resource}
                            className="border rounded-lg px-4"
                          >
                            <AccordionTrigger className="hover:no-underline">
                              <div className="flex items-center justify-between w-full pr-4">
                                <div className="flex items-center gap-3">
                                  <span className="text-2xl">
                                    {RESOURCE_ICONS[resourceKey]}
                                  </span>
                                  <span className="font-medium">
                                    {RESOURCE_LABELS[resourceKey]}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {venueOnlyCount > 0 && (
                                    <Badge
                                      variant="default"
                                      className="text-xs"
                                    >
                                      +{venueOnlyCount} venue
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {selectedCount}/{permissions.length}
                                  </Badge>
                                </div>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="pt-4 space-y-2">
                              {/* Select All Toggle */}
                              {editablePerms.length > 0 && (
                                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      handleSelectAllResource(resourceKey)
                                    }
                                    className="text-xs"
                                  >
                                    {editablePerms.every((key) =>
                                      selectedPermissions.has(key)
                                    )
                                      ? "Deselect All"
                                      : "Select All"}
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    {editablePerms.length} editable permissions
                                  </span>
                                </div>
                              )}

                              {/* Permission Checkboxes */}
                              {permissions.map((permission) => {
                                const key = `${permission.resource}:${permission.action}`;
                                const isFromRole = rolePermissions.has(key);
                                const isSelected =
                                  selectedPermissions.has(key) || isFromRole;

                                return (
                                  <div
                                    key={permission.id}
                                    className={`flex items-start gap-3 p-2 rounded ${
                                      isFromRole
                                        ? "bg-blue-50 border border-blue-200"
                                        : "hover:bg-muted"
                                    }`}
                                  >
                                    <Checkbox
                                      id={permission.id}
                                      checked={isSelected}
                                      onCheckedChange={() =>
                                        handlePermissionToggle(
                                          permission.id,
                                          key
                                        )
                                      }
                                      disabled={isFromRole}
                                      className="mt-1"
                                    />
                                    <label
                                      htmlFor={permission.id}
                                      className={`flex-1 text-sm cursor-pointer ${
                                        isFromRole
                                          ? "text-blue-900"
                                          : "text-foreground"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium">
                                          {permission.action}
                                        </span>
                                        {isFromRole && (
                                          <Badge
                                            variant="secondary"
                                            className="text-xs bg-blue-100 text-blue-700"
                                          >
                                            From Role
                                          </Badge>
                                        )}
                                      </div>
                                      {permission.description && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {permission.description}
                                        </p>
                                      )}
                                    </label>
                                  </div>
                                );
                              })}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      }
                    )}
                    </Accordion>
                </ScrollArea>
              )}
            </>
          )}

          {!selectedVenueId && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Shield className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Select a venue to manage permissions
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!selectedVenueId || saving || loading}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Permissions
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
