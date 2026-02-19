"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import { DashboardHeader } from "../DashboardHeader";
import { StaffKPICards } from "./StaffKPICards";
import { QuickActions } from "./QuickActions";
import { UpcomingShiftsWidget, type Shift } from "./UpcomingShiftsWidget";
import { WeekAtGlance } from "./WeekAtGlance";
import { RecentActivityFeed, type Notification } from "./RecentActivityFeed";
import { PersonalStatsChart } from "./PersonalStatsChart";
import { DashboardWidget } from "../DashboardCustomizationPanel";
import { DEFAULT_STAFF_WIDGETS } from "../widget-defaults";
import { getDashboardPreferences, saveDashboardPreferences } from "@/lib/actions/dashboard/preferences";

interface StaffDashboardClientProps {
  userId: string;
  kpis: {
    hoursThisWeek: number;
    upcomingTimeOff: number;
    pendingRequests: number;
    unreadMessages: number;
    shiftsThisWeek: number;
  } | null;
  upcomingShifts: Array<{
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    breakMinutes: number | null;
    position: string | null;
    notes: string | null;
    roster: {
      id: string;
      name: string;
      venue: {
        id: string;
        name: string;
      } | null;
    };
  }>;
  weeklySummary: Array<{
    date: string;
    dayName: string;
    dayOfWeek: number;
    status: "available" | "unavailable" | "partial" | "time-off";
    hours: number;
    isToday: boolean;
  }>;
  recentActivity: Array<{
    id: string;
    type: string;
    message: string;
    readAt: Date | null;
    createdAt: Date;
  }>;
  trends: Array<{
    week: string;
    hours: number;
    shifts: number;
  }>;
  unreadMessageCount: number;
}

export function StaffDashboardClient({
  userId,
  kpis,
  upcomingShifts,
  weeklySummary,
  recentActivity,
  trends,
  unreadMessageCount,
}: StaffDashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize date range from URL params
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      return {
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
      };
    }
    return undefined;
  });
  
  // Initialize widgets from defaults, will be loaded from server
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_STAFF_WIDGETS);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from server on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const result = await getDashboardPreferences();
        if (result.success && result.data) {
          // Merge with defaults to handle new widgets
          const mergedWidgets = DEFAULT_STAFF_WIDGETS.map((d) => {
            const found = result.data!.widgets.find((p) => p.id === d.id);
            return found ? { ...d, enabled: found.enabled, order: found.order } : d;
          }).sort((a, b) => a.order - b.order);
          setWidgets(mergedWidgets);
          
          // Restore date range if saved
          if (result.data.dateRange?.from || result.data.dateRange?.to) {
            setDateRange({
              from: result.data.dateRange.from ? new Date(result.data.dateRange.from) : undefined,
              to: result.data.dateRange.to ? new Date(result.data.dateRange.to) : undefined,
            });
          }
        }
      } catch (error) {
        console.error("[StaffDashboard] Failed to load preferences:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadPreferences();
  }, []);

  // Update URL when date range changes
  const handleDateRangeChange = useCallback(async (range: DateRange | undefined) => {
    setDateRange(range);
    
    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    if (range?.from) {
      params.set("from", range.from.toISOString().split("T")[0]);
    } else {
      params.delete("from");
    }
    if (range?.to) {
      params.set("to", range.to.toISOString().split("T")[0]);
    } else {
      params.delete("to");
    }
    
    // Update URL without full page reload
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, "", newUrl);
    
    // Save to database
    try {
      await saveDashboardPreferences(widgets, {
        from: range?.from || null,
        to: range?.to || null,
      });
    } catch (error) {
      console.error("[StaffDashboard] Failed to save date range:", error);
    }
    
    // Refresh data
    router.refresh();
  }, [searchParams, router, widgets]);

  // Save widgets when changed
  const handleWidgetsChange = useCallback(async (newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);
    
    try {
      await saveDashboardPreferences(newWidgets, {
        from: dateRange?.from || null,
        to: dateRange?.to || null,
      });
    } catch (error) {
      console.error("[StaffDashboard] Failed to save widgets:", error);
    }
  }, [dateRange]);

  // Reset widgets to defaults
  const handleResetWidgets = useCallback(() => {
    setWidgets(DEFAULT_STAFF_WIDGETS);
    handleWidgetsChange(DEFAULT_STAFF_WIDGETS);
  }, [handleWidgetsChange]);

  // Get visible widget IDs
  const visibleWidgetIds = widgets.filter((w) => w.enabled).map((w) => w.id);

  // Transform shifts to match expected type
  const transformedShifts: Shift[] = upcomingShifts.map((s) => ({
    id: s.id,
    date: s.date,
    startTime: s.startTime,
    endTime: s.endTime,
    breakMinutes: s.breakMinutes ?? 0,
    position: s.position,
    notes: s.notes,
    roster: {
      id: s.roster.id,
      name: s.roster.name,
      venue: s.roster.venue ?? { id: "", name: "Unknown Venue" },
    },
  }));

  // Transform notifications to match expected type
  const transformedNotifications: Notification[] = recentActivity.map((n) => ({
    id: n.id,
    type: n.type,
    message: n.message,
    readAt: n.readAt,
    createdAt: n.createdAt,
  }));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-muted rounded mb-2" />
          <div className="h-4 w-64 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Date Range Picker, Refresh, and Customize */}
      <DashboardHeader
        userRole="STAFF"
        userId={userId}
        title="Welcome back!"
        subtitle="Here's your dashboard overview"
        onDateRangeChange={handleDateRangeChange}
        onWidgetsChange={handleWidgetsChange}
        initialDateRange={dateRange}
        initialWidgets={widgets}
      />

      {/* KPI Cards */}
      {visibleWidgetIds.includes("kpis") && kpis && (
        <StaffKPICards kpis={kpis} />
      )}

      {/* Quick Actions */}
      {visibleWidgetIds.includes("quick-actions") && (
        <QuickActions unreadMessageCount={unreadMessageCount} />
      )}

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Shifts */}
        {visibleWidgetIds.includes("upcoming-shifts") && transformedShifts.length > 0 && (
          <UpcomingShiftsWidget shifts={transformedShifts} />
        )}

        {/* Week at a Glance */}
        {visibleWidgetIds.includes("week-at-glance") && weeklySummary.length > 0 && (
          <WeekAtGlance summary={weeklySummary} />
        )}

        {/* Recent Activity */}
        {visibleWidgetIds.includes("recent-activity") && transformedNotifications.length > 0 && (
          <RecentActivityFeed notifications={transformedNotifications} />
        )}

        {/* Personal Stats Chart */}
        {visibleWidgetIds.includes("personal-stats") && trends.length > 0 && (
          <PersonalStatsChart trends={trends} />
        )}
      </div>
    </div>
  );
}
