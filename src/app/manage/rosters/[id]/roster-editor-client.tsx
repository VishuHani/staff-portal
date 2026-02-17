"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { RosterStatusBadge, RosterMatrixView, ShiftForm, ApprovalWorkflow, ApprovalHistory, ConflictSummary, VersionHistory, ReuploadDialog, RosterActionsMenu, VersionChainPanel, StaffAvatarStack, DateRangePicker, FilterPanel, type ShiftConflict } from "@/components/rosters";
import { formatCurrency, formatHours, calculateShiftHours, calculateTotalPay } from "@/lib/utils/pay-calculator";
import { RosterStatus } from "@prisma/client";
import { format } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  ArrowLeft,
  Plus,
  AlertTriangle,
  Loader2,
  Info,
  ChevronDown,
  Check,
  Send,
} from "lucide-react";
import { deleteRoster, archiveRoster, recheckRosterConflicts, getRosterVersionChain, updateShift, getAdjacentRoster } from "@/lib/actions/rosters";
import { toast } from "sonner";

interface Shift {
  id: string;
  userId: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  position: string | null;
  notes: string | null;
  originalName: string | null;
  hasConflict: boolean;
  conflictType: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage: string | null;
  } | null;
}

interface Roster {
  id: string;
  name: string;
  description: string | null;
  status: RosterStatus;
  revision: number;
  chainId: string | null;
  versionNumber: number;
  isActive: boolean;
  startDate: Date;
  endDate: Date;
  publishedAt: Date | null;
  createdAt: Date;
  venue: { id: string; name: string; code: string };
  createdByUser: { id: string; firstName: string | null; lastName: string | null; email: string };
  publishedByUser: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
  shifts: Shift[];
  history: Array<{
    id: string;
    version: number;
    action: string;
    performedAt: Date;
    performedByUser: { id: string; firstName: string | null; lastName: string | null };
  }>;
  unmatchedEntries: Array<{
    id: string;
    originalName: string;
    resolved: boolean;
  }>;
}

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage: string | null;
  role?: { name: string };
  weekdayRate?: unknown;
  saturdayRate?: unknown;
  sundayRate?: unknown;
}

interface PositionColor {
  name: string;
  color: string;
}

