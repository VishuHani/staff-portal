"use client";

import { PieChart } from "@/components/charts/PieChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface DistributionData {
  name: string;
  value: number;
}

interface TeamAvailabilityPieProps {
  distribution: DistributionData[];
}

const CHART_COLORS = [
  "#22c55e", // green - Available
  "#eab308", // yellow - Partial
  "#ef4444", // red - On Leave
  "#94a3b8", // gray - Unavailable
];

export function TeamAvailabilityPie({ distribution }: TeamAvailabilityPieProps) {
  if (!distribution || distribution.length === 0) {
    return (
      <ChartSkeleton
        title="Team Availability Distribution"
        description="Current team availability status breakdown"
        type="pie"
        height={300}
      />
    );
  }

  return (
    <PieChart
      title="Team Availability Distribution"
      description="Current team availability status breakdown"
      data={distribution}
      dataKey="value"
      nameKey="name"
      colors={CHART_COLORS}
      height={300}
      showLegend={true}
      showLabels={false}
    />
  );
}
