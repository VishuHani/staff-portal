"use client";

import { useState, useEffect } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  isSameMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
  isSameDay,
  isToday,
} from "date-fns";
import { getAvailabilityMatrix } from "@/lib/actions/reports/availability-reports";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DayDetailsModal } from "@/components/reports/DayDetailsModal";
import { ExportButton } from "@/components/reports/ExportButton";
import { ReportFilters, FilterValues } from "@/components/reports/ReportFilters";

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  availableCount: number;
  totalCount: number;
  coveragePercentage: number;
}

interface CalendarViewClientProps {
  venues?: Array<{ id: string; name: string }>;
  roles?: Array<{ id: string; name: string }>;
}

export function CalendarViewClient({ venues = [], roles = [] }: CalendarViewClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarData, setCalendarData] = useState<any>(null);
  const [rawCalendarData, setRawCalendarData] = useState<any>(null); // For export
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showDayDetails, setShowDayDetails] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});

  // Calculate calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Fetch calendar data when month or filters change
  useEffect(() => {
    const fetchCalendarData = async () => {
      setLoading(true);
      try {
        const result = await getAvailabilityMatrix({
          startDate: monthStart,
          endDate: monthEnd,
          venueId: filters.venueId,
        });

        if (result.success) {
          setCalendarData(result.data);
          setRawCalendarData(result.data); // Store for export
        } else {
          toast.error(result.error || "Failed to load calendar data");
        }
      } catch (error) {
        toast.error("An error occurred while loading calendar data");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchCalendarData();
  }, [currentDate, filters.venueId]);

  const handlePreviousMonth = () => {
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDayClick = (date: Date) => {
    if (!isSameMonth(date, currentDate)) return;
    setSelectedDay(date);
    setShowDayDetails(true);
  };

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  const getDayData = (date: Date): CalendarDay => {
    const dateStr = format(date, "yyyy-MM-dd");
    let availableCount = 0;
    let totalCount = 0;

    if (calendarData?.matrix) {
      Object.keys(calendarData.matrix).forEach((userId) => {
        const userMatrix = calendarData.matrix[userId];
        if (userMatrix[dateStr]) {
          totalCount++;
          if (userMatrix[dateStr].available) {
            availableCount++;
          }
        }
      });

      // If we have users but no data for this day, count all users as total
      if (totalCount === 0 && calendarData.users) {
        totalCount = calendarData.users.length;
      }
    }

    const coveragePercentage = totalCount > 0 ? (availableCount / totalCount) * 100 : 0;

    return {
      date,
      isCurrentMonth: isSameMonth(date, currentDate),
      availableCount,
      totalCount,
      coveragePercentage,
    };
  };

  const getCoverageColor = (percentage: number, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return "bg-gray-50 text-gray-400";
    if (percentage === 0) return "bg-red-100 text-red-900 hover:bg-red-200";
    if (percentage < 30) return "bg-red-50 text-red-800 hover:bg-red-100";
    if (percentage < 50) return "bg-orange-50 text-orange-800 hover:bg-orange-100";
    if (percentage < 70) return "bg-yellow-50 text-yellow-800 hover:bg-yellow-100";
    return "bg-green-50 text-green-800 hover:bg-green-100";
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <>
      {/* Filters */}
      <ReportFilters
        onApplyFilters={handleApplyFilters}
        showVenue={true}
        showRole={true}
        showTimeSlot={false}
        showSearch={false}
        venues={venues}
        roles={roles}
      />

      {/* Export Button */}
      {rawCalendarData && (
        <div className="flex justify-end mb-4">
          <ExportButton
            reportType="calendar"
            reportData={rawCalendarData}
            formats={["csv", "excel", "pdf", "ical"]}
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl">
              {format(currentDate, "MMMM yyyy")}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
              <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading calendar...</p>
              </div>
            </div>
          ) : (
            <>
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
                  const isCurrentDay = isToday(date);

                  return (
                    <button
                      key={date.toISOString()}
                      onClick={() => handleDayClick(date)}
                      disabled={!dayData.isCurrentMonth}
                      className={cn(
                        "min-h-24 p-2 rounded-lg border-2 transition-all text-left relative",
                        getCoverageColor(dayData.coveragePercentage, dayData.isCurrentMonth),
                        isCurrentDay && "border-blue-500 ring-2 ring-blue-200",
                        !isCurrentDay && "border-transparent",
                        dayData.isCurrentMonth && "cursor-pointer",
                        !dayData.isCurrentMonth && "cursor-default opacity-50"
                      )}
                    >
                      <div className="flex flex-col h-full">
                        <span className={cn(
                          "text-sm font-medium mb-1",
                          isCurrentDay && "text-blue-600 font-bold"
                        )}>
                          {format(date, "d")}
                        </span>

                        {dayData.isCurrentMonth && dayData.totalCount > 0 && (
                          <div className="mt-auto space-y-1">
                            <div className="text-xs font-semibold">
                              {dayData.availableCount}/{dayData.totalCount}
                            </div>
                            <div className="text-xs">
                              {Math.round(dayData.coveragePercentage)}% coverage
                            </div>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-6 flex flex-wrap items-center gap-4 text-sm">
                <span className="font-medium">Coverage:</span>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-50 border border-green-200" />
                  <span className="text-xs">70%+</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-50 border border-yellow-200" />
                  <span className="text-xs">50-70%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-orange-50 border border-orange-200" />
                  <span className="text-xs">30-50%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-50 border border-red-200" />
                  <span className="text-xs">&lt;30%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-100 border border-red-300" />
                  <span className="text-xs">No coverage</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Day Details Modal */}
      {selectedDay && (
        <DayDetailsModal
          date={selectedDay}
          open={showDayDetails}
          onClose={() => setShowDayDetails(false)}
          matrixData={calendarData}
        />
      )}
    </>
  );
}
