"use client";

import { BarChart } from "@/components/charts/BarChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface VenueComparison {
  venue: string;
  today: number;
  weekAvg: number;
  monthAvg: number;
}

interface VenueComparisonChartProps {
  comparison: VenueComparison[];
}

export function VenueComparisonChart({ comparison }: VenueComparisonChartProps) {
  if (!comparison || comparison.length === 0) {
    return (
      <ChartSkeleton
        title="Cross-Venue Coverage Comparison"
        description="Coverage percentage by venue (today, week average, month average)"
        type="bar"
        height={350}
      />
    );
  }

  return (
    <BarChart
      title="Cross-Venue Coverage Comparison"
      description="Coverage percentage by venue (today, week average, month average)"
      data={comparison}
      dataKeys={[
        {
          key: "today",
          color: "#3b82f6",
          name: "Today",
        },
        {
          key: "weekAvg",
          color: "#10b981",
          name: "Week Avg",
        },
        {
          key: "monthAvg",
          color: "#8b5cf6",
          name: "Month Avg",
        },
      ]}
      xAxisKey="venue"
      yAxisLabel="Coverage %"
      height={350}
      showGrid={true}
      showLegend={true}
      stacked={false}
    />
  );
}
