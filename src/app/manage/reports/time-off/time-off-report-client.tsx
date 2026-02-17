"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  startOfWeek,
  endOfWeek,
  addMonths,
  subMonths,
} from "date-fns";
import { getTimeOffReport } from "@/lib/actions/reports/time-off-reports";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Grid3x3, List } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TimeOffCalendar } from "@/components/reports/TimeOffCalendar";
import { TimeOffMatrix } from "@/components/reports/TimeOffMatrix";
import { TimeOffList } from "@/components/reports/TimeOffList";
import { ReportFilters, FilterValues } from "@/components/reports/ReportFilters";

interface TimeOffReportClientProps {
  venues: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string }>;
}

export function TimeOffReportClient({ venues, roles }: TimeOffReportClientProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FilterValues>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentView, setCurrentView] = useState<string>("calendar");

  // Determine date range: use filter dates if provided, otherwise use month navigation
  // Use useMemo to prevent recalculation on every render
  const startDate = useMemo(
    () => filters.dateRange?.from || startOfMonth(currentDate),
    [filters.dateRange?.from, currentDate]
  );
  const endDate = useMemo(
    () => filters.dateRange?.to || endOfMonth(currentDate),
    [filters.dateRange?.to, currentDate]
  );

  // Calculate calendar grid based on the active date range
  const calendarStart = startOfWeek(startDate, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(endDate, { weekStartsOn: 0 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Track last fetch parameters to prevent unnecessary re-fetches
  const lastFetchKey = useRef<string>("");

  // Fetch report data when dates or filters change
  useEffect(() => {
    // Create a unique key from all parameters
    const fetchKey = JSON.stringify({
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      venueIds: filters.venueIds?.join(",") || "",
      roleIds: filters.roleIds?.join(",") || "",
      searchQuery: filters.searchQuery || "",
      statusFilter,
    });

    // Skip if parameters haven't changed
    if (fetchKey === lastFetchKey.current) {
      return;
    }

    lastFetchKey.current = fetchKey;

    const fetchReportData = async () => {
      setLoading(true);
      try {
        const result = await getTimeOffReport({
          startDate: startDate,
          endDate: endDate,
          venueIds: filters.venueIds,
          roleIds: filters.roleIds,
          status: statusFilter === "all" ? undefined : statusFilter as any,
          searchQuery: filters.searchQuery,
        });

        if (result.success) {
          setReportData(result.data);
        } else {
          toast.error(result.error || "Failed to load time-off report");
        }
      } catch (error) {
        toast.error("An error occurred while loading the report");
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
    // Use string values to prevent object reference issues
  }, [
    startDate.toISOString(),
    endDate.toISOString(),
    filters.venueIds?.join(","),
    filters.roleIds?.join(","),
    filters.searchQuery,
    statusFilter,
  ]);

  const handlePreviousMonth = () => {
    // Clear filter dates and use month navigation
    setFilters((prev) => ({ ...prev, dateRange: undefined }));
    setCurrentDate((prev) => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    // Clear filter dates and use month navigation
    setFilters((prev) => ({ ...prev, dateRange: undefined }));
    setCurrentDate((prev) => addMonths(prev, 1));
  };

  const handleToday = () => {
    // Clear filter dates and use month navigation
    setFilters((prev) => ({ ...prev, dateRange: undefined }));
    setCurrentDate(new Date());
  };

  const handleApplyFilters = (newFilters: FilterValues) => {
    setFilters(newFilters);
    // If new filters have date range, update currentDate to match for display purposes
    if (newFilters.dateRange?.from) {
      setCurrentDate(newFilters.dateRange.from);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <ReportFilters
        onApplyFilters={handleApplyFilters}
        showVenue={true}
        showRole={true}
        showTimeSlot={false}
        showSearch={true}
        venues={venues}
        roles={roles}
      />

      {/* Status Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Status Filter:</label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            {reportData?.summary && (
              <div className="flex items-center gap-4 ml-auto text-sm">
                <Badge variant="outline">
                  Total: {reportData.summary.totalRequests}
                </Badge>
                <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                  Pending: {reportData.summary.byStatus.pending}
                </Badge>
                <Badge variant="default" className="bg-green-100 text-green-800">
                  Approved: {reportData.summary.byStatus.approved}
                </Badge>
                <Badge variant="destructive">
                  Rejected: {reportData.summary.byStatus.rejected}
                </Badge>
                <Badge variant="outline">
                  Cancelled: {reportData.summary.byStatus.cancelled}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {reportData?.summary && reportData.summary.totalRequests > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Total Requests</div>
              <div className="text-3xl font-bold">{reportData.summary.totalRequests}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Average Coverage Impact</div>
              <div className="text-3xl font-bold">{reportData.summary.averageImpact}%</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-sm text-muted-foreground">Peak Impact</div>
              <div className="text-3xl font-bold">{reportData.summary.peakImpactPercentage}%</div>
              {reportData.summary.peakImpactDate && (
                <div className="text-xs text-muted-foreground mt-1">
                  on {format(new Date(reportData.summary.peakImpactDate), "MMM d, yyyy")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Conflict Alerts */}
      {reportData?.conflicts && reportData.conflicts.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="text-orange-600 text-sm font-semibold">
                {reportData.conflicts.length} Conflict Alert{reportData.conflicts.length !== 1 ? "s" : ""}
              </div>
            </div>
            <div className="mt-3 space-y-2">
              {reportData.conflicts.slice(0, 3).map((conflict: any) => (
                <div
                  key={conflict.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={conflict.severity === "critical" ? "destructive" : "secondary"}>
                        {conflict.severity.toUpperCase()}
                      </Badge>
                      <span className="font-medium text-sm">{conflict.title}</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {conflict.description}
                    </div>
                  </div>
                </div>
              ))}
              {reportData.conflicts.length > 3 && (
                <div className="text-sm text-muted-foreground text-center">
                  +{reportData.conflicts.length - 3} more conflicts
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month/Date Range Navigation */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold">
              {filters.dateRange?.from && filters.dateRange?.to ? (
                // Show custom date range if filters are applied
                `${format(startDate, "MMM d")} - ${format(endDate, "MMM d, yyyy")}`
              ) : (
                // Show month if using month navigation
                format(currentDate, "MMMM yyyy")
              )}
            </div>
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
        </CardContent>
      </Card>

      {/* Tabs with different views */}
      <Tabs value={currentView} onValueChange={setCurrentView}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar
          </TabsTrigger>
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Grid3x3 className="h-4 w-4" />
            Matrix
          </TabsTrigger>
          <TabsTrigger value="list" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            List
          </TabsTrigger>
        </TabsList>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading time-off report...</p>
            </div>
          </div>
        ) : reportData ? (
          <>
            <TabsContent value="calendar" className="mt-6">
              <TimeOffCalendar
                dailyCoverage={reportData.dailyCoverage}
                calendarDays={calendarDays}
                currentMonth={startDate}
              />
            </TabsContent>

            <TabsContent value="matrix" className="mt-6">
              <TimeOffMatrix
                requests={reportData.requests}
                dates={reportData.dailyCoverage.map((d: any) => d.date)}
              />
            </TabsContent>

            <TabsContent value="list" className="mt-6">
              <TimeOffList requests={reportData.requests} />
            </TabsContent>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            No data available
          </div>
        )}
      </Tabs>
    </div>
  );
}
