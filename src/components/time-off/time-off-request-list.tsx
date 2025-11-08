"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { TIME_OFF_TYPES, TIME_OFF_STATUSES } from "@/lib/schemas/time-off";
import { cancelTimeOffRequest } from "@/lib/actions/time-off";
import { format } from "date-fns";
import { Calendar, Clock, X, Loader2, FileText } from "lucide-react";

interface TimeOffRequest {
  id: string;
  startDate: Date;
  endDate: Date;
  type: string;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  reviewer?: {
    id: string;
    email: string;
  } | null;
}

interface TimeOffRequestListProps {
  requests: TimeOffRequest[];
}

export function TimeOffRequestList({ requests }: TimeOffRequestListProps) {
  const router = useRouter();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const handleCancel = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this time-off request?")) {
      return;
    }

    setCancellingId(id);

    try {
      const result = await cancelTimeOffRequest({ id, status: "CANCELLED" });

      if ("error" in result) {
        alert(result.error);
      } else {
        router.refresh();
      }
    } catch (err) {
      alert("An unexpected error occurred");
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusInfo = TIME_OFF_STATUSES.find((s) => s.value === status);
    const colors = {
      yellow: "bg-yellow-100 text-yellow-800 border-yellow-200",
      green: "bg-green-100 text-green-800 border-green-200",
      red: "bg-red-100 text-red-800 border-red-200",
      gray: "bg-gray-100 text-gray-800 border-gray-200",
    };

    return (
      <Badge
        variant="outline"
        className={colors[statusInfo?.color as keyof typeof colors] || colors.gray}
      >
        {statusInfo?.label || status}
      </Badge>
    );
  };

  const getTypeBadge = (type: string) => {
    const typeInfo = TIME_OFF_TYPES.find((t) => t.value === type);
    const colors = {
      blue: "bg-blue-100 text-blue-800 border-blue-200",
      red: "bg-red-100 text-red-800 border-red-200",
      purple: "bg-purple-100 text-purple-800 border-purple-200",
      gray: "bg-gray-100 text-gray-800 border-gray-200",
      orange: "bg-orange-100 text-orange-800 border-orange-200",
    };

    return (
      <Badge
        variant="outline"
        className={colors[typeInfo?.color as keyof typeof colors] || colors.gray}
      >
        {typeInfo?.label || type}
      </Badge>
    );
  };

  const calculateDays = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    return diff + 1;
  };

  if (requests.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            <Calendar className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No time-off requests found</p>
            <p className="text-sm mt-1">Submit a request using the form above</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request) => {
        const days = calculateDays(request.startDate, request.endDate);
        const isPending = request.status === "PENDING";

        return (
          <Card key={request.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-lg">
                      {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                      {format(new Date(request.endDate), "MMM d, yyyy")}
                    </CardTitle>
                  </div>
                  <CardDescription>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span>{days} day{days !== 1 ? "s" : ""}</span>
                      <span>•</span>
                      {getTypeBadge(request.type)}
                      {getStatusBadge(request.status)}
                    </div>
                  </CardDescription>
                </div>
                {isPending && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleCancel(request.id)}
                    disabled={cancellingId === request.id}
                  >
                    {cancellingId === request.id ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Cancelling...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancel
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Reason */}
              {request.reason && (
                <div className="rounded-lg bg-gray-50 p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="font-medium text-muted-foreground text-xs mb-1">
                        Reason
                      </p>
                      <p className="text-gray-700">{request.reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Review info */}
              {request.status !== "PENDING" && request.status !== "CANCELLED" && (
                <div className="rounded-lg border bg-card p-3 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span className="text-xs">
                        {request.status === "APPROVED" ? "Approved" : "Rejected"} by{" "}
                        {request.reviewer?.email || "Unknown"} on{" "}
                        {request.reviewedAt
                          ? format(new Date(request.reviewedAt), "MMM d, yyyy 'at' h:mm a")
                          : "Unknown date"}
                      </span>
                    </div>
                    {request.notes && (
                      <div className="pl-6">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Notes:
                        </p>
                        <p className="text-gray-700">{request.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submitted date */}
              <p className="text-xs text-muted-foreground">
                Submitted on {format(new Date(request.createdAt), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
