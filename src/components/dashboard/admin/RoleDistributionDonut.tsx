"use client";

import { DonutChart } from "@/components/charts/DonutChart";
import { ChartSkeleton } from "@/components/charts/ChartSkeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX } from "lucide-react";

interface RoleData {
  name: string;
  active: number;
  inactive: number;
  total?: number;
}

interface RoleDistributionDonutProps {
  distribution: RoleData[];
}

const ROLE_COLORS: Record<string, string> = {
  "ADMIN": "#ef4444", // red
  "MANAGER": "#f59e0b", // amber
  "STAFF": "#3b82f6", // blue
};

const DEFAULT_COLORS = [
  "#10b981", // green
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
];

export function RoleDistributionDonut({ distribution }: RoleDistributionDonutProps) {
  if (!distribution || distribution.length === 0) {
    return (
      <ChartSkeleton
        title="Role Distribution"
        description="Active and inactive users by role"
        type="donut"
        height={300}
      />
    );
  }

  // Calculate totals
  const totalActive = distribution.reduce((sum, role) => sum + role.active, 0);
  const totalInactive = distribution.reduce((sum, role) => sum + role.inactive, 0);
  const totalUsers = totalActive + totalInactive;

  // Transform data for donut chart - show active users by role
  const chartData = distribution
    .filter((role) => role.active > 0)
    .map((role) => ({
      name: role.name,
      value: role.active,
    }));

  // Get colors for each role
  const colors = distribution
    .filter((role) => role.active > 0)
    .map((role) => ROLE_COLORS[role.name] || DEFAULT_COLORS[distribution.indexOf(role) % DEFAULT_COLORS.length]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Role Distribution
        </CardTitle>
        <CardDescription>Active and inactive users by role</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-6">
          {/* Donut Chart */}
          <div className="flex-shrink-0">
            <DonutChart
              title=""
              description=""
              data={chartData}
              dataKey="value"
              nameKey="name"
              colors={colors}
              height={200}
              showLegend={false}
              showLabels={false}
              innerRadius={50}
              outerRadius={80}
              centerLabel="Active"
              centerValue={totalActive.toString()}
            />
          </div>

          {/* Legend and Stats */}
          <div className="flex-1 space-y-3">
            {/* Summary Stats */}
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
                <UserCheck className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-xs text-muted-foreground">Active</p>
                  <p className="text-lg font-semibold text-green-600">{totalActive}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                <UserX className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Inactive</p>
                  <p className="text-lg font-semibold text-gray-500">{totalInactive}</p>
                </div>
              </div>
            </div>

            {/* Role Breakdown */}
            <div className="space-y-2">
              {distribution.map((role) => (
                <div key={role.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: ROLE_COLORS[role.name] || DEFAULT_COLORS[distribution.indexOf(role) % DEFAULT_COLORS.length] }}
                    />
                    <span className="text-sm font-medium">{role.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {role.active} active
                    </Badge>
                    {role.inactive > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {role.inactive} inactive
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
