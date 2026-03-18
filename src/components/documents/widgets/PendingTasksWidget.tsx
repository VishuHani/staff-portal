"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ClipboardList,
  Clock,
  AlertTriangle,
  FileText,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow, isPast } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface PendingTask {
  id: string;
  templateName: string;
  documentType: string;
  dueDate: Date | null;
  status: string;
  assignedAt: Date;
}

interface PendingTasksWidgetProps {
  onFetchTasks: () => Promise<{
    success: boolean;
    data?: PendingTask[];
    error?: string;
  }>;
  onStartTask?: (taskId: string) => void;
  onViewAll?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function PendingTasksWidget({
  onFetchTasks,
  onStartTask,
  onViewAll,
}: PendingTasksWidgetProps) {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onFetchTasks();
      if (result.success && result.data) {
        setTasks(result.data);
      } else {
        setError(result.error || "Failed to fetch tasks");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [onFetchTasks]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // Sort tasks: overdue first, then by due date
  const sortedTasks = [...tasks].sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    
    const aOverdue = isPast(new Date(a.dueDate));
    const bOverdue = isPast(new Date(b.dueDate));
    
    if (aOverdue && !bOverdue) return -1;
    if (!aOverdue && bOverdue) return 1;
    
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

  const overdueCount = tasks.filter((t) => t.dueDate && isPast(new Date(t.dueDate))).length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">My Pending Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">My Pending Tasks</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load tasks</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">My Pending Tasks</CardTitle>
            <CardDescription>
              {tasks.length === 0
                ? "All caught up!"
                : `${tasks.length} task${tasks.length === 1 ? "" : "s"} pending`}
              {overdueCount > 0 && (
                <span className="text-red-500 ml-1">
                  ({overdueCount} overdue)
                </span>
              )}
            </CardDescription>
          </div>
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {tasks.length === 0 ? (
          <div className="text-center py-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 text-green-600 mb-3">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">No pending tasks</p>
            <p className="text-xs text-muted-foreground mt-1">
              You're all caught up!
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[250px]">
            <div className="space-y-2">
              {sortedTasks.slice(0, 5).map((task) => {
                const isOverdue = task.dueDate && isPast(new Date(task.dueDate));
                const dueDate = task.dueDate ? new Date(task.dueDate) : null;

                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border",
                      isOverdue
                        ? "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950"
                        : "border-border bg-card"
                    )}
                  >
                    {/* Icon */}
                    <div
                      className={cn(
                        "p-2 rounded-md shrink-0",
                        isOverdue
                          ? "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-300"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      <FileText className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {task.templateName}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-[10px]">
                          {task.documentType}
                        </Badge>
                        <Badge
                          variant={task.status === "IN_PROGRESS" ? "default" : "outline"}
                          className="text-[10px]"
                        >
                          {task.status === "IN_PROGRESS" ? "In Progress" : "Pending"}
                        </Badge>
                      </div>
                    </div>

                    {/* Due Date & Action */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      {dueDate && (
                        <div
                          className={cn(
                            "flex items-center gap-1 text-xs",
                            isOverdue ? "text-red-600" : "text-muted-foreground"
                          )}
                        >
                          {isOverdue ? (
                            <AlertTriangle className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          <span title={format(dueDate, "PPp")}>
                            {isOverdue
                              ? "Overdue"
                              : formatDistanceToNow(dueDate, { addSuffix: true })}
                          </span>
                        </div>
                      )}
                      {onStartTask && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartTask(task.id);
                          }}
                        >
                          {task.status === "IN_PROGRESS" ? "Continue" : "Start"}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {onViewAll && tasks.length > 5 && (
          <div className="mt-3 pt-3 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={onViewAll}
            >
              View all {tasks.length} tasks
              <ExternalLink className="h-3 w-3 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default PendingTasksWidget;