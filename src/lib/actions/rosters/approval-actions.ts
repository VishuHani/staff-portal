"use server";

/**
 * Roster Workflow Actions
 * Manager Self-Review Flow: DRAFT -> APPROVED (Finalized) -> PUBLISHED
 *
 * Managers have full control over their venue rosters without admin approval.
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { revalidatePath } from "next/cache";
import { RosterStatus, NotificationType } from "@prisma/client";
import { createNotification } from "@/lib/services/notifications";
import { format } from "date-fns";
import {
  compareRosterShifts,
  getChangesForUser,
  createUserChangeSummary,
  type ShiftForComparison,
} from "@/lib/utils/shift-diff";

// ============================================================================
// TYPES
// ============================================================================

export interface ApprovalResult {
  success: boolean;
  roster?: {
    id: string;
    status: RosterStatus;
  };
  error?: string;
  notifiedCount?: number; // Number of staff members notified when publishing
  conflictCount?: number; // Number of shifts with conflicts
  hasConflicts?: boolean; // Whether roster has any conflicts
}

export interface PendingApproval {
  id: string;
  name: string;
  description: string | null;
  venue: { id: string; name: string };
  startDate: Date;
  endDate: Date;
  submittedBy: { id: string; firstName: string | null; lastName: string | null; email: string };
  submittedAt: Date;
  shiftCount: number;
  staffCount: number;
  hasConflicts: boolean;
}

export interface ApprovalComment {
  id: string;
  rosterId: string;
  userId: string;
  user: { firstName: string | null; lastName: string | null; email: string };
  content: string;
  action: "SUBMITTED" | "APPROVED" | "REJECTED" | "COMMENT" | "FINALIZED" | "PUBLISHED" | "UNPUBLISHED" | "REVERTED_TO_DRAFT" | "SUBMITTED_FOR_REVIEW" | "RECALLED";
  createdAt: Date;
  revision?: number;
  previousStatus?: string;
  newStatus?: string;
}

// ============================================================================
// HELPER: Create Shifts Snapshot (for version history comparison)
// ============================================================================

interface ShiftSnapshot {
  id: string;
  userId: string | null;
  userName: string | null;
  date: string;
  startTime: string;
  endTime: string;
  position: string | null;
  notes: string | null;
}

async function createShiftsSnapshot(rosterId: string): Promise<ShiftSnapshot[]> {
  const shifts = await prisma.rosterShift.findMany({
    where: { rosterId },
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
  });

  return shifts.map((shift) => ({
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
}

// ============================================================================
// HELPER: Check Roster Access
// ============================================================================

async function checkRosterAccess(
  userId: string,
  userRole: string,
  roster: { venueId: string; createdBy: string }
): Promise<boolean> {
  // Admins have access to all rosters
  if (userRole === "ADMIN") return true;

  // Creator always has access
  if (roster.createdBy === userId) return true;

  // Managers need venue access
  if (userRole === "MANAGER") {
    const userVenues = await prisma.userVenue.findMany({
      where: { userId },
      select: { venueId: true },
    });
    return userVenues.some((v) => v.venueId === roster.venueId);
  }

  return false;
}

// ============================================================================
// FINALIZE ROSTER (DRAFT -> APPROVED)
// ============================================================================

/**
 * Finalize a draft roster - marks it as ready to publish
 * This is the manager's self-review step before publishing
 */
