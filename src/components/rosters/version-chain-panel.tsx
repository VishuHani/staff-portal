"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RosterStatus } from "@prisma/client";
import { format } from "date-fns";
import {
  GitBranch,
  ChevronDown,
  CheckCircle,
  Archive,
  Clock,
  FileText,
  Send,
  Loader2,
  RotateCcw,
  GitCompare,
  Plus,
  Minus,
  Edit,
  ArrowRight,
} from "lucide-react";
import { getRosterVersionChain, compareRosterVersions } from "@/lib/actions/rosters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface VersionInfo {
  id: string;
  name: string;
  versionNumber: number;
  revision: number;
  isActive: boolean;
  status: RosterStatus;
  createdAt: Date;
  publishedAt: Date | null;
  createdByUser: { id: string; firstName: string | null; lastName: string | null };
  _count: { shifts: number };
}

interface VersionDiff {
  added: Array<{
    id: string;
    userId: string | null;
    userName: string | null;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    position: string | null;
    notes: string | null;
  }>;
  removed: Array<{
    id: string;
    userId: string | null;
    userName: string | null;
    date: string;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    position: string | null;
    notes: string | null;
  }>;
  modified: Array<{
    before: {
      id: string;
      userId: string | null;
      userName: string | null;
      date: string;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      position: string | null;
      notes: string | null;
    };
    after: {
      id: string;
      userId: string | null;
      userName: string | null;
      date: string;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      position: string | null;
      notes: string | null;
    };
    changes: string[];
  }>;
  reassigned: Array<{
    shift: {
      id: string;
      userId: string | null;
      userName: string | null;
      date: string;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      position: string | null;
      notes: string | null;
    };
    previousUser: string | null;
    newUser: string | null;
  }>;
  summary: {
    totalChanges: number;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    reassignedCount: number;
    affectedUsers: string[];
  };
}

interface VersionChainPanelProps {
  rosterId: string;
  currentVersionNumber: number;
  isActive: boolean;
  chainId: string | null;
  onVersionChange?: () => void;
}

const statusConfig: Record<RosterStatus, { label: string; color: string; icon: typeof FileText }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  PENDING_REVIEW: { label: "Pending", color: "bg-amber-100 text-amber-700", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle },
  PUBLISHED: { label: "Published", color: "bg-cyan-100 text-cyan-700", icon: Send },
  ARCHIVED: { label: "Archived", color: "bg-gray-100 text-gray-500", icon: Archive },
};

