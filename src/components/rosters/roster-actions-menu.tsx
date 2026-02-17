"use client";

/**
 * Roster Actions Menu Component
 * Dropdown menu with context-aware actions based on roster status
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RosterStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Upload,
  RefreshCw,
  Archive,
  Eye,
} from "lucide-react";
import { CopyRosterDialog } from "./copy-roster-dialog";
import { ReuploadDialog } from "./reupload-dialog";

interface RosterActionsMenuProps {
  roster: {
    id: string;
    name: string;
    status: RosterStatus;
    startDate: Date;
    endDate: Date;
    venue: {
      id: string;
      name: string;
    };
    _count?: {
      shifts: number;
    };
  };
  onArchive?: () => void;
  onReupload?: () => void; // Override internal re-upload dialog
  onRefresh?: () => void;
  variant?: "icon" | "button";
  align?: "start" | "end";
}

export function RosterActionsMenu({
  roster,
  onArchive,
  onReupload,
  onRefresh,
  variant = "icon",
  align = "end",
}: RosterActionsMenuProps) {
  const router = useRouter();
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [showReuploadDialog, setShowReuploadDialog] = useState(false);

  // Use internal dialog unless parent provides override
  const useInternalReupload = !onReupload;

  const isDraft = roster.status === RosterStatus.DRAFT;
  const isPendingReview = roster.status === RosterStatus.PENDING_REVIEW;
  const isApproved = roster.status === RosterStatus.APPROVED;
  const isPublished = roster.status === RosterStatus.PUBLISHED;
  const isArchived = roster.status === RosterStatus.ARCHIVED;

  const canEdit = isDraft || isPendingReview || isApproved;
  const canReupload = isDraft;
  const canCreateNewVersion = isPublished;
  const canArchive = isPublished;
  const canCopy = true; // Can copy any roster

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/manage/rosters/${roster.id}`);
  };

  const handleView = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/manage/rosters/${roster.id}`);
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCopyDialog(true);
  };

  const handleReupload = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onReupload) {
      onReupload();
    } else {
      setShowReuploadDialog(true);
    }
  };

  const handleCreateNewVersion = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Open copy dialog with "same week" pre-selected
    setShowCopyDialog(true);
  };

  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation();
    onArchive?.();
  };

  const handleCopySuccess = (newRosterId: string) => {
    setShowCopyDialog(false);
    router.push(`/manage/rosters/${newRosterId}`);
  };

  const handleReuploadSuccess = () => {
    setShowReuploadDialog(false);
    onRefresh?.();
    router.refresh();
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          {variant === "icon" ? (
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Roster actions</span>
            </Button>
          ) : (
            <Button variant="outline" size="sm">
              Actions
              <MoreHorizontal className="h-4 w-4 ml-2" />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align={align} className="w-48">
          {/* Edit - Draft only */}
          {canEdit && (
            <DropdownMenuItem onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Roster
            </DropdownMenuItem>
          )}

          {/* View - for published/archived */}
          {(isPublished || isArchived) && (
            <DropdownMenuItem onClick={handleView}>
              <Eye className="h-4 w-4 mr-2" />
              View Roster
            </DropdownMenuItem>
          )}

          {/* Copy Roster - Any status */}
          {canCopy && (
            <DropdownMenuItem onClick={handleCopy}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Roster
            </DropdownMenuItem>
          )}

          {/* Re-upload - Draft only */}
          {canReupload && (
            <DropdownMenuItem onClick={handleReupload}>
              <Upload className="h-4 w-4 mr-2" />
              Re-upload File
            </DropdownMenuItem>
          )}

          {/* Create New Version - Published only */}
          {canCreateNewVersion && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleCreateNewVersion}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Create New Version
              </DropdownMenuItem>
            </>
          )}

          {/* Archive - Published only */}
          {canArchive && onArchive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleArchive}
                className="text-orange-600 focus:text-orange-600"
              >
                <Archive className="h-4 w-4 mr-2" />
                Archive
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Copy Roster Dialog */}
      <CopyRosterDialog
        open={showCopyDialog}
        onOpenChange={setShowCopyDialog}
        roster={roster}
        defaultToSameWeek={isPublished}
        onSuccess={handleCopySuccess}
      />

      {/* Re-upload Dialog - only render if not using parent's callback */}
      {useInternalReupload && (
        <ReuploadDialog
          open={showReuploadDialog}
          onOpenChange={setShowReuploadDialog}
          rosterId={roster.id}
          venueId={roster.venue.id}
          onSuccess={handleReuploadSuccess}
        />
      )}
    </>
  );
}
