"use client";

/**
 * Copy Roster Dialog Component
 * Allows copying a roster to a different week or creating a new version (same week)
 */

import { useState, useTransition } from "react";
import { RosterStatus } from "@prisma/client";
import { format, addWeeks, startOfWeek, endOfWeek } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Copy, RefreshCw, Loader2, MapPin, Users } from "lucide-react";
import { toast } from "sonner";
import { copyRoster } from "@/lib/actions/rosters";

interface CopyRosterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: {
    id: string;
    name: string;
    status: RosterStatus;
    startDate: Date;
    endDate: Date;
    venue: {
      id: string;
      name: string;
    };
    _count?: {
      shifts: number;
    };
  };
  defaultToSameWeek?: boolean;
  onSuccess: (newRosterId: string) => void;
}

// Generate next 8 weeks for selection
function getUpcomingWeeks(currentWeekStart: Date): { start: Date; end: Date; label: string }[] {
  const weeks = [];
  const today = new Date();
  const currentSourceWeek = startOfWeek(currentWeekStart, { weekStartsOn: 1 });

  for (let i = 0; i < 8; i++) {
    const weekStart = startOfWeek(addWeeks(today, i), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

    // Skip if this is the same week as the source roster
    if (weekStart.getTime() === currentSourceWeek.getTime()) {
      continue;
    }

    weeks.push({
      start: weekStart,
      end: weekEnd,
      label: `${format(weekStart, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`,
    });
  }

  return weeks;
}

export function CopyRosterDialog({
  open,
  onOpenChange,
  roster,
  defaultToSameWeek = false,
  onSuccess,
}: CopyRosterDialogProps) {
  const [isPending, startTransition] = useTransition();
  const [copyType, setCopyType] = useState<"different" | "same">(
    defaultToSameWeek ? "same" : "different"
  );
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [rosterName, setRosterName] = useState("");
  const [openEditorAfter, setOpenEditorAfter] = useState(true);

  const isPublished = roster.status === RosterStatus.PUBLISHED;
  const shiftCount = roster._count?.shifts || 0;
  const upcomingWeeks = getUpcomingWeeks(new Date(roster.startDate));

  // Reset state when dialog opens
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setCopyType(defaultToSameWeek ? "same" : "different");
      setSelectedWeek("");
      setRosterName("");
      setOpenEditorAfter(true);
    }
    onOpenChange(open);
  };

  // Generate default name based on selection
  const getDefaultName = () => {
    if (copyType === "same") {
      return `${roster.name} v2`;
    }
    if (selectedWeek) {
      const week = upcomingWeeks.find((w) => w.start.toISOString() === selectedWeek);
      if (week) {
        return `Week of ${format(week.start, "MMM d, yyyy")}`;
      }
    }
    return "";
  };

  const handleCopy = () => {
    let targetWeekStart: Date;

    if (copyType === "same") {
      targetWeekStart = new Date(roster.startDate);
    } else {
      if (!selectedWeek) {
        toast.error("Please select a target week");
        return;
      }
      targetWeekStart = new Date(selectedWeek);
    }

    const finalName = rosterName || getDefaultName();
    if (!finalName) {
      toast.error("Please enter a roster name");
      return;
    }

    startTransition(async () => {
      const result = await copyRoster(roster.id, {
        targetWeekStart,
        name: finalName,
        createNewVersion: copyType === "same",
      });

      if (result.success && result.rosterId) {
        toast.success(
          copyType === "same"
            ? "New version created as draft"
            : "Roster copied successfully"
        );
        onSuccess(result.rosterId);
      } else {
        toast.error(result.error || "Failed to copy roster");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5 text-blue-600" />
            Copy Roster
          </DialogTitle>
          <DialogDescription>
            Create a copy of this roster for a different week or create a new version.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Source Roster Info */}
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <div className="text-sm font-medium">Source Roster</div>
            <div className="text-lg font-semibold">{roster.name}</div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {roster.venue.name}
              </div>
              <div className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {shiftCount} shifts
              </div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {format(new Date(roster.startDate), "MMM d")} -{" "}
                {format(new Date(roster.endDate), "MMM d")}
              </div>
            </div>
          </div>

          {/* Copy Type Selection */}
          <div className="space-y-3">
            <Label>Copy to</Label>
            <RadioGroup
              value={copyType}
              onValueChange={(value) => setCopyType(value as "different" | "same")}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50">
                <RadioGroupItem value="different" id="different" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="different" className="cursor-pointer font-medium">
                    Different week
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Copy all shifts to a new roster for a different week
                  </p>
                </div>
              </div>

              {isPublished && (
                <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
                  <RadioGroupItem value="same" id="same" className="mt-1" />
                  <div className="flex-1">
                    <Label htmlFor="same" className="cursor-pointer font-medium flex items-center gap-2">
                      <RefreshCw className="h-4 w-4" />
                      Create new version (same week)
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create v2 of this roster. When published, it will replace the current version.
                    </p>
                  </div>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Week Selection - only for different week */}
          {copyType === "different" && (
            <div className="space-y-2">
              <Label htmlFor="week">Select target week</Label>
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger id="week">
                  <SelectValue placeholder="Choose a week..." />
                </SelectTrigger>
                <SelectContent>
                  {upcomingWeeks.map((week) => (
                    <SelectItem key={week.start.toISOString()} value={week.start.toISOString()}>
                      {week.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Roster Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Roster name</Label>
            <Input
              id="name"
              placeholder={getDefaultName() || "Enter roster name..."}
              value={rosterName}
              onChange={(e) => setRosterName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to use the default name
            </p>
          </div>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="openEditor"
              checked={openEditorAfter}
              onCheckedChange={(checked) => setOpenEditorAfter(checked === true)}
            />
            <Label htmlFor="openEditor" className="text-sm cursor-pointer">
              Open editor after copying
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleCopy}
            disabled={isPending || (copyType === "different" && !selectedWeek)}
            className="gap-2"
          >
            {isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Copying...
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {copyType === "same" ? "Create Version" : "Copy Roster"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
