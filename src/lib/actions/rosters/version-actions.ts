"use server";

/**
 * Roster Version Management Actions
 * Handles version history, diffs, and rollback functionality
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { revalidatePath } from "next/cache";
import { RosterStatus } from "@prisma/client";
import { createNotification } from "@/lib/services/notifications";
import { NotificationType } from "@prisma/client";

// ============================================================================
// TYPES
// ============================================================================

export interface VersionEntry {
  id: string;
  version: number;
  action: string;
  changes: Record<string, unknown> | null;
  performedAt: Date;
  performedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export interface ShiftSnapshot {
  id: string;
  userId: string | null;
  userName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  position: string | null;
  notes: string | null;
}

export interface VersionDiff {
  added: ShiftSnapshot[];
  removed: ShiftSnapshot[];
  modified: Array<{
    before: ShiftSnapshot;
    after: ShiftSnapshot;
    changes: string[];
  }>;
  reassigned: Array<{
    shift: ShiftSnapshot;
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

// ============================================================================
// GET VERSION HISTORY
// ============================================================================

/**
 * Get version history for a roster
 */
export async function getVersionHistory(rosterId: string): Promise<{
  success: boolean;
  history?: VersionEntry[];
  currentVersion?: number;
  error?: string;
}> {
  try {
    await requireAuth();

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { revision: true },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    const history = await prisma.rosterHistory.findMany({
      where: { rosterId },
      include: {
        performedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { version: "desc" },
    });

    const entries: VersionEntry[] = history.map((h) => ({
      id: h.id,
      version: h.version,
      action: h.action,
      changes: h.changes as Record<string, unknown> | null,
      performedAt: h.performedAt,
      performedBy: h.performedByUser,
    }));

    return {
      success: true,
      history: entries,
      currentVersion: roster.revision,
    };
  } catch (error) {
    console.error("Error fetching version history:", error);
    return { success: false, error: "Failed to fetch version history" };
  }
}

// ============================================================================
// GET VERSION SNAPSHOT
// ============================================================================

/**
 * Get a snapshot of shifts at a specific version
 */
export async function getVersionSnapshot(
  rosterId: string,
  version: number
): Promise<{
  success: boolean;
  snapshot?: ShiftSnapshot[];
  error?: string;
}> {
  try {
    await requireAuth();

    // Get the history entry for this version
    const historyEntry = await prisma.rosterHistory.findFirst({
      where: {
        rosterId,
        version,
      },
    });

    if (!historyEntry) {
      return { success: false, error: "Version not found" };
    }

    // If snapshot was stored in changes, return it
    const changes = historyEntry.changes as Record<string, unknown> | null;
    if (changes?.shiftsSnapshot) {
      return {
        success: true,
        snapshot: changes.shiftsSnapshot as ShiftSnapshot[],
      };
    }

    // Otherwise, reconstruct from current shifts (only works for current version)
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        shifts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    if (roster.revision !== version) {
      return {
        success: false,
        error: `Snapshot data not available for revision ${version}. Only revisions created after workflow actions (finalize, publish, etc.) have comparison data.`
      };
    }

    const snapshot: ShiftSnapshot[] = roster.shifts.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user
        ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email
        : null,
      date: shift.date.toISOString().split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      position: shift.position,
      notes: shift.notes,
    }));

    return { success: true, snapshot };
  } catch (error) {
    console.error("Error fetching version snapshot:", error);
    return { success: false, error: "Failed to fetch version snapshot" };
  }
}

// ============================================================================
// COMPARE VERSIONS (DIFF)
// ============================================================================

/**
 * Compare two versions and return the differences
 */
export async function getVersionDiff(
  rosterId: string,
  fromVersion: number,
  toVersion: number
): Promise<{
  success: boolean;
  diff?: VersionDiff;
  error?: string;
}> {
  try {
    await requireAuth();

    // Get snapshots for both versions
    const [fromResult, toResult] = await Promise.all([
      getVersionSnapshot(rosterId, fromVersion),
      getVersionSnapshot(rosterId, toVersion),
    ]);

    if (!fromResult.success || !fromResult.snapshot) {
      return { success: false, error: `Could not get snapshot for version ${fromVersion}` };
    }

    if (!toResult.success || !toResult.snapshot) {
      return { success: false, error: `Could not get snapshot for version ${toVersion}` };
    }

    const diff = calculateDiff(fromResult.snapshot, toResult.snapshot);

    return { success: true, diff };
  } catch (error) {
    console.error("Error calculating version diff:", error);
    return { success: false, error: "Failed to calculate version diff" };
  }
}

