"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { revalidatePath } from "next/cache";
import { RosterStatus } from "@prisma/client";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { getAuditContext } from "@/lib/utils/audit-helpers";

// Types
export interface ShiftInput {
  userId?: string | null;
  date: Date;
  startTime: string; // "09:00" format
  endTime: string; // "17:00" format
  breakMinutes?: number;
  position?: string;
  notes?: string;
  originalName?: string; // For unmatched entries
}

// Add a single shift to a roster
export async function addShift(rosterId: string, data: ShiftInput) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to edit rosters" };
    }

    // Get roster and verify it's editable
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    if (roster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only add shifts to draft rosters" };
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

    // Check for conflicts if user is assigned
    let hasConflict = false;
    let conflictType: string | null = null;

    if (data.userId) {
      const conflict = await checkShiftConflicts(data.userId, data.date, data.startTime, data.endTime, rosterId);
      hasConflict = conflict.hasConflict;
      conflictType = conflict.conflictType;
    }

    const shift = await prisma.rosterShift.create({
      data: {
        rosterId,
        userId: data.userId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes ?? 0,
        position: data.position,
        notes: data.notes,
        originalName: data.originalName,
        hasConflict,
        conflictType,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "SHIFT_ADDED",
      resourceType: "RosterShift",
      resourceId: shift.id,
      newValue: JSON.stringify({
        rosterId,
        userId: data.userId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        position: data.position,
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath(`/manage/rosters/${rosterId}`);

    return { success: true, shift };
  } catch (error) {
    console.error("Error adding shift:", error);
    return { success: false, error: "Failed to add shift" };
  }
}

// Update an existing shift
export async function updateShift(shiftId: string, data: Partial<ShiftInput>) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to edit shifts" };
    }

    // Get shift with roster
    const existingShift = await prisma.rosterShift.findUnique({
      where: { id: shiftId },
      include: { roster: true },
    });

    if (!existingShift) {
      return { success: false, error: "Shift not found" };
    }

    if (existingShift.roster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only edit shifts in draft rosters" };
    }

    // Check venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(existingShift.roster.venueId)) {
        return { success: false, error: "You don't have access to this shift" };
      }
    }

    // Check for conflicts if user is being assigned/changed
    let hasConflict = existingShift.hasConflict;
    let conflictType = existingShift.conflictType;

    const newUserId = data.userId !== undefined ? data.userId : existingShift.userId;
    const newDate = data.date ?? existingShift.date;
    const newStartTime = data.startTime ?? existingShift.startTime;
    const newEndTime = data.endTime ?? existingShift.endTime;

    if (newUserId) {
      const conflict = await checkShiftConflicts(newUserId, newDate, newStartTime, newEndTime, existingShift.rosterId, shiftId);
      hasConflict = conflict.hasConflict;
      conflictType = conflict.conflictType;
    } else {
      hasConflict = false;
      conflictType = null;
    }

    const shift = await prisma.rosterShift.update({
      where: { id: shiftId },
      data: {
        userId: data.userId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes,
        position: data.position,
        notes: data.notes,
        originalName: data.originalName,
        hasConflict,
        conflictType,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    // Audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "SHIFT_UPDATED",
      resourceType: "RosterShift",
      resourceId: shiftId,
      oldValue: JSON.stringify({
        userId: existingShift.userId,
        date: existingShift.date,
        startTime: existingShift.startTime,
        endTime: existingShift.endTime,
        position: existingShift.position,
      }),
      newValue: JSON.stringify(data),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath(`/manage/rosters/${existingShift.rosterId}`);

    return { success: true, shift };
  } catch (error) {
    console.error("Error updating shift:", error);
    return { success: false, error: "Failed to update shift" };
  }
}

// Delete a shift
export async function deleteShift(shiftId: string) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to delete shifts" };
    }

    const shift = await prisma.rosterShift.findUnique({
      where: { id: shiftId },
      include: { roster: true },
    });

    if (!shift) {
      return { success: false, error: "Shift not found" };
    }

    if (shift.roster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only delete shifts from draft rosters" };
    }

    // Check venue access for managers
    if (user.role.name === "MANAGER") {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const venueIds = userVenues.map((v) => v.venueId);
      if (!venueIds.includes(shift.roster.venueId)) {
        return { success: false, error: "You don't have access to this shift" };
      }
    }

    await prisma.rosterShift.delete({
      where: { id: shiftId },
    });

    // Audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "SHIFT_DELETED",
      resourceType: "RosterShift",
      resourceId: shiftId,
      oldValue: JSON.stringify({
        rosterId: shift.rosterId,
        userId: shift.userId,
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        position: shift.position,
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath(`/manage/rosters/${shift.rosterId}`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting shift:", error);
    return { success: false, error: "Failed to delete shift" };
  }
}

// Bulk add shifts to a roster
export async function bulkAddShifts(rosterId: string, shifts: ShiftInput[]) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to edit rosters" };
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    if (roster.status !== RosterStatus.DRAFT) {
      return { success: false, error: "Can only add shifts to draft rosters" };
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

    // Process each shift and check for conflicts
    const shiftsToCreate = await Promise.all(
      shifts.map(async (shift) => {
        let hasConflict = false;
        let conflictType: string | null = null;

        if (shift.userId) {
          const conflict = await checkShiftConflicts(shift.userId, shift.date, shift.startTime, shift.endTime, rosterId);
          hasConflict = conflict.hasConflict;
          conflictType = conflict.conflictType;
        }

        return {
          rosterId,
          userId: shift.userId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes ?? 0,
          position: shift.position,
          notes: shift.notes,
          originalName: shift.originalName,
          hasConflict,
          conflictType,
        };
      })
    );

    const result = await prisma.rosterShift.createMany({
      data: shiftsToCreate,
    });

    revalidatePath(`/manage/rosters/${rosterId}`);

    return { success: true, count: result.count };
  } catch (error) {
    console.error("Error bulk adding shifts:", error);
    return { success: false, error: "Failed to add shifts" };
  }
}

// Check for conflicts for a shift
export async function checkShiftConflicts(
  userId: string,
  date: Date,
  startTime: string,
  endTime: string,
  rosterId: string,
  excludeShiftId?: string
): Promise<{ hasConflict: boolean; conflictType: string | null; details?: string }> {
  try {
    // Check for approved time-off
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const timeOffRequests = await prisma.timeOffRequest.findMany({
      where: {
        userId,
        status: "APPROVED",
        startDate: { lte: dayEnd },
        endDate: { gte: dayStart },
      },
    });

    if (timeOffRequests.length > 0) {
      return {
        hasConflict: true,
        conflictType: "TIME_OFF",
        details: "Staff member has approved time off on this date",
      };
    }

    // Check for existing shifts on the same day (double booking)
    const existingShiftsQuery: Parameters<typeof prisma.rosterShift.findMany>[0] = {
      where: {
        userId,
        date: {
          gte: dayStart,
          lte: dayEnd,
        },
        roster: {
          status: { in: [RosterStatus.DRAFT, RosterStatus.PUBLISHED] },
        },
      },
    };

    // Exclude current shift if updating
    if (excludeShiftId) {
      existingShiftsQuery.where = {
        ...existingShiftsQuery.where,
        id: { not: excludeShiftId },
      };
    }

    const existingShifts = await prisma.rosterShift.findMany(existingShiftsQuery);

    // Check for time overlap
    for (const existingShift of existingShifts) {
      const existingStart = parseInt(existingShift.startTime.replace(":", ""));
      const existingEnd = parseInt(existingShift.endTime.replace(":", ""));
      const newStart = parseInt(startTime.replace(":", ""));
      const newEnd = parseInt(endTime.replace(":", ""));

      // Check for overlap
      if (newStart < existingEnd && newEnd > existingStart) {
        return {
          hasConflict: true,
          conflictType: "DOUBLE_BOOKED",
          details: "Staff member has an overlapping shift",
        };
      }
    }

    // Check against availability (warning if shift is outside availability hours)
    const dayOfWeek = date.getDay();
    const availability = await prisma.availability.findFirst({
      where: {
        userId,
        dayOfWeek,
      },
    });

    if (availability && !availability.isAvailable) {
      return {
        hasConflict: true,
        conflictType: "AVAILABILITY",
        details: "Staff member is not available on this day",
      };
    }

    // Check if shift time falls within availability hours
    if (availability && availability.isAvailable && !availability.isAllDay) {
      const shiftStart = parseInt(startTime.replace(":", ""));
      const shiftEnd = parseInt(endTime.replace(":", ""));
      const availStart = availability.startTime 
        ? parseInt(availability.startTime.replace(":", ""))
        : 0;
      const availEnd = availability.endTime
        ? parseInt(availability.endTime.replace(":", ""))
        : 2359;

      if (shiftStart < availStart || shiftEnd > availEnd) {
        return {
          hasConflict: true,
          conflictType: "AVAILABILITY",
          details: `Shift time (${startTime}-${endTime}) is outside staff availability (${availability.startTime || "00:00"}-${availability.endTime || "23:59"})`,
        };
      }
    }

    return { hasConflict: false, conflictType: null };
  } catch (error) {
    console.error("Error checking shift conflicts:", error);
    return { hasConflict: false, conflictType: null };
  }
}

// Bulk check all conflicts in a roster and update shift records
export async function recheckRosterConflicts(rosterId: string) {
  try {
    const user = await requireAuth();

    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to check roster conflicts" };
    }

    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        shifts: {
          where: { userId: { not: null } },
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Check conflicts for each shift
    const conflictResults = await Promise.all(
      roster.shifts.map(async (shift) => {
        if (!shift.userId) {
          return { shiftId: shift.id, hasConflict: false, conflictType: null };
        }

        const conflict = await checkShiftConflicts(
          shift.userId,
          shift.date,
          shift.startTime,
          shift.endTime,
          rosterId,
          shift.id
        );

        return {
          shiftId: shift.id,
          userId: shift.userId,
          userName: `${shift.user?.firstName || ""} ${shift.user?.lastName || ""}`.trim() || shift.user?.email || "Unknown",
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          position: shift.position,
          hasConflict: conflict.hasConflict,
          conflictType: conflict.conflictType,
          conflictDetails: conflict.details,
        };
      })
    );

    // Update shifts with conflict status
    await Promise.all(
      conflictResults.map((result) =>
        prisma.rosterShift.update({
          where: { id: result.shiftId },
          data: {
            hasConflict: result.hasConflict,
            conflictType: result.conflictType,
          },
        })
      )
    );

    // Filter to only conflicts
    const conflicts = conflictResults.filter((r) => r.hasConflict);

    revalidatePath(`/manage/rosters/${rosterId}`);
    revalidatePath(`/system/rosters/${rosterId}`);

    return {
      success: true,
      totalShifts: roster.shifts.length,
      conflictCount: conflicts.length,
      conflicts,
    };
  } catch (error) {
    console.error("Error rechecking roster conflicts:", error);
    return { success: false, error: "Failed to check roster conflicts" };
  }
}
