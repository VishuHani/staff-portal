"use client";

import { HeatmapChart } from "@/components/charts/HeatmapChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface HeatmapData {
  x: string | number;
  y: string | number;
  value: number;
  label?: string;
}

interface UserActivityHeatmapProps {
  heatmap: {
    data: HeatmapData[];
    xLabels: (string | number)[];
    yLabels: (string | number)[];
  } | null;
}

export function UserActivityHeatmap({ heatmap }: UserActivityHeatmapProps) {
  if (!heatmap) {
    return (
      <ChartSkeleton
        title="User Activity Heatmap"
        description="System activity by day and hour (last 7 days)"
        type="heatmap"
        height={400}
      />
    );
  }

  return (
    <HeatmapChart
      title="User Activity Heatmap"
      description="System activity by day and hour (last 7 days)"
      data={heatmap.data}
      xLabels={heatmap.xLabels}
      yLabels={heatmap.yLabels}
      showValues={false}
      colorScale={{
        low: "bg-blue-100 hover:bg-blue-200 text-blue-900",
        medium: "bg-blue-300 hover:bg-blue-400 text-blue-900",
        high: "bg-blue-500 hover:bg-blue-600 text-white",
      }}
    />
  );
}
