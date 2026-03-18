"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Activity,
  FileText,
  User,
  Clock,
  ArrowRight,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface RecentActivityItem {
  id: string;
  action: string;
  resourceType: string;
  description: string | null;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

interface RecentActivityWidgetProps {
  venueId: string;
  onFetchActivity: (venueId: string, limit?: number) => Promise<{
    success: boolean;
    data?: RecentActivityItem[];
    error?: string;
  }>;
  limit?: number;
  onClick?: () => void;
}

// Action color mapping
const ACTION_COLORS: Record<string, string> = {
  CREATED: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  UPDATED: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  DELETED: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  ASSIGNED: "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
  SUBMITTED: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
  REJECTED: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
  VIEWED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  DOWNLOADED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  SIGNED: "bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300",
};

// ============================================================================
// Component
// ============================================================================

export function RecentActivityWidget({
  venueId,
  onFetchActivity,
  limit = 10,
  onClick,
}: RecentActivityWidgetProps) {
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onFetchActivity(venueId, limit);
      if (result.success && result.data) {
        setActivities(result.data);
      } else {
        setError(result.error || "Failed to fetch activity");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, limit, onFetchActivity]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  if (isLoading) {
    return (
      <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
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
      <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load activity</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <CardDescription>Latest document actions</CardDescription>
          </div>
          <Activity className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            No recent activity
          </div>
        ) : (
          <ScrollArea className="h-[200px]">
            <div className="space-y-3">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 text-sm"
                >
                  {/* Action Badge */}
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-[10px] px-1.5 py-0.5 shrink-0",
                      ACTION_COLORS[activity.action] || ""
                    )}
                  >
                    {activity.action}
                  </Badge>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <User className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="font-medium truncate">
                        {activity.user.name}
                      </span>
                    </div>
                    {activity.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {activity.description}
                      </p>
                    )}
                  </div>

                  {/* Time */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Clock className="h-3 w-3" />
                    <span title={format(new Date(activity.createdAt), "PPp")}>
                      {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {onClick && activities.length > 0 && (
          <div className="mt-3 pt-3 border-t flex items-center justify-center text-xs text-primary">
            View all activity
            <ArrowRight className="h-3 w-3 ml-1" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default RecentActivityWidget;