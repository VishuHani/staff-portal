"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getFullName } from "@/lib/utils/profile";
import { TIME_OFF_TYPES, TIME_OFF_STATUSES } from "@/lib/schemas/time-off";
import { reviewTimeOffRequest } from "@/lib/actions/time-off";
import { format } from "date-fns";
import { CheckCircle, XCircle, Loader2, FileText } from "lucide-react";

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
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    role: {
      name: string;
    };
  };
  reviewer?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    role: {
      name: string;
    };
  } | null;
}

interface TimeOffReviewListProps {
  requests: TimeOffRequest[];
}

export function TimeOffReviewList({ requests }: TimeOffReviewListProps) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<TimeOffRequest | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReviewClick = (request: TimeOffRequest, action: "APPROVED" | "REJECTED") => {
    setSelectedRequest(request);
    setReviewAction(action);
    setNotes("");
    setIsDialogOpen(true);
  };

  const handleReviewSubmit = async () => {
    if (!selectedRequest || !reviewAction) return;

    setIsSubmitting(true);

    try {
      const result = await reviewTimeOffRequest({
        id: selectedRequest.id,
        status: reviewAction,
        notes: notes || undefined,
      });

      if ("error" in result) {
        alert(result.error);
      } else {
        setIsDialogOpen(false);
        router.refresh();
      }
    } catch (err) {
      alert("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
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
      <div className="py-12 text-center text-muted-foreground">
        <p>No time-off requests found</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {requests.map((request) => {
          const days = calculateDays(request.startDate, request.endDate);
          const isPending = request.status === "PENDING";
          const userName = getFullName(request.user);

          return (
            <div key={request.id} className="rounded-lg border p-4 space-y-4">
              {/* Header */}
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <UserAvatar
                      imageUrl={request.user.profileImage}
                      firstName={request.user.firstName}
                      lastName={request.user.lastName}
                      email={request.user.email}
                      size="sm"
                    />
                    <span className="font-medium">{userName}</span>
                    <Badge variant="secondary" className="text-xs">
                      {request.user.role.name}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium">
                      {format(new Date(request.startDate), "MMM d, yyyy")} -{" "}
                      {format(new Date(request.endDate), "MMM d, yyyy")}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {days} day{days !== 1 ? "s" : ""}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    {getTypeBadge(request.type)}
                    {getStatusBadge(request.status)}
                  </div>
                </div>
                {isPending && (
                  <div className="flex gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleReviewClick(request, "APPROVED")}
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleReviewClick(request, "REJECTED")}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>

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
              {request.status !== "PENDING" && (
                <div className="rounded-lg border bg-card p-3 text-sm">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-muted-foreground text-xs">
                      {request.status === "APPROVED" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-600" />
                      )}
                      <span>
                        {request.status === "APPROVED" ? "Approved" : "Rejected"} by{" "}
                        {request.reviewer ? getFullName(request.reviewer) : "Unknown"} on{" "}
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
            </div>
          );
        })}
      </div>

      {/* Review Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "APPROVED" ? "Approve" : "Reject"} Time-Off Request
            </DialogTitle>
            <DialogDescription asChild>
              {selectedRequest && (
                <div className="mt-2 space-y-1">
                  <div>
                    <strong>Staff:</strong> {getFullName(selectedRequest.user)}
                  </div>
                  <div>
                    <strong>Dates:</strong>{" "}
                    {format(new Date(selectedRequest.startDate), "MMM d, yyyy")} -{" "}
                    {format(new Date(selectedRequest.endDate), "MMM d, yyyy")}
                  </div>
                  <div>
                    <strong>Type:</strong>{" "}
                    {TIME_OFF_TYPES.find((t) => t.value === selectedRequest.type)?.label ||
                      selectedRequest.type}
                  </div>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder={
                  reviewAction === "APPROVED"
                    ? "Add any notes for approval..."
                    : "Please provide a reason for rejection..."
                }
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={500}
              />
              {notes && (
                <p className="text-xs text-muted-foreground">
                  {notes.length}/500 characters
                </p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReviewSubmit}
              disabled={isSubmitting}
              variant={reviewAction === "APPROVED" ? "default" : "destructive"}
              className={reviewAction === "APPROVED" ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  {reviewAction === "APPROVED" ? (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  ) : (
                    <XCircle className="mr-2 h-4 w-4" />
                  )}
                  {reviewAction === "APPROVED" ? "Approve" : "Reject"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
