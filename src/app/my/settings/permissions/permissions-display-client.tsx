"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Shield,
  Building2,
  Star,
  Calendar,
  User,
  Clock,
  Info,
} from "lucide-react";

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string | null;
  source: "role" | "venue";
  grantedAt?: Date;
  grantedBy?: string;
}

interface VenuePermissions {
  venue: {
    id: string;
    name: string;
    code: string;
  };
  permissions: Permission[];
}

interface PermissionsDisplayClientProps {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    role: {
      name: string;
      description: string | null;
    };
  };
  rolePermissions: Permission[];
  venuePermissionsByVenue: VenuePermissions[];
  venues: Array<{
    id: string;
    name: string;
    code: string;
    isPrimary: boolean;
  }>;
}

// Resource display names
const RESOURCE_LABELS: Record<string, string> = {
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
  rosters: "Rosters",
};

// Icons for each resource
const RESOURCE_ICONS: Record<string, string> = {
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
  rosters: "📆",
};

function formatResourceName(resource: string): string {
  return RESOURCE_LABELS[resource] || resource;
}

function formatActionName(action: string): string {
  return action
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function groupPermissionsByResource(permissions: Permission[]) {
  return permissions.reduce(
    (acc, perm) => {
      if (!acc[perm.resource]) {
        acc[perm.resource] = [];
      }
      acc[perm.resource].push(perm);
      return acc;
    },
    {} as Record<string, Permission[]>
  );
}

export function PermissionsDisplayClient({
  user,
  rolePermissions,
  venuePermissionsByVenue,
  venues,
}: PermissionsDisplayClientProps) {
  const [activeTab, setActiveTab] = useState("role");

  const groupedRolePermissions = groupPermissionsByResource(rolePermissions);
  const totalRolePermissions = rolePermissions.length;
  const totalVenuePermissions = venuePermissionsByVenue.reduce(
    (sum, v) => sum + v.permissions.length,
    0
  );

  const userName = user.firstName && user.lastName
    ? `${user.firstName} ${user.lastName}`
    : user.email;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Permissions</h1>
        <p className="text-muted-foreground mt-2">
          View your current permissions and access levels across the platform
        </p>
      </div>

      {/* User Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-medium">{userName}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <Badge variant="secondary" className="mt-1">
                <Shield className="mr-1 h-3 w-3" />
                {user.role.name}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Venues</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {venues.map((v) => (
                  <Badge
                    key={v.id}
                    variant={v.isPrimary ? "default" : "outline"}
                    className="text-xs"
                  >
                    <Building2 className="mr-1 h-3 w-3" />
                    {v.code}
                    {v.isPrimary && <Star className="ml-1 h-3 w-3 fill-current" />}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Permission Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Role Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-600">
              {totalRolePermissions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              From your {user.role.name} role
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Venue-Specific Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {totalVenuePermissions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Additional permissions at venues
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Active Permissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-purple-600">
              {totalRolePermissions + totalVenuePermissions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Combined access rights
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Permission Details Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="role">
            <Shield className="mr-2 h-4 w-4" />
            Role Permissions ({totalRolePermissions})
          </TabsTrigger>
          <TabsTrigger value="venue">
            <Building2 className="mr-2 h-4 w-4" />
            Venue Permissions ({totalVenuePermissions})
          </TabsTrigger>
        </TabsList>

        {/* Role Permissions Tab */}
        <TabsContent value="role" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                {user.role.name} Role Permissions
              </CardTitle>
              <CardDescription>
                These permissions are automatically granted based on your role assignment
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(groupedRolePermissions).length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No role permissions assigned</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <Accordion type="multiple" className="space-y-2">
                    {Object.entries(groupedRolePermissions).map(
                      ([resource, permissions]) => (
                        <AccordionItem
                          key={resource}
                          value={resource}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <span className="text-2xl">
                                  {RESOURCE_ICONS[resource] || "📋"}
                                </span>
                                <span className="font-medium">
                                  {formatResourceName(resource)}
                                </span>
                              </div>
                              <Badge variant="outline" className="text-xs">
                                {permissions.length}
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-2">
                            {permissions.map((permission) => (
                              <div
                                key={permission.id}
                                className="flex items-start gap-3 p-2 rounded bg-blue-50 border border-blue-200"
                              >
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm text-blue-900">
                                      {formatActionName(permission.action)}
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className="text-xs bg-blue-100 text-blue-700"
                                    >
                                      From Role
                                    </Badge>
                                  </div>
                                  {permission.description && (
                                    <p className="text-xs text-muted-foreground mt-1">
                                      {permission.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      )
                    )}
                  </Accordion>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Venue Permissions Tab */}
        <TabsContent value="venue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Venue-Specific Permissions
              </CardTitle>
              <CardDescription>
                Additional permissions granted to you at specific venues
              </CardDescription>
            </CardHeader>
            <CardContent>
              {venuePermissionsByVenue.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No venue-specific permissions assigned</p>
                  <p className="text-sm mt-1">
                    Venue permissions can be granted by administrators or managers
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[400px] pr-4">
                  <Accordion type="multiple" className="space-y-2">
                    {venuePermissionsByVenue.map((venuePerms) => {
                      const groupedByResource = groupPermissionsByResource(
                        venuePerms.permissions
                      );

                      return (
                        <AccordionItem
                          key={venuePerms.venue.id}
                          value={venuePerms.venue.id}
                          className="border rounded-lg px-4"
                        >
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center justify-between w-full pr-4">
                              <div className="flex items-center gap-3">
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                <span className="font-medium">
                                  {venuePerms.venue.name}
                                </span>
                                <Badge variant="outline" className="text-xs">
                                  {venuePerms.venue.code}
                                </Badge>
                              </div>
                              <Badge variant="default" className="text-xs">
                                {venuePerms.permissions.length} permissions
                              </Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pt-4 space-y-4">
                            {Object.entries(groupedByResource).map(
                              ([resource, permissions]) => (
                                <div key={resource} className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                                    <span>{RESOURCE_ICONS[resource] || "📋"}</span>
                                    {formatResourceName(resource)}
                                  </div>
                                  {permissions.map((permission) => (
                                    <div
                                      key={permission.id}
                                      className="flex items-start gap-3 p-2 rounded bg-green-50 border border-green-200 ml-4"
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="font-medium text-sm text-green-900">
                                            {formatActionName(permission.action)}
                                          </span>
                                          <Badge
                                            variant="secondary"
                                            className="text-xs bg-green-100 text-green-700"
                                          >
                                            Venue-Specific
                                          </Badge>
                                        </div>
                                        {permission.description && (
                                          <p className="text-xs text-muted-foreground mt-1">
                                            {permission.description}
                                          </p>
                                        )}
                                        {permission.grantedBy && permission.grantedAt && (
                                          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                              <User className="h-3 w-3" />
                                              Granted by: {permission.grantedBy}
                                            </span>
                                            <span className="flex items-center gap-1">
                                              <Clock className="h-3 w-3" />
                                              {new Date(permission.grantedAt).toLocaleDateString()}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Help Card */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <Info className="h-6 w-6 text-muted-foreground flex-shrink-0" />
            <div>
              <h3 className="font-medium">About Permissions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your permissions determine what actions you can perform in the system.
                Role permissions are automatically assigned based on your role,
                while venue-specific permissions are additional access rights granted
                at specific locations. If you need additional permissions, please
                contact your manager or administrator.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
