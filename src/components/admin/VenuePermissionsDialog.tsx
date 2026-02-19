"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Shield, Check, X, Loader2, AlertCircle } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  venues: "Venues",
  positions: "Positions",
  availability: "Availability",
  timeoff: "Time Off",
  posts: "Posts",
  comments: "Comments",
  reactions: "Reactions",
  messages: "Messages",
  conversations: "Conversations",
  notifications: "Notifications",
  audit: "Audit Logs",
  channels: "Channels",
  ai: "AI Features",
  reports: "Reports",
  schedules: "Schedules",
  announcements: "Announcements",
  settings: "Settings",
  media: "Media",
  dashboard: "Dashboard",
  profile: "Profile",
  admin: "Admin Functions",
  rosters: "Rosters",
};

// Icons for each resource category
const RESOURCE_ICONS: Record<PermissionResource, string> = {
  users: "👥",
  roles: "🛡️",
  stores: "🏢",
  venues: "🏪",
  positions: "💼",
  availability: "📅",
  timeoff: "🏖️",
  posts: "📝",
  comments: "💬",
  reactions: "👍",
  messages: "✉️",
  conversations: "💭",
  notifications: "🔔",
  audit: "📋",
  channels: "📢",
  ai: "🤖",
  reports: "📊",
  schedules: "⏰",
  announcements: "📣",
  settings: "⚙️",
  media: "🖼️",
  dashboard: "📈",
  profile: "👤",
  admin: "👑",
  rosters: "📆",
};

