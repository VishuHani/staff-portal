"use client";

/**
 * Approval Workflow Component
 * Manager self-review workflow: DRAFT -> APPROVED (Finalize) -> PUBLISHED (Publish)
 * No admin approval required - managers control the entire workflow
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RosterStatus } from "@prisma/client";
import {
  finalizeRoster,
  publishRoster,
  revertToDraft,
} from "@/lib/actions/rosters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  AlertCircle,
  Check,
  Clock,
  FileCheck,
  Globe,
  Undo,
  Archive,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PublishConfirmationDialog } from "./publish-confirmation-dialog";

// ============================================================================
// TYPES
// ============================================================================

interface ApprovalWorkflowProps {
  rosterId: string;
  status: RosterStatus;
  userRole: string;
  isCreator: boolean;
  hasAssignedShifts: boolean;
  onStatusChange?: (newStatus: RosterStatus) => void;
  // Additional props for publish confirmation
  rosterName?: string;
  venueName?: string;
  startDate?: Date;
  endDate?: Date;
  shiftCount?: number;
  assignedStaffCount?: number;
  isNewVersion?: boolean;
}

// ============================================================================
// STATUS BADGE
// ============================================================================

const statusConfig: Record<
  RosterStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
> = {
  DRAFT: {
    label: "Draft",
    variant: "secondary",
    icon: <Clock className="h-3 w-3" />,
  },
  PENDING_REVIEW: {
    label: "Pending Review",
    variant: "outline",
    icon: <Clock className="h-3 w-3" />,
  },
  APPROVED: {
    label: "Finalized",
    variant: "default",
    icon: <Check className="h-3 w-3" />,
  },
  PUBLISHED: {
    label: "Published",
    variant: "default",
    icon: <Globe className="h-3 w-3" />,
  },
  ARCHIVED: {
    label: "Archived",
    variant: "secondary",
    icon: <Archive className="h-3 w-3" />,
  },
};

export function RosterStatusBadge({ status }: { status: RosterStatus }) {
  const config = statusConfig[status];
  return (
    <Badge variant={config.variant} className="gap-1">
      {config.icon}
      {config.label}
    </Badge>
  );
}

// ============================================================================
// APPROVAL WORKFLOW COMPONENT
// ============================================================================

export function ApprovalWorkflow({
  rosterId,
  status,
  userRole,
  isCreator,
  hasAssignedShifts,
  onStatusChange,
  rosterName,
  venueName,
  startDate,
  endDate,
  shiftCount = 0,
  assignedStaffCount = 0,
  isNewVersion = false,
}: ApprovalWorkflowProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showRevertDialog, setShowRevertDialog] = useState(false);
  const [notes, setNotes] = useState("");
  const [revertReason, setRevertReason] = useState("");

  const isAdmin = userRole === "ADMIN";
  const isManager = userRole === "MANAGER";
  const canManageRoster = isCreator || isAdmin || isManager;

  // New workflow permissions
  // Allow finalization from DRAFT or PENDING_REVIEW (legacy status from old workflow)
  const canFinalize = canManageRoster && (status === RosterStatus.DRAFT || status === RosterStatus.PENDING_REVIEW);
  const canPublish = canManageRoster && status === RosterStatus.APPROVED;
  const canRevert = canManageRoster && (status === RosterStatus.APPROVED || status === RosterStatus.PENDING_REVIEW);

  const handleFinalize = async () => {
    if (!hasAssignedShifts) {
      toast.error("Cannot finalize a roster with no assigned shifts");
      return;
    }

    startTransition(async () => {
      const result = await finalizeRoster(rosterId, notes || undefined);
      if (result.success) {
        toast.success("Roster finalized and ready to publish");
        setShowFinalizeDialog(false);
        setNotes("");
        onStatusChange?.(RosterStatus.APPROVED);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to finalize roster");
      }
    });
  };

  const handlePublish = async () => {
    startTransition(async () => {
      const result = await publishRoster(rosterId);
      if (result.success) {
        toast.success(`Roster published! ${result.notifiedCount} staff members notified.`);
        setShowPublishDialog(false);
        onStatusChange?.(RosterStatus.PUBLISHED);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to publish roster");
      }
    });
  };

  const handleRevert = async () => {
    startTransition(async () => {
      const result = await revertToDraft(rosterId, revertReason || undefined);
      if (result.success) {
        toast.success("Roster reverted to draft");
        setShowRevertDialog(false);
        setRevertReason("");
        onStatusChange?.(RosterStatus.DRAFT);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to revert roster");
      }
    });
  };

  // Get workflow stage info
  const getWorkflowStage = () => {
    switch (status) {
      case RosterStatus.DRAFT:
        return {
          stage: 1,
          title: "Step 1: Finalize Roster",
          description: "Review your roster and finalize it when ready. Once finalized, you can publish it to notify staff.",
        };
      case RosterStatus.PENDING_REVIEW:
        return {
          stage: 1,
          title: "Step 1: Finalize Roster",
          description: "This roster was submitted for review. You can now finalize it directly without waiting for approval.",
        };
      case RosterStatus.APPROVED:
        return {
          stage: 2,
          title: "Step 2: Publish to Staff",
          description: "Your roster is finalized. Publish it to notify all assigned staff members about their shifts.",
        };
      case RosterStatus.PUBLISHED:
        return {
          stage: 3,
          title: "Published",
          description: "This roster is live. Staff members have been notified of their shifts.",
        };
      default:
        return {
          stage: 0,
          title: "Workflow",
          description: "",
        };
    }
  };

  const workflowInfo = getWorkflowStage();

  return (
    <div className="space-y-4">
      {/* Workflow Progress */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { step: 1, label: "Draft", color: "blue" },
          { step: 2, label: "Finalized", color: "purple" },
          { step: 3, label: "Published", color: "green" },
        ].map(({ step, label, color }) => (
          <div key={step} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold shadow-sm transition-all ${
                  step < workflowInfo.stage
                    ? "bg-gradient-to-br from-green-500 to-green-600 text-white ring-2 ring-green-200"
                    : step === workflowInfo.stage
                    ? color === "blue"
                      ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white ring-2 ring-blue-200 animate-pulse"
                      : color === "purple"
                      ? "bg-gradient-to-br from-purple-500 to-purple-600 text-white ring-2 ring-purple-200 animate-pulse"
                      : "bg-gradient-to-br from-green-500 to-green-600 text-white ring-2 ring-green-200 animate-pulse"
                    : "bg-gray-100 text-gray-400 dark:bg-gray-800"
                }`}
              >
                {step < workflowInfo.stage ? <Check className="h-5 w-5" /> : step}
              </div>
              <span className={`text-xs mt-1.5 font-medium ${
                step <= workflowInfo.stage ? "text-foreground" : "text-muted-foreground"
              }`}>
                {label}
              </span>
            </div>
            {step < 3 && (
              <div
                className={`w-16 h-1 mx-2 rounded-full transition-all ${
                  step < workflowInfo.stage
                    ? "bg-gradient-to-r from-green-500 to-green-400"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Status Card */}
      <div className={`rounded-lg p-4 border-2 ${
        status === RosterStatus.DRAFT || status === RosterStatus.PENDING_REVIEW
          ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800"
          : status === RosterStatus.APPROVED
          ? "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800"
          : status === RosterStatus.PUBLISHED
          ? "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
          : "bg-gray-50 border-gray-200 dark:bg-gray-800 dark:border-gray-700"
      }`}>
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-muted-foreground">Current Status:</span>
          <RosterStatusBadge status={status} />
        </div>
        <p className={`text-sm ${
          status === RosterStatus.DRAFT || status === RosterStatus.PENDING_REVIEW
            ? "text-blue-700 dark:text-blue-300"
            : status === RosterStatus.APPROVED
            ? "text-purple-700 dark:text-purple-300"
            : status === RosterStatus.PUBLISHED
            ? "text-green-700 dark:text-green-300"
            : "text-muted-foreground"
        }`}>
          {workflowInfo.description}
        </p>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        {/* Finalize (DRAFT -> APPROVED) */}
        {canFinalize && (
          <Button
            onClick={() => setShowFinalizeDialog(true)}
            disabled={isPending || !hasAssignedShifts}
            className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md hover:shadow-lg transition-all"
            size="lg"
          >
            <FileCheck className="h-5 w-5" />
            Finalize Roster
          </Button>
        )}

        {/* Publish (APPROVED -> PUBLISHED) */}
        {canPublish && (
          <Button
            onClick={() => setShowPublishDialog(true)}
            disabled={isPending}
            className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
            size="lg"
          >
            <Globe className="h-5 w-5" />
            Publish to Staff
          </Button>
        )}

        {/* Revert to Draft */}
        {canRevert && (
          <Button
            variant="outline"
            onClick={() => setShowRevertDialog(true)}
            disabled={isPending}
            className="gap-2 border-2 border-blue-300 text-blue-600 hover:bg-blue-50 hover:border-blue-400 dark:border-blue-700 dark:text-blue-400 dark:hover:bg-blue-950"
            size="lg"
          >
            <Undo className="h-5 w-5" />
            Revert to Draft
          </Button>
        )}
      </div>

      {/* Validation Message */}
      {canFinalize && !hasAssignedShifts && (
        <div className="flex items-center gap-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 rounded-lg px-4 py-3 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>Add at least one shift before finalizing the roster</span>
        </div>
      )}

      {/* Finalize Dialog */}
      <Dialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="h-5 w-5 text-blue-600" />
              Finalize Roster
            </DialogTitle>
            <DialogDescription>
              Finalizing marks this roster as reviewed and ready to publish. You can still make
              changes by reverting to draft if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this roster..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinalizeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleFinalize}
              disabled={isPending}
              className="gap-2 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Finalizing...
                </>
              ) : (
                <>
                  <FileCheck className="h-4 w-4" />
                  Finalize
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation Dialog */}
      {rosterName && venueName && startDate && endDate ? (
        <PublishConfirmationDialog
          open={showPublishDialog}
          onOpenChange={setShowPublishDialog}
          rosterName={rosterName}
          venueName={venueName}
          startDate={startDate}
          endDate={endDate}
          shiftCount={shiftCount}
          assignedStaffCount={assignedStaffCount}
          isNewVersion={isNewVersion}
          isPending={isPending}
          onConfirm={handlePublish}
        />
      ) : (
        /* Fallback: Simple Publish Dialog if roster details not provided */
        <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-green-600" />
                Publish Roster
              </DialogTitle>
              <DialogDescription>
                Publishing this roster will notify all assigned staff members about their
                shifts via email and in-app notifications.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
                <p className="font-medium">What happens next:</p>
                <ul className="mt-2 list-disc list-inside space-y-1">
                  <li>Staff will receive email notifications</li>
                  <li>Shifts will appear on their "My Shifts" page</li>
                  <li>Calendar invites will be sent (if enabled)</li>
                </ul>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={handlePublish}
                disabled={isPending}
                className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  <>
                    <Globe className="h-4 w-4" />
                    Publish
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Revert to Draft Dialog */}
      <Dialog open={showRevertDialog} onOpenChange={setShowRevertDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Undo className="h-5 w-5 text-orange-600" />
              Revert to Draft
            </DialogTitle>
            <DialogDescription>
              This will return the roster to draft status so you can make further changes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="revert-reason">Reason (optional)</Label>
              <Textarea
                id="revert-reason"
                placeholder="Why are you reverting this roster?"
                value={revertReason}
                onChange={(e) => setRevertReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRevertDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRevert}
              disabled={isPending}
              className="gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
            >
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Reverting...
                </>
              ) : (
                <>
                  <Undo className="h-4 w-4" />
                  Revert to Draft
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