interface Position {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

interface StaffPayRates {
  weekdayRate: unknown;
  saturdayRate: unknown;
  sundayRate: unknown;
}

interface RosterEditorClientProps {
  roster: Roster;
  staff: StaffMember[];
  canEdit: boolean;
  canPublish: boolean;
  userRole?: string;
  userId?: string;
  positionColors?: PositionColor[];
  positions?: Position[];
  staffPayRates?: Record<string, StaffPayRates>;
}

// Version Switcher component for navigating between versions
interface VersionInfo {
  id: string;
  name: string;
  versionNumber: number;
  isActive: boolean;
  status: RosterStatus;
  createdAt: Date;
}

function VersionSwitcher({
  currentRosterId,
  chainId,
  currentVersionNumber,
}: {
  currentRosterId: string;
  chainId: string | null;
  currentVersionNumber: number;
}) {
  const router = useRouter();
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (chainId) {
      loadVersions();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  async function loadVersions() {
    setLoading(true);
    const result = await getRosterVersionChain(currentRosterId);
    if (result.success && result.versions) {
      setVersions(result.versions as VersionInfo[]);
    }
    setLoading(false);
  }

  // No chain or single version - show static badge
  if (!chainId || versions.length <= 1) {
    return (
      <Badge variant="outline" className="text-sm">
        v{currentVersionNumber}
      </Badge>
    );
  }

  // Smart detection: find the actual active version (highest published version number)
  const activeVersionInChain = versions.find((v) => v.isActive && v.status === RosterStatus.PUBLISHED) ||
    versions.filter((v) => v.status === RosterStatus.PUBLISHED).sort((a, b) => b.versionNumber - a.versionNumber)[0];

  // Helper to determine if a version is THE active one
  const isVersionTheActiveOne = (version: VersionInfo) => version.id === activeVersionInChain?.id;

  // Multiple versions - show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          v{currentVersionNumber}
          <ChevronDown className="ml-1 h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {versions.map((version) => {
          const isActive = isVersionTheActiveOne(version);
          return (
            <DropdownMenuItem
              key={version.id}
              onClick={() => router.push(`/manage/rosters/${version.id}`)}
              className={version.id === currentRosterId ? "bg-muted" : ""}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <span className="font-medium">v{version.versionNumber}</span>
                  <Badge
                    variant="secondary"
                    className={`text-xs ${
                      version.status === RosterStatus.DRAFT
                        ? "bg-gray-100 text-gray-700"
                        : version.status === RosterStatus.ARCHIVED
                          ? "bg-gray-100 text-gray-500"
                          : isActive
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                    }`}
                  >
                    {version.status === RosterStatus.DRAFT
                      ? "Draft"
                      : version.status === RosterStatus.ARCHIVED
                        ? "Archived"
                        : isActive
                          ? "Active"
                          : "Superseded"}
                  </Badge>
                </div>
                {version.id === currentRosterId && (
                  <Check className="h-4 w-4 text-green-600" />
                )}
              </div>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RosterEditorClient({
  roster: initialRoster,
  staff,
  canEdit,
  canPublish,
  userRole = "STAFF",
  userId,
  positionColors = [],
  positions = [],
  staffPayRates = {},
}: RosterEditorClientProps) {
  const router = useRouter();
  const [roster, setRoster] = useState(initialRoster);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showShiftForm, setShowShiftForm] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [newShiftDefaults, setNewShiftDefaults] = useState<{ date?: Date; userId?: string }>({});
  const [showReuploadDialog, setShowReuploadDialog] = useState(false);
  const [filters, setFilters] = useState<{ staffIds: string[]; positions: string[] }>({
    staffIds: [],
    positions: [],
  });

  const isDraft = roster.status === RosterStatus.DRAFT;
  const isPendingReview = roster.status === RosterStatus.PENDING_REVIEW;
  const isApproved = roster.status === RosterStatus.APPROVED;
  const isPublished = roster.status === RosterStatus.PUBLISHED;
  const isSuperseded = !roster.isActive && roster.status !== RosterStatus.DRAFT;
  const conflictCount = roster.shifts.filter((s) => s.hasConflict).length;
  const assignedCount = roster.shifts.filter((s) => s.userId).length;
  const unassignedCount = roster.shifts.filter((s) => !s.userId).length;
  const isCreator = userId === roster.createdByUser.id;
  const isAdmin = userRole === "ADMIN";

  // Get unique staff assigned to shifts for avatar stack
  const assignedStaff = Array.from(
    new Map(
      roster.shifts
        .filter((s) => s.user)
        .map((s) => [s.user!.id, s.user!])
    ).values()
  );

  // Calculate total hours and cost
  const totalHours = roster.shifts.reduce(
    (sum, s) => sum + calculateShiftHours(s.startTime, s.endTime, s.breakMinutes),
    0
  );

  const totalCost = roster.shifts.reduce((sum, shift) => {
    if (!shift.user?.id || !staffPayRates[shift.user.id]) return sum;
    const result = calculateTotalPay(
      [{ date: new Date(shift.date), startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes }],
      staffPayRates[shift.user.id]
    );
    return sum + (result.total || 0);
  }, 0);

  // Filter shifts based on active filters
  const filteredShifts = roster.shifts.filter((shift) => {
    if (filters.staffIds.length > 0 && shift.user?.id && !filters.staffIds.includes(shift.user.id)) {
      return false;
    }
    if (filters.positions.length > 0 && shift.position && !filters.positions.includes(shift.position)) {
      return false;
    }
    return true;
  });

  const handleStatusChange = (newStatus: RosterStatus) => {
    setRoster((prev) => ({ ...prev, status: newStatus }));
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteRoster(roster.id);
      if (result.success) {
        toast.success("Roster deleted");
        router.push("/manage/rosters");
      } else {
        toast.error(result.error || "Failed to delete roster");
      }
    } catch (error) {
      console.error("Error deleting roster:", error);
      toast.error("An error occurred");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const result = await archiveRoster(roster.id);
      if (result.success) {
        toast.success("Roster archived");
        router.refresh();
      } else {
        toast.error(result.error || "Failed to archive roster");
      }
    } catch (error) {
      console.error("Error archiving roster:", error);
      toast.error("An error occurred");
    } finally {
      setIsArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShowShiftForm(true);
  };

  const handleRefreshConflicts = async () => {
    const result = await recheckRosterConflicts(roster.id);
    if (result.success) {
      toast.success(`Found ${result.conflictCount} conflict${result.conflictCount !== 1 ? "s" : ""}`);
      router.refresh();
    } else {
      toast.error(result.error || "Failed to check conflicts");
    }
  };

  const handleResolveConflict = (shiftId: string) => {
    const shift = roster.shifts.find((s) => s.id === shiftId);
    if (shift) {
      setEditingShift(shift);
      setShowShiftForm(true);
    }
  };

  const handleMoveShift = async (shiftId: string, newDate: Date, newUserId: string | null) => {
    // Find the shift to update
    const shiftToMove = roster.shifts.find((s) => s.id === shiftId);
    if (!shiftToMove) return;

    // Store original values for rollback
    const originalDate = shiftToMove.date;
    const originalUserId = shiftToMove.userId;
    const originalUser = shiftToMove.user;

    // Find new user data from staff list if assigning to a user
    const newUser = newUserId ? staff.find((s) => s.id === newUserId) : null;

    // Optimistic update - update local state immediately
    setRoster((prev) => ({
      ...prev,
      shifts: prev.shifts.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              date: newDate,
              userId: newUserId,
              user: newUser
                ? {
                    id: newUser.id,
                    firstName: newUser.firstName,
                    lastName: newUser.lastName,
                    email: newUser.email,
                    profileImage: newUser.profileImage,
                  }
                : null,
            }
          : s
      ),
    }));

    try {
      const result = await updateShift(shiftId, {
        date: newDate,
        userId: newUserId,
      });
      if (result.success) {
        toast.success("Shift moved");
        // Refresh in background to sync with server
        router.refresh();
      } else {
        // Rollback on error
        setRoster((prev) => ({
          ...prev,
          shifts: prev.shifts.map((s) =>
            s.id === shiftId
              ? { ...s, date: originalDate, userId: originalUserId, user: originalUser }
              : s
          ),
        }));
        toast.error(result.error || "Failed to move shift");
      }
    } catch (error) {
      // Rollback on error
      setRoster((prev) => ({
        ...prev,
        shifts: prev.shifts.map((s) =>
          s.id === shiftId
            ? { ...s, date: originalDate, userId: originalUserId, user: originalUser }
            : s
        ),
      }));
      console.error("Error moving shift:", error);
      toast.error("An error occurred");
    }
  };

  // Prepare conflicts for ConflictSummary component
  const shiftConflicts: ShiftConflict[] = roster.shifts
    .filter((s) => s.hasConflict)
    .map((s) => ({
      shiftId: s.id,
      userId: s.userId,
      userName: s.user
        ? `${s.user.firstName || ""} ${s.user.lastName || ""}`.trim() || s.user.email
        : s.originalName || "Unassigned",
      date: s.date,
      startTime: s.startTime,
      endTime: s.endTime,
      position: s.position,
      conflictType: s.conflictType || "UNKNOWN",
    }));

  return (
    <div className="space-y-6">
      {/* Superseded Version Banner */}
      {isSuperseded && (
        <Alert variant="default" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
          <Info className="h-4 w-4 text-orange-600" />
          <AlertTitle className="text-orange-800 dark:text-orange-200">
            Viewing Superseded Version (v{roster.versionNumber})
          </AlertTitle>
          <AlertDescription className="text-orange-700 dark:text-orange-300">
            This version has been replaced by a newer version. You are viewing it in read-only mode.
            Use the Version Chain panel below to navigate to the current active version or restore this version.
          </AlertDescription>
        </Alert>
      )}

      {/* Header - Mockup Style */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/manage/rosters">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold">Weekly Schedule</h1>
          <RosterStatusBadge status={roster.status} />
          <DateRangePicker
            startDate={roster.startDate}
            endDate={roster.endDate}
            onPrevious={async () => {
              const result = await getAdjacentRoster(roster.id, "previous");
              if (result.success && result.roster) {
                router.push(`/manage/rosters/${result.roster.id}`);
              } else {
                toast.info(result.message || "No previous week roster found");
              }
            }}
            onNext={async () => {
              const result = await getAdjacentRoster(roster.id, "next");
              if (result.success && result.roster) {
                router.push(`/manage/rosters/${result.roster.id}`);
              } else {
                toast.info(result.message || "No next week roster found");
              }
            }}
          />
        </div>

        <div className="flex items-center gap-3">
          <StaffAvatarStack staff={assignedStaff} maxDisplay={4} />
          <FilterPanel
            staff={staff}
            positions={positions}
            selectedStaffIds={filters.staffIds}
            selectedPositions={filters.positions}
            onFilterChange={setFilters}
          />
          {canEdit && (
            <RosterActionsMenu
              roster={{
                id: roster.id,
                name: roster.name,
                status: roster.status,
                startDate: roster.startDate,
                endDate: roster.endDate,
                venue: roster.venue,
                _count: { shifts: roster.shifts.length },
              }}
              onReupload={() => setShowReuploadDialog(true)}
              onArchive={() => setShowArchiveDialog(true)}
              onRefresh={() => router.refresh()}
              variant="button"
            />
          )}
          {canPublish && isDraft && (
            <Button className="bg-blue-600 hover:bg-blue-700 text-white">
              <Send className="h-4 w-4 mr-2" />
              Publish Roster
            </Button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-6 py-3 px-4 bg-muted/30 rounded-lg border">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total Cost</span>
          <span className="text-xl font-bold">{formatCurrency(totalCost)}</span>
          <Badge className="bg-green-100 text-green-700 border-green-200">
            On Budget
          </Badge>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Total Hours</span>
          <span className="text-xl font-bold">{formatHours(totalHours)}</span>
          <span className="text-sm text-muted-foreground">/ 480h Cap</span>
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Conflicts</span>
          {conflictCount > 0 ? (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              {conflictCount} Issues
            </Badge>
          ) : (
            <Badge className="bg-green-100 text-green-700 border-green-200 gap-1">
              <Check className="h-3 w-3" />
              0 Issues
            </Badge>
          )}
        </div>
      </div>

      {/* Main Matrix View - No Card wrapper, directly rendered */}
      <RosterMatrixView
        shifts={filteredShifts}
        weekStart={new Date(roster.startDate)}
        editable={isDraft && canEdit}
        positionColors={positionColors}
        staffPayRates={staffPayRates as Record<string, { weekdayRate: unknown; saturdayRate: unknown; sundayRate: unknown }>}
        onEditShift={handleEditShift}
        onAddShift={(date, userId) => {
          setEditingShift(null);
          setNewShiftDefaults({ date, userId });
          setShowShiftForm(true);
        }}
        onMoveShift={handleMoveShift}
        onRefresh={() => router.refresh()}
      />

      {/* Conflict Summary - Only show if there are conflicts */}
      {conflictCount > 0 && (
        <ConflictSummary
          conflicts={shiftConflicts}
          onResolveConflict={handleResolveConflict}
          onRefreshConflicts={handleRefreshConflicts}
        />
      )}

      {/* Workflow & History - Collapsible sections below the main view */}
      {(isDraft || isPendingReview || isApproved) && (
        <Card>
          <CardHeader>
            <CardTitle>Roster Workflow</CardTitle>
            <CardDescription>
              {isDraft && "Finalize your roster when ready, then publish to notify staff"}
              {isPendingReview && "This roster can now be finalized directly - no approval needed"}
              {isApproved && "Your roster is finalized and ready to publish"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ApprovalWorkflow
              rosterId={roster.id}
              status={roster.status}
              userRole={userRole}
              isCreator={isCreator}
              hasAssignedShifts={assignedCount > 0}
              onStatusChange={handleStatusChange}
              rosterName={roster.name}
              venueName={roster.venue.name}
              startDate={new Date(roster.startDate)}
              endDate={new Date(roster.endDate)}
              shiftCount={roster.shifts.length}
              assignedStaffCount={assignedCount}
            />
          </CardContent>
        </Card>
      )}

      {/* Version Chain Panel */}
      <VersionChainPanel
        rosterId={roster.id}
        currentVersionNumber={roster.versionNumber}
        isActive={roster.isActive}
        chainId={roster.chainId}
        onVersionChange={() => router.refresh()}
      />

      {/* History Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <ApprovalHistory rosterId={roster.id} />
        <VersionHistory
          rosterId={roster.id}
          currentVersion={roster.revision}
          canRollback={isDraft && canEdit}
          onVersionChange={() => router.refresh()}
        />
      </div>

      {/* Shift Form Dialog */}
      <ShiftForm
        rosterId={roster.id}
        rosterStartDate={new Date(roster.startDate)}
        rosterEndDate={new Date(roster.endDate)}
        staff={staff}
        positions={positions}
        shift={editingShift ? {
          id: editingShift.id,
          userId: editingShift.userId,
          date: new Date(editingShift.date),
          startTime: editingShift.startTime,
          endTime: editingShift.endTime,
          breakMinutes: editingShift.breakMinutes,
          position: editingShift.position,
          notes: editingShift.notes,
        } : undefined}
        defaultDate={newShiftDefaults.date}
        defaultUserId={newShiftDefaults.userId}
        open={showShiftForm}
        onOpenChange={(open) => {
          setShowShiftForm(open);
          if (!open) setNewShiftDefaults({});
        }}
        onSuccess={() => router.refresh()}
      />

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Roster</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this roster? This will also delete all {roster.shifts.length} shift
              {roster.shifts.length !== 1 ? "s" : ""}. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Archive Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Roster</AlertDialogTitle>
            <AlertDialogDescription>
              Archive this roster? It will be moved to archived status and staff can still view their past shifts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isArchiving}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive} disabled={isArchiving}>
              {isArchiving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Archive
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reupload Dialog */}
      <ReuploadDialog
        open={showReuploadDialog}
        onOpenChange={setShowReuploadDialog}
        rosterId={roster.id}
        venueId={roster.venue.id}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
