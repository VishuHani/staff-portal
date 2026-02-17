"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { format } from "date-fns";

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onPrevious?: () => void;
  onNext?: () => void;
  hasPrevious?: boolean;
  hasNext?: boolean;
}

export function DateRangePicker({
  startDate,
  endDate,
  onPrevious,
  onNext,
  hasPrevious = true,
  hasNext = true,
}: DateRangePickerProps) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Format: "18 Nov - 24 Nov 2025"
  const isSameMonth = start.getMonth() === end.getMonth();
  const isSameYear = start.getFullYear() === end.getFullYear();

  let dateString: string;
  if (isSameMonth && isSameYear) {
    dateString = `${format(start, "d")} - ${format(end, "d MMM yyyy")}`;
  } else if (isSameYear) {
    dateString = `${format(start, "d MMM")} - ${format(end, "d MMM yyyy")}`;
  } else {
    dateString = `${format(start, "d MMM yyyy")} - ${format(end, "d MMM yyyy")}`;
  }

  return (
    <div className="flex items-center gap-1 border rounded-lg px-2 py-1 bg-background">
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onPrevious}
        disabled={!hasPrevious}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 px-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium whitespace-nowrap">
          {dateString}
        </span>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        onClick={onNext}
        disabled={!hasNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
