"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardDateRangePicker } from "./DashboardDateRangePicker";
import {
  DashboardCustomizationPanel,
  type DashboardWidget,
} from "./DashboardCustomizationPanel";
import {
  DEFAULT_STAFF_WIDGETS,
  DEFAULT_MANAGER_WIDGETS,
  DEFAULT_ADMIN_WIDGETS,
} from "./widget-defaults";
import { useDashboardRealtime } from "@/hooks/useDashboardRealtime";
import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { RefreshCw, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardHeaderProps {
  userRole: "STAFF" | "MANAGER" | "ADMIN";
  userId: string;
  title: string;
  subtitle: string;
  onDateRangeChange?: (range: DateRange | undefined) => void;
  onWidgetsChange?: (widgets: DashboardWidget[]) => void;
  initialDateRange?: DateRange;
  initialWidgets?: DashboardWidget[];
  className?: string;
}

export function DashboardHeader({
  userRole,
  userId,
  title,
  subtitle,
  onDateRangeChange,
  onWidgetsChange,
  initialDateRange,
  initialWidgets,
  className,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(initialDateRange);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Get default widgets for role
  const defaultWidgets = userRole === "STAFF" 
    ? DEFAULT_STAFF_WIDGETS 
    : userRole === "MANAGER" 
    ? DEFAULT_MANAGER_WIDGETS 
    : DEFAULT_ADMIN_WIDGETS;
  
  // Initialize widgets from props or defaults
  const [widgets, setWidgets] = useState<DashboardWidget[]>(initialWidgets || defaultWidgets);

  // Update state when props change
  useEffect(() => {
    if (initialDateRange) {
      setDateRange(initialDateRange);
    }
  }, [initialDateRange]);

  useEffect(() => {
    if (initialWidgets) {
      setWidgets(initialWidgets);
    }
  }, [initialWidgets]);

  // Real-time updates
  const { refreshDashboard } = useDashboardRealtime({
    userId,
    role: userRole,
    enabled: true,
  });

  // Handle date range change
  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    onDateRangeChange?.(range);
  };

  // Handle widgets change
  const handleWidgetsChange = (newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);
    onWidgetsChange?.(newWidgets);
    // Refresh to apply new widget visibility
    refreshDashboard();
  };

  // Handle reset
  const handleReset = () => {
    setWidgets(defaultWidgets);
    onWidgetsChange?.(defaultWidgets);
    refreshDashboard();
  };

  // Manual refresh
  const handleRefresh = async () => {
    setIsRefreshing(true);
    refreshDashboard();
    router.refresh();
    // Small delay to show the spinning animation
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const visibleWidgets = widgets.filter((w) => w.enabled);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Title row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Date Range Picker */}
          <DashboardDateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            align="end"
            className="h-9"
          />

          {/* Refresh button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw
              className={cn("h-4 w-4", isRefreshing && "animate-spin")}
            />
          </Button>

          {/* Customize button */}
          <DashboardCustomizationPanel
            widgets={widgets}
            onChange={handleWidgetsChange}
            onReset={handleReset}
            trigger={
              <Button variant="outline" size="sm" className="h-9">
                <Settings2 className="h-4 w-4 mr-2" />
                Customize
              </Button>
            }
          />
        </div>
      </div>

      {/* Visible widgets info (for debugging) */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-muted-foreground">
          Showing {visibleWidgets.length} of {widgets.length} widgets
        </div>
      )}
    </div>
  );
}

// Export the hook for use in parent components
export { useDashboardWidgets } from "./DashboardCustomizationPanel";
export type { DashboardWidget } from "./DashboardCustomizationPanel";
