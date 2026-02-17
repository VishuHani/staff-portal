"use client";

import { useState, useEffect } from "react";
import { Shield, Building2, Users, Lock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VenuePermissionsOverviewTable } from "@/components/admin/VenuePermissionsOverviewTable";
import { getUsersWithVenuePermissions } from "@/lib/actions/admin/venue-permissions";
import { toast } from "sonner";
import type { PermissionResource } from "@/lib/rbac/permissions";

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface VenuePermissionsPageClientProps {
  venues: Venue[];
  allPermissions: Record<PermissionResource, any[]>;
  totalAssignments: number;
}

export function VenuePermissionsPageClient({
  venues,
  allPermissions,
  totalAssignments,
}: VenuePermissionsPageClientProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>("");
  const [usersData, setUsersData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const activeVenues = venues.filter(v => v.active);
  const totalPermissionTypes = Object.values(allPermissions).flat().length;

  useEffect(() => {
    if (selectedVenueId) {
      loadVenuePermissions();
    } else {
      setUsersData([]);
    }
  }, [selectedVenueId]);

  const loadVenuePermissions = async () => {
    if (!selectedVenueId) return;

    setLoading(true);
    try {
      const result = await getUsersWithVenuePermissions(selectedVenueId);

      if (result.success) {
        setUsersData(result.users || []);
      } else {
        toast.error(result.error || "Failed to load venue permissions");
      }
    } catch (error) {
      console.error("Error loading venue permissions:", error);
      toast.error("Failed to load venue permissions");
    } finally {
      setLoading(false);
    }
  };

  const selectedVenue = venues.find(v => v.id === selectedVenueId);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Venue Permissions Overview
          </h2>
          <p className="mt-2 text-muted-foreground">
            View and manage venue-specific permissions across all locations
          </p>
        </div>
        <Button
          variant="outline"
          onClick={loadVenuePermissions}
          disabled={!selectedVenueId || loading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Venues</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{venues.length}</div>
            <p className="text-xs text-muted-foreground">
              {activeVenues.length} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Permission Types
            </CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPermissionTypes}</div>
            <p className="text-xs text-muted-foreground">
              Available permissions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Assignments
            </CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAssignments}</div>
            <p className="text-xs text-muted-foreground">
              Venue-specific grants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Users at Venue
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {selectedVenueId ? usersData.length : "-"}
            </div>
            <p className="text-xs text-muted-foreground">
              With custom permissions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Venue Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Venue</CardTitle>
          <CardDescription>
            Choose a venue to view all users with custom permissions at that location
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Choose a venue..." />
            </SelectTrigger>
            <SelectContent>
              {venues.map(venue => (
                <SelectItem key={venue.id} value={venue.id}>
                  {venue.name} ({venue.code})
                  {!venue.active && " - Inactive"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Permissions Table */}
      {selectedVenueId ? (
        <VenuePermissionsOverviewTable
          venue={selectedVenue!}
          users={usersData}
          loading={loading}
          onRefresh={loadVenuePermissions}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No venue selected</h3>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Select a venue from the dropdown above to view all users with
              venue-specific permissions at that location
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
