"use client";

import { LineChart } from "@/components/charts/LineChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface MetricData {
  week: string;
  avgDays: number;
  target: number;
}

interface ApprovalTurnaroundChartProps {
  metrics: MetricData[];
}

export function ApprovalTurnaroundChart({ metrics }: ApprovalTurnaroundChartProps) {
  if (!metrics || metrics.length === 0) {
    return (
      <ChartSkeleton
        title="Approval Turnaround Time"
        description="Average days to approve time-off requests (last 12 weeks)"
        type="line"
        height={300}
      />
    );
  }

  return (
    <LineChart
      title="Approval Turnaround Time"
      description="Average days to approve time-off requests (last 12 weeks)"
      data={metrics}
      dataKeys={[
        {
          key: "avgDays",
          color: "#3b82f6",
          name: "Avg Days",
        },
        {
          key: "target",
          color: "#94a3b8",
          name: "Target (2 days)",
        },
      ]}
      xAxisKey="week"
      yAxisLabel="Days"
      height={300}
      showGrid={true}
      showLegend={true}
    />
  );
}
