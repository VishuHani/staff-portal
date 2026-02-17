"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { revalidatePath } from "next/cache";
import { RosterStatus } from "@prisma/client";
import { createNotification } from "@/lib/services/notifications";
import { NotificationType } from "@prisma/client";
import {
  generateChainId,
  createNewVersion,
  activateVersion,
} from "@/lib/services/version-chain";
import { recordAudit } from "@/lib/services/roster-audit";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { getAuditContext } from "@/lib/utils/audit-helpers";

// Types
export interface CreateRosterInput {
  name: string;
  description?: string;
  venueId: string;
  startDate: Date;
  endDate: Date;
}

export interface UpdateRosterInput {
  name?: string;
  description?: string;
  startDate?: Date;
  endDate?: Date;
}

// Create a new roster
export async function createRoster(data: CreateRosterInput) {
  try {
    const user = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("rosters", "create");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to create rosters" };
    }

    // Validate venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(data.venueId)) {
        return { success: false, error: "You don't have access to this venue" };
      }
    }

    // Generate chainId for this venue/week combination
    const chainId = generateChainId(data.venueId, data.startDate);

    // Check if there's already a roster in this chain
    const existingInChain = await prisma.roster.findFirst({
      where: { chainId, status: { not: RosterStatus.ARCHIVED } },
    });

    const roster = await prisma.roster.create({
      data: {
        name: data.name,
        description: data.description,
        venueId: data.venueId,
        startDate: data.startDate,
        endDate: data.endDate,
        status: RosterStatus.DRAFT,
        createdBy: user.id,
        // Version chain fields
        chainId,
        versionNumber: existingInChain ? existingInChain.versionNumber + 1 : 1,
        revision: 1,
        isActive: false, // Will become active when published
      },
      include: {
        venue: { select: { id: true, name: true } },
      },
    });

    // Create audit entry
    await prisma.rosterHistory.create({
      data: {
        rosterId: roster.id,
        chainId,
        version: 1,
        action: existingInChain ? "VERSION_CREATED" : "ROSTER_CREATED",
        changes: {
          name: data.name,
          venueId: data.venueId,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
        },
        metadata: {
          versionNumber: roster.versionNumber,
          isFirstInChain: !existingInChain,
        },
        performedBy: user.id,
      },
    });

    // General audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "ROSTER_CREATED",
      resourceType: "Roster",
      resourceId: roster.id,
      newValue: JSON.stringify({
        name: roster.name,
        venueId: roster.venueId,
        startDate: roster.startDate,
        endDate: roster.endDate,
        versionNumber: roster.versionNumber,
        chainId: roster.chainId,
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/manage/rosters");
    revalidatePath("/system/rosters");

    return { success: true, roster };
  } catch (error) {
    console.error("Error creating roster:", error);
    return { success: false, error: "Failed to create roster" };
  }
}

// Update roster details
export async function updateRoster(rosterId: string, data: UpdateRosterInput) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to edit rosters" };
    }

    // Get current roster
    const existingRoster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: { venue: true },
    });

    if (!existingRoster) {
      return { success: false, error: "Roster not found" };
    }

    // Check venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(existingRoster.venueId)) {
        return { success: false, error: "You don't have access to this roster" };
      }
    }

    // Only allow editing of draft rosters
    if (existingRoster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only edit draft rosters" };
    }

    // Increment revision
    const newRevision = existingRoster.revision + 1;

    const roster = await prisma.roster.update({
      where: { id: rosterId },
      data: {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        revision: newRevision,
      },
    });

    // Create audit entry
    await prisma.rosterHistory.create({
      data: {
        rosterId: roster.id,
        chainId: roster.chainId,
        version: newRevision,
        action: "ROSTER_UPDATED",
        changes: JSON.parse(JSON.stringify(data)),
        metadata: {
          versionNumber: roster.versionNumber,
          previousRevision: existingRoster.revision,
        },
        performedBy: user.id,
      },
    });

    // General audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "ROSTER_UPDATED",
      resourceType: "Roster",
      resourceId: rosterId,
      oldValue: JSON.stringify({
        name: existingRoster.name,
        description: existingRoster.description,
        startDate: existingRoster.startDate,
        endDate: existingRoster.endDate,
      }),
      newValue: JSON.stringify(data),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath("/manage/rosters");

    return { success: true, roster };
  } catch (error) {
    console.error("Error updating roster:", error);
    return { success: false, error: "Failed to update roster" };
  }
}

// Delete a roster (only drafts)
export async function deleteRoster(rosterId: string) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "delete");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to delete rosters" };
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Check venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(roster.venueId)) {
        return { success: false, error: "You don't have access to this roster" };
      }
    }

    // Only allow deleting drafts
    if (roster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only delete draft rosters" };
    }

    // Delete roster (cascade will handle shifts and history)
    await prisma.roster.delete({
      where: { id: rosterId },
    });

    // General audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "ROSTER_DELETED",
      resourceType: "Roster",
      resourceId: rosterId,
      oldValue: JSON.stringify({
        name: roster.name,
        venueId: roster.venueId,
        startDate: roster.startDate,
        endDate: roster.endDate,
        status: roster.status,
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/manage/rosters");
    revalidatePath("/system/rosters");

    return { success: true };
  } catch (error) {
    console.error("Error deleting roster:", error);
    return { success: false, error: "Failed to delete roster" };
  }
}

