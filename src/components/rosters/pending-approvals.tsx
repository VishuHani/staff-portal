"use client";

/**
 * Pending Approvals Component
 * Lists all rosters pending admin approval
 */

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getPendingApprovals,
  approveRoster,
  rejectRoster,
  type PendingApproval,
} from "@/lib/actions/rosters";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Calendar,
  Check,
  Clock,
  Eye,
  MapPin,
  User,
  Users,
  X,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// ============================================================================
// TYPES
// ============================================================================

interface PendingApprovalsProps {
  className?: string;
}

// ============================================================================
// PENDING APPROVALS COMPONENT
// ============================================================================

export function PendingApprovals({ className }: PendingApprovalsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [selectedRoster, setSelectedRoster] = useState<PendingApproval | null>(null);
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [comments, setComments] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  useEffect(() => {
    fetchApprovals();
  }, []);

  async function fetchApprovals() {
    setLoading(true);
    const result = await getPendingApprovals();
    if (result.success && result.approvals) {
      setApprovals(result.approvals);
    } else {
      setError(result.error || "Failed to load pending approvals");
    }
    setLoading(false);
  }

  const handleApprove = async () => {
    if (!selectedRoster) return;

    startTransition(async () => {
      const result = await approveRoster(selectedRoster.id, comments || undefined);
      if (result.success) {
        toast.success("Roster approved");
        setShowApproveDialog(false);
        setSelectedRoster(null);
        setComments("");
        fetchApprovals();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to approve roster");
      }
    });
  };

  const handleReject = async () => {
    if (!selectedRoster) return;

    if (!rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    startTransition(async () => {
      const result = await rejectRoster(selectedRoster.id, rejectReason);
      if (result.success) {
        toast.success("Roster returned for revision");
        setShowRejectDialog(false);
        setSelectedRoster(null);
        setRejectReason("");
        fetchApprovals();
        router.refresh();
      } else {
        toast.error(result.error || "Failed to reject roster");
      }
    });
  };

  const openApproveDialog = (approval: PendingApproval) => {
    setSelectedRoster(approval);
    setShowApproveDialog(true);
  };

  const openRejectDialog = (approval: PendingApproval) => {
    setSelectedRoster(approval);
    setShowRejectDialog(true);
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Rosters awaiting your review</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 p-4 border rounded-lg">
                <Skeleton className="h-12 w-12 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-9 w-24" />
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
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-4 w-4" />
            <p className="text-sm">{error}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (approvals.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
          <CardDescription>Rosters awaiting your review</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Check className="h-12 w-12 text-green-500 mb-4" />
            <p className="text-lg font-medium">All caught up!</p>
            <p className="text-sm text-muted-foreground">No rosters pending approval</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>
                {approvals.length} roster{approvals.length !== 1 ? "s" : ""} awaiting review
              </CardDescription>
            </div>
            <Badge variant="secondary" className="text-lg px-3 py-1">
              {approvals.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roster</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Date Range</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Shifts</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {approvals.map((approval) => {
                const submitterName =
                  approval.submittedBy.firstName && approval.submittedBy.lastName
                    ? `${approval.submittedBy.firstName} ${approval.submittedBy.lastName}`
                    : approval.submittedBy.email;

                return (
                  <TableRow key={approval.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{approval.name}</span>
                        {approval.hasConflicts && (
                          <Badge variant="destructive" className="w-fit mt-1 gap-1">
                            <AlertCircle className="h-3 w-3" />
                            Has Conflicts
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {approval.venue.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        {format(new Date(approval.startDate), "MMM d")} -{" "}
                        {format(new Date(approval.endDate), "MMM d")}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-sm">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3 text-muted-foreground" />
                          {submitterName}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(approval.submittedAt), {
                            addSuffix: true,
                          })}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-sm">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        {approval.shiftCount} shifts / {approval.staffCount} staff
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/system/rosters/${approval.id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Eye className="h-3 w-3" />
                            Review
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          className="gap-1 bg-green-600 hover:bg-green-700"
                          onClick={() => openApproveDialog(approval)}
                          disabled={isPending}
                        >
                          <Check className="h-3 w-3" />
                          Approve
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          className="gap-1"
                          onClick={() => openRejectDialog(approval)}
                          disabled={isPending}
                        >
                          <X className="h-3 w-3" />
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Approve Dialog */}
      <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Approve Roster
            </DialogTitle>
            <DialogDescription>
              {selectedRoster && (
                <>
                  Approve &quot;{selectedRoster.name}&quot; for {selectedRoster.venue.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="approve-comments">Comments (optional)</Label>
              <Textarea
                id="approve-comments"
                placeholder="Add any approval notes..."
                value={comments}
                onChange={(e) => setComments(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={isPending}
              className="gap-2 bg-green-600 hover:bg-green-700"
            >
              <Check className="h-4 w-4" />
              {isPending ? "Approving..." : "Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Request Changes
            </DialogTitle>
            <DialogDescription>
              {selectedRoster && (
                <>
                  Return &quot;{selectedRoster.name}&quot; for revision
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reject-reason">
                Reason for Changes <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reject-reason"
                placeholder="Explain what needs to be changed..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
                required
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              {isPending ? "Sending..." : "Request Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
