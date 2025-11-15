"use client";

import { Pie, PieChart, ResponsiveContainer, Tooltip, Legend, Cell } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface DonutChartProps {
  title?: string;
  description?: string;
  data: any[];
  dataKey: string;
  nameKey: string;
  colors?: string[];
  height?: number;
  showLegend?: boolean;
  showLabels?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  centerLabel?: string;
  centerValue?: string;
  className?: string;
}

const DEFAULT_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function DonutChart({
  title,
  description,
  data,
  dataKey,
  nameKey,
  colors = DEFAULT_COLORS,
  height = 300,
  showLegend = true,
  showLabels = false,
  innerRadius = 60,
  outerRadius = 80,
  centerLabel,
  centerValue,
  className,
}: DonutChartProps) {
  const renderLabel = (entry: any) => {
    if (!showLabels) return null;
    return `${entry[nameKey]}: ${entry[dataKey]}`;
  };

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
          <PieChart>
            <Pie
              data={data}
              dataKey={dataKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              label={showLabels ? renderLabel : false}
              labelLine={showLabels}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              labelStyle={{ color: "hsl(var(--foreground))" }}
            />
            {showLegend && <Legend />}
            {/* Center label - rendered as SVG text */}
            {(centerLabel || centerValue) && (
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                {centerLabel && (
                  <tspan x="50%" dy="-0.5em" className="text-sm fill-muted-foreground">
                    {centerLabel}
                  </tspan>
                )}
                {centerValue && (
                  <tspan x="50%" dy="1.5em" className="text-2xl font-bold fill-foreground">
                    {centerValue}
                  </tspan>
                )}
              </text>
            )}
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