// Publish a roster
export async function publishRoster(rosterId: string) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "publish");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to publish rosters" };
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        shifts: {
          where: { userId: { not: null } },
          include: { user: { select: { id: true, firstName: true, email: true } } },
        },
        venue: { select: { name: true } },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Check venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(roster.venueId)) {
        return { success: false, error: "You don't have access to this roster" };
      }
    }

    // Check if roster has any shifts
    if (roster.shifts.length === 0) {
      return { success: false, error: "Cannot publish a roster with no assigned shifts" };
    }

    const newRevision = roster.revision + 1;

    // Update roster status
    const updatedRoster = await prisma.roster.update({
      where: { id: rosterId },
      data: {
        status: RosterStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedBy: user.id,
        revision: newRevision,
      },
    });

    // Activate this version in the chain (deactivates others)
    await activateVersion(rosterId, user.id);

    // Create audit entry
    await prisma.rosterHistory.create({
      data: {
        rosterId: roster.id,
        chainId: roster.chainId,
        version: newRevision,
        action: "STATUS_PUBLISHED",
        changes: {
          previousStatus: roster.status,
          newStatus: RosterStatus.PUBLISHED,
        },
        metadata: {
          versionNumber: roster.versionNumber,
          shiftCount: roster.shifts.length,
          uniqueStaffCount: new Set(roster.shifts.map((s) => s.userId)).size,
        },
        performedBy: user.id,
      },
    });

    // Get unique staff members and notify them
    const uniqueStaffIds = [...new Set(roster.shifts.map((s) => s.userId).filter(Boolean))] as string[];

    // Create notifications for all staff
    const startDateStr = roster.startDate.toLocaleDateString();
    const endDateStr = roster.endDate.toLocaleDateString();

    // Determine if this is a new roster or an update
    const isUpdate = roster.versionNumber > 1;
    const notificationType = isUpdate
      ? NotificationType.ROSTER_UPDATED
      : NotificationType.ROSTER_PUBLISHED;
    const notificationTitle = isUpdate
      ? "Roster Updated"
      : "New Roster Published";
    const notificationMessage = isUpdate
      ? `The roster for ${roster.venue.name} (${startDateStr} - ${endDateStr}) has been updated. Please check for any changes to your shifts.`
      : `A new roster for ${roster.venue.name} (${startDateStr} - ${endDateStr}) has been published. Check your shifts.`;

    for (const staffId of uniqueStaffIds) {
      await createNotification({
        userId: staffId,
        type: notificationType,
        title: notificationTitle,
        message: notificationMessage,
        link: "/my/rosters",
      });
    }

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath("/manage/rosters");
    revalidatePath("/my/rosters");

    return { success: true, roster: updatedRoster, notifiedCount: uniqueStaffIds.length };
  } catch (error) {
    console.error("Error publishing roster:", error);
    return { success: false, error: "Failed to publish roster" };
  }
}

// Archive a roster
export async function archiveRoster(rosterId: string) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to archive rosters" };
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Only published rosters can be archived
    if (roster.status !== RosterStatus.PUBLISHED) {
      return { success: false, error: "Only published rosters can be archived" };
    }

    const newRevision = roster.revision + 1;

    const updatedRoster = await prisma.roster.update({
      where: { id: rosterId },
      data: {
        status: RosterStatus.ARCHIVED,
        revision: newRevision,
        isActive: false, // Archived rosters are never active
      },
    });

    // Create audit entry
    await prisma.rosterHistory.create({
      data: {
        rosterId: roster.id,
        chainId: roster.chainId,
        version: newRevision,
        action: "STATUS_ARCHIVED",
        changes: {
          previousStatus: roster.status,
          newStatus: RosterStatus.ARCHIVED,
        },
        metadata: {
          versionNumber: roster.versionNumber,
        },
        performedBy: user.id,
      },
    });

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath("/manage/rosters");

    return { success: true, roster: updatedRoster };
  } catch (error) {
    console.error("Error archiving roster:", error);
    return { success: false, error: "Failed to archive roster" };
  }
}

// Copy roster input type
export interface CopyRosterInput {
  targetWeekStart: Date;
  name: string;
  createNewVersion?: boolean; // If true, copy to same week as new version
}