export function VenuePermissionsDialog({
  open,
  onOpenChange,
  user,
  venues,
}: VenuePermissionsDialogProps) {
  const [activeTab, setActiveTab] = useState<string>("");
  const [allPermissions, setAllPermissions] = useState<
    Record<PermissionResource, Permission[]>
  >({} as any);

  // Track permissions per venue
  const [venuePermissionsMap, setVenuePermissionsMap] = useState<
    Record<string, {
      selectedPermissions: Set<string>;
      rolePermissions: Set<string>;
      venuePermissions: Set<string>;
      isReadOnly: boolean;
    }>
  >({});

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Initialize active tab and load permissions on mount
  useEffect(() => {
    if (open && venues.length > 0) {
      // Set first venue as active tab
      if (!activeTab) {
        setActiveTab(venues[0].id);
      }
      loadPermissions();
    }
  }, [open, venues]);

  // Load user's effective permissions when active tab changes
  useEffect(() => {
    if (activeTab && open) {
      // Only load if we haven't loaded this venue yet
      if (!venuePermissionsMap[activeTab]) {
        loadUserPermissions(activeTab);
      }
    }
  }, [activeTab, open]);

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

  const loadUserPermissions = async (venueId: string) => {
    if (!venueId) return;

    setLoading(true);
    try {
      const result = await getUserEffectiveVenuePermissions(
        user.id,
        venueId
      );

      if (result.success && result.rolePermissions && result.venuePermissions) {
        // Track role-based permissions (read-only, shown as disabled checkboxes)
        const rolePerms = new Set(
          result.rolePermissions.map((p) => `${p.resource}:${p.action}`)
        );

        // Track venue-specific permissions (editable)
        const venuePerms = new Set(
          result.venuePermissions.map((p) => `${p.resource}:${p.action}`)
        );

        // Store permissions for this venue
        setVenuePermissionsMap((prev) => ({
          ...prev,
          [venueId]: {
            selectedPermissions: venuePerms,
            rolePermissions: rolePerms,
            venuePermissions: venuePerms,
            isReadOnly: result.isReadOnly || false,
          },
        }));
      } else {
        toast.error(result.error || "Failed to load user permissions");
      }
    } catch (error) {
      console.error("Error loading user permissions:", error);
      toast.error("Failed to load user permissions");
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionToggle = (permissionId: string, key: string) => {
    if (!activeTab || !venuePermissionsMap[activeTab]) return;

    const venueData = venuePermissionsMap[activeTab];

    // Don't allow toggling if it's a role permission or read-only mode
    if (venueData.rolePermissions.has(key) || venueData.isReadOnly) {
      return;
    }

    setVenuePermissionsMap((prev) => {
      const newMap = { ...prev };
      const newSelected = new Set(venueData.selectedPermissions);

      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }

      newMap[activeTab] = {
        ...venueData,
        selectedPermissions: newSelected,
      };

      return newMap;
    });
  };

  const handleSelectAllResource = (resource: PermissionResource) => {
    if (!activeTab || !venuePermissionsMap[activeTab]) return;

    const venueData = venuePermissionsMap[activeTab];
    if (venueData.isReadOnly) return;

    const resourcePerms = allPermissions[resource] || [];
    const allKeys = resourcePerms.map((p) => `${p.resource}:${p.action}`);
    const editableKeys = allKeys.filter((key) => !venueData.rolePermissions.has(key));

    setVenuePermissionsMap((prev) => {
      const newMap = { ...prev };
      const newSelected = new Set(venueData.selectedPermissions);
      const allSelected = editableKeys.every((key) => newSelected.has(key));

      if (allSelected) {
        // Deselect all
        editableKeys.forEach((key) => newSelected.delete(key));
      } else {
        // Select all
        editableKeys.forEach((key) => newSelected.add(key));
      }

      newMap[activeTab] = {
        ...venueData,
        selectedPermissions: newSelected,
      };

      return newMap;
    });
  };

  const handleSave = async () => {
    if (!activeTab) {
      toast.error("No venue selected");
      return;
    }

    const venueData = venuePermissionsMap[activeTab];
    if (!venueData) {
      toast.error("Venue data not loaded");
      return;
    }

    if (venueData.isReadOnly) {
      toast.error("You don't have permission to edit these permissions");
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
          if (venueData.selectedPermissions.has(key) && !venueData.rolePermissions.has(key)) {
            permissionIds.push(perm.id);
          }
        });

      const result = await bulkUpdateUserVenuePermissions(
        user.id,
        activeTab,
        permissionIds
      );

      if (result.success) {
        const venueName = venues.find((v) => v.id === activeTab)?.name || "venue";
        toast.success(result.message || `Permissions updated for ${venueName}`);
        // Optionally close dialog or stay open
        // onOpenChange(false);
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

  // Get current venue's data
  const currentVenueData = activeTab ? venuePermissionsMap[activeTab] : null;

  // Calculate summary stats for active venue
  const totalVenuePermissions = currentVenueData
    ? Array.from(currentVenueData.selectedPermissions).filter(
        (key) => !currentVenueData.rolePermissions.has(key)
      ).length
    : 0;
  const totalRolePermissions = currentVenueData?.rolePermissions.size || 0;

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

          {/* Read-Only Banner */}
          {currentVenueData?.isReadOnly && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You are viewing permissions in read-only mode. {currentVenueData.isReadOnly && "You cannot edit your own permissions."}
              </AlertDescription>
            </Alert>
          )}

          {/* Venue Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${venues.length}, 1fr)` }}>
              {venues.map((venue) => {
                const venueData = venuePermissionsMap[venue.id];
                const venuePermCount = venueData
                  ? Array.from(venueData.selectedPermissions).filter(
                      (key) => !venueData.rolePermissions.has(key)
                    ).length
                  : 0;

                return (
                  <TabsTrigger key={venue.id} value={venue.id} className="flex flex-col gap-1">
                    <span className="font-medium">{venue.name}</span>
                    {venueData && venuePermCount > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        +{venuePermCount}
                      </Badge>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {venues.map((venue) => (
              <TabsContent key={venue.id} value={venue.id} className="flex-1 overflow-hidden flex flex-col space-y-4 mt-4">
                {currentVenueData && activeTab === venue.id && (
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
                          (key) => !currentVenueData.rolePermissions.has(key)
                        );
                        const selectedCount = resourcePerms.filter(
                          (key) =>
                            currentVenueData.selectedPermissions.has(key) ||
                            currentVenueData.rolePermissions.has(key)
                        ).length;
                        const venueOnlyCount = editablePerms.filter((key) =>
                          currentVenueData.selectedPermissions.has(key)
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
                              {editablePerms.length > 0 && !currentVenueData.isReadOnly && (
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
                                      currentVenueData.selectedPermissions.has(key)
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
                                const isFromRole = currentVenueData.rolePermissions.has(key);
                                const isSelected =
                                  currentVenueData.selectedPermissions.has(key) || isFromRole;

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
                                      disabled={isFromRole || currentVenueData.isReadOnly}
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
              </TabsContent>
            ))}
          </Tabs>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {currentVenueData?.isReadOnly ? "Close" : "Cancel"}
          </Button>
          {!currentVenueData?.isReadOnly && (
            <Button
              type="button"
              onClick={handleSave}
              disabled={!activeTab || saving || loading}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save for {venues.find((v) => v.id === activeTab)?.name || "Venue"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
