"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface DaySummary {
  date: string;
  dayName: string;
  dayOfWeek: number;
  status: "available" | "unavailable" | "partial" | "time-off";
  hours: number;
  isToday: boolean;
}

interface WeekAtGlanceProps {
  summary: DaySummary[];
}

const statusConfig = {
  available: {
    bg: "bg-green-100",
    border: "border-green-300",
    text: "text-green-900",
    label: "Available",
  },
  unavailable: {
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-600",
    label: "Unavailable",
  },
  partial: {
    bg: "bg-yellow-100",
    border: "border-yellow-300",
    text: "text-yellow-900",
    label: "Partial",
  },
  "time-off": {
    bg: "bg-red-100",
    border: "border-red-300",
    text: "text-red-900",
    label: "Time Off",
  },
};

export function WeekAtGlance({ summary }: WeekAtGlanceProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              My Week at a Glance
            </CardTitle>
            <CardDescription>Your availability for the next 7 days</CardDescription>
          </div>
          <Link href="/availability">
            <Button size="sm">
              Set Availability
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-2">
          {summary.map((day) => {
            const config = statusConfig[day.status];
            return (
              <div
                key={day.date}
                className={cn(
                  "relative rounded-lg border-2 p-3 text-center transition-all",
                  config.bg,
                  config.border,
                  day.isToday && "ring-2 ring-primary ring-offset-2"
                )}
              >
                {day.isToday && (
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
                      Today
                    </span>
                  </div>
                )}
                <div className="text-xs font-semibold text-muted-foreground">
                  {day.dayName}
                </div>
                <div className={cn("mt-1 text-2xl font-bold", config.text)}>
                  {day.hours > 0 ? day.hours : "-"}
                </div>
                <div className="mt-1 flex items-center justify-center gap-1 text-xs">
                  {day.hours > 0 && (
                    <>
                      <Clock className="h-3 w-3" />
                      <span>hrs</span>
                    </>
                  )}
                  {day.hours === 0 && (
                    <span className={config.text}>{config.label}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          {Object.entries(statusConfig).map(([key, config]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={cn("h-3 w-3 rounded border", config.bg, config.border)} />
              <span className="text-muted-foreground">{config.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
