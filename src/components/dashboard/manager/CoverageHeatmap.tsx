"use client";

import { HeatmapChart } from "@/components/charts/HeatmapChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface HeatmapData {
  x: string | number;
  y: string | number;
  value: number;
  label?: string;
}

interface CoverageHeatmapProps {
  heatmap: {
    data: HeatmapData[];
    xLabels: (string | number)[];
    yLabels: (string | number)[];
  } | null;
}

export function CoverageHeatmap({ heatmap }: CoverageHeatmapProps) {
  if (!heatmap) {
    return (
      <ChartSkeleton
        title="Weekly Coverage Heatmap"
        description="Team availability for the next 7 days by time slot"
        type="heatmap"
        height={400}
      />
    );
  }

  return (
    <HeatmapChart
      title="Weekly Coverage Heatmap"
      description="Team availability for the next 7 days by time slot"
      data={heatmap.data}
      xLabels={heatmap.xLabels}
      yLabels={heatmap.yLabels}
      showValues={true}
      colorScale={{
        low: "bg-red-100 hover:bg-red-200 text-red-900",
        medium: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900",
        high: "bg-green-100 hover:bg-green-200 text-green-900",
      }}
    />
  );
}
