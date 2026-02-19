"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, ChevronRight, Sun, Sunrise, Sunset } from "lucide-react";
import Link from "next/link";
import { format, isToday, isTomorrow, isThisWeek, differenceInMinutes } from "date-fns";

export interface Shift {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  position: string | null;
  notes: string | null;
  roster: {
    id: string;
    name: string;
    venue: { id: string; name: string };
  };
}

interface UpcomingShiftsWidgetProps {
  shifts: Shift[];
}

function getTimeOfDayIcon(time: string): { icon: typeof Sun; color: string } {
  const hour = parseInt(time.split(":")[0], 10);
  if (hour >= 5 && hour < 12) {
    return { icon: Sunrise, color: "text-amber-500" };
  }
  if (hour >= 12 && hour < 17) {
    return { icon: Sun, color: "text-yellow-500" };
  }
  return { icon: Sunset, color: "text-orange-500" };
}

function formatDuration(startTime: string, endTime: string, breakMinutes: number): string {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM) - breakMinutes;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function getShiftLabel(date: Date): { label: string; highlight: boolean } {
  if (isToday(date)) {
    return { label: "Today", highlight: true };
  }
  if (isTomorrow(date)) {
    return { label: "Tomorrow", highlight: false };
  }
  if (isThisWeek(date)) {
    return { label: format(date, "EEEE"), highlight: false };
  }
  return { label: format(date, "MMM d"), highlight: false };
}

export function UpcomingShiftsWidget({ shifts }: UpcomingShiftsWidgetProps) {
  // Group shifts by date category
  const todayShifts = shifts.filter((s) => isToday(new Date(s.date)));
  const tomorrowShifts = shifts.filter((s) => isTomorrow(new Date(s.date)));
  const thisWeekShifts = shifts.filter(
    (s) => isThisWeek(new Date(s.date)) && !isToday(new Date(s.date)) && !isTomorrow(new Date(s.date))
  );

  // Calculate total hours this week
  const weeklyHours = shifts.reduce((total, shift) => {
    const [startH, startM] = shift.startTime.split(":").map(Number);
    const [endH, endM] = shift.endTime.split(":").map(Number);
    const duration = (endH * 60 + endM) - (startH * 60 + startM) - shift.breakMinutes;
    return total + duration / 60;
  }, 0);

  // Check if next shift is starting soon (within 2 hours)
  const now = new Date();
  const nextShift = shifts[0];
  let startingSoon = false;
  if (nextShift && isToday(new Date(nextShift.date))) {
    const [startH, startM] = nextShift.startTime.split(":").map(Number);
    const shiftStart = new Date(now);
    shiftStart.setHours(startH, startM, 0, 0);
    const minutesUntil = differenceInMinutes(shiftStart, now);
    startingSoon = minutesUntil > 0 && minutesUntil <= 120;
  }

  if (shifts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Upcoming Shifts
          </CardTitle>
          <CardDescription>Your scheduled shifts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">No upcoming shifts scheduled</p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back later or contact your manager
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Upcoming Shifts
              {startingSoon && (
                <Badge variant="destructive" className="ml-2 animate-pulse">
                  Starting Soon
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {shifts.length} shift{shifts.length !== 1 ? "s" : ""} • {weeklyHours.toFixed(1)}h total
            </CardDescription>
          </div>
          <Link href="/my/rosters">
            <Button variant="ghost" size="sm">
              View All
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Shifts */}
        {todayShifts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
              <Sun className="h-4 w-4" />
              Today
            </div>
            {todayShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} highlight />
            ))}
          </div>
        )}

        {/* Tomorrow's Shifts */}
        {tomorrowShifts.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground mt-4">Tomorrow</div>
            {tomorrowShifts.map((shift) => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
          </div>
        )}

        {/* This Week */}
        {thisWeekShifts.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium text-muted-foreground mt-4">This Week</div>
            {thisWeekShifts.slice(0, 3).map((shift) => (
              <ShiftCard key={shift.id} shift={shift} />
            ))}
            {thisWeekShifts.length > 3 && (
              <Link href="/my/rosters">
                <Button variant="link" size="sm" className="w-full">
                  +{thisWeekShifts.length - 3} more shifts
                </Button>
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ShiftCard({ shift, highlight = false }: { shift: Shift; highlight?: boolean }) {
  const { icon: TimeIcon, color: timeColor } = getTimeOfDayIcon(shift.startTime);
  const { label: dateLabel } = getShiftLabel(new Date(shift.date));
  const duration = formatDuration(shift.startTime, shift.endTime, shift.breakMinutes);

  return (
    <div
      className={`p-3 rounded-lg border transition-all ${
        highlight
          ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10"
          : "bg-card hover:bg-accent/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 rounded-lg p-2 bg-accent`}>
            <TimeIcon className={`h-4 w-4 ${timeColor}`} />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">
                {shift.startTime} - {shift.endTime}
              </span>
              {shift.position && (
                <Badge variant="secondary" className="text-xs">
                  {shift.position}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {shift.roster.venue.name}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {duration}
              </span>
            </div>
            {shift.notes && (
              <p className="text-xs text-muted-foreground italic">{shift.notes}</p>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{dateLabel}</p>
          {shift.breakMinutes > 0 && (
            <p className="text-xs text-muted-foreground">{shift.breakMinutes}m break</p>
          )}
        </div>
      </div>
    </div>
  );
}