/**
 * Compare two rosters by their IDs (for version chain comparison)
 * This is the preferred method for comparing versions in a chain
 */
export async function compareRosterVersions(
  rosterIdA: string,
  rosterIdB: string
): Promise<{
  success: boolean;
  diff?: VersionDiff;
  error?: string;
}> {
  try {
    await requireAuth();

    // Get both rosters with their shifts
    const [rosterA, rosterB] = await Promise.all([
      prisma.roster.findUnique({
        where: { id: rosterIdA },
        include: {
          shifts: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
      prisma.roster.findUnique({
        where: { id: rosterIdB },
        include: {
          shifts: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      }),
    ]);

    if (!rosterA) {
      return { success: false, error: "Source roster not found" };
    }
    if (!rosterB) {
      return { success: false, error: "Target roster not found" };
    }

    // Convert shifts to snapshots
    const snapshotA: ShiftSnapshot[] = rosterA.shifts.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user
        ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email
        : null,
      date: shift.date.toISOString().split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      position: shift.position,
      notes: shift.notes,
    }));

    const snapshotB: ShiftSnapshot[] = rosterB.shifts.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user
        ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email
        : null,
      date: shift.date.toISOString().split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      position: shift.position,
      notes: shift.notes,
    }));

    const diff = calculateDiff(snapshotA, snapshotB);

    return { success: true, diff };
  } catch (error) {
    console.error("Error comparing roster versions:", error);
    return { success: false, error: "Failed to compare roster versions" };
  }
}

/**
 * Calculate differences between two shift snapshots
 */
function calculateDiff(before: ShiftSnapshot[], after: ShiftSnapshot[]): VersionDiff {
  const beforeMap = new Map(before.map((s) => [getShiftKey(s), s]));
  const afterMap = new Map(after.map((s) => [getShiftKey(s), s]));

  const added: ShiftSnapshot[] = [];
  const removed: ShiftSnapshot[] = [];
  const modified: VersionDiff["modified"] = [];
  const reassigned: VersionDiff["reassigned"] = [];
  const affectedUserIds = new Set<string>();

  // Find removed and modified
  for (const [key, beforeShift] of beforeMap) {
    const afterShift = afterMap.get(key);
    if (!afterShift) {
      removed.push(beforeShift);
      if (beforeShift.userId) affectedUserIds.add(beforeShift.userId);
    } else {
      const changes = compareShifts(beforeShift, afterShift);
      if (changes.length > 0) {
        modified.push({
          before: beforeShift,
          after: afterShift,
          changes,
        });
        if (afterShift.userId) affectedUserIds.add(afterShift.userId);
      }
    }
  }

  // Find added
  for (const [key, afterShift] of afterMap) {
    if (!beforeMap.has(key)) {
      added.push(afterShift);
      if (afterShift.userId) affectedUserIds.add(afterShift.userId);
    }
  }

  return {
    added,
    removed,
    modified,
    reassigned,
    summary: {
      totalChanges: added.length + removed.length + modified.length + reassigned.length,
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      reassignedCount: reassigned.length,
      affectedUsers: Array.from(affectedUserIds),
    },
  };
}

function getShiftKey(shift: ShiftSnapshot): string {
  return `${shift.userId || "unassigned"}-${shift.date}-${shift.startTime}`;
}

function compareShifts(before: ShiftSnapshot, after: ShiftSnapshot): string[] {
  const changes: string[] = [];

  if (before.endTime !== after.endTime) {
    changes.push(`End time: ${before.endTime} → ${after.endTime}`);
  }
  if (before.position !== after.position) {
    changes.push(`Position: ${before.position || "None"} → ${after.position || "None"}`);
  }
  if (before.notes !== after.notes) {
    changes.push("Notes updated");
  }
  if (before.userId !== after.userId) {
    changes.push(`Staff: ${before.userName || "Unassigned"} → ${after.userName || "Unassigned"}`);
  }

  return changes;
}

// ============================================================================
// CREATE VERSION SNAPSHOT
// ============================================================================

/**
 * Create a version snapshot before making changes
 * Called internally when modifying roster
 */
