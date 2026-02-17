"use client";

/**
 * Approval History Component
 * Displays timeline of approval actions for a roster
 */

import { useEffect, useState } from "react";
import { getApprovalHistory, type ApprovalComment } from "@/lib/actions/rosters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowRight,
  Check,
  Clock,
  MessageSquare,
  Send,
  Undo,
  X,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface ApprovalHistoryProps {
  rosterId: string;
  className?: string;
}

// ============================================================================
// ACTION ICON MAPPING
// ============================================================================

const actionConfig: Record<
  string,
  { icon: React.ReactNode; color: string; label: string }
> = {
  // New workflow actions
  FINALIZED: {
    icon: <Check className="h-4 w-4" />,
    color: "text-blue-600 bg-blue-100",
    label: "Finalized",
  },
  PUBLISHED: {
    icon: <Send className="h-4 w-4" />,
    color: "text-green-600 bg-green-100",
    label: "Published",
  },
  PUBLISHED_AS_NEW_VERSION: {
    icon: <Send className="h-4 w-4" />,
    color: "text-green-600 bg-green-100",
    label: "Published (New Version)",
  },
  UNPUBLISHED: {
    icon: <Undo className="h-4 w-4" />,
    color: "text-orange-600 bg-orange-100",
    label: "Unpublished",
  },
  REVERTED_TO_DRAFT: {
    icon: <Undo className="h-4 w-4" />,
    color: "text-orange-600 bg-orange-100",
    label: "Reverted to Draft",
  },
  // Legacy actions (kept for backwards compatibility)
  SUBMITTED_FOR_REVIEW: {
    icon: <Send className="h-4 w-4" />,
    color: "text-blue-600 bg-blue-100",
    label: "Submitted for Review",
  },
  SUBMITTED: {
    icon: <Send className="h-4 w-4" />,
    color: "text-blue-600 bg-blue-100",
    label: "Submitted",
  },
  APPROVED: {
    icon: <Check className="h-4 w-4" />,
    color: "text-green-600 bg-green-100",
    label: "Approved",
  },
  REJECTED: {
    icon: <X className="h-4 w-4" />,
    color: "text-red-600 bg-red-100",
    label: "Changes Requested",
  },
  RECALLED: {
    icon: <Undo className="h-4 w-4" />,
    color: "text-orange-600 bg-orange-100",
    label: "Recalled",
  },
  COMMENT: {
    icon: <MessageSquare className="h-4 w-4" />,
    color: "text-gray-600 bg-gray-100",
    label: "Comment",
  },
  RESTORED_FROM_VERSION: {
    icon: <Undo className="h-4 w-4" />,
    color: "text-purple-600 bg-purple-100",
    label: "Restored from Version",
  },
  SUPERSEDED_BY_NEW_VERSION: {
    icon: <Undo className="h-4 w-4" />,
    color: "text-orange-600 bg-orange-100",
    label: "Superseded",
  },
  ARCHIVED_BY_NEW_VERSION: {
    icon: <Undo className="h-4 w-4" />,
    color: "text-gray-600 bg-gray-100",
    label: "Archived",
  },
};

// Status badge styling
const statusBadgeConfig: Record<string, { color: string; label: string }> = {
  DRAFT: { color: "bg-gray-100 text-gray-700 border-gray-300", label: "Draft" },
  PENDING_REVIEW: { color: "bg-amber-100 text-amber-700 border-amber-300", label: "Pending" },
  APPROVED: { color: "bg-blue-100 text-blue-700 border-blue-300", label: "Approved" },
  PUBLISHED: { color: "bg-green-100 text-green-700 border-green-300", label: "Published" },
  ARCHIVED: { color: "bg-gray-100 text-gray-500 border-gray-300", label: "Archived" },
};

// Default config for unknown actions
const defaultActionConfig = {
  icon: <Clock className="h-4 w-4" />,
  color: "text-gray-600 bg-gray-100",
  label: "Action",
};

// ============================================================================
// APPROVAL HISTORY COMPONENT
// ============================================================================

export function ApprovalHistory({ rosterId, className }: ApprovalHistoryProps) {
  const [history, setHistory] = useState<ApprovalComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      const result = await getApprovalHistory(rosterId);
      if (result.success && result.history) {
        setHistory(result.history);
      } else {
        setError(result.error || "Failed to load history");
      }
      setLoading(false);
    }

    fetchHistory();
  }, [rosterId]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (history.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Approval History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No approval history yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Approval History
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {history.length} workflow event{history.length !== 1 ? "s" : ""}
        </p>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

            <div className="space-y-6">
              {history.map((item, index) => {
                const config = actionConfig[item.action] || defaultActionConfig;
                const userName =
                  item.user.firstName && item.user.lastName
                    ? `${item.user.firstName} ${item.user.lastName}`
                    : item.user.email;

                return (
                  <div key={item.id} className="relative flex gap-4 pl-2">
                    {/* Icon */}
                    <div
                      className={cn(
                        "relative z-10 flex h-8 w-8 items-center justify-center rounded-full",
                        config.color
                      )}
                    >
                      {config.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{config.label}</p>
                          {item.revision && (
                            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              Rev {item.revision}
                            </span>
                          )}
                        </div>
                        <time
                          className="text-xs text-muted-foreground"
                          title={format(new Date(item.createdAt), "PPpp")}
                        >
                          {formatDistanceToNow(new Date(item.createdAt), {
                            addSuffix: true,
                          })}
                        </time>
                      </div>
                      <p className="text-sm text-muted-foreground">by {userName}</p>
                      {item.previousStatus && item.newStatus && (
                        <div className="flex items-center gap-2 mt-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              statusBadgeConfig[item.previousStatus]?.color || "bg-gray-100 text-gray-600"
                            )}
                          >
                            {statusBadgeConfig[item.previousStatus]?.label || item.previousStatus}
                          </Badge>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              statusBadgeConfig[item.newStatus]?.color || "bg-gray-100 text-gray-600"
                            )}
                          >
                            {statusBadgeConfig[item.newStatus]?.label || item.newStatus}
                          </Badge>
                        </div>
                      )}
                      {item.content && item.content !== config.label && (
                        <p className="mt-2 text-sm bg-muted/50 rounded-md p-2">
                          {item.content}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
