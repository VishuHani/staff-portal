"use client";

import { PieChart } from "@/components/charts/PieChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface DistributionData {
  name: string;
  value: number;
}

interface ActionDistributionPieProps {
  distribution: DistributionData[];
}

const CHART_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#14b8a6", // teal
];

export function ActionDistributionPie({ distribution }: ActionDistributionPieProps) {
  if (!distribution || distribution.length === 0) {
    return (
      <ChartSkeleton
        title="Action Distribution"
        description="System actions breakdown (last 30 days)"
        type="pie"
        height={300}
      />
    );
  }

  return (
    <PieChart
      title="Action Distribution"
      description="System actions breakdown (last 30 days)"
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
