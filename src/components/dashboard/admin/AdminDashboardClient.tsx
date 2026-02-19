"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import { DashboardHeader } from "../DashboardHeader";
import { GlobalStatsCards } from "./GlobalStatsCards";
import { VenueComparisonChart } from "./VenueComparisonChart";
import { UserActivityHeatmap } from "./UserActivityHeatmap";
import { ActionDistributionPie } from "./ActionDistributionPie";
import { RoleDistributionDonut } from "./RoleDistributionDonut";
import { ApprovalTurnaroundChart } from "./ApprovalTurnaroundChart";
import { AuditLogFeed } from "./AuditLogFeed";
import { DashboardWidget } from "../DashboardCustomizationPanel";
import { DEFAULT_ADMIN_WIDGETS } from "../widget-defaults";
import { getDashboardPreferences, saveDashboardPreferences } from "@/lib/actions/dashboard/preferences";

interface AdminDashboardClientProps {
  userId: string;
  globalStats: {
    totalActiveStaff: number;
    totalInactiveStaff?: number;
    multiVenueCoverage: number;
    systemHealth: string;
    healthScore?: number;
    healthMetrics?: {
      failedActions?: number;
      oldPendingRequests?: number;
      rosterConflicts?: number;
      missedRosters?: number;
      activeUsersLast24h?: number;
      engagementRate?: number;
    };
    pendingActions: number;
    pendingTimeOff?: number;
    conflictsCount?: number;
    activeUsersToday: number;
  } | null;
  venueComparison: Array<{
    venue: string;
    today: number;
    weekAvg: number;
    monthAvg: number;
  }>;
  activityHeatmap: {
    data: Array<{ x: number; y: string; value: number; label: string }>;
    xLabels: number[];
    yLabels: string[];
  } | null;
  actionDistribution: Array<{ name: string; value: number }>;
  roleDistribution: Array<{
    name: string;
    active: number;
    inactive: number;
    total: number;
  }>;
  approvalMetrics: Array<{ week: string; avgDays: number; target: number }>;
  auditLogs: Array<{
    id: string;
    action: string;
    resource: string;
    description: string;
    timestamp: Date;
    user: {
      name: string;
      email: string;
      avatar: string | null;
    };
  }>;
}

export function AdminDashboardClient({
  userId,
  globalStats,
  venueComparison,
  activityHeatmap,
  actionDistribution,
  roleDistribution,
  approvalMetrics,
  auditLogs,
}: AdminDashboardClientProps) {
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
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_ADMIN_WIDGETS);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from server on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const result = await getDashboardPreferences();
        if (result.success && result.data) {
          // Merge with defaults to handle new widgets
          const mergedWidgets = DEFAULT_ADMIN_WIDGETS.map((d) => {
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
        console.error("[AdminDashboard] Failed to load preferences:", error);
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
      console.error("[AdminDashboard] Failed to save date range:", error);
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
      console.error("[AdminDashboard] Failed to save widgets:", error);
    }
  }, [dateRange]);

  // Get visible widget IDs
  const visibleWidgetIds = widgets.filter((w) => w.enabled).map((w) => w.id);

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
        userRole="ADMIN"
        userId={userId}
        title="Welcome back!"
        subtitle="System-wide administration dashboard"
        onDateRangeChange={handleDateRangeChange}
        onWidgetsChange={handleWidgetsChange}
        initialDateRange={dateRange}
        initialWidgets={widgets}
      />

      {/* Global Stats Cards */}
      {visibleWidgetIds.includes("global-stats") && globalStats && (
        <GlobalStatsCards stats={globalStats} />
      )}

      {/* Venue Comparison Chart */}
      {visibleWidgetIds.includes("venue-comparison") && venueComparison.length > 0 && (
        <VenueComparisonChart comparison={venueComparison} />
      )}

      {/* System Activity Grid (2x2) */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* User Activity Heatmap */}
        {visibleWidgetIds.includes("activity-heatmap") && activityHeatmap && (
          <UserActivityHeatmap heatmap={activityHeatmap} />
        )}

        {/* Action Distribution Pie */}
        {visibleWidgetIds.includes("action-distribution") && actionDistribution.length > 0 && (
          <ActionDistributionPie distribution={actionDistribution} />
        )}

        {/* Role Distribution Donut */}
        {visibleWidgetIds.includes("role-distribution") && roleDistribution.length > 0 && (
          <RoleDistributionDonut distribution={roleDistribution} />
        )}

        {/* Approval Turnaround Chart */}
        {visibleWidgetIds.includes("approval-metrics") && approvalMetrics.length > 0 && (
          <ApprovalTurnaroundChart metrics={approvalMetrics} />
        )}
      </div>

      {/* Audit Log Feed */}
      {visibleWidgetIds.includes("audit-logs") && auditLogs.length > 0 && (
        <AuditLogFeed logs={auditLogs} />
      )}
    </div>
  );
}