export function VersionChainPanel({
  rosterId,
  currentVersionNumber,
  isActive,
  chainId,
  onVersionChange,
}: VersionChainPanelProps) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true); // Start expanded to show all versions
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedForRestore, setSelectedForRestore] = useState<VersionInfo | null>(null);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<VersionInfo | null>(null);
  const [compareDiff, setCompareDiff] = useState<VersionDiff | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);

  useEffect(() => {
    if (chainId) {
      loadVersionChain();
    } else {
      setLoading(false);
    }
  }, [chainId, rosterId]);

  async function loadVersionChain() {
    try {
      setLoading(true);
      const result = await getRosterVersionChain(rosterId);
      if (result.success && result.versions) {
        setVersions(result.versions as VersionInfo[]);
      }
    } catch (error) {
      console.error("Error loading version chain:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompare(version: VersionInfo) {
    try {
      setCompareLoading(true);
      setSelectedForCompare(version);
      setCompareDialogOpen(true);
      
      // Use compareRosterVersions server action with roster IDs
      const result = await compareRosterVersions(rosterId, version.id);
      
      if (result.success && result.diff) {
        setCompareDiff(result.diff as VersionDiff);
      } else {
        toast.error(result.error || "Failed to compare versions");
        setCompareDialogOpen(false);
      }
    } catch (error) {
      console.error("Error comparing versions:", error);
      toast.error("Failed to compare versions");
      setCompareDialogOpen(false);
    } finally {
      setCompareLoading(false);
    }
  }

  if (!chainId) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Version Chain</CardTitle>
          </div>
          <CardDescription>
            v{currentVersionNumber} - Single version (no chain)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            This roster has no other versions. Use "Create New Version" from the Roster Actions menu to create a new version based on this one.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Version Chain</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const chainHasDraft = versions.some((v) => v.status === RosterStatus.DRAFT);
  const otherVersions = versions.filter((v) => v.id !== rosterId);
  const currentVersion = versions.find((v) => v.id === rosterId);

  // Find the actual active version in the chain (highest published version number with isActive=true)
  // This helps determine if a version is "restorable" even if isActive flags are corrupted
  const activeVersionInChain = versions.find((v) => v.isActive && v.status === RosterStatus.PUBLISHED) ||
    versions.filter((v) => v.status === RosterStatus.PUBLISHED).sort((a, b) => b.versionNumber - a.versionNumber)[0];

  // A version is restorable if:
  // 1. It's not a DRAFT (nothing to restore from a draft)
  // 2. It's not THE active version (can't restore what's already live)
  const isCurrentTheActiveOne = currentVersion?.id === activeVersionInChain?.id;
  const canRestoreCurrent = currentVersion &&
    currentVersion.status !== RosterStatus.DRAFT &&
    !isCurrentTheActiveOne;

  // Check if a version is restorable (for the "Other Versions" list)
  const isVersionRestorable = (version: VersionInfo) => {
    return version.status !== RosterStatus.DRAFT && version.id !== activeVersionInChain?.id;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Version Chain</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {versions.length} version{versions.length !== 1 ? "s" : ""}
            </Badge>
          </div>
          {otherVersions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? "Collapse" : "View All"}
              <ChevronDown
                className={cn("ml-1 h-4 w-4 transition-transform", expanded && "rotate-180")}
              />
            </Button>
          )}
        </div>
        <CardDescription>
          Currently viewing Version {currentVersionNumber}
          {isActive ? " (Active)" : " (Superseded)"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current Version Status */}
        <div className="flex items-center justify-between rounded-lg border p-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full",
                isActive ? "bg-green-100" : "bg-gray-100"
              )}
            >
              {isActive ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <Archive className="h-4 w-4 text-gray-500" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                Version {currentVersionNumber}
                {isActive && (
                  <Badge variant="outline" className="ml-2 border-green-500 text-green-600">
                    Active
                  </Badge>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? "This is the current live version"
                  : "This version has been superseded"}
              </p>
            </div>
          </div>
        </div>

        {/* Other Versions */}
        {expanded && otherVersions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Other Versions
            </p>
            {otherVersions.map((version) => {
              const StatusIcon = statusConfig[version.status].icon;
              // Use smart detection: is this THE active version, not just has isActive flag
              const isThisTheActiveVersion = version.id === activeVersionInChain?.id;
              return (
                <div
                  key={version.id}
                  className={cn(
                    "flex items-center justify-between rounded-lg border p-3",
                    isThisTheActiveVersion && "border-green-500 bg-green-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                        isThisTheActiveVersion ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {version.versionNumber}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{version.name}</p>
                        {isThisTheActiveVersion && (
                          <Badge variant="outline" className="border-green-500 text-green-600 text-xs">
                            Active
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge className={cn("text-xs", statusConfig[version.status].color)}>
                          <StatusIcon className="mr-1 h-3 w-3" />
                          {statusConfig[version.status].label}
                        </Badge>
                        <span>{version._count.shifts} shifts</span>
                        <span>
                          {format(new Date(version.createdAt), "MMM d, yyyy")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Compare button for all versions */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCompare(version)}
                      title="Compare with current version"
                    >
                      <GitCompare className="mr-1 h-3 w-3" />
                      Compare
                    </Button>
                    {/* Show restore button for restorable versions (not active, not draft) */}
                    {isVersionRestorable(version) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedForRestore(version);
                          setRestoreDialogOpen(true);
                        }}
                        title="Restore this version"
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Actions */}
        {versions.length > 1 && (
          <div className="flex flex-col gap-2 pt-2">
            {/* Compare with another version */}
            {otherVersions.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  // Default to comparing with the active version or first other version
                  const versionToCompare = activeVersionInChain && activeVersionInChain.id !== rosterId
                    ? activeVersionInChain
                    : otherVersions[0];
                  handleCompare(versionToCompare);
                }}
              >
                <GitCompare className="mr-1 h-3 w-3" />
                Compare with {activeVersionInChain && activeVersionInChain.id !== rosterId 
                  ? `Active (v${activeVersionInChain.versionNumber})` 
                  : `v${otherVersions[0].versionNumber}`}
              </Button>
            )}
            {/* Restore button for superseded/archived versions */}
            {canRestoreCurrent && currentVersion && (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={() => {
                  setSelectedForRestore(currentVersion);
                  setRestoreDialogOpen(true);
                }}
              >
                <RotateCcw className="mr-1 h-3 w-3" />
                Restore This Version
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Restore Dialog */}
      <AlertDialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-orange-600" />
              Restore Version {selectedForRestore?.versionNumber}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                This will create a new draft version based on{" "}
                <strong>Version {selectedForRestore?.versionNumber}</strong> ({selectedForRestore?.name}).
              </p>
              <p className="text-sm">
                The new draft will contain all shifts from this version. You can then review,
                edit, and publish it as a new version when ready.
              </p>
              {chainHasDraft && (
                <p className="text-sm text-orange-600 font-medium">
                  Note: There is already a draft version in this chain.
                  Restoring will replace that draft.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-orange-600 hover:bg-orange-700"
              onClick={async () => {
                if (selectedForRestore) {
                  try {
                    // Import and call the restore action
                    const { restoreFromVersion } = await import("@/lib/actions/rosters");
                    const result = await restoreFromVersion(selectedForRestore.id);
                    if (result.success && result.rosterId) {
                      toast.success(`Version ${selectedForRestore.versionNumber} restored as new draft`);
                      router.push(`/manage/rosters/${result.rosterId}`);
                      onVersionChange?.();
                    } else {
                      toast.error(result.error || "Failed to restore version");
                    }
                  } catch (error) {
                    console.error("Error restoring version:", error);
                    toast.error("Failed to restore version");
                  }
                }
              }}
            >
              <RotateCcw className="mr-1 h-4 w-4" />
              Restore as Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Compare Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCompare className="h-5 w-5 text-blue-600" />
              Compare Versions
            </DialogTitle>
            <DialogDescription>
              Comparing Version {currentVersionNumber} with Version {selectedForCompare?.versionNumber}
            </DialogDescription>
          </DialogHeader>
          
          {compareLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : compareDiff ? (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Summary */}
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="rounded-lg border p-2">
                    <p className="text-2xl font-bold">{compareDiff.summary.totalChanges}</p>
                    <p className="text-xs text-muted-foreground">Total Changes</p>
                  </div>
                  <div className="rounded-lg border border-green-200 bg-green-50 p-2">
                    <p className="text-2xl font-bold text-green-600">{compareDiff.summary.addedCount}</p>
                    <p className="text-xs text-green-600">Added</p>
                  </div>
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2">
                    <p className="text-2xl font-bold text-red-600">{compareDiff.summary.removedCount}</p>
                    <p className="text-xs text-red-600">Removed</p>
                  </div>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                    <p className="text-2xl font-bold text-amber-600">{compareDiff.summary.modifiedCount}</p>
                    <p className="text-xs text-amber-600">Modified</p>
                  </div>
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-2">
                    <p className="text-2xl font-bold text-purple-600">{compareDiff.summary.reassignedCount}</p>
                    <p className="text-xs text-purple-600">Reassigned</p>
                  </div>
                </div>

                {/* Added Shifts */}
                {compareDiff.added.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Plus className="h-4 w-4 text-green-600" />
                      Added Shifts ({compareDiff.added.length})
                    </h4>
                    <div className="space-y-1">
                      {compareDiff.added.map((shift, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-2 text-sm">
                          <span className="font-medium">{shift.userName || "Unassigned"}</span>
                          <span className="text-muted-foreground">{format(new Date(shift.date), "EEE, MMM d")}</span>
                          <span className="text-muted-foreground">{shift.startTime} - {shift.endTime}</span>
                          {shift.position && (
                            <Badge variant="outline" className="text-xs">{shift.position}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Removed Shifts */}
                {compareDiff.removed.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Minus className="h-4 w-4 text-red-600" />
                      Removed Shifts ({compareDiff.removed.length})
                    </h4>
                    <div className="space-y-1">
                      {compareDiff.removed.map((shift, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm">
                          <span className="font-medium">{shift.userName || "Unassigned"}</span>
                          <span className="text-muted-foreground">{format(new Date(shift.date), "EEE, MMM d")}</span>
                          <span className="text-muted-foreground">{shift.startTime} - {shift.endTime}</span>
                          {shift.position && (
                            <Badge variant="outline" className="text-xs">{shift.position}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Modified Shifts */}
                {compareDiff.modified.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Edit className="h-4 w-4 text-amber-600" />
                      Modified Shifts ({compareDiff.modified.length})
                    </h4>
                    <div className="space-y-1">
                      {compareDiff.modified.map((mod, i) => (
                        <div key={i} className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{mod.after.userName || "Unassigned"}</span>
                            <span className="text-muted-foreground">{format(new Date(mod.after.date), "EEE, MMM d")}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {mod.changes.map((change, j) => (
                              <Badge key={j} variant="outline" className="text-xs bg-white">
                                {change}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reassigned Shifts */}
                {compareDiff.reassigned && compareDiff.reassigned.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <ArrowRight className="h-4 w-4 text-purple-600" />
                      Reassigned Shifts ({compareDiff.reassigned.length})
                    </h4>
                    <div className="space-y-1">
                      {compareDiff.reassigned.map((reassign, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 p-2 text-sm">
                          <span className="font-medium text-red-600">{reassign.previousUser || "Unassigned"}</span>
                          <ArrowRight className="h-4 w-4 text-purple-600" />
                          <span className="font-medium text-green-600">{reassign.newUser || "Unassigned"}</span>
                          <span className="text-muted-foreground">{format(new Date(reassign.shift.date), "EEE, MMM d")}</span>
                          <span className="text-muted-foreground">{reassign.shift.startTime} - {reassign.shift.endTime}</span>
                          {reassign.shift.position && (
                            <Badge variant="outline" className="text-xs">{reassign.shift.position}</Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No Changes */}
                {compareDiff.summary.totalChanges === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <p>No differences found between these versions</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

/**
 * A compact version badge for use in lists
 */
export function VersionBadge({
  versionNumber,
  isActive,
  totalVersions,
}: {
  versionNumber: number;
  isActive: boolean;
  totalVersions?: number;
}) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "text-xs",
        isActive ? "border-green-500 text-green-600" : "border-gray-300 text-gray-500"
      )}
    >
      <GitBranch className="mr-1 h-3 w-3" />
      v{versionNumber}
      {totalVersions && totalVersions > 1 && (
        <span className="ml-1 text-muted-foreground">of {totalVersions}</span>
      )}
      {isActive && <CheckCircle className="ml-1 h-3 w-3" />}
    </Badge>
  );
}
