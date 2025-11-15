"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";

interface RoleData {
  name: string;
  active: number;
  inactive: number;
}

interface RoleDistributionDonutProps {
  distribution: RoleData[];
}

const ROLE_COLORS = [
  "#ef4444", // red - admin
  "#f59e0b", // amber - manager
  "#3b82f6", // blue - staff
  "#10b981", // green
  "#8b5cf6", // purple
];

export function RoleDistributionDonut({ distribution }: RoleDistributionDonutProps) {
  if (!distribution || distribution.length === 0) {
    return (
      <ChartSkeleton
        title="Role Distribution"
        description="Active users by role"
        type="donut"
        height={300}
      />
    );
  }

  // Calculate total active users
  const totalActive = distribution.reduce((sum, role) => sum + role.active, 0);

  // Transform data for donut chart (only showing active users)
  const chartData = distribution.map((role) => ({
    name: role.name,
    value: role.active,
  }));

  return (
    <DonutChart
      title="Role Distribution"
      description="Active users by role"
      data={chartData}
      dataKey="value"
      nameKey="name"
      colors={ROLE_COLORS}
      height={300}
      showLegend={true}
      showLabels={false}
      innerRadius={60}
      outerRadius={90}
      centerLabel="Total"
      centerValue={totalActive.toString()}
    />
  );
}
