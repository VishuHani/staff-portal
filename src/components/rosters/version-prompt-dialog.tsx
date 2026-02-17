"use client";

/**
 * Version Prompt Dialog
 * Shown when uploading a roster that already exists for the same venue + week
 */

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  GitBranch,
  Calendar,
  FileText,
  Users,
  CheckCircle,
  Clock,
  Send,
  Archive,
  Loader2,
  AlertTriangle,
  Plus,
} from "lucide-react";
import { format } from "date-fns";
import { RosterStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface ExistingRosterInfo {
  id: string;
  name: string;
  versionNumber: number;
  status: RosterStatus;
  shiftCount: number;
  createdAt: Date;
  createdByName: string | null;
}

interface VersionPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRoster: ExistingRosterInfo;
  weekStart: Date;
  nextVersionNumber: number;
  onCreateNewVersion: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const statusConfig: Record<RosterStatus, { label: string; color: string; icon: typeof FileText }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  PENDING_REVIEW: { label: "Pending Review", color: "bg-amber-100 text-amber-700", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle },
  PUBLISHED: { label: "Published", color: "bg-cyan-100 text-cyan-700", icon: Send },
  ARCHIVED: { label: "Archived", color: "bg-gray-100 text-gray-500", icon: Archive },
};

export function VersionPromptDialog({
  open,
  onOpenChange,
  existingRoster,
  weekStart,
  nextVersionNumber,
  onCreateNewVersion,
  onCancel,
  isLoading = false,
}: VersionPromptDialogProps) {
  const StatusIcon = statusConfig[existingRoster.status].icon;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-blue-600" />
            Roster Already Exists
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 text-sm">
              <p>
                A roster already exists for the week of{" "}
                <strong>{format(weekStart, "MMM d, yyyy")}</strong>.
              </p>

              {/* Existing Roster Info Card */}
              <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{existingRoster.name}</span>
                  </div>
                  <Badge
                    variant="outline"
                    className="text-xs"
                  >
                    v{existingRoster.versionNumber}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon className="h-3.5 w-3.5" />
                    <Badge className={cn("text-xs", statusConfig[existingRoster.status].color)}>
                      {statusConfig[existingRoster.status].label}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    {existingRoster.shiftCount} shifts
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Created {format(new Date(existingRoster.createdAt), "MMM d, yyyy 'at' h:mm a")}
                  {existingRoster.createdByName && ` by ${existingRoster.createdByName}`}
                </p>
              </div>

              {/* Create Version Option */}
              <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-900">
                    Create as Version {nextVersionNumber}
                  </span>
                </div>
                <p className="text-xs text-blue-700">
                  The new upload will become version {nextVersionNumber} of this roster.
                  Staff will be notified of any shift changes when you publish.
                </p>
              </div>

              {/* Info Note */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>
                  Creating a new version lets you track changes over time.
                  The previous version will remain in the version history.
                </p>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel onClick={onCancel} disabled={isLoading}>
            Cancel Upload
          </AlertDialogCancel>
          <Button
            onClick={onCreateNewVersion}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <GitBranch className="h-4 w-4 mr-2" />
                Create Version {nextVersionNumber}
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Version indicator badge for confirmation step
 */
export function VersionIndicator({
  isNewVersion,
  versionNumber,
  parentVersionNumber,
}: {
  isNewVersion: boolean;
  versionNumber: number;
  parentVersionNumber?: number;
}) {
  if (!isNewVersion) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <GitBranch className="h-4 w-4 text-blue-600" />
      <div>
        <p className="text-sm font-medium text-blue-900">
          Creating Version {versionNumber}
        </p>
        {parentVersionNumber && (
          <p className="text-xs text-blue-700">
            Replacing version {parentVersionNumber}
          </p>
        )}
      </div>
    </div>
  );
}
