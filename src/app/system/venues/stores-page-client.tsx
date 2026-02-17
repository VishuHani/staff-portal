"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VenueDialog } from "@/components/admin/VenueDialog";
import { VenueTable } from "@/components/admin/VenueTable";

interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
  businessHoursStart?: string;
  businessHoursEnd?: string;
  operatingDays?: number[] | unknown;
  _count?: {
    userVenues: number;
  };
}

interface StoresPageClientProps {
  venues: Venue[];
  stats: {
    total: number;
    active: number;
    inactive: number;
  };
}

/**
 * StoresPageClient Component
 *
 * Client component for venue management page.
 * Handles dialogs, state management, and page interactions.
 */
export function StoresPageClient({ venues, stats }: StoresPageClientProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);

  const handleCreate = () => {
    setSelectedVenue(null);
    setDialogOpen(true);
  };

  const handleEdit = (venue: Venue) => {
    setSelectedVenue(venue);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedVenue(null);
  };

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Venue Management</h2>
          <p className="mt-2 text-muted-foreground">
            Manage all venues in the system
          </p>
        </div>
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Venue
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Venues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-gray-500 mt-1">
              Across all locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Active Venues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-gray-500 mt-1">
              Currently operational
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-gray-600">
              Inactive Venues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
            <p className="text-xs text-gray-500 mt-1">
              Not currently in use
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Venues Table */}
      <VenueTable
        venues={venues}
        onEdit={handleEdit}
        onRefresh={handleSuccess}
      />

      {/* Create/Edit Dialog */}
      <VenueDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        venue={selectedVenue}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
