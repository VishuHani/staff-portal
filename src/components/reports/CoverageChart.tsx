"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { BarChart3, LineChart as LineChartIcon } from "lucide-react";

interface DailyCoverageData {
  date: string;
  availableStaff: number;
  totalStaff: number;
  coveragePercentage: number;
}

interface CoverageChartProps {
  data: DailyCoverageData[];
  title: string;
  description: string;
}

export function CoverageChart({ data, title, description }: CoverageChartProps) {
  const [chartType, setChartType] = useState<"bar" | "line">("bar");

  // Transform data for charts
  const chartData = data.map((item) => ({
    ...item,
    date: format(new Date(item.date), "MMM d"),
  }));

  const customTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <p className="font-medium text-sm mb-2">{payload[0].payload.date}</p>
          <div className="space-y-1">
            <p className="text-xs">
              <span className="text-green-600 font-medium">Available:</span>{" "}
              {payload[0].payload.availableStaff} staff
            </p>
            <p className="text-xs">
              <span className="text-blue-600 font-medium">Total:</span>{" "}
              {payload[0].payload.totalStaff} staff
            </p>
            <p className="text-xs">
              <span className="text-purple-600 font-medium">Coverage:</span>{" "}
              {payload[0].payload.coveragePercentage}%
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={chartType === "bar" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("bar")}
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Bar
            </Button>
            <Button
              variant={chartType === "line" ? "default" : "outline"}
              size="sm"
              onClick={() => setChartType("line")}
            >
              <LineChartIcon className="h-4 w-4 mr-2" />
              Line
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {chartData.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            No coverage data available for the selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={400}>
            {chartType === "bar" ? (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Staff Count", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                />
                <Tooltip content={customTooltip} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="circle"
                />
                <Bar
                  dataKey="availableStaff"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  name="Available Staff"
                />
                <Bar
                  dataKey="totalStaff"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Total Staff"
                />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Staff Count", angle: -90, position: "insideLeft", style: { fontSize: 12 } }}
                />
                <Tooltip content={customTooltip} />
                <Legend
                  wrapperStyle={{ fontSize: 12 }}
                  iconType="circle"
                />
                <Line
                  type="monotone"
                  dataKey="availableStaff"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ fill: "#10b981", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Available Staff"
                />
                <Line
                  type="monotone"
                  dataKey="totalStaff"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: "#3b82f6", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Total Staff"
                />
                <Line
                  type="monotone"
                  dataKey="coveragePercentage"
                  stroke="#a855f7"
                  strokeWidth={2}
                  dot={{ fill: "#a855f7", r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Coverage %"
                  yAxisId="right"
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 12 }}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: "Coverage %", angle: 90, position: "insideRight", style: { fontSize: 12 } }}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