// Copy a roster to a different week or create a new version
export async function copyRoster(
  sourceRosterId: string,
  input: CopyRosterInput
) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "create");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to create rosters" };
    }

    // Get source roster with all shifts
    const sourceRoster = await prisma.roster.findUnique({
      where: { id: sourceRosterId },
      include: {
        venue: { select: { id: true, name: true } },
        shifts: true,
        unmatchedEntries: true,
      },
    });

    if (!sourceRoster) {
      return { success: false, error: "Source roster not found" };
    }

    // Check venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(sourceRoster.venueId)) {
        return { success: false, error: "You don't have access to this roster" };
      }
    }

    // For new versions (same week), use the version chain service
    if (input.createNewVersion) {
      if (sourceRoster.status !== RosterStatus.PUBLISHED) {
        return {
          success: false,
          error: "Can only create new versions of published rosters"
        };
      }

      // Use the version chain service for creating new versions
      const result = await createNewVersion(sourceRosterId, {
        name: input.name,
        createdBy: user.id,
      });

      if (!result.success) {
        return { success: false, error: result.error };
      }

      revalidatePath("/manage/rosters");
      revalidatePath("/system/rosters");

      return {
        success: true,
        rosterId: result.rosterId,
        versionNumber: result.versionNumber,
        chainId: result.chainId,
        shiftsCount: sourceRoster.shifts.length,
      };
    }

    // For different week copies, create standalone roster
    const sourceStartDate = new Date(sourceRoster.startDate);
    const sourceEndDate = new Date(sourceRoster.endDate);
    const targetStartDate = new Date(input.targetWeekStart);

    // Calculate days difference for shifting shift dates
    const daysDiff = Math.round(
      (targetStartDate.getTime() - sourceStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate end date (same duration as source)
    const durationDays = Math.round(
      (sourceEndDate.getTime() - sourceStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const targetEndDate = new Date(targetStartDate);
    targetEndDate.setDate(targetEndDate.getDate() + durationDays);

    // Check if roster already exists for target week
    const existingRoster = await prisma.roster.findFirst({
      where: {
        venueId: sourceRoster.venueId,
        startDate: targetStartDate,
        status: { not: RosterStatus.ARCHIVED },
      },
    });

    if (existingRoster) {
      return {
        success: false,
        error: `A roster already exists for this week. Use "Create New Version" to update it.`,
      };
    }

    // Generate chainId for the new week
    const chainId = generateChainId(sourceRoster.venueId, targetStartDate);

    // Create the new roster (standalone, new chain)
    const newRoster = await prisma.roster.create({
      data: {
        name: input.name,
        description: sourceRoster.description,
        venueId: sourceRoster.venueId,
        startDate: targetStartDate,
        endDate: targetEndDate,
        status: RosterStatus.DRAFT,
        createdBy: user.id,
        // Version chain fields for new chain
        chainId,
        versionNumber: 1,
        revision: 1,
        isActive: false,
        // Copy source file info if available
        sourceFileUrl: sourceRoster.sourceFileUrl,
        sourceFileName: sourceRoster.sourceFileName,
        sourceFileType: sourceRoster.sourceFileType,
        // Keep parentId for backwards compatibility during migration
        parentId: null, // Different week = no parent relationship
      },
    });

    // Copy all shifts with adjusted dates
    if (sourceRoster.shifts.length > 0) {
      const shiftData = sourceRoster.shifts.map((shift) => {
        const shiftDate = new Date(shift.date);
        const newShiftDate = new Date(shiftDate);
        newShiftDate.setDate(newShiftDate.getDate() + daysDiff);

        return {
          rosterId: newRoster.id,
          userId: shift.userId,
          date: newShiftDate,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes,
          position: shift.position,
          notes: shift.notes,
          originalName: shift.originalName,
          hasConflict: false, // Reset conflicts for new roster
          conflictType: null,
        };
      });

      await prisma.rosterShift.createMany({
        data: shiftData,
      });
    }

    // Copy unmatched entries
    if (sourceRoster.unmatchedEntries.length > 0) {
      const unmatchedData = sourceRoster.unmatchedEntries.map((entry) => ({
        rosterId: newRoster.id,
        originalName: entry.originalName,
        suggestedUserId: entry.suggestedUserId,
        confidence: entry.confidence,
        resolved: entry.resolved,
        resolvedUserId: entry.resolvedUserId,
      }));

      await prisma.unmatchedRosterEntry.createMany({
        data: unmatchedData,
      });
    }

    // Create audit entry
    await prisma.rosterHistory.create({
      data: {
        rosterId: newRoster.id,
        chainId,
        version: 1,
        action: "ROSTER_CREATED",
        changes: {
          copiedFrom: sourceRosterId,
          sourceName: sourceRoster.name,
          shiftsCount: sourceRoster.shifts.length,
          dateAdjustment: daysDiff,
        },
        metadata: {
          versionNumber: 1,
          copyType: "different_week",
        },
        performedBy: user.id,
      },
    });

    revalidatePath("/manage/rosters");
    revalidatePath("/system/rosters");

    return {
      success: true,
      rosterId: newRoster.id,
      chainId,
      versionNumber: 1,
      shiftsCount: sourceRoster.shifts.length,
    };
  } catch (error) {
    console.error("Error copying roster:", error);
    return { success: false, error: "Failed to copy roster" };
  }
}
