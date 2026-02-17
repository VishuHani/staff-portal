"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, MoreVertical, Palette, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { deleteVenue, toggleVenueActive } from "@/lib/actions/admin/venues";

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

interface VenueTableProps {
  venues: Venue[];
  onEdit: (venue: Venue) => void;
  onRefresh: () => void;
}

/**
 * VenueTable Component
 *
 * Displays venues in a card/grid layout with search and actions.
 *
 * Features:
 * - Search by name or code
 * - Edit, toggle active, and delete actions
 * - Shows user count per venue
 * - Active/inactive status badges
 * - Delete confirmation dialog
 *
 * @example
 * ```tsx
 * <VenueTable
 *   venues={allVenues}
 *   onEdit={(venue) => {
 *     setSelectedVenue(venue);
 *     setDialogOpen(true);
 *   }}
 *   onRefresh={() => router.refresh()}
 * />
 * ```
 */
export function VenueTable({ venues, onEdit, onRefresh }: VenueTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [venueToDelete, setVenueToDelete] = useState<Venue | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filter venues based on search
  const filteredVenues = venues.filter(
    (venue) =>
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleActive = async (venue: Venue) => {
    const result = await toggleVenueActive({ venueId: venue.id });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(
        `Venue ${venue.active ? "deactivated" : "activated"} successfully!`
      );
      onRefresh();
    }
  };

  const handleDeleteClick = (venue: Venue) => {
    setVenueToDelete(venue);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!venueToDelete) return;

    setIsDeleting(true);

    try {
      const result = await deleteVenue({ venueId: venueToDelete.id });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Venue deleted successfully!");
        setDeleteDialogOpen(false);
        setVenueToDelete(null);
        onRefresh();
      }
    } catch (error) {
      console.error("Error deleting venue:", error);
      toast.error("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-4">
        {/* Search */}
        <div className="flex items-center gap-4">
          <Input
            placeholder="Search venues by name or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
          {searchQuery && (
            <p className="text-sm text-gray-500">
              Found {filteredVenues.length} venue{filteredVenues.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>

        {/* Venues Grid */}
        {filteredVenues.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900">
                {searchQuery ? "No venues found" : "No venues yet"}
              </p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery
                  ? "Try adjusting your search query"
                  : "Create your first venue to get started"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredVenues.map((venue) => (
              <Card key={venue.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex items-center gap-2">
                        <Building2 className="h-5 w-5 shrink-0" />
                        <span className="truncate">{venue.name}</span>
                      </CardTitle>
                      <CardDescription className="mt-1">
                        Code: <span className="font-mono">{venue.code}</span>
                      </CardDescription>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(venue)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit Venue
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => router.push(`/system/venues/${venue.id}/positions`)}
                        >
                          <Palette className="mr-2 h-4 w-4" />
                          Manage Positions
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(venue)}>
                          {venue.active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDeleteClick(venue)}
                          className="text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Venue
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>
                        {venue._count?.userVenues || 0} user
                        {venue._count?.userVenues !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <Badge variant={venue.active ? "default" : "secondary"}>
                      {venue.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Venue</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{venueToDelete?.name}</span>?
              {venueToDelete?._count?.userVenues ? (
                <>
                  <br />
                  <br />
                  <span className="text-red-600">
                    Warning: This venue has{" "}
                    {venueToDelete._count.userVenues} user
                    {venueToDelete._count.userVenues !== 1 ? "s" : ""} assigned.
                    Please reassign users before deleting.
                  </span>
                </>
              ) : (
                " This action cannot be undone."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting || (venueToDelete?._count?.userVenues ?? 0) > 0}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Venue"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
