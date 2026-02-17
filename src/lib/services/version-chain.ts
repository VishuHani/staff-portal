/**
 * Version Chain Service
 *
 * Unified version management for rosters. All versions of a roster
 * for the same venue/week belong to a single "version chain".
 *
 * Key concepts:
 * - chainId: Deterministic ID that groups versions together
 * - versionNumber: Position in chain (1, 2, 3...)
 * - isActive: The current live version in the chain
 * - revision: Internal edit counter for audit trail
 */

import { prisma } from "@/lib/prisma";
import { RosterStatus } from "@prisma/client";
import { createHash } from "crypto";
import { format, startOfWeek } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export interface VersionInfo {
  rosterId: string;
  name: string;
  versionNumber: number;
  status: RosterStatus;
  isActive: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  shiftCount: number;
  createdBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface VersionChain {
  chainId: string;
  venueId: string;
  venueName: string;
  weekStart: Date;
  weekEnd: Date;
  versions: VersionInfo[];
  activeVersion: VersionInfo | null;
  totalVersions: number;
}

export interface ShiftSnapshot {
  id: string;
  userId: string | null;
  userName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
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
// CHAIN ID GENERATION
// ============================================================================

/**
 * Generate a deterministic chainId for a venue/week combination.
 * Same venue + week will always produce the same chainId.
 */
export function generateChainId(venueId: string, weekStart: Date): string {
  // Normalize to start of week (Monday)
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });
  const weekKey = format(normalizedWeekStart, "yyyy-MM-dd");

  // Create deterministic hash
  const hash = createHash("sha256")
    .update(`roster-chain:${venueId}:${weekKey}`)
    .digest("hex")
    .substring(0, 24);

  return `chain_${hash}`;
}

/**
 * Get or generate chainId for a roster based on its venue and dates.
 */
export function getChainIdForRoster(venueId: string, startDate: Date): string {
  return generateChainId(venueId, startDate);
}

// ============================================================================
// VERSION CHAIN QUERIES
// ============================================================================

/**
 * Get the full version chain for a given chainId.
 */
export async function getVersionChain(
  chainId: string
): Promise<VersionChain | null> {
  const rosters = await prisma.roster.findMany({
    where: { chainId },
    include: {
      venue: { select: { id: true, name: true } },
      createdByUser: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { shifts: true } },
    },
    orderBy: { versionNumber: "asc" },
  });

  if (rosters.length === 0) {
    return null;
  }

  const versions: VersionInfo[] = rosters.map((r) => ({
    rosterId: r.id,
    name: r.name,
    versionNumber: r.versionNumber,
    status: r.status,
    isActive: r.isActive,
    publishedAt: r.publishedAt,
    createdAt: r.createdAt,
    shiftCount: r._count.shifts,
    createdBy: r.createdByUser,
  }));

  const activeVersion = versions.find((v) => v.isActive) || null;
  const firstRoster = rosters[0];

  return {
    chainId,
    venueId: firstRoster.venueId,
    venueName: firstRoster.venue.name,
    weekStart: firstRoster.startDate,
    weekEnd: firstRoster.endDate,
    versions,
    activeVersion,
    totalVersions: versions.length,
  };
}

/**
 * Get the version chain for a specific roster.
 */
export async function getChainForRoster(
  rosterId: string
): Promise<VersionChain | null> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { chainId: true },
  });

  if (!roster?.chainId) {
    return null;
  }

  return getVersionChain(roster.chainId);
}

/**
 * Get all version chains for a venue, optionally filtered by date range.
 */
export async function getVersionChainsForVenue(
  venueId: string,
  options?: {
    startDate?: Date;
    endDate?: Date;
    includeArchived?: boolean;
  }
): Promise<VersionChain[]> {
  const where: {
    venueId: string;
    chainId: { not: null };
    startDate?: { gte: Date };
    endDate?: { lte: Date };
  } = {
    venueId,
    chainId: { not: null },
  };

  if (options?.startDate) {
    where.startDate = { gte: options.startDate };
  }

  if (options?.endDate) {
    where.endDate = { lte: options.endDate };
  }

  // Get unique chainIds
  const rosters = await prisma.roster.findMany({
    where,
    select: { chainId: true },
    distinct: ["chainId"],
  });

  const chainIds = rosters
    .map((r) => r.chainId)
    .filter((id): id is string => id !== null);

  // Fetch all chains in parallel
  const chains = await Promise.all(chainIds.map((id) => getVersionChain(id)));

  return chains.filter((c): c is VersionChain => c !== null);
}

