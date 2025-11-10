"use client";

import { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

export interface Venue {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

interface VenueSelectorProps {
  venues: Venue[];
  selectedVenueIds: string[];
  primaryVenueId?: string;
  onSelectionChange: (venueIds: string[], primaryVenueId?: string) => void;
  disabled?: boolean;
  className?: string;
  error?: string;
  required?: boolean;
}

/**
 * VenueSelector Component
 *
 * Multi-select dropdown for assigning venues to users with primary venue designation.
 *
 * Features:
 * - Multi-select with checkboxes
 * - Primary venue selection (radio button)
 * - Search/filter venues
 * - Shows selected venues as badges
 * - Validation (at least one venue, exactly one primary)
 *
 * @example
 * ```tsx
 * <VenueSelector
 *   venues={allVenues}
 *   selectedVenueIds={["venue1", "venue2"]}
 *   primaryVenueId="venue1"
 *   onSelectionChange={(ids, primaryId) => {
 *     setValue("venueIds", ids);
 *     setValue("primaryVenueId", primaryId);
 *   }}
 * />
 * ```
 */
export function VenueSelector({
  venues,
  selectedVenueIds,
  primaryVenueId,
  onSelectionChange,
  disabled = false,
  className,
  error,
  required = false,
}: VenueSelectorProps) {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter venues based on search
  const filteredVenues = venues.filter((venue) =>
    venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    venue.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected venues for display
  const selectedVenues = venues.filter((v) => selectedVenueIds.includes(v.id));

  // Handle venue toggle
  const handleToggleVenue = (venueId: string) => {
    const isSelected = selectedVenueIds.includes(venueId);

    let newSelectedIds: string[];
    let newPrimaryId = primaryVenueId;

    if (isSelected) {
      // Deselecting
      newSelectedIds = selectedVenueIds.filter((id) => id !== venueId);

      // If we're removing the primary venue, clear primary or set to first remaining
      if (venueId === primaryVenueId) {
        newPrimaryId = newSelectedIds.length > 0 ? newSelectedIds[0] : undefined;
      }
    } else {
      // Selecting
      newSelectedIds = [...selectedVenueIds, venueId];

      // If this is the first venue, make it primary
      if (newSelectedIds.length === 1) {
        newPrimaryId = venueId;
      }
    }

    onSelectionChange(newSelectedIds, newPrimaryId);
  };

  // Handle primary venue change
  const handlePrimaryChange = (venueId: string) => {
    onSelectionChange(selectedVenueIds, venueId);
  };

  // Auto-set primary if only one venue selected
  useEffect(() => {
    if (selectedVenueIds.length === 1 && primaryVenueId !== selectedVenueIds[0]) {
      onSelectionChange(selectedVenueIds, selectedVenueIds[0]);
    }
  }, [selectedVenueIds, primaryVenueId, onSelectionChange]);

  const hasError = Boolean(error);

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between",
              hasError && "border-red-500",
              disabled && "cursor-not-allowed opacity-50"
            )}
            disabled={disabled}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Building2 className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {selectedVenues.length === 0 ? (
                  <span className="text-gray-500">
                    Select venues{required && " (required)"}
                  </span>
                ) : (
                  `${selectedVenues.length} venue${selectedVenues.length !== 1 ? "s" : ""} selected`
                )}
              </span>
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[400px] p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Search venues..."
              value={searchQuery}
              onValueChange={setSearchQuery}
            />
            <CommandList>
              <CommandEmpty>No venues found.</CommandEmpty>
              <CommandGroup heading="Available Venues">
                {filteredVenues.map((venue) => {
                  const isSelected = selectedVenueIds.includes(venue.id);
                  const isPrimary = venue.id === primaryVenueId;

                  return (
                    <CommandItem
                      key={venue.id}
                      onSelect={() => handleToggleVenue(venue.id)}
                      className="flex items-center gap-2 px-2 py-2 cursor-pointer"
                    >
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded border border-gray-300",
                          isSelected && "bg-blue-600 border-blue-600"
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3 text-white" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">{venue.name}</span>
                          {!venue.active && (
                            <Badge variant="outline" className="text-xs">
                              Inactive
                            </Badge>
                          )}
                          {isPrimary && (
                            <Badge className="text-xs bg-blue-600">Primary</Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">{venue.code}</span>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>

          {/* Primary Venue Selection */}
          {selectedVenueIds.length > 1 && (
            <div className="border-t p-3">
              <Label className="text-sm font-medium mb-2 block">Primary Venue</Label>
              <RadioGroup
                value={primaryVenueId ?? ""}
                onValueChange={handlePrimaryChange}
                className="space-y-2"
              >
                {selectedVenues.map((venue) => (
                  <div key={venue.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={venue.id} id={`primary-${venue.id}`} />
                    <Label
                      htmlFor={`primary-${venue.id}`}
                      className="text-sm font-normal cursor-pointer flex-1"
                    >
                      {venue.name}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Selected Venues Display */}
      {selectedVenues.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedVenues.map((venue) => {
            const isPrimary = venue.id === primaryVenueId;
            return (
              <Badge
                key={venue.id}
                variant={isPrimary ? "default" : "secondary"}
                className="flex items-center gap-1"
              >
                <Building2 className="h-3 w-3" />
                {venue.name}
                {isPrimary && <span className="text-xs">(Primary)</span>}
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleToggleVenue(venue.id)}
                    className="ml-1 hover:bg-black/10 rounded-full p-0.5"
                  >
                    <span className="sr-only">Remove {venue.name}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                    </svg>
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Error Message */}
      {hasError && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {/* Validation Info */}
      {selectedVenueIds.length === 0 && required && (
        <p className="text-sm text-gray-500">
          At least one venue must be selected
        </p>
      )}
    </div>
  );
}

/**
 * Simple VenueDisplay Component
 *
 * Read-only display of assigned venues (for user profile pages, etc.)
 */
interface VenueDisplayProps {
  venues: Array<{
    id: string;
    name: string;
    code: string;
    isPrimary?: boolean;
  }>;
  className?: string;
}

export function VenueDisplay({ venues, className }: VenueDisplayProps) {
  if (venues.length === 0) {
    return (
      <p className="text-sm text-gray-500">No venues assigned</p>
    );
  }

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {venues.map((venue) => (
        <Badge
          key={venue.id}
          variant={venue.isPrimary ? "default" : "secondary"}
          className="flex items-center gap-1"
        >
          <Building2 className="h-3 w-3" />
          {venue.name}
          {venue.isPrimary && <span className="text-xs">(Primary)</span>}
        </Badge>
      ))}
    </div>
  );
}
