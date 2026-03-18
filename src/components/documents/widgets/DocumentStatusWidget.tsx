"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface DocumentStatusData {
  totalDocuments: number;
  activeDocuments: number;
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  inProgressAssignments: number;
  overdueAssignments: number;
  completionRate: number;
}

interface DocumentStatusWidgetProps {
  venueId: string;
  onFetchStatus: (venueId: string) => Promise<{
    success: boolean;
    data?: DocumentStatusData;
    error?: string;
  }>;
  onClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function DocumentStatusWidget({
  venueId,
  onFetchStatus,
  onClick,
}: DocumentStatusWidgetProps) {
  const [status, setStatus] = useState<DocumentStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onFetchStatus(venueId);
      if (result.success && result.data) {
        setStatus(result.data);
      } else {
        setError(result.error || "Failed to fetch status");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, onFetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (isLoading) {
    return (
      <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Document Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !status) {
    return (
      <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Document Status</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load status</p>
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
          <CardTitle className="text-sm font-medium">Document Status</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </div>
        <CardDescription>
          {status.activeDocuments} active documents
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Completion Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Completion Rate</span>
            <span className="font-medium flex items-center gap-1">
              {status.completionRate}%
              {status.completionRate >= 70 ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : null}
            </span>
          </div>
          <Progress
            value={status.completionRate}
            className={cn(
              "h-2",
              status.completionRate < 50 && "[&>div]:bg-destructive",
              status.completionRate >= 70 && "[&>div]:bg-green-500"
            )}
          />
        </div>

        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">Completed:</span>
            <span className="font-medium">{status.completedAssignments}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">In Progress:</span>
            <span className="font-medium">{status.inProgressAssignments}</span>
          </div>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-gray-500" />
            <span className="text-muted-foreground">Pending:</span>
            <span className="font-medium">{status.pendingAssignments}</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-muted-foreground">Overdue:</span>
            <span className={cn(
              "font-medium",
              status.overdueAssignments > 0 && "text-red-500"
            )}>
              {status.overdueAssignments}
            </span>
          </div>
        </div>

        {/* Total */}
        <div className="pt-2 border-t text-xs text-muted-foreground">
          {status.totalAssignments} total assignments
        </div>
      </CardContent>
    </Card>
  );
}

export default DocumentStatusWidget;