"use client";

/**
 * Conflict Summary Component
 * Displays conflicts in a roster and provides resolution options
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Lightbulb,
  RefreshCw,
  User,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// TYPES
// ============================================================================

export interface ShiftConflict {
  shiftId: string;
  userId: string | null;
  userName: string;
  date: Date | string;
  startTime: string;
  endTime: string;
  position: string | null;
  conflictType: "TIME_OFF" | "DOUBLE_BOOKED" | "AVAILABILITY" | string;
  conflictDetails?: string;
}

interface ConflictSummaryProps {
  conflicts: ShiftConflict[];
  onResolveConflict?: (shiftId: string) => void;
  onRefreshConflicts?: () => void;
  className?: string;
}

// ============================================================================
// CONFLICT TYPE CONFIGURATION
// ============================================================================

const conflictConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode; description: string }
> = {
  TIME_OFF: {
    label: "Time Off",
    color: "text-red-600 bg-red-50 border-red-200 dark:bg-red-900/20",
    icon: <Calendar className="h-4 w-4" />,
    description: "Staff has approved time off on this date",
  },
  DOUBLE_BOOKED: {
    label: "Double Booked",
    color: "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20",
    icon: <AlertTriangle className="h-4 w-4" />,
    description: "Staff is scheduled for overlapping shifts",
  },
  AVAILABILITY: {
    label: "Unavailable",
    color: "text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20",
    icon: <Clock className="h-4 w-4" />,
    description: "Staff is not available on this day",
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function ConflictSummary({
  conflicts,
  onResolveConflict,
  onRefreshConflicts,
  className,
}: ConflictSummaryProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [expandedConflicts, setExpandedConflicts] = useState<Set<string>>(new Set());

  // Group conflicts by type
  const conflictsByType = conflicts.reduce(
    (acc, conflict) => {
      const type = conflict.conflictType || "UNKNOWN";
      if (!acc[type]) acc[type] = [];
      acc[type].push(conflict);
      return acc;
    },
    {} as Record<string, ShiftConflict[]>
  );

  const toggleExpanded = (shiftId: string) => {
    const newExpanded = new Set(expandedConflicts);
    if (newExpanded.has(shiftId)) {
      newExpanded.delete(shiftId);
    } else {
      newExpanded.add(shiftId);
    }
    setExpandedConflicts(newExpanded);
  };

  const handleRefresh = () => {
    startTransition(() => {
      onRefreshConflicts?.();
      router.refresh();
    });
  };

  if (conflicts.length === 0) {
    return (
      <Card className={cn("border-green-200 dark:border-green-800", className)}>
        <CardContent className="pt-6">
          <div className="flex items-center gap-3 text-green-600 dark:text-green-400">
            <div className="p-2 rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <div>
              <p className="font-medium">No Conflicts</p>
              <p className="text-sm text-muted-foreground">
                All shifts are conflict-free
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-orange-200 dark:border-orange-800", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-600" />
            <CardTitle className="text-lg">Scheduling Conflicts</CardTitle>
            <Badge variant="destructive" className="ml-2">
              {conflicts.length}
            </Badge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isPending}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isPending && "animate-spin")} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Review and resolve conflicts before publishing the roster
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] pr-4">
          <div className="space-y-4">
            {Object.entries(conflictsByType).map(([type, typeConflicts]) => {
              const config = conflictConfig[type] || {
                label: type,
                color: "text-gray-600 bg-gray-50 border-gray-200",
                icon: <AlertTriangle className="h-4 w-4" />,
                description: "Unknown conflict type",
              };

              return (
                <div key={type} className="space-y-2">
                  {/* Type Header */}
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <div className={cn("p-1 rounded", config.color)}>
                      {config.icon}
                    </div>
                    <span>{config.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {typeConflicts.length}
                    </Badge>
                  </div>

                  {/* Conflicts of this type */}
                  <div className="space-y-2 pl-7">
                    {typeConflicts.map((conflict) => (
                      <ConflictItem
                        key={conflict.shiftId}
                        conflict={conflict}
                        config={config}
                        isExpanded={expandedConflicts.has(conflict.shiftId)}
                        onToggle={() => toggleExpanded(conflict.shiftId)}
                        onResolve={() => onResolveConflict?.(conflict.shiftId)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CONFLICT ITEM COMPONENT
// ============================================================================

interface ConflictItemProps {
  conflict: ShiftConflict;
  config: (typeof conflictConfig)[string];
  isExpanded: boolean;
  onToggle: () => void;
  onResolve?: () => void;
}

function ConflictItem({
  conflict,
  config,
  isExpanded,
  onToggle,
  onResolve,
}: ConflictItemProps) {
  const date = typeof conflict.date === "string" ? new Date(conflict.date) : conflict.date;

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggle}>
      <div className={cn("rounded-lg border p-3", config.color)}>
        <CollapsibleTrigger className="flex items-center justify-between w-full text-left">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <User className="h-3 w-3" />
                {conflict.userName}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(date, "EEE, MMM d")}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {conflict.startTime} - {conflict.endTime}
                </span>
              </div>
            </div>
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 pt-3 border-t border-current/10">
          <div className="space-y-3">
            {/* Conflict Details */}
            <p className="text-sm">{conflict.conflictDetails || config.description}</p>

            {/* Position if available */}
            {conflict.position && (
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="secondary">{conflict.position}</Badge>
              </div>
            )}

            {/* Resolution Suggestions */}
            <div className="bg-white/50 dark:bg-gray-800/50 rounded-md p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Lightbulb className="h-3 w-3" />
                Suggested Actions
              </div>
              <ul className="text-xs space-y-1 text-muted-foreground">
                {conflict.conflictType === "TIME_OFF" && (
                  <>
                    <li>- Reassign this shift to another staff member</li>
                    <li>- Review and potentially adjust the time-off request</li>
                  </>
                )}
                {conflict.conflictType === "DOUBLE_BOOKED" && (
                  <>
                    <li>- Remove one of the overlapping shifts</li>
                    <li>- Adjust shift times to avoid overlap</li>
                  </>
                )}
                {conflict.conflictType === "AVAILABILITY" && (
                  <>
                    <li>- Ask the staff member to update their availability</li>
                    <li>- Assign this shift to someone who is available</li>
                  </>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            {onResolve && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    onResolve();
                  }}
                  className="gap-1"
                >
                  <X className="h-3 w-3" />
                  Edit Shift
                </Button>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
