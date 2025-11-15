"use client";

import { format, parseISO, isSameDay, isToday } from "date-fns";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import type { DailyCoverageImpact, TimeOffRequest } from "@/lib/actions/reports/time-off-reports";

interface TimeOffCalendarProps {
  dailyCoverage: DailyCoverageImpact[];
  calendarDays: Date[];
  currentMonth: Date;
}

interface StatusBadgeProps {
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
}

function StatusBadge({ status }: StatusBadgeProps) {
  const variants: Record<typeof status, { variant: any; label: string }> = {
    PENDING: { variant: "secondary", label: "Pending" },
    APPROVED: { variant: "default", label: "Approved" },
    REJECTED: { variant: "destructive", label: "Rejected" },
    CANCELLED: { variant: "outline", label: "Cancelled" },
  };

  const { variant, label } = variants[status];

  return (
    <Badge variant={variant} className="text-xs">
      {label}
    </Badge>
  );
}

export function TimeOffCalendar({
  dailyCoverage,
  calendarDays,
  currentMonth,
}: TimeOffCalendarProps) {
  const [selectedDay, setSelectedDay] = useState<DailyCoverageImpact | null>(null);
  const [showDayDetails, setShowDayDetails] = useState(false);

  const getDayData = (date: Date): DailyCoverageImpact | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    return dailyCoverage.find((d) => d.date === dateStr) || null;
  };

  const getImpactColor = (severity: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return "bg-gray-50 text-gray-400";

    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-900 hover:bg-red-200 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-900 hover:bg-orange-200 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-900 hover:bg-yellow-200 border-yellow-300";
      case "low":
        return "bg-blue-50 text-blue-800 hover:bg-blue-100 border-blue-200";
      default:
        return "bg-green-50 text-green-800 hover:bg-green-100 border-green-200";
    }
  };

  const handleDayClick = (date: Date, dayData: DailyCoverageImpact | null) => {
    if (dayData && dayData.staffOff > 0) {
      setSelectedDay(dayData);
      setShowDayDetails(true);
    }
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth() &&
           date.getFullYear() === currentMonth.getFullYear();
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      <Card>
        <CardContent className="p-6">
          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Weekday Headers */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center font-semibold text-sm py-2 text-muted-foreground"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {calendarDays.map((date) => {
              const dayData = getDayData(date);
              const inMonth = isCurrentMonth(date);
              const isCurrentDay = isToday(date);
              const severity = dayData?.severity || "none";
              const hasTimeOff = dayData && dayData.staffOff > 0;

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => handleDayClick(date, dayData)}
                  disabled={!inMonth || !hasTimeOff}
                  className={cn(
                    "min-h-24 p-2 rounded-lg border-2 transition-all text-left relative",
                    getImpactColor(severity, inMonth),
                    isCurrentDay && "ring-2 ring-blue-500",
                    inMonth && hasTimeOff && "cursor-pointer",
                    (!inMonth || !hasTimeOff) && "cursor-default opacity-50"
                  )}
                >
                  <div className="flex flex-col h-full">
                    <span
                      className={cn(
                        "text-sm font-medium mb-1",
                        isCurrentDay && "text-blue-600 font-bold"
                      )}
                    >
                      {format(date, "d")}
                    </span>

                    {inMonth && dayData && dayData.staffOff > 0 && (
                      <div className="mt-auto space-y-1">
                        <div className="text-xs font-semibold">
                          {dayData.staffOff} staff off
                        </div>
                        <div className="text-xs">
                          {dayData.percentage}% impact
                        </div>
                        {dayData.hasConflict && (
                          <div className="absolute top-1 right-1">
                            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
            <span className="font-medium">Impact Level:</span>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-50 border border-green-200" />
              <span className="text-xs">Minimal (&lt;15%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-50 border border-blue-200" />
              <span className="text-xs">Low (15-30%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
              <span className="text-xs">Moderate (30-50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-100 border border-orange-200" />
              <span className="text-xs">High (50-70%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
              <span className="text-xs">Critical (70%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs">Conflict Alert</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Details Modal */}
      {selectedDay && (
        <Dialog open={showDayDetails} onOpenChange={setShowDayDetails}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                {format(parseISO(selectedDay.date), "EEEE, MMMM d, yyyy")}
              </DialogTitle>
              <DialogDescription>
                {selectedDay.staffOff} of {selectedDay.totalStaff} staff members are off (
                {selectedDay.percentage}% impact)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Impact Summary */}
              <div className="flex items-center gap-4">
                <div className={cn(
                  "px-3 py-1 rounded-full text-sm font-medium",
                  selectedDay.severity === "critical" && "bg-red-100 text-red-900",
                  selectedDay.severity === "high" && "bg-orange-100 text-orange-900",
                  selectedDay.severity === "medium" && "bg-yellow-100 text-yellow-900",
                  selectedDay.severity === "low" && "bg-blue-100 text-blue-900",
                  selectedDay.severity === "none" && "bg-green-100 text-green-900"
                )}>
                  {selectedDay.severity.toUpperCase()} IMPACT
                </div>
                {selectedDay.hasConflict && (
                  <Badge variant="destructive">Conflict Detected</Badge>
                )}
              </div>

              {/* Time-Off Requests */}
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Time-Off Requests:</h4>
                {selectedDay.requests.map((request) => (
                  <Card key={request.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-medium">{request.userName}</span>
                            <StatusBadge status={request.status} />
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <div>
                              <span className="font-medium">Role:</span> {request.userRole}
                            </div>
                            {request.userVenues.length > 0 && (
                              <div>
                                <span className="font-medium">Venues:</span>{" "}
                                {request.userVenues.join(", ")}
                              </div>
                            )}
                            <div>
                              <span className="font-medium">Dates:</span>{" "}
                              {format(parseISO(request.startDate), "MMM d")} -{" "}
                              {format(parseISO(request.endDate), "MMM d, yyyy")}
                            </div>
                            <div>
                              <span className="font-medium">Type:</span> {request.type}
                            </div>
                            {request.reason && (
                              <div>
                                <span className="font-medium">Reason:</span> {request.reason}
                              </div>
                            )}
                            {request.reviewerName && (
                              <div>
                                <span className="font-medium">Reviewed by:</span>{" "}
                                {request.reviewerName}
                              </div>
                            )}
                            {request.notes && (
                              <div>
                                <span className="font-medium">Notes:</span> {request.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
