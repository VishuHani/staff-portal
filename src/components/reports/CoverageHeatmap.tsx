"use client";

import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HeatmapCell {
  day: string;
  hour: number;
  count: number;
}

interface CoverageHeatmapProps {
  data: HeatmapCell[];
  title: string;
  description: string;
}

export function CoverageHeatmap({ data, title, description }: CoverageHeatmapProps) {
  // Days of the week
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  // Ensure data is an array
  const safeData = Array.isArray(data) ? data : [];

  // Dynamically determine hours from data (allows filtering to business hours)
  const hoursInData = safeData.length > 0
    ? Array.from(new Set(safeData.map(d => d.hour))).sort((a, b) => a - b)
    : Array.from({ length: 24 }, (_, i) => i);

  const hours = hoursInData;

  // Find max count for color scaling
  const maxCount = safeData.length > 0 ? Math.max(...safeData.map((d) => d.count), 1) : 1;

  // Get color intensity based on count
  const getColorIntensity = (count: number) => {
    const intensity = count / maxCount;
    if (intensity === 0) return "bg-gray-100 border-gray-200";
    if (intensity < 0.25) return "bg-green-100 border-green-200";
    if (intensity < 0.5) return "bg-green-300 border-green-400";
    if (intensity < 0.75) return "bg-green-500 border-green-600";
    return "bg-green-700 border-green-800";
  };

  // Get data for specific day and hour
  const getCellData = (day: string, hour: number) => {
    return safeData.find((d) => d.day === day && d.hour === hour) || { day, hour, count: 0 };
  };

  // Format hour for display
  const formatHour = (hour: number) => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent>
        {data.length === 0 ? (
          <div className="h-96 flex items-center justify-center text-muted-foreground">
            No heatmap data available for the selected period
          </div>
        ) : (
          <div className="space-y-4">
            {/* Legend */}
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">Coverage:</span>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200" />
                <span className="text-xs">None</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-100 border border-green-200" />
                <span className="text-xs">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-300 border border-green-400" />
                <span className="text-xs">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-500 border border-green-600" />
                <span className="text-xs">High</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-green-700 border border-green-800" />
                <span className="text-xs">Very High</span>
              </div>
            </div>

            {/* Heatmap Grid */}
            <div className="overflow-x-auto">
              <div className="inline-block min-w-full">
                <div className="grid grid-cols-[120px_repeat(24,minmax(0,1fr))] gap-1">
                  {/* Header Row - Hours */}
                  <div className="text-xs font-medium text-muted-foreground py-2"></div>
                  {hours.map((hour) => (
                    <div
                      key={hour}
                      className="text-xs font-medium text-muted-foreground text-center py-2"
                    >
                      {hour}
                    </div>
                  ))}

                  {/* Data Rows */}
                  {days.map((day) => (
                    <React.Fragment key={day}>
                      {/* Day Label */}
                      <div
                        className="text-sm font-medium text-muted-foreground py-2 pr-2 flex items-center"
                      >
                        {day}
                      </div>

                      {/* Hour Cells */}
                      {hours.map((hour) => {
                        const cellData = getCellData(day, hour);
                        return (
                          <TooltipProvider key={`${day}-${hour}`}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={cn(
                                    "h-8 rounded border cursor-pointer transition-transform hover:scale-110",
                                    getColorIntensity(cellData.count)
                                  )}
                                />
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-1">
                                  <p className="font-medium text-sm">{day}</p>
                                  <p className="text-xs">{formatHour(hour)}</p>
                                  <p className="text-xs font-medium">
                                    {cellData.count} staff available
                                  </p>
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="text-xs text-muted-foreground">
              <p>
                Heatmap shows staff availability across different times of the week.
                Darker green indicates higher availability.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
