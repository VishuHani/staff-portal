"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";

interface VenueSelectorProps {
  venues: { id: string; name: string }[];
  selectedVenueId: string | "all";
  onVenueChange: (venueId: string | "all") => void;
  showAllOption?: boolean;
  disabled?: boolean;
}

export function VenueSelector({
  venues,
  selectedVenueId,
  onVenueChange,
  showAllOption = true,
  disabled = false,
}: VenueSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Building2 className="h-4 w-4 text-muted-foreground" />
      <Select
        value={selectedVenueId}
        onValueChange={(value) => onVenueChange(value as string | "all")}
        disabled={disabled}
      >
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select venue" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && (
            <SelectItem value="all">
              <span className="font-medium">All Venues</span>
            </SelectItem>
          )}
          {venues.map((venue) => (
            <SelectItem key={venue.id} value={venue.id}>
              {venue.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
