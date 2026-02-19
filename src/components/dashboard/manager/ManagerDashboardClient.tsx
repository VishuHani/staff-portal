"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DateRange } from "react-day-picker";
import { DashboardHeader } from "../DashboardHeader";
import { HeroStatsBar } from "./HeroStatsBar";
import { CoverageHeatmap } from "./CoverageHeatmap";
import { TeamAvailabilityPie } from "./TeamAvailabilityPie";
import { CoverageTrendChart } from "./CoverageTrendChart";
import { AIInsightsPanel } from "./AIInsightsPanel";
import { TeamSnapshotTable } from "./TeamSnapshotTable";
import { DashboardWidget } from "../DashboardCustomizationPanel";
import { DEFAULT_MANAGER_WIDGETS } from "../widget-defaults";
import { getDashboardPreferences, saveDashboardPreferences } from "@/lib/actions/dashboard/preferences";

interface ManagerDashboardClientProps {
  userId: string;
  heroStats: {
    coverageToday: number;
    availableStaff: number;
    totalStaff: number;
    pendingApprovals: number;
    upcomingAbsences: number;
  } | null;
  heatmap: {
    data: Array<{ x: string; y: string; value: number; label: string }>;
    xLabels: string[];
    yLabels: string[];
  } | null;
  distribution: Array<{ name: string; value: number }>;
  trend: Array<{ week: string; coverage: number; target: number; source?: string }>;
  insights: Array<{
    id: string;
    type: string;
    message: string;
    priority: "high" | "medium" | "low";
    actionUrl: string;
    staffName?: string;
    date?: string;
    impact?: {
      coverageImprovement: number;
      fairnessImprovement: number;
      conflictsResolved: number;
    };
    confidence?: number;
  }>;
  snapshot: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    hoursToday: number;
    nextTimeOff: string;
  }>;
}

export function ManagerDashboardClient({
  userId,
  heroStats,
  heatmap,
  distribution,
  trend,
  insights,
  snapshot,
}: ManagerDashboardClientProps) {
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
  const [widgets, setWidgets] = useState<DashboardWidget[]>(DEFAULT_MANAGER_WIDGETS);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from server on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const result = await getDashboardPreferences();
        if (result.success && result.data) {
          // Merge with defaults to handle new widgets
          const mergedWidgets = DEFAULT_MANAGER_WIDGETS.map((d) => {
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
        console.error("[ManagerDashboard] Failed to load preferences:", error);
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
      console.error("[ManagerDashboard] Failed to save date range:", error);
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
      console.error("[ManagerDashboard] Failed to save widgets:", error);
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
        userRole="MANAGER"
        userId={userId}
        title="Welcome back!"
        subtitle="Here's your team management dashboard"
        onDateRangeChange={handleDateRangeChange}
        onWidgetsChange={handleWidgetsChange}
        initialDateRange={dateRange}
        initialWidgets={widgets}
      />

      {/* Hero Stats Bar */}
      {visibleWidgetIds.includes("hero-stats") && heroStats && (
        <HeroStatsBar stats={heroStats} />
      )}

      {/* Main Visualizations Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Coverage Heatmap */}
        {visibleWidgetIds.includes("coverage-heatmap") && heatmap && (
          <CoverageHeatmap heatmap={heatmap} />
        )}

        {/* Team Availability Pie */}
        {visibleWidgetIds.includes("availability-pie") && distribution.length > 0 && (
          <TeamAvailabilityPie distribution={distribution} />
        )}

        {/* Coverage Trend Chart */}
        {visibleWidgetIds.includes("coverage-trend") && trend.length > 0 && (
          <CoverageTrendChart trends={trend} />
        )}

        {/* AI Insights Panel */}
        {visibleWidgetIds.includes("ai-insights") && (
          <AIInsightsPanel insights={insights} />
        )}
      </div>

      {/* Team Snapshot Table */}
      {visibleWidgetIds.includes("team-snapshot") && snapshot.length > 0 && (
        <TeamSnapshotTable snapshot={snapshot} />
      )}
    </div>
  );
}
