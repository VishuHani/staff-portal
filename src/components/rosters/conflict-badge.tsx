"use client";

import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertTriangle, CalendarOff, Clock, Users } from "lucide-react";

interface ConflictBadgeProps {
  conflictType: string | null;
  showLabel?: boolean;
}

const conflictConfig: Record<string, {
  label: string;
  description: string;
  icon: React.ElementType;
  className: string;
}> = {
  TIME_OFF: {
    label: "Time Off",
    description: "Staff member has approved time off on this date",
    icon: CalendarOff,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  AVAILABILITY: {
    label: "Unavailable",
    description: "Staff member is marked as unavailable for this day",
    icon: Clock,
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  DOUBLE_BOOKED: {
    label: "Double Booked",
    description: "Staff member has an overlapping shift",
    icon: Users,
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
};

export function ConflictBadge({ conflictType, showLabel = true }: ConflictBadgeProps) {
  if (!conflictType) return null;

  const config = conflictConfig[conflictType] || {
    label: "Conflict",
    description: "There is a scheduling conflict",
    icon: AlertTriangle,
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const Icon = config.icon;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={`${config.className} cursor-help`}>
            <Icon className="h-3 w-3 mr-1" />
            {showLabel && config.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ConflictIndicator({ hasConflict }: { hasConflict: boolean }) {
  if (!hasConflict) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertTriangle className="h-3 w-3 text-red-600 dark:text-red-400" />
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>This shift has a conflict</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