// ============================================================================
// VERSION MANAGEMENT
// ============================================================================

/**
 * Get the next version number for a chain.
 */
export async function getNextVersionNumber(chainId: string): Promise<number> {
  const result = await prisma.roster.aggregate({
    where: { chainId },
    _max: { versionNumber: true },
  });

  return (result._max.versionNumber || 0) + 1;
}

/**
 * Create a new version in an existing chain.
 * Returns the new roster ID and version number.
 */
export async function createNewVersion(
  sourceRosterId: string,
  options: {
    name?: string;
    createdBy: string;
  }
): Promise<{
  success: boolean;
  rosterId?: string;
  versionNumber?: number;
  chainId?: string;
  error?: string;
}> {
  try {
    // Get source roster with all data
    const sourceRoster = await prisma.roster.findUnique({
      where: { id: sourceRosterId },
      include: {
        venue: true,
        shifts: true,
        unmatchedEntries: true,
      },
    });

    if (!sourceRoster) {
      return { success: false, error: "Source roster not found" };
    }

    // Only published rosters can have new versions created
    if (sourceRoster.status !== RosterStatus.PUBLISHED) {
      return {
        success: false,
        error: "Can only create new versions of published rosters",
      };
    }

    // Determine chainId - use existing or generate new
    const chainId =
      sourceRoster.chainId ||
      generateChainId(sourceRoster.venueId, sourceRoster.startDate);

    // If source doesn't have chainId, update it first
    if (!sourceRoster.chainId) {
      await prisma.roster.update({
        where: { id: sourceRosterId },
        data: { chainId, versionNumber: 1 },
      });
    }

    // Get next version number
    const nextVersionNumber = await getNextVersionNumber(chainId);

    // Create the new roster version
    const newRoster = await prisma.roster.create({
      data: {
        name: options.name || `${sourceRoster.name} v${nextVersionNumber}`,
        description: sourceRoster.description,
        venueId: sourceRoster.venueId,
        startDate: sourceRoster.startDate,
        endDate: sourceRoster.endDate,
        status: RosterStatus.DRAFT,
        chainId,
        versionNumber: nextVersionNumber,
        revision: 1,
        isActive: false, // Will become active when published
        createdBy: options.createdBy,
        sourceFileUrl: sourceRoster.sourceFileUrl,
        sourceFileName: sourceRoster.sourceFileName,
        sourceFileType: sourceRoster.sourceFileType,
        // Keep parentId for backwards compatibility during migration
        parentId: sourceRosterId,
      },
    });

    // Copy all shifts
    if (sourceRoster.shifts.length > 0) {
      await prisma.rosterShift.createMany({
        data: sourceRoster.shifts.map((shift) => ({
          rosterId: newRoster.id,
          userId: shift.userId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          position: shift.position,
          notes: shift.notes,
          originalName: shift.originalName,
          hasConflict: false,
          conflictType: null,
        })),
      });
    }

    // Copy unmatched entries
    if (sourceRoster.unmatchedEntries.length > 0) {
      await prisma.unmatchedRosterEntry.createMany({
        data: sourceRoster.unmatchedEntries.map((entry) => ({
          rosterId: newRoster.id,
          originalName: entry.originalName,
          suggestedUserId: entry.suggestedUserId,
          confidence: entry.confidence,
          resolved: entry.resolved,
          resolvedUserId: entry.resolvedUserId,
        })),
      });
    }

    // Create audit entry
    await prisma.rosterHistory.create({
      data: {
        rosterId: newRoster.id,
        chainId,
        version: 1,
        action: "VERSION_CREATED",
        changes: {
          sourceRosterId,
          sourceVersionNumber: sourceRoster.versionNumber || 1,
          newVersionNumber: nextVersionNumber,
        },
        metadata: {
          sourceName: sourceRoster.name,
          shiftsCount: sourceRoster.shifts.length,
        },
        performedBy: options.createdBy,
      },
    });

    return {
      success: true,
      rosterId: newRoster.id,
      versionNumber: nextVersionNumber,
      chainId,
    };
  } catch (error) {
    console.error("Error creating new version:", error);
    return { success: false, error: "Failed to create new version" };
  }
}

