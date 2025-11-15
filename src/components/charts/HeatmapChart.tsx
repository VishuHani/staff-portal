"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface HeatmapData {
  x: string | number;
  y: string | number;
  value: number;
  label?: string;
}

interface HeatmapChartProps {
  title?: string;
  description?: string;
  data: HeatmapData[];
  xLabels: (string | number)[];
  yLabels: (string | number)[];
  minValue?: number;
  maxValue?: number;
  colorScale?: {
    low: string;
    medium: string;
    high: string;
  };
  showValues?: boolean;
  onCellClick?: (data: HeatmapData) => void;
  className?: string;
}

const DEFAULT_COLOR_SCALE = {
  low: "bg-green-100 hover:bg-green-200 text-green-900",
  medium: "bg-yellow-100 hover:bg-yellow-200 text-yellow-900",
  high: "bg-red-100 hover:bg-red-200 text-red-900",
};

export function HeatmapChart({
  title,
  description,
  data,
  xLabels,
  yLabels,
  minValue,
  maxValue,
  colorScale = DEFAULT_COLOR_SCALE,
  showValues = true,
  onCellClick,
  className,
}: HeatmapChartProps) {
  // Calculate min/max if not provided
  const values = data.map((d) => d.value);
  const min = minValue ?? Math.min(...values);
  const max = maxValue ?? Math.max(...values);
  const range = max - min;

  // Get color class based on value
  const getColorClass = (value: number) => {
    if (range === 0) return colorScale.medium;
    const normalized = (value - min) / range;
    if (normalized < 0.33) return colorScale.low;
    if (normalized < 0.67) return colorScale.medium;
    return colorScale.high;
  };

  // Find cell data for x, y coordinates
  const getCellData = (x: string | number, y: string | number): HeatmapData | null => {
    return data.find((d) => d.x === x && d.y === y) || null;
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
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Heatmap Grid */}
            <div className="grid gap-1" style={{ gridTemplateColumns: `auto repeat(${xLabels.length}, 1fr)` }}>
              {/* Top-left corner cell (empty) */}
              <div className="p-2" />

              {/* X-axis labels (top) */}
              {xLabels.map((label) => (
                <div key={`x-${label}`} className="p-2 text-center text-xs font-medium text-muted-foreground">
                  {label}
                </div>
              ))}

              {/* Grid rows */}
              {yLabels.map((yLabel, yIndex) => (
                <React.Fragment key={`row-${yLabel}-${yIndex}`}>
                  {/* Y-axis label (left) */}
                  <div className="p-2 text-xs font-medium text-muted-foreground flex items-center">
                    {yLabel}
                  </div>

                  {/* Data cells */}
                  {xLabels.map((xLabel) => {
                    const cellData = getCellData(xLabel, yLabel);
                    const value = cellData?.value ?? 0;
                    const colorClass = getColorClass(value);

                    return (
                      <div
                        key={`cell-${xLabel}-${yLabel}`}
                        className={cn(
                          "p-3 rounded text-center text-xs font-medium transition-colors",
                          colorClass,
                          onCellClick && "cursor-pointer"
                        )}
                        onClick={() => cellData && onCellClick?.(cellData)}
                        title={cellData?.label || `${xLabel}, ${yLabel}: ${value}`}
                      >
                        {showValues && (cellData?.value !== undefined ? cellData.value : "-")}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-4 flex items-center justify-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
                <span className="text-muted-foreground">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200" />
                <span className="text-muted-foreground">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-red-100 border border-red-200" />
                <span className="text-muted-foreground">High</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