export async function finalizeRoster(
  rosterId: string,
  notes?: string
): Promise<ApprovalResult> {
  try {
    const user = await requireAuth();

    // Check permission
    const canManageRosters = await hasPermission(user.id, "rosters", "create");
    if (!canManageRosters) {
      return { success: false, error: "You don't have permission to manage rosters" };
    }

    // Get the roster
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        venue: { select: { id: true, name: true } },
        shifts: {
          where: { userId: { not: null } },
          select: { id: true, hasConflict: true },
        },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Check access
    const hasAccess = await checkRosterAccess(user.id, user.role.name, roster);
    if (!hasAccess) {
      return { success: false, error: "You don't have access to this roster" };
    }

    // Verify it's in DRAFT or PENDING_REVIEW status (legacy)
    if (roster.status !== RosterStatus.DRAFT && roster.status !== RosterStatus.PENDING_REVIEW) {
      return {
        success: false,
        error: `Roster is already ${roster.status.toLowerCase()}. Only draft rosters can be finalized.`,
      };
    }

    // Check if roster has any assigned shifts
    if (roster.shifts.length === 0) {
      return { success: false, error: "Cannot finalize a roster with no assigned shifts" };
    }

    // Warn about conflicts but allow finalization
    const hasConflicts = roster.shifts.some((s) => s.hasConflict);
    const conflictCount = roster.shifts.filter((s) => s.hasConflict).length;

    const previousStatus = roster.status;

    // Create shifts snapshot for version history comparison
    const shiftsSnapshot = await createShiftsSnapshot(rosterId);

    // Update roster status to APPROVED (finalized)
    const updatedRoster = await prisma.$transaction(async (tx) => {
      const updated = await tx.roster.update({
        where: { id: rosterId },
        data: {
          status: RosterStatus.APPROVED,
          revision: { increment: 1 },
        },
      });

      // Create history entry with shifts snapshot
      await tx.rosterHistory.create({
        data: {
          rosterId,
          version: updated.revision,
          action: "FINALIZED",
          changes: JSON.parse(JSON.stringify({
            notes: notes || undefined,
            finalizedBy: user.email,
            hasConflicts,
            conflictCount,
            shiftCount: roster.shifts.length,
            previousStatus,
            newStatus: RosterStatus.APPROVED,
            shiftsSnapshot,
          })),
          performedBy: user.id,
        },
      });

      return updated;
    });

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath(`/system/rosters/${rosterId}`);
    revalidatePath("/manage/rosters");
    revalidatePath("/system/rosters");

    return { 
      success: true, 
      roster: { id: updatedRoster.id, status: updatedRoster.status },
      hasConflicts,
      conflictCount,
    };
  } catch (error) {
    console.error("Error finalizing roster:", error);
    return { success: false, error: "Failed to finalize roster" };
  }
}

// ============================================================================
// PUBLISH ROSTER (APPROVED -> PUBLISHED)
// ============================================================================

/**
 * Publish a finalized roster - makes it visible to staff
 * Sends notifications to all staff members with assigned shifts
 */
