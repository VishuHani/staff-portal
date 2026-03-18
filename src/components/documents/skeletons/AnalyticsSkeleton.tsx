"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

// ============================================================================
// ANALYTICS SKELETON
// ============================================================================

interface AnalyticsSkeletonProps {
  /** Show date range picker */
  showDateRange?: boolean;
  /** Number of stat cards */
  statCount?: number;
  /** Show charts */
  showCharts?: boolean;
  /** Show tables */
  showTables?: boolean;
}

export function AnalyticsSkeleton({
  showDateRange = true,
  statCount = 4,
  showCharts = true,
  showTables = true,
}: AnalyticsSkeletonProps) {
  return (
    <div className="space-y-6" role="status" aria-label="Loading analytics">
      {/* Header with date range */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        {showDateRange && (
          <Skeleton className="h-10 w-64" />
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: statCount }).map((_, i) => (
          <AnalyticsStatSkeleton key={i} />
        ))}
      </div>

      {/* Charts */}
      {showCharts && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnalyticsChartSkeleton title="Completion Trend" />
          <AnalyticsChartSkeleton title="Status Distribution" type="donut" />
        </div>
      )}

      {/* Tables */}
      {showTables && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnalyticsTableSkeleton title="Top Documents" />
          <AnalyticsTableSkeleton title="Recent Activity" />
        </div>
      )}

      <span className="sr-only">Loading analytics...</span>
    </div>
  );
}

// ============================================================================
// ANALYTICS STAT SKELETON
// ============================================================================

interface AnalyticsStatSkeletonProps {
  /** Show trend indicator */
  showTrend?: boolean;
}

export function AnalyticsStatSkeleton({ showTrend = true }: AnalyticsStatSkeletonProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>
        {showTrend && (
          <div className="flex items-center gap-2 mt-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 w-20" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ANALYTICS CHART SKELETON
// ============================================================================

interface AnalyticsChartSkeletonProps {
  /** Chart title */
  title?: string;
  /** Chart type */
  type?: "line" | "bar" | "donut" | "area";
  /** Chart height */
  height?: number;
}

export function AnalyticsChartSkeleton({
  title,
  type = "line",
  height = 300,
}: AnalyticsChartSkeletonProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      </CardHeader>
      <CardContent>
        {type === "line" || type === "area" ? (
          <div style={{ height: `${height}px` }} className="flex items-end gap-2">
            {/* Simulated line chart */}
            <svg className="w-full h-full" viewBox="0 0 400 200">
              <path
                d="M0,150 Q50,100 100,120 T200,80 T300,100 T400,60"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted opacity-30"
              />
              {type === "area" && (
                <path
                  d="M0,150 Q50,100 100,120 T200,80 T300,100 T400,60 L400,200 L0,200 Z"
                  className="text-muted opacity-10 fill-current"
                />
              )}
            </svg>
          </div>
        ) : type === "bar" ? (
          <div style={{ height: `${height}px` }} className="flex items-end gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton
                key={i}
                className="flex-1"
                style={{ height: `${Math.random() * 60 + 40}%` }}
              />
            ))}
          </div>
        ) : type === "donut" ? (
          <div style={{ height: `${height}px` }} className="flex items-center justify-center">
            <div className="relative">
              <Skeleton className="w-48 h-48 rounded-full" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Skeleton className="w-24 h-24 rounded-full bg-background" />
              </div>
            </div>
            <div className="ml-6 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ANALYTICS TABLE SKELETON
// ============================================================================

interface AnalyticsTableSkeletonProps {
  /** Table title */
  title?: string;
  /** Number of rows */
  rowCount?: number;
}

export function AnalyticsTableSkeleton({
  title,
  rowCount = 5,
}: AnalyticsTableSkeletonProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center gap-4 pb-2 border-b">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-16 ml-auto" />
          </div>

          {/* Rows */}
          {Array.from({ length: rowCount }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <div className="flex items-center gap-3 flex-1">
                <Skeleton className="h-8 w-8 rounded" />
                <div className="space-y-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// ANALYTICS OVERVIEW SKELETON
// ============================================================================

export function AnalyticsOverviewSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading analytics overview">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-7 w-16" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main chart */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>

      {/* Secondary charts */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-40 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>

      <span className="sr-only">Loading analytics overview...</span>
    </div>
  );
}

// ============================================================================
// ANALYTICS FILTER SKELETON
// ============================================================================

export function AnalyticsFilterSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-lg">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-10 w-32" />
      <Skeleton className="h-10 w-32" />
      <div className="ml-auto flex gap-2">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

// ============================================================================
// ANALYTICS REPORT SKELETON
// ============================================================================

export function AnalyticsReportSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading report">
      {/* Report header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Report sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="pt-4">
              <Skeleton className="h-48 w-full" />
            </div>
          </CardContent>
        </Card>
      ))}

      <span className="sr-only">Loading report...</span>
    </div>
  );
}

// ============================================================================
// COMPLETION RATE SKELETON
// ============================================================================

export function CompletionRateSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-2">
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Circular progress */}
          <div className="relative">
            <Skeleton className="w-32 h-32 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <Skeleton className="h-8 w-12 mx-auto" />
                <Skeleton className="h-4 w-8 mx-auto mt-1" />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4 flex-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-3 w-3 rounded-full" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <Skeleton className="h-4 w-12" />
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export default AnalyticsSkeleton;