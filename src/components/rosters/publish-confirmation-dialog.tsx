"use client";

/**
 * Publish Confirmation Dialog
 * Shows roster dates and requires explicit confirmation before publishing
 */

import { useState } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Globe, Calendar, Users, AlertTriangle, Loader2 } from "lucide-react";

interface PublishConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rosterName: string;
  venueName: string;
  startDate: Date;
  endDate: Date;
  shiftCount: number;
  assignedStaffCount: number;
  isNewVersion?: boolean;
  isPending?: boolean;
  onConfirm: () => void;
}

export function PublishConfirmationDialog({
  open,
  onOpenChange,
  rosterName,
  venueName,
  startDate,
  endDate,
  shiftCount,
  assignedStaffCount,
  isNewVersion = false,
  isPending = false,
  onConfirm,
}: PublishConfirmationDialogProps) {
  const [confirmed, setConfirmed] = useState(false);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setConfirmed(false);
    }
    onOpenChange(newOpen);
  };

  const handleConfirm = () => {
    if (confirmed) {
      onConfirm();
    }
  };

  const formattedStartDate = format(new Date(startDate), "EEEE, MMMM d, yyyy");
  const formattedEndDate = format(new Date(endDate), "EEEE, MMMM d, yyyy");

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-green-600" />
            {isNewVersion ? "Publish Updated Roster" : "Publish Roster"}
          </DialogTitle>
          <DialogDescription>
            {isNewVersion
              ? "Publishing this update will notify staff of any schedule changes."
              : "Publishing will make this roster live and notify all assigned staff."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Roster Details */}
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Roster</p>
              <p className="font-semibold">{rosterName}</p>
              <p className="text-sm text-muted-foreground">{venueName}</p>
            </div>

            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Date Range</p>
                <p className="text-sm text-muted-foreground">
                  {formattedStartDate}
                </p>
                <p className="text-sm text-muted-foreground">
                  to {formattedEndDate}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm">
                <span className="font-medium">{shiftCount}</span> shifts for{" "}
                <span className="font-medium">{assignedStaffCount}</span> staff
                members
              </p>
            </div>
          </div>

          {/* What happens next */}
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-800 dark:text-green-200">
            <p className="font-medium mb-2">What happens next:</p>
            <ul className="list-disc list-inside space-y-1">
              {isNewVersion ? (
                <>
                  <li>Staff will be notified of their specific changes</li>
                  <li>The previous version will be archived</li>
                  <li>Updated shifts will appear in staff schedules</li>
                </>
              ) : (
                <>
                  <li>Staff will receive email notifications</li>
                  <li>Shifts will appear on their "My Shifts" page</li>
                  <li>Calendar invites will be sent (if enabled)</li>
                </>
              )}
            </ul>
          </div>

          {/* Warning for version updates */}
          {isNewVersion && (
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <p>
                Staff whose shifts have changed will receive personalized
                notifications. Unchanged schedules will also be confirmed.
              </p>
            </div>
          )}

          {/* Confirmation Checkbox */}
          <div className="flex items-start space-x-3 pt-2">
            <Checkbox
              id="confirm-dates"
              checked={confirmed}
              onCheckedChange={(checked) => setConfirmed(checked === true)}
            />
            <Label
              htmlFor="confirm-dates"
              className="text-sm leading-relaxed cursor-pointer"
            >
              I confirm that the roster dates ({format(new Date(startDate), "MMM d")} -{" "}
              {format(new Date(endDate), "MMM d")}) are correct and I want to
              notify staff about their shifts.
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!confirmed || isPending}
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
                Publish Roster
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
