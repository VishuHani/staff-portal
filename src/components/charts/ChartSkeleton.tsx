import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface ChartSkeletonProps {
  title?: string;
  description?: string;
  height?: number;
  type?: "line" | "bar" | "pie" | "donut" | "heatmap";
  className?: string;
}

export function ChartSkeleton({
  title,
  description,
  height = 300,
  type = "line",
  className
}: ChartSkeletonProps) {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && (
            <CardTitle>
              <Skeleton className="h-6 w-48" />
            </CardTitle>
          )}
          {description && (
            <CardDescription>
              <Skeleton className="h-4 w-64 mt-2" />
            </CardDescription>
          )}
        </CardHeader>
      )}
      <CardContent>
        <div className="relative" style={{ height }}>
          {type === "line" && <LineChartSkeleton />}
          {type === "bar" && <BarChartSkeleton />}
          {type === "pie" && <PieChartSkeleton />}
          {type === "donut" && <DonutChartSkeleton />}
          {type === "heatmap" && <HeatmapSkeleton />}
        </div>
      </CardContent>
    </Card>
  );
}

function LineChartSkeleton() {
  return (
    <div className="flex h-full items-end justify-around gap-2 px-4">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-1">
          <Skeleton
            className="w-full"
            style={{
              height: `${Math.random() * 60 + 40}%`,
              transition: "height 0.3s ease"
            }}
          />
          <Skeleton className="h-3 w-8" />
        </div>
      ))}
    </div>
  );
}

function BarChartSkeleton() {
  return (
    <div className="flex h-full items-end justify-around gap-3 px-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2 flex-1">
          <Skeleton
            className="w-full"
            style={{
              height: `${Math.random() * 70 + 30}%`,
              transition: "height 0.3s ease"
            }}
          />
          <Skeleton className="h-3 w-12" />
        </div>
      ))}
    </div>
  );
}

function PieChartSkeleton() {
  return (
    <div className="flex h-full items-center justify-center">
      <Skeleton className="h-48 w-48 rounded-full" />
    </div>
  );
}

function DonutChartSkeleton() {
  return (
    <div className="flex h-full items-center justify-center relative">
      <Skeleton className="h-48 w-48 rounded-full" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-24 w-24 rounded-full bg-background" />
      </div>
    </div>
  );
}

function HeatmapSkeleton() {
  return (
    <div className="grid grid-cols-7 gap-2 h-full p-4">
      {Array.from({ length: 21 }).map((_, i) => (
        <Skeleton key={i} className="h-full w-full rounded" />
      ))}
    </div>
  );
}

// Specialized skeleton for KPI cards
export function KPICardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          <Skeleton className="h-4 w-32" />
        </CardTitle>
        <Skeleton className="h-4 w-4 rounded" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-40" />
      </CardContent>
    </Card>
  );
}

// Specialized skeleton for table rows
export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}
