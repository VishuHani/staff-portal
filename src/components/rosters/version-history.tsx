"use client";

/**
 * Change Log Component (formerly Version History)
 * Displays timeline of roster edits/revisions with diff and rollback capabilities
 * Note: This shows edit revisions within a single roster, not the version chain
 */

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  History,
  GitCompare,
  RotateCcw,
  ChevronRight,
  User,
  Calendar,
  Clock,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Upload,
  Loader2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  getVersionHistory,
  getVersionDiff,
  rollbackToVersion,
  type VersionEntry,
  type VersionDiff,
} from "@/lib/actions/rosters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VersionHistoryProps {
  rosterId: string;
  currentVersion: number;
  canRollback: boolean; // Only DRAFT status can rollback
  onVersionChange?: () => void;
}

const ACTION_LABELS: Record<string, { label: string; color: string; icon: typeof History }> = {
  CREATED: { label: "Created", color: "bg-green-100 text-green-800", icon: FileText },
  UPDATED: { label: "Updated", color: "bg-blue-100 text-blue-800", icon: FileText },
  SHIFT_ADDED: { label: "Shift Added", color: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 },
  SHIFT_REMOVED: { label: "Shift Removed", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  SHIFT_UPDATED: { label: "Shift Updated", color: "bg-amber-100 text-amber-800", icon: FileText },
  BULK_IMPORT: { label: "Bulk Import", color: "bg-purple-100 text-purple-800", icon: Upload },
  SUBMITTED: { label: "Submitted for Review", color: "bg-indigo-100 text-indigo-800", icon: FileText },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  FINALIZED: { label: "Finalized", color: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
  PUBLISHED: { label: "Published", color: "bg-cyan-100 text-cyan-800", icon: CheckCircle2 },
  PUBLISHED_AS_NEW_VERSION: { label: "Published (New Version)", color: "bg-cyan-100 text-cyan-800", icon: CheckCircle2 },
  UNPUBLISHED: { label: "Unpublished", color: "bg-orange-100 text-orange-800", icon: RotateCcw },
  REVERTED_TO_DRAFT: { label: "Reverted to Draft", color: "bg-orange-100 text-orange-800", icon: RotateCcw },
  ARCHIVED: { label: "Archived", color: "bg-gray-100 text-gray-800", icon: History },
  RESTORED_FROM_VERSION: { label: "Restored from Version", color: "bg-purple-100 text-purple-800", icon: RotateCcw },
  SUPERSEDED_BY_NEW_VERSION: { label: "Superseded", color: "bg-orange-100 text-orange-800", icon: History },
  ARCHIVED_BY_NEW_VERSION: { label: "Archived", color: "bg-gray-100 text-gray-800", icon: History },
  ROLLBACK_STARTED: { label: "Rollback Started", color: "bg-orange-100 text-orange-800", icon: RotateCcw },
  ROLLBACK_COMPLETE: { label: "Rollback Complete", color: "bg-orange-100 text-orange-800", icon: RotateCcw },
  MERGE_STARTED: { label: "Merge Started", color: "bg-violet-100 text-violet-800", icon: GitCompare },
  MERGE_COMPLETE: { label: "Merge Complete", color: "bg-violet-100 text-violet-800", icon: GitCompare },
};

export function VersionHistory({
  rosterId,
  currentVersion,
  canRollback,
  onVersionChange,
}: VersionHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<VersionEntry[]>([]);
  const [selectedVersions, setSelectedVersions] = useState<[number | null, number | null]>([null, null]);
  const [diffDialogOpen, setDiffDialogOpen] = useState(false);
  const [diff, setDiff] = useState<VersionDiff | null>(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [rollbackVersion, setRollbackVersion] = useState<number | null>(null);
  const [rollingBack, setRollingBack] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [rosterId]);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const result = await getVersionHistory(rosterId);
      if (result.success && result.history) {
        setHistory(result.history);
      }
    } catch (error) {
      console.error("Error loading version history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompareVersions = async () => {
    const [from, to] = selectedVersions;
    if (from === null || to === null) return;

    setLoadingDiff(true);
    setDiffDialogOpen(true);
    try {
      const result = await getVersionDiff(rosterId, from, to);
      if (result.success && result.diff) {
        setDiff(result.diff);
      } else {
        toast.error(result.error || "Failed to load diff");
        setDiffDialogOpen(false);
      }
    } catch (error) {
      toast.error("Failed to compare versions");
      setDiffDialogOpen(false);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleRollback = async () => {
    if (rollbackVersion === null) return;

    setRollingBack(true);
    try {
      const result = await rollbackToVersion(rosterId, rollbackVersion);
      if (result.success) {
        toast.success(`Rolled back to revision ${rollbackVersion}`);
        setRollbackDialogOpen(false);
        loadHistory();
        onVersionChange?.();
      } else {
        toast.error(result.error || "Failed to rollback");
      }
    } catch (error) {
      toast.error("Failed to rollback");
    } finally {
      setRollingBack(false);
    }
  };

  const toggleVersionSelection = (version: number) => {
    setSelectedVersions((prev) => {
      if (prev[0] === version) return [prev[1], null];
      if (prev[1] === version) return [prev[0], null];
      if (prev[0] === null) return [version, prev[1]];
      if (prev[1] === null) return [prev[0], version];
      // Both selected, replace first
      return [version, prev[1]];
    });
  };

  const getActionInfo = (action: string) => {
    return ACTION_LABELS[action] || { label: action, color: "bg-gray-100 text-gray-800", icon: History };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <History className="h-5 w-5" />
            Edit History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <History className="h-5 w-5" />
                Edit History
              </CardTitle>
              <CardDescription>
                {history.length} edits | Revision {currentVersion}
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={selectedVersions[0] === null || selectedVersions[1] === null}
              onClick={handleCompareVersions}
            >
              <GitCompare className="h-4 w-4 mr-2" />
              Compare Revisions
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No version history available
            </p>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                <div className="space-y-4">
                  {history.map((entry, index) => {
                    const actionInfo = getActionInfo(entry.action);
                    const ActionIcon = actionInfo.icon;
                    const isSelected =
                      selectedVersions[0] === entry.version ||
                      selectedVersions[1] === entry.version;
                    const isCurrent = index === 0;

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "relative pl-10 group",
                          isSelected && "bg-muted/50 -mx-2 px-2 py-2 rounded-lg"
                        )}
                      >
                        {/* Timeline dot */}
                        <div
                          className={cn(
                            "absolute left-2 w-5 h-5 rounded-full border-2 flex items-center justify-center",
                            isCurrent
                              ? "bg-primary border-primary"
                              : isSelected
                              ? "bg-primary/20 border-primary"
                              : "bg-background border-border"
                          )}
                        >
                          {isCurrent && (
                            <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                          )}
                        </div>

                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Badge variant="secondary" className={actionInfo.color}>
                                <ActionIcon className="h-3 w-3 mr-1" />
                                {actionInfo.label}
                              </Badge>
                              <span className="text-sm font-medium">
                                rev {entry.version}
                              </span>
                              {isCurrent && (
                                <Badge variant="outline" className="text-xs">
                                  Current
                                </Badge>
                              )}
                            </div>

                            <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {entry.performedBy.firstName} {entry.performedBy.lastName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDistanceToNow(new Date(entry.performedAt), {
                                  addSuffix: true,
                                })}
                              </span>
                            </div>

                            {entry.changes && (
                              <div className="mt-2 text-xs text-muted-foreground">
                                {typeof entry.changes.shiftCount === "number" && (
                                  <span>{entry.changes.shiftCount} shifts at this point</span>
                                )}
                                {typeof entry.changes.rolledBackToVersion === "number" && (
                                  <span>Restored from version {entry.changes.rolledBackToVersion}</span>
                                )}
                                {typeof entry.changes.added === "number" && (
                                  <span>
                                    +{entry.changes.added} added, -{Number(entry.changes.removed)} removed,{" "}
                                    ~{Number(entry.changes.updated)} updated
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant={isSelected ? "secondary" : "ghost"}
                              size="sm"
                              onClick={() => toggleVersionSelection(entry.version)}
                            >
                              {isSelected ? "Selected" : "Select"}
                            </Button>
                            {canRollback && !isCurrent && entry.changes?.shiftsSnapshot !== undefined && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setRollbackVersion(entry.version);
                                  setRollbackDialogOpen(true);
                                }}
                              >
                                <RotateCcw className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Diff Dialog */}
      <Dialog open={diffDialogOpen} onOpenChange={setDiffDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              Compare Revisions: rev {selectedVersions[0]} → rev {selectedVersions[1]}
            </DialogTitle>
            <DialogDescription>
              Changes between the selected revisions
            </DialogDescription>
          </DialogHeader>

          {loadingDiff ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : diff ? (
            <ScrollArea className="max-h-[50vh]">
              <div className="space-y-4">
                {/* Summary */}
                <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      +{diff.summary.addedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Added</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      -{diff.summary.removedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Removed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-amber-600">
                      ~{diff.summary.modifiedCount}
                    </div>
                    <div className="text-xs text-muted-foreground">Modified</div>
                  </div>
                </div>

                {/* Added Shifts */}
                {diff.added.length > 0 && (
                  <div>
                    <h4 className="font-medium text-green-700 mb-2">
                      Added Shifts ({diff.added.length})
                    </h4>
                    <div className="space-y-2">
                      {diff.added.map((shift, i) => (
                        <div
                          key={i}
                          className="p-2 bg-green-50 border border-green-200 rounded text-sm"
                        >
                          <div className="font-medium">
                            {shift.userName || "Unassigned"} - {shift.position || "No position"}
                          </div>
                          <div className="text-muted-foreground">
                            {shift.date} | {shift.startTime} - {shift.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Shifts */}
                {diff.removed.length > 0 && (
                  <div>
                    <h4 className="font-medium text-red-700 mb-2">
                      Removed Shifts ({diff.removed.length})
                    </h4>
                    <div className="space-y-2">
                      {diff.removed.map((shift, i) => (
                        <div
                          key={i}
                          className="p-2 bg-red-50 border border-red-200 rounded text-sm"
                        >
                          <div className="font-medium">
                            {shift.userName || "Unassigned"} - {shift.position || "No position"}
                          </div>
                          <div className="text-muted-foreground">
                            {shift.date} | {shift.startTime} - {shift.endTime}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modified Shifts */}
                {diff.modified.length > 0 && (
                  <div>
                    <h4 className="font-medium text-amber-700 mb-2">
                      Modified Shifts ({diff.modified.length})
                    </h4>
                    <div className="space-y-2">
                      {diff.modified.map((mod, i) => (
                        <div
                          key={i}
                          className="p-2 bg-amber-50 border border-amber-200 rounded text-sm"
                        >
                          <div className="font-medium">
                            {mod.after.userName || "Unassigned"} - {mod.after.position || "No position"}
                          </div>
                          <div className="text-muted-foreground">
                            {mod.after.date} | {mod.after.startTime} - {mod.after.endTime}
                          </div>
                          <div className="mt-1 text-xs">
                            {mod.changes.map((change, j) => (
                              <div key={j} className="text-amber-700">
                                <ChevronRight className="h-3 w-3 inline" /> {change}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {diff.summary.totalChanges === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No differences between these versions
                  </p>
                )}
              </div>
            </ScrollArea>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDiffDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation */}
      <AlertDialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rollback to rev {rollbackVersion}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore the roster to its state at revision {rollbackVersion}.
              All shifts will be replaced with the shifts from that revision.
              A new history entry will be created to track this rollback.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRollback}
              disabled={rollingBack}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {rollingBack ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rolling back...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Rollback
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