export async function createVersionSnapshot(
  rosterId: string,
  action: string,
  additionalChanges?: Record<string, unknown>
): Promise<{ success: boolean; version?: number; error?: string }> {
  try {
    const user = await requireAuth();

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        shifts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Create snapshot of current shifts
    const shiftsSnapshot: ShiftSnapshot[] = roster.shifts.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user
        ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email
        : null,
      date: shift.date.toISOString().split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      position: shift.position,
      notes: shift.notes,
    }));

    // Increment version and create history entry
    const newVersion = roster.revision + 1;

    await prisma.$transaction([
      prisma.roster.update({
        where: { id: rosterId },
        data: { revision: newVersion },
      }),
      prisma.rosterHistory.create({
        data: {
          rosterId,
          version: newVersion,
          action,
          changes: JSON.parse(JSON.stringify({
            ...additionalChanges,
            shiftsSnapshot,
            shiftCount: shiftsSnapshot.length,
          })),
          performedBy: user.id,
        },
      }),
    ]);

    return { success: true, version: newVersion };
  } catch (error) {
    console.error("Error creating version snapshot:", error);
    return { success: false, error: "Failed to create version snapshot" };
  }
}

// ============================================================================
// ROLLBACK TO VERSION
// ============================================================================

/**
 * Rollback roster to a previous version
 */
export async function rollbackToVersion(
  rosterId: string,
  targetVersion: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to modify rosters" };
    }

    // Get the roster
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Only draft rosters can be rolled back
    if (roster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only rollback draft rosters" };
    }

    // Get the target version snapshot
    const snapshotResult = await getVersionSnapshot(rosterId, targetVersion);
    if (!snapshotResult.success || !snapshotResult.snapshot) {
      return { success: false, error: snapshotResult.error || "Could not get version snapshot" };
    }

    // Create a snapshot of current state before rollback
    await createVersionSnapshot(rosterId, "ROLLBACK_STARTED", {
      rollingBackTo: targetVersion,
    });

    // Delete all current shifts and recreate from snapshot
    await prisma.$transaction(async (tx) => {
      // Delete current shifts
      await tx.rosterShift.deleteMany({
        where: { rosterId },
      });

      // Recreate shifts from snapshot
      for (const shift of snapshotResult.snapshot!) {
        await tx.rosterShift.create({
          data: {
            rosterId,
            userId: shift.userId,
            date: new Date(shift.date),
            startTime: shift.startTime,
            endTime: shift.endTime,
            position: shift.position,
            notes: shift.notes,
          },
        });
      }

      // Update roster version and create history
      await tx.roster.update({
        where: { id: rosterId },
        data: {
          revision: { increment: 1 },
        },
      });

      await tx.rosterHistory.create({
        data: {
          rosterId,
          version: roster.revision + 2, // +1 for rollback_started, +1 for rollback_complete
          action: "ROLLBACK_COMPLETE",
          changes: {
            rolledBackToVersion: targetVersion,
            restoredShifts: snapshotResult.snapshot!.length,
          },
          performedBy: user.id,
        },
      });
    });

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath(`/system/rosters/${rosterId}`);

    return { success: true };
  } catch (error) {
    console.error("Error rolling back version:", error);
    return { success: false, error: "Failed to rollback to version" };
  }
}

// ============================================================================
// REUPLOAD AND MERGE
// ============================================================================

export interface MergePreview {
  toAdd: ShiftSnapshot[];
  toRemove: ShiftSnapshot[];
  toUpdate: Array<{
    existing: ShiftSnapshot;
    incoming: ShiftSnapshot;
    changes: string[];
  }>;
  unchanged: ShiftSnapshot[];
  conflicts: Array<{
    existing: ShiftSnapshot;
    incoming: ShiftSnapshot;
    reason: string;
  }>;
  summary: {
    addCount: number;
    removeCount: number;
    updateCount: number;
    unchangedCount: number;
    conflictCount: number;
  };
}

/**
 * Preview what would happen if we merge new extracted shifts
 */
export async function previewMerge(
  rosterId: string,
  incomingShifts: ShiftSnapshot[]
): Promise<{
  success: boolean;
  preview?: MergePreview;
  error?: string;
}> {
  try {
    await requireAuth();

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        shifts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Get current shifts as snapshots
    const currentShifts: ShiftSnapshot[] = roster.shifts.map((shift) => ({
      id: shift.id,
      userId: shift.userId,
      userName: shift.user
        ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email
        : null,
      date: shift.date.toISOString().split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      position: shift.position,
      notes: shift.notes,
    }));

    // Calculate merge preview
    const preview = calculateMergePreview(currentShifts, incomingShifts);

    return { success: true, preview };
  } catch (error) {
    console.error("Error previewing merge:", error);
    return { success: false, error: "Failed to preview merge" };
  }
}

