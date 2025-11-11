"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Shield, Users, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { revokeUserVenuePermission } from "@/lib/actions/admin/venue-permissions";
import { toast } from "sonner";

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface UserWithPermissions {
  user: {
    id: string;
    name: string;
    email: string;
    active: boolean;
    role: string;
  };
  permissions: Array<{
    id: string;
    resource: string;
    action: string;
    description: string | null;
    grantedAt: Date;
  }>;
}

interface VenuePermissionsOverviewTableProps {
  venue: Venue;
  users: UserWithPermissions[];
  loading: boolean;
  onRefresh: () => void;
}

export function VenuePermissionsOverviewTable({
  venue,
  users,
  loading,
  onRefresh,
}: VenuePermissionsOverviewTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [revokeDialogOpen, setRevokeDialogOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [selectedRevoke, setSelectedRevoke] = useState<{
    userId: string;
    permissionId: string;
    userName: string;
    permissionName: string;
  } | null>(null);

  const filteredUsers = users.filter(u =>
    u.user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleUser = (userId: string) => {
    setExpandedUsers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(userId)) {
        newSet.delete(userId);
      } else {
        newSet.add(userId);
      }
      return newSet;
    });
  };

  const handleRevokeClick = (
    userId: string,
    permissionId: string,
    userName: string,
    resource: string,
    action: string
  ) => {
    setSelectedRevoke({
      userId,
      permissionId,
      userName,
      permissionName: `${resource}:${action}`,
    });
    setRevokeDialogOpen(true);
  };

  const handleRevoke = async () => {
    if (!selectedRevoke) return;

    setRevoking(true);
    try {
      const result = await revokeUserVenuePermission(
        selectedRevoke.userId,
        venue.id,
        selectedRevoke.permissionId
      );

      if (result.success) {
        toast.success("Permission revoked successfully");
        setRevokeDialogOpen(false);
        setSelectedRevoke(null);
        onRefresh();
      } else {
        toast.error(result.error || "Failed to revoke permission");
      }
    } catch (error) {
      console.error("Error revoking permission:", error);
      toast.error("Failed to revoke permission");
    } finally {
      setRevoking(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-muted-foreground">Loading permissions...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (users.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shield className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No permissions assigned</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            No users have venue-specific permissions at {venue.name}.
            <br />
            Permissions can be assigned from the User Management page.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>
                Permissions at {venue.name}
              </CardTitle>
              <CardDescription>
                {filteredUsers.length} user{filteredUsers.length !== 1 ? "s" : ""} with custom permissions
              </CardDescription>
            </div>
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="max-w-xs"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {filteredUsers.map(userWithPerms => {
              const isExpanded = expandedUsers.has(userWithPerms.user.id);
              const totalPerms = userWithPerms.permissions.length;

              return (
                <Collapsible
                  key={userWithPerms.user.id}
                  open={isExpanded}
                  onOpenChange={() => toggleUser(userWithPerms.user.id)}
                >
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger className="w-full">
                      <div className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div className="flex flex-col items-start">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {userWithPerms.user.name}
                              </span>
                              {!userWithPerms.user.active && (
                                <Badge variant="destructive" className="text-xs">
                                  Inactive
                                </Badge>
                              )}
                            </div>
                            <span className="text-sm text-muted-foreground">
                              {userWithPerms.user.email}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary">
                            {userWithPerms.user.role}
                          </Badge>
                          <Badge variant="outline">
                            <Shield className="mr-1 h-3 w-3" />
                            {totalPerms} permission{totalPerms !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="border-t p-4 space-y-2 bg-muted/20">
                        {userWithPerms.permissions.map(permission => (
                          <div
                            key={permission.id}
                            className="flex items-center justify-between p-3 rounded bg-background border"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="default">
                                  {permission.resource}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {permission.action}
                                </span>
                              </div>
                              {permission.description && (
                                <p className="text-xs text-muted-foreground">
                                  {permission.description}
                                </p>
                              )}
                              <p className="text-xs text-muted-foreground">
                                Granted: {format(new Date(permission.grantedAt), "MMM d, yyyy HH:mm")}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRevokeClick(
                                  userWithPerms.user.id,
                                  permission.id,
                                  userWithPerms.user.name,
                                  permission.resource,
                                  permission.action
                                );
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No users match your search query
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoke Confirmation Dialog */}
      <AlertDialog open={revokeDialogOpen} onOpenChange={setRevokeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke Permission</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke the permission <strong>{selectedRevoke?.permissionName}</strong> from{" "}
              <strong>{selectedRevoke?.userName}</strong> at {venue.name}?
              <br /><br />
              This action cannot be undone, but the permission can be re-granted later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRevoke();
              }}
              disabled={revoking}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revoking && (
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
              )}
              Revoke Permission
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
