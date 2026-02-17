"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, isToday, isTomorrow, isThisWeek, isPast, differenceInHours } from "date-fns";
import { Calendar, Clock, MapPin, CalendarDays, Sun, AlertCircle } from "lucide-react";

interface Shift {
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

interface MyShiftsClientProps {
  initialShifts: Shift[];
}

export function MyShiftsClient({ initialShifts }: MyShiftsClientProps) {
  const [shifts] = useState(initialShifts);

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

  const ShiftCard = ({ shift, highlight = false }: { shift: Shift; highlight?: boolean }) => {
    const shiftDate = new Date(shift.date);
    const isShiftToday = isToday(shiftDate);

    return (
      <div
        className={`p-4 rounded-lg border ${
          highlight
            ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-900/10"
            : "bg-card"
        }`}
      >
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
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
          </div>
          <div className="text-right">
            <p className="font-mono text-sm">
              {formatDuration(shift.startTime, shift.endTime, shift.breakMinutes)}
            </p>
            {shift.breakMinutes > 0 && (
              <p className="text-xs text-muted-foreground">
                {shift.breakMinutes}m break
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

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
      <div className="grid gap-4 md:grid-cols-3">
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
      </div>

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
    </div>
  );
}
