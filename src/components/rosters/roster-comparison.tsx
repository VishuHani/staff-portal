"use client";

/**
 * Roster Comparison Component
 * Shows differences between two roster versions for review
 */

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  Calendar,
  Clock,
  Minus,
  Plus,
  RefreshCw,
  User,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface ShiftData {
  id: string;
  userId: string | null;
  userName?: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  position: string | null;
  notes: string | null;
}

interface RosterComparisonProps {
  previousShifts: ShiftData[];
  currentShifts: ShiftData[];
  className?: string;
}

interface ShiftChange {
  type: "added" | "removed" | "modified";
  previous?: ShiftData;
  current?: ShiftData;
  changes?: string[];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getShiftKey(shift: ShiftData): string {
  const dateStr = typeof shift.date === "string" ? shift.date : format(shift.date, "yyyy-MM-dd");
  return `${shift.userId || "unassigned"}-${dateStr}-${shift.startTime}`;
}

function compareShifts(prev: ShiftData, curr: ShiftData): string[] {
  const changes: string[] = [];

  if (prev.endTime !== curr.endTime) {
    changes.push(`End time: ${prev.endTime} → ${curr.endTime}`);
  }
  if (prev.position !== curr.position) {
    changes.push(`Position: ${prev.position || "None"} → ${curr.position || "None"}`);
  }
  if (prev.notes !== curr.notes) {
    changes.push(`Notes updated`);
  }

  return changes;
}

function detectChanges(previousShifts: ShiftData[], currentShifts: ShiftData[]): ShiftChange[] {
  const changes: ShiftChange[] = [];
  const prevMap = new Map(previousShifts.map((s) => [getShiftKey(s), s]));
  const currMap = new Map(currentShifts.map((s) => [getShiftKey(s), s]));

  // Find removed and modified shifts
  for (const [key, prevShift] of prevMap) {
    const currShift = currMap.get(key);
    if (!currShift) {
      changes.push({ type: "removed", previous: prevShift });
    } else {
      const shiftChanges = compareShifts(prevShift, currShift);
      if (shiftChanges.length > 0) {
        changes.push({
          type: "modified",
          previous: prevShift,
          current: currShift,
          changes: shiftChanges,
        });
      }
    }
  }

  // Find added shifts
  for (const [key, currShift] of currMap) {
    if (!prevMap.has(key)) {
      changes.push({ type: "added", current: currShift });
    }
  }

  // Sort by date
  return changes.sort((a, b) => {
    const dateA = a.current?.date || a.previous?.date || "";
    const dateB = b.current?.date || b.previous?.date || "";
    return new Date(dateA).getTime() - new Date(dateB).getTime();
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export function RosterComparison({
  previousShifts,
  currentShifts,
  className,
}: RosterComparisonProps) {
  const changes = useMemo(
    () => detectChanges(previousShifts, currentShifts),
    [previousShifts, currentShifts]
  );

  const addedCount = changes.filter((c) => c.type === "added").length;
  const removedCount = changes.filter((c) => c.type === "removed").length;
  const modifiedCount = changes.filter((c) => c.type === "modified").length;

  if (changes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Version Comparison</CardTitle>
          <CardDescription>No changes detected between versions</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Version Comparison</CardTitle>
        <CardDescription className="flex items-center gap-4">
          {addedCount > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <Plus className="h-3 w-3" />
              {addedCount} added
            </span>
          )}
          {removedCount > 0 && (
            <span className="flex items-center gap-1 text-red-600">
              <Minus className="h-3 w-3" />
              {removedCount} removed
            </span>
          )}
          {modifiedCount > 0 && (
            <span className="flex items-center gap-1 text-amber-600">
              <RefreshCw className="h-3 w-3" />
              {modifiedCount} modified
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-3">
            {changes.map((change, index) => (
              <ChangeItem key={index} change={change} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CHANGE ITEM COMPONENT
// ============================================================================

function ChangeItem({ change }: { change: ShiftChange }) {
  const shift = change.current || change.previous;
  if (!shift) return null;

  const date = typeof shift.date === "string" ? new Date(shift.date) : shift.date;
  const userName = shift.userName || "Unassigned";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        change.type === "added" && "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-800",
        change.type === "removed" && "bg-red-50 border-red-200 dark:bg-red-900/10 dark:border-red-800",
        change.type === "modified" && "bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800"
      )}
    >
      {/* Type Icon */}
      <div
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full",
          change.type === "added" && "bg-green-100 text-green-600 dark:bg-green-900/30",
          change.type === "removed" && "bg-red-100 text-red-600 dark:bg-red-900/30",
          change.type === "modified" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30"
        )}
      >
        {change.type === "added" && <Plus className="h-4 w-4" />}
        {change.type === "removed" && <Minus className="h-4 w-4" />}
        {change.type === "modified" && <RefreshCw className="h-4 w-4" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              change.type === "added" && "border-green-300 text-green-700",
              change.type === "removed" && "border-red-300 text-red-700",
              change.type === "modified" && "border-amber-300 text-amber-700"
            )}
          >
            {change.type === "added" && "Added"}
            {change.type === "removed" && "Removed"}
            {change.type === "modified" && "Modified"}
          </Badge>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className="flex items-center gap-1">
            <User className="h-3 w-3 text-muted-foreground" />
            {userName}
          </span>
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {format(date, "EEE, MMM d")}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            {shift.startTime} - {shift.endTime}
          </span>
          {shift.position && (
            <Badge variant="secondary" className="text-xs">
              {shift.position}
            </Badge>
          )}
        </div>

        {/* Show changes for modified shifts */}
        {change.type === "modified" && change.changes && change.changes.length > 0 && (
          <div className="mt-2 space-y-1">
            {change.changes.map((changeDesc, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <ArrowRight className="h-3 w-3" />
                {changeDesc}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
