"use client";

import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface BarChartProps {
  title?: string;
  description?: string;
  data: any[];
  dataKeys: {
    key: string;
    color: string;
    name?: string;
  }[];
  xAxisKey: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  height?: number;
  showGrid?: boolean;
  showLegend?: boolean;
  stacked?: boolean;
  horizontal?: boolean;
  className?: string;
}

export function BarChart({
  title,
  description,
  data,
  dataKeys,
  xAxisKey,
  xAxisLabel,
  yAxisLabel,
  height = 300,
  showGrid = true,
  showLegend = true,
  stacked = false,
  horizontal = false,
  className,
}: BarChartProps) {
  return (
    <Card className={className}>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <RechartsBarChart
            data={data}
            layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            {showGrid && <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />}
            {horizontal ? (
              <>
                <XAxis type="number" />
                <YAxis
                  dataKey={xAxisKey}
                  type="category"
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined}
                  className="text-xs"
                />
              </>
            ) : (
              <>
                <XAxis
                  dataKey={xAxisKey}
                  label={xAxisLabel ? { value: xAxisLabel, position: "insideBottom", offset: -5 } : undefined}
                  className="text-xs"
                />
                <YAxis
                  label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: "insideLeft" } : undefined}
                  className="text-xs"
                />
              </>
            )}
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            {showLegend && <Legend />}
            {dataKeys.map((dataKey) => (
              <Bar
                key={dataKey.key}
                dataKey={dataKey.key}
                fill={dataKey.color}
                name={dataKey.name || dataKey.key}
                radius={[4, 4, 0, 0]}
                stackId={stacked ? "stack" : undefined}
              />
            ))}
          </RechartsBarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
