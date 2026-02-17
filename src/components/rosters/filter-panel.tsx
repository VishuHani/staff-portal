"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface Position {
  id: string;
  name: string;
  color: string;
}

interface FilterPanelProps {
  staff: StaffMember[];
  positions: Position[];
  selectedStaffIds: string[];
  selectedPositions: string[];
  onFilterChange: (filters: { staffIds: string[]; positions: string[] }) => void;
}

function getDisplayName(staff: StaffMember): string {
  const name = `${staff.firstName || ""} ${staff.lastName || ""}`.trim();
  return name || staff.email;
}

export function FilterPanel({
  staff,
  positions,
  selectedStaffIds,
  selectedPositions,
  onFilterChange,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const activeFilterCount = selectedStaffIds.length + selectedPositions.length;

  const handleStaffToggle = (staffId: string) => {
    const newStaffIds = selectedStaffIds.includes(staffId)
      ? selectedStaffIds.filter((id) => id !== staffId)
      : [...selectedStaffIds, staffId];
    onFilterChange({ staffIds: newStaffIds, positions: selectedPositions });
  };

  const handlePositionToggle = (position: string) => {
    const newPositions = selectedPositions.includes(position)
      ? selectedPositions.filter((p) => p !== position)
      : [...selectedPositions, position];
    onFilterChange({ staffIds: selectedStaffIds, positions: newPositions });
  };

  const handleClearAll = () => {
    onFilterChange({ staffIds: [], positions: [] });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="h-4 w-4 mr-2" />
          Filter
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-2 h-5 w-5 p-0 flex items-center justify-center rounded-full text-xs"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">Filters</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="h-auto py-1 px-2 text-xs"
              >
                <X className="h-3 w-3 mr-1" />
                Clear all
              </Button>
            )}
          </div>

          {/* Position Filter */}
          {positions.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Position
              </Label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {positions.map((position) => (
                  <div
                    key={position.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`position-${position.id}`}
                      checked={selectedPositions.includes(position.name)}
                      onCheckedChange={() => handlePositionToggle(position.name)}
                    />
                    <label
                      htmlFor={`position-${position.id}`}
                      className="flex items-center gap-2 text-sm cursor-pointer flex-1"
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: position.color }}
                      />
                      {position.name}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Staff Filter */}
          {staff.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground uppercase tracking-wide">
                Staff
              </Label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {staff.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center space-x-2"
                  >
                    <Checkbox
                      id={`staff-${member.id}`}
                      checked={selectedStaffIds.includes(member.id)}
                      onCheckedChange={() => handleStaffToggle(member.id)}
                    />
                    <label
                      htmlFor={`staff-${member.id}`}
                      className="text-sm cursor-pointer flex-1 truncate"
                    >
                      {getDisplayName(member)}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {positions.length === 0 && staff.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No filters available
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
