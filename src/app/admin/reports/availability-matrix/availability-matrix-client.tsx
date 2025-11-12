"use client";

import { useState, useEffect } from "react";
import { DateRange } from "react-day-picker";
import { startOfWeek, endOfWeek } from "date-fns";
import { ReportFilters, FilterValues } from "@/components/reports/ReportFilters";
import { AvailabilityMatrixGrid } from "@/components/reports/AvailabilityMatrixGrid";
import { ExportButton } from "@/components/reports/ExportButton";
import { getAvailabilityMatrix } from "@/lib/actions/reports/availability-reports";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface AvailabilityMatrixClientProps {
  venues?: Array<{ id: string; name: string }>;
}

export function AvailabilityMatrixClient({ venues = [] }: AvailabilityMatrixClientProps) {
  const [matrixData, setMatrixData] = useState<any>(null);
  const [rawMatrixData, setRawMatrixData] = useState<any>(null); // For export
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({
    dateRange: {
      from: startOfWeek(new Date(), { weekStartsOn: 1 }),
      to: endOfWeek(new Date(), { weekStartsOn: 1 }),
    },
  });

  // Fetch matrix data when filters change
  useEffect(() => {
    const fetchMatrix = async () => {
      if (!filters.dateRange?.from || !filters.dateRange?.to) {
        return;
      }

      setLoading(true);
      try {
        const result = await getAvailabilityMatrix({
          startDate: filters.dateRange.from,
          endDate: filters.dateRange.to,
          venueId: filters.venueId,
          roleId: filters.roleId,
          timeSlotStart: filters.timeSlotStart,
          timeSlotEnd: filters.timeSlotEnd,
        });

        if (result.success && result.data) {
          // Store raw data for export
          setRawMatrixData(result.data);

          // Transform the matrix data structure to match AvailabilityMatrixGrid expectations
          const transformedData = {
            dates: result.data.dates,
            users: result.data.users.map((user: any) => ({
              userId: user.id,
              userName: user.name,
              userEmail: user.email,
              cells: result.data.dates.map((date: string) => {
                const availability = result.data.matrix[user.id]?.[date];
                return {
                  date,
                  status: availability?.available
                    ? (availability.isAllDay ? "available" : "partial")
                    : "unavailable",
                  timeSlots: availability?.available && !availability.isAllDay && availability.startTime && availability.endTime
                    ? [`${availability.startTime} - ${availability.endTime}`]
                    : undefined,
                };
              }),
            })),
          };
          setMatrixData(transformedData);
        } else {
          toast.error(result.error || "Failed to load availability matrix");
        }
      } catch (error) {
        toast.error("An error occurred while loading the matrix");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatrix();
  }, [filters]);

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      {/* Filters Sidebar */}
      <div>
        <ReportFilters
          onApplyFilters={handleApplyFilters}
          showVenue={true}
          showRole={true}
          showTimeSlot={true}
          showSearch={true}
          venues={venues}
        />
      </div>

      {/* Matrix Grid */}
      <div className="space-y-4">
        {/* Export Button */}
        {rawMatrixData && (
          <div className="flex justify-end">
            <ExportButton
              reportType="matrix"
              reportData={rawMatrixData}
              formats={["csv", "excel", "pdf", "ical"]}
            />
          </div>
        )}

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center space-y-2">
                <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Loading availability matrix...</p>
              </div>
            </CardContent>
          </Card>
        ) : matrixData ? (
          <AvailabilityMatrixGrid
            data={matrixData}
            searchQuery={filters.searchQuery}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                Select a date range to view the availability matrix
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
