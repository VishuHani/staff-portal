"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format, isToday, isTomorrow, isThisWeek, isPast, differenceInHours, startOfWeek, addDays, isSameDay } from "date-fns";
import { Calendar, Clock, MapPin, CalendarDays, Sun, AlertCircle, AlertTriangle, Grid, List, ExternalLink, XCircle, CalendarX, CheckCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { acknowledgeShift, acknowledgeMultipleShifts, getUnacknowledgedShiftsCount } from "@/lib/actions/rosters/shift-acknowledgment-actions";
import { toast } from "sonner";

// Conflict type constants
const CONFLICT_TYPES = {
  TIME_OFF: "TIME_OFF",
  DOUBLE_BOOKED: "DOUBLE_BOOKED",
  AVAILABILITY: "AVAILABILITY",
  CROSS_VENUE_CONFLICT: "CROSS_VENUE_CONFLICT",
} as const;

// Helper to get conflict label
const getConflictLabel = (conflictType: string | null): string => {
  if (!conflictType) return "Conflict";
  const types = conflictType.split(",");
  const labels: string[] = [];
  
  if (types.includes(CONFLICT_TYPES.TIME_OFF)) {
    labels.push("Time Off Request");
  }
  if (types.includes(CONFLICT_TYPES.DOUBLE_BOOKED)) {
    labels.push("Double Booked");
  }
  if (types.includes(CONFLICT_TYPES.AVAILABILITY)) {
    labels.push("Outside Availability");
  }
  if (types.includes(CONFLICT_TYPES.CROSS_VENUE_CONFLICT)) {
    labels.push("Cross-Venue Conflict");
  }
  
  return labels.join(", ") || "Conflict";
};

// Helper to get conflict badge variant
const getConflictVariant = (conflictType: string | null): "destructive" | "warning" => {
  if (!conflictType) return "destructive";
  // TIME_OFF and DOUBLE_BOOKED are more severe
  if (conflictType.includes(CONFLICT_TYPES.TIME_OFF) || conflictType.includes(CONFLICT_TYPES.DOUBLE_BOOKED)) {
    return "destructive";
  }
  return "warning";
};

interface Shift {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  position: string | null;
  notes: string | null;
  hasConflict: boolean;
  conflictType: string | null;
  acknowledgedAt: Date | null;
  acknowledgmentNote: string | null;
  roster: {
    id: string;
    name: string;
    venue: { id: string; name: string };
  };
}

interface MyShiftsClientProps {
  initialShifts: Shift[];
}

export function MyShiftsClient({ initialShifts }: MyShiftsClientProps) {
  const [shifts, setShifts] = useState(initialShifts);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [acknowledgeDialogOpen, setAcknowledgeDialogOpen] = useState(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [acknowledgmentNote, setAcknowledgmentNote] = useState("");

  // Handle single shift acknowledgment
  const handleAcknowledge = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    setAcknowledgmentNote("");
    setAcknowledgeDialogOpen(true);
  };

  // Confirm acknowledgment
  const confirmAcknowledge = () => {
    if (!selectedShiftId) return;
    
    startTransition(async () => {
      setAcknowledgingId(selectedShiftId);
      const result = await acknowledgeShift(selectedShiftId, acknowledgmentNote || undefined);
      
      if (result.success) {
        // Update local state
        setShifts(prev => prev.map(s => 
          s.id === selectedShiftId 
            ? { ...s, acknowledgedAt: new Date(), acknowledgmentNote: acknowledgmentNote || null }
            : s
        ));
        toast.success("Shift acknowledged successfully");
        setAcknowledgeDialogOpen(false);
      } else {
        toast.error(result.error || "Failed to acknowledge shift");
      }
      
      setAcknowledgingId(null);
      setSelectedShiftId(null);
      setAcknowledgmentNote("");
    });
  };

  // Acknowledge all unacknowledged shifts
  const handleAcknowledgeAll = () => {
    const unacknowledgedIds = upcomingShifts
      .filter(s => !s.acknowledgedAt)
      .map(s => s.id);
    
    if (unacknowledgedIds.length === 0) return;
    
    startTransition(async () => {
      const result = await acknowledgeMultipleShifts(unacknowledgedIds);
      
      if (result.success) {
        // Update local state
        const now = new Date();
        setShifts(prev => prev.map(s => 
          unacknowledgedIds.includes(s.id) 
            ? { ...s, acknowledgedAt: now, acknowledgmentNote: null }
            : s
        ));
        toast.success(`Acknowledged ${result.acknowledgedCount} shifts`);
      } else {
        toast.error(result.error || "Failed to acknowledge shifts");
      }
    });
  };

  // Sort and categorize shifts
  const now = new Date();
  const upcomingShifts = shifts
    .filter((s) => new Date(s.date) >= new Date(now.toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const todayShifts = upcomingShifts.filter((s) => isToday(new Date(s.date)));
  const tomorrowShifts = upcomingShifts.filter((s) => isTomorrow(new Date(s.date)));
  const thisWeekShifts = upcomingShifts.filter(
    (s) => isThisWeek(new Date(s.date)) && !isToday(new Date(s.date)) && !isTomorrow(new Date(s.date))
  );
  const laterShifts = upcomingShifts.filter(
    (s) => !isToday(new Date(s.date)) && !isTomorrow(new Date(s.date)) && !isThisWeek(new Date(s.date))
  );

  // Get shifts with conflicts
  const conflictingShifts = upcomingShifts.filter((s) => s.hasConflict);
  
  // Get unacknowledged shifts
  const unacknowledgedShifts = upcomingShifts.filter((s) => !s.acknowledgedAt);

  // Calculate total hours this week
  const weeklyHours = thisWeekShifts.concat(todayShifts, tomorrowShifts).reduce((total, shift) => {
    const [startH, startM] = shift.startTime.split(":").map(Number);
    const [endH, endM] = shift.endTime.split(":").map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM) - shift.breakMinutes;
    return total + duration / 60;
  }, 0);

  const formatDuration = (startTime: string, endTime: string, breakMinutes: number) => {
    const [startH, startM] = startTime.split(":").map(Number);
    const [endH, endM] = endTime.split(":").map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakMinutes;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  // Get unique rosters for quick links
  const uniqueRosters = Array.from(
    new Map(upcomingShifts.map((s) => [s.roster.id, s.roster])).values()
  );

  // Generate week for grid view
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Get shifts for a specific date
  const getShiftsForDate = (date: Date) => {
    return upcomingShifts.filter((s) => isSameDay(new Date(s.date), date));
  };

  const ShiftCard = ({ shift, highlight = false }: { shift: Shift; highlight?: boolean }) => {
    const shiftDate = new Date(shift.date);
    const isShiftToday = isToday(shiftDate);
    const hasConflict = shift.hasConflict;
    const conflictVariant = getConflictVariant(shift.conflictType);
    const isAcknowledged = !!shift.acknowledgedAt;
    const isAcknowledging = acknowledgingId === shift.id;

    return (
      <div
        className={cn(
          "p-4 rounded-lg border",
          highlight
            ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10"
            : "bg-card",
          hasConflict && "border-l-4 border-l-red-500",
          isAcknowledged && "border-l-4 border-l-green-500"
        )}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">
                {isShiftToday
                  ? "Today"
                  : isTomorrow(shiftDate)
                  ? "Tomorrow"
                  : format(shiftDate, "EEEE, MMM d")}
              </span>
              {shift.position && (
                <Badge variant="secondary" className="text-xs">
                  {shift.position}
                </Badge>
              )}
              {isAcknowledged && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Acknowledged
                </Badge>
              )}
              {hasConflict && (
                <Badge
                  variant={conflictVariant === "destructive" ? "destructive" : "outline"}
                  className={cn(
                    "text-xs flex items-center gap-1",
                    conflictVariant === "warning" && "border-yellow-500 text-yellow-700 bg-yellow-50"
                  )}
                >
                  {conflictVariant === "destructive" ? (
                    <AlertCircle className="h-3 w-3" />
                  ) : (
                    <AlertTriangle className="h-3 w-3" />
                  )}
                  {getConflictLabel(shift.conflictType)}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {shift.startTime} - {shift.endTime}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {shift.roster.venue.name}
              </span>
            </div>
            {shift.notes && (
              <p className="text-sm text-muted-foreground mt-1">{shift.notes}</p>
            )}
            {shift.acknowledgmentNote && (
              <p className="text-xs text-muted-foreground mt-1 italic">
                Note: {shift.acknowledgmentNote}
              </p>
            )}
            {hasConflict && (
              <div className="mt-2 p-2 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-xs text-red-700 dark:text-red-300">
                  <strong>Scheduling Conflict:</strong> This shift overlaps with{" "}
                  {shift.conflictType?.includes(CONFLICT_TYPES.TIME_OFF) && "an approved time-off request"}
                  {shift.conflictType?.includes(CONFLICT_TYPES.DOUBLE_BOOKED) && "another shift"}
                  {shift.conflictType?.includes(CONFLICT_TYPES.CROSS_VENUE_CONFLICT) && "a shift at another venue"}
                  {shift.conflictType?.includes(CONFLICT_TYPES.AVAILABILITY) && "your unavailability"}
                  . Please contact your manager.
                </p>
              </div>
            )}
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div>
              <p className="font-mono text-sm">
                {formatDuration(shift.startTime, shift.endTime, shift.breakMinutes)}
              </p>
              {shift.breakMinutes > 0 && (
                <p className="text-xs text-muted-foreground">
                  {shift.breakMinutes}m break
                </p>
              )}
            </div>
            {/* Acknowledge Button */}
            {!isAcknowledged && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAcknowledge(shift.id)}
                disabled={isPending || isAcknowledging}
                className="text-xs"
              >
                {isAcknowledging ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1" />
                )}
                Acknowledge
              </Button>
            )}
          </div>
        </div>
        {/* Phase 3D: Add link to full roster */}
        <div className="mt-2 pt-2 border-t">
          <Link
            href={`/manage/rosters/${shift.roster.id}`}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            View Full Roster: {shift.roster.name}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </div>
    );
  };

  // Grid View Component
  const GridView = () => (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-8 bg-muted/50">
        <div className="p-2 text-xs font-medium border-r">Week</div>
        {weekDays.map((day) => (
          <div
            key={day.toISOString()}
            className={cn(
              "p-2 text-center border-r last:border-r-0",
              isToday(day) && "bg-blue-100 dark:bg-blue-900/20"
            )}
          >
            <div className="text-xs font-medium">{format(day, "EEE")}</div>
            <div className={cn(
              "text-sm font-bold",
              isToday(day) && "text-blue-600"
            )}>
              {format(day, "d")}
            </div>
          </div>
        ))}
      </div>

      {/* Time slots */}
      {["Morning", "Afternoon", "Evening"].map((period) => (
        <div key={period} className="grid grid-cols-8 border-t">
          <div className="p-2 text-xs font-medium border-r bg-muted/30">
            {period}
          </div>
          {weekDays.map((day) => {
            const dayShifts = getShiftsForDate(day);
            const periodShifts = dayShifts.filter((s) => {
              const hour = parseInt(s.startTime.split(":")[0]);
              if (period === "Morning") return hour >= 6 && hour < 12;
              if (period === "Afternoon") return hour >= 12 && hour < 17;
              return hour >= 17 || hour < 6;
            });

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "p-1 border-r last:border-r-0 min-h-[60px]",
                  isToday(day) && "bg-blue-50/50"
                )}
              >
                {periodShifts.map((shift) => (
                  <div
                    key={shift.id}
                    className={cn(
                      "text-xs p-1 mb-1 rounded truncate flex items-center gap-0.5",
                      shift.hasConflict
                        ? "bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700"
                        : shift.acknowledgedAt
                        ? "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
                        : "bg-blue-100 dark:bg-blue-900/30"
                    )}
                    title={`${shift.startTime}-${shift.endTime} @ ${shift.roster.venue.name}${shift.hasConflict ? " (CONFLICT)" : ""}${shift.acknowledgedAt ? " (Acknowledged)" : ""}`}
                  >
                    {shift.hasConflict && (
                      <AlertCircle className="h-2.5 w-2.5 text-red-500 flex-shrink-0" />
                    )}
                    {shift.acknowledgedAt && !shift.hasConflict && (
                      <CheckCircle className="h-2.5 w-2.5 text-green-500 flex-shrink-0" />
                    )}
                    <span className="truncate">{shift.startTime}-{shift.endTime}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );

  if (upcomingShifts.length === 0) {
    return (
      <div className="text-center py-12">
        <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
        <h2 className="text-xl font-semibold mb-2">No Upcoming Shifts</h2>
        <p className="text-muted-foreground">
          You don't have any scheduled shifts at the moment.
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Check back later or contact your manager.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Shifts</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcomingShifts.length}</div>
            <p className="text-xs text-muted-foreground">
              {todayShifts.length > 0 && `${todayShifts.length} today`}
              {todayShifts.length > 0 && tomorrowShifts.length > 0 && ", "}
              {tomorrowShifts.length > 0 && `${tomorrowShifts.length} tomorrow`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Hours This Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weeklyHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground">
              Across {todayShifts.length + tomorrowShifts.length + thisWeekShifts.length} shifts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Shift</CardTitle>
            <Sun className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {upcomingShifts[0] && (
              <>
                <div className="text-2xl font-bold">
                  {isToday(new Date(upcomingShifts[0].date))
                    ? upcomingShifts[0].startTime
                    : format(new Date(upcomingShifts[0].date), "EEE")}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isToday(new Date(upcomingShifts[0].date))
                    ? "Today"
                    : format(new Date(upcomingShifts[0].date), "MMM d")}
                  {" at "}
                  {upcomingShifts[0].roster.venue.name}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Acknowledgment Status Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Acknowledgments</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {upcomingShifts.length - unacknowledgedShifts.length}/{upcomingShifts.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {unacknowledgedShifts.length > 0 
                ? `${unacknowledgedShifts.length} pending acknowledgment`
                : "All shifts acknowledged"}
            </p>
            {unacknowledgedShifts.length > 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleAcknowledgeAll}
                disabled={isPending}
                className="mt-2 w-full text-xs"
              >
                {isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <CheckCircle className="h-3 w-3 mr-1" />
                )}
                Acknowledge All ({unacknowledgedShifts.length})
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conflict Warning Alert */}
      {conflictingShifts.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Scheduling Conflicts Detected</AlertTitle>
          <AlertDescription>
            You have {conflictingShifts.length} shift{conflictingShifts.length > 1 ? "s" : ""} with scheduling conflicts.
            Please review the affected shifts below and contact your manager to resolve these issues.
          </AlertDescription>
        </Alert>
      )}

      {/* Unacknowledged Shifts Alert */}
      {unacknowledgedShifts.length > 0 && unacknowledgedShifts.length !== conflictingShifts.length && (
        <Alert className="border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-700">Pending Acknowledgments</AlertTitle>
          <AlertDescription className="text-yellow-600">
            You have {unacknowledgedShifts.length} shift{unacknowledgedShifts.length > 1 ? "s" : ""} that need acknowledgment.
            Please acknowledge your shifts to confirm your attendance.
          </AlertDescription>
        </Alert>
      )}

      {/* View Toggle */}
      <div className="flex justify-end">
        <div className="flex rounded-lg border overflow-hidden">
          <Button
            variant={viewMode === "list" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("list")}
            className="rounded-none"
          >
            <List className="h-4 w-4 mr-1" />
            List
          </Button>
          <Button
            variant={viewMode === "grid" ? "default" : "ghost"}
            size="sm"
            onClick={() => setViewMode("grid")}
            className="rounded-none"
          >
            <Grid className="h-4 w-4 mr-1" />
            Week View
          </Button>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" && <GridView />}

      {/* List View */}
      {viewMode === "list" && (
        <>
          {/* Today's Shifts */}
          {todayShifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sun className="h-5 w-5 text-yellow-500" />
                  Today
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {todayShifts.map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} highlight />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tomorrow's Shifts */}
          {tomorrowShifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Tomorrow</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tomorrowShifts.map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* This Week */}
          {thisWeekShifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>This Week</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {thisWeekShifts.map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Later */}
          {laterShifts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Coming Up</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {laterShifts.map((shift) => (
                  <ShiftCard key={shift.id} shift={shift} />
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Acknowledgment Dialog */}
      <Dialog open={acknowledgeDialogOpen} onOpenChange={setAcknowledgeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Acknowledge Shift</DialogTitle>
            <DialogDescription>
              Confirm that you have seen this shift and will be available to work.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Add an optional note (e.g., running 5 minutes late, need to leave early, etc.)"
              value={acknowledgmentNote}
              onChange={(e) => setAcknowledgmentNote(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button onClick={confirmAcknowledge} disabled={isPending}>
              {isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Confirm Acknowledgment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