function calculateMergePreview(
  current: ShiftSnapshot[],
  incoming: ShiftSnapshot[]
): MergePreview {
  const currentMap = new Map(current.map((s) => [getShiftKey(s), s]));
  const incomingMap = new Map(incoming.map((s) => [getShiftKey(s), s]));

  const toAdd: ShiftSnapshot[] = [];
  const toRemove: ShiftSnapshot[] = [];
  const toUpdate: MergePreview["toUpdate"] = [];
  const unchanged: ShiftSnapshot[] = [];
  const conflicts: MergePreview["conflicts"] = [];

  // Check incoming shifts
  for (const [key, incomingShift] of incomingMap) {
    const existingShift = currentMap.get(key);
    if (!existingShift) {
      toAdd.push(incomingShift);
    } else {
      const changes = compareShifts(existingShift, incomingShift);
      if (changes.length > 0) {
        toUpdate.push({
          existing: existingShift,
          incoming: incomingShift,
          changes,
        });
      } else {
        unchanged.push(existingShift);
      }
    }
  }

  // Find shifts to remove (in current but not in incoming)
  for (const [key, existingShift] of currentMap) {
    if (!incomingMap.has(key)) {
      toRemove.push(existingShift);
    }
  }

  return {
    toAdd,
    toRemove,
    toUpdate,
    unchanged,
    conflicts,
    summary: {
      addCount: toAdd.length,
      removeCount: toRemove.length,
      updateCount: toUpdate.length,
      unchangedCount: unchanged.length,
      conflictCount: conflicts.length,
    },
  };
}

/**
 * Apply a merge after preview
 */
export async function applyMerge(
  rosterId: string,
  options: {
    addShifts: boolean;
    removeShifts: boolean;
    updateShifts: boolean;
    shiftsToAdd?: ShiftSnapshot[];
    shiftsToRemove?: string[]; // IDs
    shiftsToUpdate?: Array<{ id: string; updates: Partial<ShiftSnapshot> }>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to modify rosters" };
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    if (roster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only merge into draft rosters" };
    }

    // Create snapshot before merge
    await createVersionSnapshot(rosterId, "MERGE_STARTED", {
      mergeOptions: {
        addShifts: options.addShifts,
        removeShifts: options.removeShifts,
        updateShifts: options.updateShifts,
      },
    });

    await prisma.$transaction(async (tx) => {
      // Remove shifts
      if (options.removeShifts && options.shiftsToRemove?.length) {
        await tx.rosterShift.deleteMany({
          where: {
            id: { in: options.shiftsToRemove },
            rosterId,
          },
        });
      }

      // Add shifts
      if (options.addShifts && options.shiftsToAdd?.length) {
        for (const shift of options.shiftsToAdd) {
          await tx.rosterShift.create({
            data: {
              rosterId,
              userId: shift.userId,
              date: new Date(shift.date),
              startTime: shift.startTime,
              endTime: shift.endTime,
              position: shift.position,
              notes: shift.notes,
            },
          });
        }
      }

      // Update shifts
      if (options.updateShifts && options.shiftsToUpdate?.length) {
        for (const update of options.shiftsToUpdate) {
          await tx.rosterShift.update({
            where: { id: update.id },
            data: {
              ...(update.updates.userId !== undefined && { userId: update.updates.userId }),
              ...(update.updates.date && { date: new Date(update.updates.date) }),
              ...(update.updates.startTime && { startTime: update.updates.startTime }),
              ...(update.updates.endTime && { endTime: update.updates.endTime }),
              ...(update.updates.position !== undefined && { position: update.updates.position }),
              ...(update.updates.notes !== undefined && { notes: update.updates.notes }),
            },
          });
        }
      }

      // Update version
      await tx.roster.update({
        where: { id: rosterId },
        data: { revision: { increment: 1 } },
      });

      // Create completion history
      await tx.rosterHistory.create({
        data: {
          rosterId,
          version: roster.revision + 2,
          action: "MERGE_COMPLETE",
          changes: {
            added: options.shiftsToAdd?.length || 0,
            removed: options.shiftsToRemove?.length || 0,
            updated: options.shiftsToUpdate?.length || 0,
          },
          performedBy: user.id,
        },
      });
    });

    // Notify affected staff
    const affectedStaff = new Set<string>();
    if (options.shiftsToAdd) {
      options.shiftsToAdd.forEach((s) => s.userId && affectedStaff.add(s.userId));
    }

    for (const staffId of affectedStaff) {
      await createNotification({
        userId: staffId,
        type: NotificationType.ROSTER_UPDATED,
        title: "Roster Updated",
        message: "A roster you're assigned to has been updated. Please check your shifts.",
        link: `/my/rosters`,
      });
    }

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath(`/system/rosters/${rosterId}`);

    return { success: true };
  } catch (error) {
    console.error("Error applying merge:", error);
    return { success: false, error: "Failed to apply merge" };
  }
}

