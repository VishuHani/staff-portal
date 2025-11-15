"use client";

import { LineChart } from "@/components/charts/LineChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface TrendData {
  week: string;
  coverage: number;
  target: number;
}

interface CoverageTrendChartProps {
  trends: TrendData[];
}

export function CoverageTrendChart({ trends }: CoverageTrendChartProps) {
  if (!trends || trends.length === 0) {
    return (
      <ChartSkeleton
        title="Coverage Trend"
        description="Average daily coverage percentage over the last 8 weeks"
        type="line"
        height={300}
      />
    );
  }

  return (
    <LineChart
      title="Coverage Trend"
      description="Average daily coverage percentage over the last 8 weeks"
      data={trends}
      dataKeys={[
        {
          key: "coverage",
          color: "#3b82f6",
          name: "Coverage %",
        },
        {
          key: "target",
          color: "#94a3b8",
          name: "Target (80%)",
        },
      ]}
      xAxisKey="week"
      yAxisLabel="Coverage %"
      height={300}
      showGrid={true}
      showLegend={true}
    />
  );
}
