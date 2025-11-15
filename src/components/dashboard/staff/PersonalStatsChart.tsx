"use client";

import { LineChart } from "@/components/charts/LineChart";

interface TrendData {
  week: string;
  hours: number;
}

interface PersonalStatsChartProps {
  trends: TrendData[];
}

export function PersonalStatsChart({ trends }: PersonalStatsChartProps) {
  return (
    <LineChart
      title="Availability Trends"
      description="Your weekly availability over the last 4 weeks"
      data={trends}
      dataKeys={[
        {
          key: "hours",
          color: "hsl(var(--primary))",
          name: "Hours Available",
        },
      ]}
      xAxisKey="week"
      yAxisLabel="Hours"
      height={250}
      showGrid={true}
      showLegend={false}
    />
  );
}