export async function publishRoster(rosterId: string): Promise<ApprovalResult> {
  try {
    const user = await requireAuth();

    // Check permission
    const canPublish = await hasPermission(user.id, "rosters", "publish");
    if (!canPublish) {
      return { success: false, error: "You don't have permission to publish rosters" };
    }

    // Get the roster with shifts and assigned staff
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        venue: { select: { id: true, name: true } },
        shifts: {
          where: { userId: { not: null } },
          select: {
            id: true,
            userId: true,
            date: true,
            startTime: true,
            endTime: true,
          },
        },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Check access
    const hasAccess = await checkRosterAccess(user.id, user.role.name, roster);
    if (!hasAccess) {
      return { success: false, error: "You don't have access to this roster" };
    }

    // Verify it's in APPROVED status (finalized)
    if (roster.status !== RosterStatus.APPROVED) {
      if (roster.status === RosterStatus.DRAFT) {
        return { success: false, error: "Please finalize the roster before publishing" };
      }
      if (roster.status === RosterStatus.PUBLISHED) {
        return { success: false, error: "Roster is already published" };
      }
      return {
        success: false,
        error: `Cannot publish roster with status: ${roster.status}`,
      };
    }

    // Get unique staff IDs who have shifts
    const staffIds = [...new Set(roster.shifts.map((s) => s.userId).filter(Boolean))] as string[];

    // Create shifts snapshot for version history comparison
    const shiftsSnapshot = await createShiftsSnapshot(rosterId);

    // Check if this is part of a version chain
    const rosterWithChain = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { parentId: true, chainId: true },
    });
    const hasParent = !!rosterWithChain?.parentId;
    const chainId = rosterWithChain?.chainId;

    // Update roster status to PUBLISHED
    const updatedRoster = await prisma.$transaction(async (tx) => {
      // If this roster is in a chain, mark ALL other active versions in the chain as superseded
      if (chainId) {
        // Find all currently active rosters in this chain (excluding the one being published)
        const activeRostersInChain = await tx.roster.findMany({
          where: {
            chainId,
            id: { not: rosterId },
            isActive: true,
          },
          select: { id: true },
        });

        // Mark them all as inactive (superseded)
        if (activeRostersInChain.length > 0) {
          await tx.roster.updateMany({
            where: {
              id: { in: activeRostersInChain.map(r => r.id) },
            },
            data: {
              isActive: false,
            },
          });

          // Create history entries for each superseded version
          for (const oldRoster of activeRostersInChain) {
            await tx.rosterHistory.create({
              data: {
                rosterId: oldRoster.id,
                version: 1,
                action: "SUPERSEDED_BY_NEW_VERSION",
                changes: {
                  replacedBy: rosterId,
                  supersededBy: user.email,
                },
                performedBy: user.id,
              },
            });
          }
        }
      }

      // If this roster has a direct parent, archive it (not just supersede)
      if (hasParent && rosterWithChain.parentId) {
        await tx.roster.update({
          where: { id: rosterWithChain.parentId },
          data: {
            status: RosterStatus.ARCHIVED,
            isActive: false,
          },
        });

        await tx.rosterHistory.create({
          data: {
            rosterId: rosterWithChain.parentId,
            version: 1,
            action: "ARCHIVED_BY_NEW_VERSION",
            changes: {
              replacedBy: rosterId,
              archivedBy: user.email,
            },
            performedBy: user.id,
          },
        });
      }

      // Publish the new roster
      const updated = await tx.roster.update({
        where: { id: rosterId },
        data: {
          status: RosterStatus.PUBLISHED,
          publishedAt: new Date(),
          publishedBy: user.id,
          revision: { increment: 1 },
          isActive: true,
        },
      });

      // Create history entry with shifts snapshot
      await tx.rosterHistory.create({
        data: {
          rosterId,
          version: updated.revision,
          action: hasParent ? "PUBLISHED_AS_NEW_VERSION" : "PUBLISHED",
          changes: JSON.parse(JSON.stringify({
            publishedBy: user.email,
            staffNotified: staffIds.length,
            shiftCount: roster.shifts.length,
            previousStatus: roster.status,
            newStatus: RosterStatus.PUBLISHED,
            shiftsSnapshot,
            ...(hasParent ? { replacedVersion: rosterWithChain.parentId } : {}),
          })),
          performedBy: user.id,
        },
      });

      return updated;
    });

    // Notify staff members with shifts
    const dateRange = `${format(roster.startDate, "MMM d")} - ${format(roster.endDate, "MMM d, yyyy")}`;

    // For new versions, use granular change detection
    if (hasParent && rosterWithChain?.parentId) {
      // Fetch parent roster's shifts for comparison
      const parentRoster = await prisma.roster.findUnique({
        where: { id: rosterWithChain.parentId },
        include: {
          shifts: {
            select: {
              id: true,
              userId: true,
              date: true,
              startTime: true,
              endTime: true,
              breakMinutes: true,
              position: true,
              user: {
                select: { id: true, firstName: true, lastName: true, email: true },
              },
            },
          },
        },
      });

      // Fetch new roster's shifts with user details
      const newRosterShifts = await prisma.rosterShift.findMany({
        where: { rosterId },
        select: {
          id: true,
          userId: true,
          date: true,
          startTime: true,
          endTime: true,
          breakMinutes: true,
          position: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      const oldShifts: ShiftForComparison[] = parentRoster?.shifts || [];
      const newShifts: ShiftForComparison[] = newRosterShifts;

      // Compare shifts
      const diff = compareRosterShifts(oldShifts, newShifts);

      // Send granular notifications to affected users
      for (const userId of diff.summary.affectedUsers) {
        const userChanges = getChangesForUser(diff, userId);
        if (userChanges.length === 0) continue;

        const message = createUserChangeSummary(
          userChanges,
          userId,
          roster.venue.name,
          dateRange
        );

        await createNotification({
          userId,
          type: NotificationType.ROSTER_PUBLISHED,
          title: "Roster Updated",
          message,
          link: "/my/rosters",
        });
      }

      // Also notify staff who weren't affected but still have shifts
      const notifiedUsers = new Set(diff.summary.affectedUsers);
      for (const staffId of staffIds) {
        if (notifiedUsers.has(staffId)) continue;
        const staffShiftCount = roster.shifts.filter((s) => s.userId === staffId).length;
        await createNotification({
          userId: staffId,
          type: NotificationType.ROSTER_PUBLISHED,
          title: "Roster Republished",
          message: `The roster for ${roster.venue.name} (${dateRange}) has been updated. Your ${staffShiftCount} shift${staffShiftCount > 1 ? "s remain" : " remains"} unchanged.`,
          link: "/my/rosters",
        });
      }
    } else {
      // Standard notifications for new rosters
      for (const staffId of staffIds) {
        const staffShiftCount = roster.shifts.filter((s) => s.userId === staffId).length;
        await createNotification({
          userId: staffId,
          type: NotificationType.ROSTER_PUBLISHED,
          title: "New Shifts Published",
          message: `You have ${staffShiftCount} shift${staffShiftCount > 1 ? "s" : ""} scheduled at ${roster.venue.name} for ${dateRange}.`,
          link: "/my/rosters",
        });
      }
    }

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath(`/system/rosters/${rosterId}`);
    revalidatePath("/manage/rosters");
    revalidatePath("/system/rosters");
    revalidatePath("/my/rosters");

    return { 
      success: true, 
      roster: { id: updatedRoster.id, status: updatedRoster.status },
      notifiedCount: staffIds.length,
    };
  } catch (error) {
    console.error("Error publishing roster:", error);
    return { success: false, error: "Failed to publish roster" };
  }
}

// ============================================================================
// UNPUBLISH / REVERT TO DRAFT
// ============================================================================

/**
 * Revert a roster back to draft status
 * Can be used to unpublish or cancel finalization
 */
export async function revertToDraft(
  rosterId: string,
  reason?: string
): Promise<ApprovalResult> {
  try {
    const user = await requireAuth();

    // Check permission
    const canManageRosters = await hasPermission(user.id, "rosters", "edit");
    if (!canManageRosters) {
      return { success: false, error: "You don't have permission to manage rosters" };
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        venue: { select: { name: true } },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Check access
    const hasAccess = await checkRosterAccess(user.id, user.role.name, roster);
    if (!hasAccess) {
      return { success: false, error: "You don't have access to this roster" };
    }

    // Can revert from APPROVED or PUBLISHED
    if (roster.status === RosterStatus.DRAFT) {
      return { success: false, error: "Roster is already a draft" };
    }

    if (roster.status === RosterStatus.ARCHIVED) {
      return { success: false, error: "Cannot revert an archived roster" };
    }

    const previousStatus = roster.status;

    // Create shifts snapshot for version history comparison
    const shiftsSnapshot = await createShiftsSnapshot(rosterId);

    // Update roster status back to DRAFT
    const updatedRoster = await prisma.$transaction(async (tx) => {
      const updated = await tx.roster.update({
        where: { id: rosterId },
        data: {
          status: RosterStatus.DRAFT,
          revision: { increment: 1 },
        },
      });

      // Create history entry with shifts snapshot
      await tx.rosterHistory.create({
        data: {
          rosterId,
          version: updated.revision,
          action: previousStatus === RosterStatus.PUBLISHED ? "UNPUBLISHED" : "REVERTED_TO_DRAFT",
          changes: JSON.parse(JSON.stringify({
            reason: reason || undefined,
            revertedBy: user.email,
            previousStatus,
            newStatus: RosterStatus.DRAFT,
            shiftsSnapshot,
          })),
          performedBy: user.id,
        },
      });

      return updated;
    });

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath(`/system/rosters/${rosterId}`);
    revalidatePath("/manage/rosters");
    revalidatePath("/system/rosters");
    revalidatePath("/my/rosters");

    return { success: true, roster: { id: updatedRoster.id, status: updatedRoster.status } };
  } catch (error) {
    console.error("Error reverting roster to draft:", error);
    return { success: false, error: "Failed to revert roster to draft" };
  }
}

// ============================================================================
// LEGACY FUNCTIONS (For backwards compatibility)
// ============================================================================

/**
 * @deprecated Use finalizeRoster instead
 */
export async function submitForReview(
  rosterId: string,
  comments?: string
): Promise<ApprovalResult> {
  // Redirect to new workflow - finalize directly
  return finalizeRoster(rosterId, comments);
}

/**
 * @deprecated Approval is no longer required - use finalizeRoster + publishRoster
 */
export async function approveRoster(
  rosterId: string,
  comments?: string
): Promise<ApprovalResult> {
  // Just finalize if in draft, otherwise succeed silently
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { status: true },
  });

  if (roster?.status === RosterStatus.DRAFT) {
    return finalizeRoster(rosterId, comments);
  }

  return {
    success: true,
    roster: { id: rosterId, status: roster?.status || RosterStatus.APPROVED }
  };
}