// ============================================================================
// RESTORE FROM VERSION CHAIN
// ============================================================================

/**
 * Restore a superseded version from the version chain
 * This creates a new draft version based on the selected superseded version
 * If there's an existing draft in the chain, it will be deleted
 */
export async function restoreFromVersion(sourceRosterId: string): Promise<{
  success: boolean;
  rosterId?: string;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "create");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to create rosters" };
    }

    // Get the source roster with all its shifts
    const sourceRoster = await prisma.roster.findUnique({
      where: { id: sourceRosterId },
      include: {
        shifts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        venue: true,
      },
    });

    if (!sourceRoster) {
      return { success: false, error: "Source roster not found" };
    }

    // Check that this roster is part of a chain and is superseded
    if (!sourceRoster.chainId) {
      return { success: false, error: "This roster is not part of a version chain" };
    }

    // Get all versions in the chain to determine the new version number
    const chainVersions = await prisma.roster.findMany({
      where: { chainId: sourceRoster.chainId },
      orderBy: { versionNumber: "desc" },
    });

    const maxVersionNumber = chainVersions[0]?.versionNumber || 1;
    const newVersionNumber = maxVersionNumber + 1;

    // Check if there's an existing draft in the chain - if so, delete it
    const existingDraft = chainVersions.find((v) => v.status === RosterStatus.DRAFT);

    // Perform the restore in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Delete existing draft if present
      if (existingDraft) {
        // Delete shifts first
        await tx.rosterShift.deleteMany({
          where: { rosterId: existingDraft.id },
        });
        // Delete history
        await tx.rosterHistory.deleteMany({
          where: { rosterId: existingDraft.id },
        });
        // Delete unmatched entries
        await tx.unmatchedRosterEntry.deleteMany({
          where: { rosterId: existingDraft.id },
        });
        // Delete the roster
        await tx.roster.delete({
          where: { id: existingDraft.id },
        });
      }

      // Create the new roster version
      const newRoster = await tx.roster.create({
        data: {
          name: `${sourceRoster.name} (Restored)`,
          description: `Restored from Version ${sourceRoster.versionNumber}`,
          venueId: sourceRoster.venueId,
          startDate: sourceRoster.startDate,
          endDate: sourceRoster.endDate,
          status: RosterStatus.DRAFT,
          chainId: sourceRoster.chainId,
          versionNumber: newVersionNumber,
          isActive: false, // Will become active when published
          revision: 1,
          createdBy: user.id,
        },
      });

      // Copy all shifts from source roster
      for (const shift of sourceRoster.shifts) {
        await tx.rosterShift.create({
          data: {
            rosterId: newRoster.id,
            userId: shift.userId,
            date: shift.date,
            startTime: shift.startTime,
            endTime: shift.endTime,
            position: shift.position,
            notes: shift.notes,
            hasConflict: false, // Reset conflict status
          },
        });
      }

      // Create shifts snapshot for version history comparison
      const shiftsSnapshot: ShiftSnapshot[] = sourceRoster.shifts.map((shift) => ({
        id: shift.id,
        userId: shift.userId,
        userName: shift.user
          ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim()
          : null,
        date: shift.date.toISOString().split("T")[0],
        startTime: shift.startTime,
        endTime: shift.endTime,
        position: shift.position,
        notes: shift.notes,
      }));

      // Create initial history entry with shifts snapshot
      await tx.rosterHistory.create({
        data: {
          rosterId: newRoster.id,
          version: 1,
          action: "RESTORED_FROM_VERSION",
          changes: JSON.parse(JSON.stringify({
            sourceRosterId: sourceRoster.id,
            sourceVersionNumber: sourceRoster.versionNumber,
            shiftsCopied: sourceRoster.shifts.length,
            replacedDraft: existingDraft?.id || null,
            shiftsSnapshot,
          })),
          performedBy: user.id,
        },
      });

      return newRoster;
    });

    revalidatePath("/manage/rosters");
    revalidatePath(`/manage/rosters/${result.id}`);
    revalidatePath(`/manage/rosters/${sourceRosterId}`);

    return { success: true, rosterId: result.id };
  } catch (error) {
    console.error("Error restoring from version:", error);
    return { success: false, error: "Failed to restore version" };
  }
}