/**
 * Activate a version (called when publishing).
 * Deactivates all other versions in the chain.
 */
export async function activateVersion(
  rosterId: string,
  performedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { chainId: true, versionNumber: true, name: true },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // If no chainId, just activate this roster
    if (!roster.chainId) {
      await prisma.roster.update({
        where: { id: rosterId },
        data: { isActive: true },
      });
      return { success: true };
    }

    // Deactivate all versions in chain, then activate this one
    await prisma.$transaction([
      // Deactivate all versions
      prisma.roster.updateMany({
        where: { chainId: roster.chainId },
        data: { isActive: false },
      }),
      // Activate this version
      prisma.roster.update({
        where: { id: rosterId },
        data: { isActive: true },
      }),
    ]);

    // Create audit entries for superseded versions
    const supersededVersions = await prisma.roster.findMany({
      where: {
        chainId: roster.chainId,
        id: { not: rosterId },
        status: RosterStatus.PUBLISHED,
      },
      select: { id: true, versionNumber: true },
    });

    for (const superseded of supersededVersions) {
      await prisma.rosterHistory.create({
        data: {
          rosterId: superseded.id,
          chainId: roster.chainId,
          version: superseded.versionNumber,
          action: "VERSION_SUPERSEDED",
          changes: {
            supersededBy: rosterId,
            supersededByVersion: roster.versionNumber,
          },
          performedBy,
        },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error activating version:", error);
    return { success: false, error: "Failed to activate version" };
  }
}

// ============================================================================
// VERSION COMPARISON
// ============================================================================

/**
 * Get shift snapshot for a roster.
 */
export async function getShiftSnapshot(
  rosterId: string
): Promise<ShiftSnapshot[]> {
  const shifts = await prisma.rosterShift.findMany({
    where: { rosterId },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return shifts.map((shift) => ({
    id: shift.id,
    userId: shift.userId,
    userName: shift.user
      ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() ||
        shift.user.email
      : null,
    date: shift.date.toISOString().split("T")[0],
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    position: shift.position,
    notes: shift.notes,
  }));
}

/**
 * Compare two roster versions and return detailed diff.
 */
export async function compareVersions(
  rosterIdA: string,
  rosterIdB: string
): Promise<{ success: boolean; diff?: VersionDiff; error?: string }> {
  try {
    const [snapshotA, snapshotB] = await Promise.all([
      getShiftSnapshot(rosterIdA),
      getShiftSnapshot(rosterIdB),
    ]);

    const diff = calculateVersionDiff(snapshotA, snapshotB);

    return { success: true, diff };
  } catch (error) {
    console.error("Error comparing versions:", error);
    return { success: false, error: "Failed to compare versions" };
  }
}

/**
 * Calculate diff between two shift snapshots.
 */
function calculateVersionDiff(
  before: ShiftSnapshot[],
  after: ShiftSnapshot[]
): VersionDiff {
  // Create maps for efficient lookup
  // Key: date + startTime + position (core identity of a shift slot)
  const getShiftSlotKey = (s: ShiftSnapshot) =>
    `${s.date}|${s.startTime}|${s.position || ""}`;

  const beforeBySlot = new Map<string, ShiftSnapshot>();
  const afterBySlot = new Map<string, ShiftSnapshot>();

  before.forEach((s) => beforeBySlot.set(getShiftSlotKey(s), s));
  after.forEach((s) => afterBySlot.set(getShiftSlotKey(s), s));

  const added: ShiftSnapshot[] = [];
  const removed: ShiftSnapshot[] = [];
  const modified: VersionDiff["modified"] = [];
  const reassigned: VersionDiff["reassigned"] = [];
  const affectedUserIds = new Set<string>();

  // Find added and modified
  for (const [key, afterShift] of afterBySlot) {
    const beforeShift = beforeBySlot.get(key);

    if (!beforeShift) {
      // New shift
      added.push(afterShift);
      if (afterShift.userId) affectedUserIds.add(afterShift.userId);
    } else {
      // Check for modifications
      const changes: string[] = [];

      if (beforeShift.endTime !== afterShift.endTime) {
        changes.push(`End time: ${beforeShift.endTime} → ${afterShift.endTime}`);
      }
      if (beforeShift.breakMinutes !== afterShift.breakMinutes) {
        changes.push(
          `Break: ${beforeShift.breakMinutes}min → ${afterShift.breakMinutes}min`
        );
      }
      if (beforeShift.notes !== afterShift.notes) {
        changes.push("Notes updated");
      }

      // Check for reassignment
      if (beforeShift.userId !== afterShift.userId) {
        reassigned.push({
          shift: afterShift,
          previousUser: beforeShift.userName,
          newUser: afterShift.userName,
        });
        if (beforeShift.userId) affectedUserIds.add(beforeShift.userId);
        if (afterShift.userId) affectedUserIds.add(afterShift.userId);
      }

      if (changes.length > 0) {
        modified.push({ before: beforeShift, after: afterShift, changes });
        if (afterShift.userId) affectedUserIds.add(afterShift.userId);
      }
    }
  }

  // Find removed
  for (const [key, beforeShift] of beforeBySlot) {
    if (!afterBySlot.has(key)) {
      removed.push(beforeShift);
      if (beforeShift.userId) affectedUserIds.add(beforeShift.userId);
    }
  }

  return {
    added,
    removed,
    modified,
    reassigned,
    summary: {
      totalChanges:
        added.length + removed.length + modified.length + reassigned.length,
      addedCount: added.length,
      removedCount: removed.length,
      modifiedCount: modified.length,
      reassignedCount: reassigned.length,
      affectedUsers: Array.from(affectedUserIds),
    },
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if a roster is part of a version chain.
 */
export async function isPartOfChain(rosterId: string): Promise<boolean> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { chainId: true },
  });

  return !!roster?.chainId;
}

/**
 * Get the active version for a chain (if any).
 */
export async function getActiveVersion(
  chainId: string
): Promise<{
  rosterId: string;
  versionNumber: number;
  status: RosterStatus;
} | null> {
  const active = await prisma.roster.findFirst({
    where: { chainId, isActive: true },
    select: { id: true, versionNumber: true, status: true },
  });

  if (!active) return null;

  return {
    rosterId: active.id,
    versionNumber: active.versionNumber,
    status: active.status,
  };
}

/**
 * Check if there's a draft version in progress for a chain.
 */
export async function hasDraftVersion(chainId: string): Promise<boolean> {
  const draft = await prisma.roster.findFirst({
    where: { chainId, status: RosterStatus.DRAFT },
    select: { id: true },
  });

  return !!draft;
}

/**
 * Get version chain summary for display in lists.
 */
export async function getChainSummary(chainId: string): Promise<{
  chainId: string;
  totalVersions: number;
  activeVersionNumber: number | null;
  hasDraft: boolean;
  latestVersionNumber: number;
} | null> {
  const rosters = await prisma.roster.findMany({
    where: { chainId },
    select: {
      versionNumber: true,
      status: true,
      isActive: true,
    },
    orderBy: { versionNumber: "desc" },
  });

  if (rosters.length === 0) return null;

  const activeRoster = rosters.find((r) => r.isActive);
  const hasDraft = rosters.some((r) => r.status === RosterStatus.DRAFT);

  return {
    chainId,
    totalVersions: rosters.length,
    activeVersionNumber: activeRoster?.versionNumber || null,
    hasDraft,
    latestVersionNumber: rosters[0].versionNumber,
  };
}
