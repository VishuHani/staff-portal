"use client";

import { useState } from "react";
import { format, startOfToday, startOfWeek, endOfWeek, startOfMonth, endOfMonth, addDays, addWeeks, addMonths, subMonths } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export type DateRangePreset =
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "nextWeek"
  | "thisMonth"
  | "nextMonth"
  | "lastMonth"
  | "custom";

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [selectedPreset, setSelectedPreset] = useState<DateRangePreset>("thisWeek");

  const getPresetRange = (preset: DateRangePreset): DateRange | undefined => {
    const today = startOfToday();

    switch (preset) {
      case "today":
        return { from: today, to: today };
      case "tomorrow":
        const tomorrow = addDays(today, 1);
        return { from: tomorrow, to: tomorrow };
      case "thisWeek":
        return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfWeek(today, { weekStartsOn: 1 }) };
      case "nextWeek":
        const nextWeekStart = addWeeks(startOfWeek(today, { weekStartsOn: 1 }), 1);
        return { from: nextWeekStart, to: endOfWeek(nextWeekStart, { weekStartsOn: 1 }) };
      case "thisMonth":
        return { from: startOfMonth(today), to: endOfMonth(today) };
      case "nextMonth":
        const nextMonthStart = addMonths(startOfMonth(today), 1);
        return { from: nextMonthStart, to: endOfMonth(nextMonthStart) };
      case "lastMonth":
        const lastMonthStart = subMonths(startOfMonth(today), 1);
        return { from: lastMonthStart, to: endOfMonth(lastMonthStart) };
      case "custom":
        return value;
      default:
        return undefined;
    }
  };

  const handlePresetClick = (preset: DateRangePreset) => {
    setSelectedPreset(preset);
    const range = getPresetRange(preset);
    onChange(range);
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setSelectedPreset("custom");
    onChange(range);
  };

  const presets: Array<{ label: string; value: DateRangePreset }> = [
    { label: "Today", value: "today" },
    { label: "Tomorrow", value: "tomorrow" },
    { label: "This Week", value: "thisWeek" },
    { label: "Next Week", value: "nextWeek" },
    { label: "This Month", value: "thisMonth" },
    { label: "Next Month", value: "nextMonth" },
    { label: "Last Month", value: "lastMonth" },
  ];

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.value}
            variant={selectedPreset === preset.value ? "default" : "outline"}
            size="sm"
            onClick={() => handlePresetClick(preset.value)}
            type="button"
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !value && "text-muted-foreground"
            )}
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {value?.from ? (
              value.to ? (
                <>
                  {format(value.from, "MMM dd, yyyy")} -{" "}
                  {format(value.to, "MMM dd, yyyy")}
                </>
              ) : (
                format(value.from, "MMM dd, yyyy")
              )
            ) : (
              <span>Pick a date range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            initialFocus
            mode="range"
            defaultMonth={value?.from}
            selected={value}
            onSelect={handleDateSelect}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