/**
 * @deprecated Use revertToDraft instead
 */
export async function rejectRoster(
  rosterId: string,
  reason: string
): Promise<ApprovalResult> {
  return revertToDraft(rosterId, reason);
}

/**
 * @deprecated Use revertToDraft instead
 */
export async function recallSubmission(rosterId: string): Promise<ApprovalResult> {
  return revertToDraft(rosterId, "Recalled by user");
}

// ============================================================================
// QUERIES
// ============================================================================

/**
 * Get all finalized rosters ready to publish (for dashboard)
 */
export async function getFinalizedRosters(): Promise<{
  success: boolean;
  rosters?: PendingApproval[];
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Build venue filter for managers
    let venueFilter = {};
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      venueFilter = { venueId: { in: userVenues.map((v) => v.venueId) } };
    }

    const rosters = await prisma.roster.findMany({
      where: {
        status: RosterStatus.APPROVED,
        ...venueFilter,
      },
      include: {
        venue: { select: { id: true, name: true } },
        createdByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        shifts: {
          where: { userId: { not: null } },
          select: { userId: true, hasConflict: true },
        },
        history: {
          where: { action: "FINALIZED" },
          orderBy: { performedAt: "desc" },
          take: 1,
          select: { performedAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
    });

    const result: PendingApproval[] = rosters.map((roster) => {
      const uniqueStaffIds = new Set(roster.shifts.map((s) => s.userId).filter(Boolean));
      const hasConflicts = roster.shifts.some((s) => s.hasConflict);
      const submittedAt = roster.history[0]?.performedAt || roster.updatedAt;

      return {
        id: roster.id,
        name: roster.name,
        description: roster.description,
        venue: roster.venue,
        startDate: roster.startDate,
        endDate: roster.endDate,
        submittedBy: roster.createdByUser,
        submittedAt,
        shiftCount: roster.shifts.length,
        staffCount: uniqueStaffIds.size,
        hasConflicts,
      };
    });

    return { success: true, rosters: result };
  } catch (error) {
    console.error("Error fetching finalized rosters:", error);
    return { success: false, error: "Failed to fetch finalized rosters" };
  }
}

/**
 * @deprecated Use getFinalizedRosters instead
 */
export async function getPendingApprovals(): Promise<{
  success: boolean;
  approvals?: PendingApproval[];
  error?: string;
}> {
  const result = await getFinalizedRosters();
  return {
    success: result.success,
    approvals: result.rosters,
    error: result.error,
  };
}

/**
 * Get approval/workflow history for a roster
 */
export async function getApprovalHistory(rosterId: string): Promise<{
  success: boolean;
  history?: ApprovalComment[];
  error?: string;
}> {
  try {
    await requireAuth();

    const historyEntries = await prisma.rosterHistory.findMany({
      where: {
        rosterId,
        action: {
          in: [
            "SUBMITTED_FOR_REVIEW",
            "APPROVED",
            "REJECTED",
            "RECALLED",
            "FINALIZED",
            "PUBLISHED",
            "PUBLISHED_AS_NEW_VERSION",
            "UNPUBLISHED",
            "REVERTED_TO_DRAFT",
            "RESTORED_FROM_VERSION",
          ],
        },
      },
      include: {
        performedByUser: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { performedAt: "desc" },
    });

    const history: ApprovalComment[] = historyEntries.map((entry) => {
      const changes = entry.changes as Record<string, unknown> | null;
      let content = "";

      switch (entry.action) {
        case "FINALIZED":
          content = changes?.notes
            ? `Finalized: ${changes.notes}`
            : "Roster finalized and ready to publish";
          break;
        case "PUBLISHED":
          content = `Published - ${changes?.staffNotified || 0} staff notified`;
          break;
        case "PUBLISHED_AS_NEW_VERSION":
          content = `Published as new version - ${changes?.staffNotified || 0} staff notified`;
          break;
        case "UNPUBLISHED":
          content = changes?.reason
            ? `Unpublished: ${changes.reason}`
            : "Roster unpublished";
          break;
        case "REVERTED_TO_DRAFT":
          content = changes?.reason
            ? `Reverted to draft: ${changes.reason}`
            : "Reverted to draft";
          break;
        case "RESTORED_FROM_VERSION":
          content = changes?.sourceVersionNumber
            ? `Restored from Version ${changes.sourceVersionNumber}`
            : "Restored from previous version";
          break;
        // Legacy actions
        case "SUBMITTED_FOR_REVIEW":
          content = changes?.comments
            ? `Submitted for review: ${changes.comments}`
            : "Submitted for review";
          break;
        case "APPROVED":
          content = changes?.comments
            ? `Approved: ${changes.comments}`
            : "Approved";
          break;
        case "REJECTED":
          content = changes?.reason
            ? `Rejected: ${changes.reason}`
            : "Rejected";
          break;
        case "RECALLED":
          content = "Recalled submission";
          break;
        default:
          content = entry.action;
      }

      // Extract status transition from changes if available
      const previousStatus = changes?.previousStatus as string | undefined;
      const newStatus = changes?.newStatus as string | undefined;

      return {
        id: entry.id,
        rosterId: entry.rosterId,
        userId: entry.performedBy,
        user: entry.performedByUser,
        content,
        action: entry.action as ApprovalComment["action"],
        createdAt: entry.performedAt,
        revision: entry.version,
        previousStatus,
        newStatus,
      };
    });

    return { success: true, history };
  } catch (error) {
    console.error("Error fetching approval history:", error);
    return { success: false, error: "Failed to fetch approval history" };
  }
}

/**
 * Get count of finalized rosters ready to publish
 */
export async function getPendingApprovalsCount(): Promise<{
  success: boolean;
  count?: number;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Build venue filter for managers
    let venueFilter = {};
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      venueFilter = { venueId: { in: userVenues.map((v) => v.venueId) } };
    }

    const count = await prisma.roster.count({
      where: {
        status: RosterStatus.APPROVED,
        ...venueFilter,
      },
    });

    return { success: true, count };
  } catch (error) {
    console.error("Error counting finalized rosters:", error);
    return { success: false, error: "Failed to count finalized rosters" };
  }
}
