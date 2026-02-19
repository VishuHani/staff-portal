"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths } from "date-fns";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

interface DashboardDateRangePickerProps {
  value?: DateRange;
  onChange?: (range: DateRange | undefined) => void;
  className?: string;
  align?: "start" | "center" | "end";
}

const presets = [
  {
    label: "Today",
    getValue: () => {
      const today = new Date();
      return { from: today, to: today };
    },
  },
  {
    label: "This Week",
    getValue: () => {
      const today = new Date();
      return {
        from: startOfWeek(today, { weekStartsOn: 0 }),
        to: endOfWeek(today, { weekStartsOn: 0 }),
      };
    },
  },
  {
    label: "Last 7 Days",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 6), to: today };
    },
  },
  {
    label: "Last 14 Days",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 13), to: today };
    },
  },
  {
    label: "This Month",
    getValue: () => {
      const today = new Date();
      return {
        from: startOfMonth(today),
        to: endOfMonth(today),
      };
    },
  },
  {
    label: "Last 30 Days",
    getValue: () => {
      const today = new Date();
      return { from: subDays(today, 29), to: today };
    },
  },
  {
    label: "Last 3 Months",
    getValue: () => {
      const today = new Date();
      return { from: subMonths(today, 3), to: today };
    },
  },
];

export function DashboardDateRangePicker({
  value,
  onChange,
  className,
  align = "start",
}: DashboardDateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedRange, setSelectedRange] = useState<DateRange | undefined>(
    value || presets[2].getValue() // Default to "Last 7 Days"
  );

  const handlePresetSelect = (preset: typeof presets[0]) => {
    const range = preset.getValue();
    setSelectedRange(range);
    onChange?.(range);
    setIsOpen(false);
  };

  const handleCalendarSelect = (range: DateRange | undefined) => {
    setSelectedRange(range);
    onChange?.(range);
  };

  const displayLabel = selectedRange?.from && selectedRange?.to
    ? selectedRange.from.getTime() === selectedRange.to.getTime()
      ? format(selectedRange.from, "MMM d, yyyy")
      : `${format(selectedRange.from, "MMM d")} - ${format(selectedRange.to, "MMM d, yyyy")}`
    : "Select date range";

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-start text-left font-normal",
            !selectedRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          <span className="truncate max-w-[200px]">{displayLabel}</span>
          <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align={align}>
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-2 hidden sm:block">
            <div className="space-y-1">
              {presets.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs"
                  onClick={() => handlePresetSelect(preset)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              defaultMonth={selectedRange?.from}
              selected={selectedRange}
              onSelect={handleCalendarSelect}
              numberOfMonths={1}
              className="rounded-md border-0"
            />
          </div>
        </div>

        {/* Mobile presets */}
        <div className="border-t p-2 sm:hidden">
          <div className="flex flex-wrap gap-1">
            {presets.slice(0, 4).map((preset) => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
