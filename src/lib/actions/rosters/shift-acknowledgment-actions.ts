"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { RosterStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Acknowledge a single shift
export async function acknowledgeShift(shiftId: string, note?: string) {
  try {
    const user = await requireAuth();

    // Verify the shift belongs to this user
    const shift = await prisma.rosterShift.findUnique({
      where: { id: shiftId },
      select: { 
        id: true, 
        userId: true, 
        acknowledgedAt: true,
        roster: {
          select: { status: true }
        }
      },
    });

    if (!shift) {
      return { success: false, error: "Shift not found" };
    }

    if (shift.userId !== user.id) {
      return { success: false, error: "You can only acknowledge your own shifts" };
    }

    if (shift.acknowledgedAt) {
      return { success: false, error: "Shift already acknowledged" };
    }

    // Update the shift with acknowledgment timestamp
    const updatedShift = await prisma.rosterShift.update({
      where: { id: shiftId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgmentNote: note || null,
      },
    });

    revalidatePath("/my/rosters");

    return { success: true, shift: updatedShift };
  } catch (error) {
    console.error("Error acknowledging shift:", error);
    return { success: false, error: "Failed to acknowledge shift" };
  }
}

// Acknowledge multiple shifts at once
export async function acknowledgeMultipleShifts(shiftIds: string[], note?: string) {
  try {
    const user = await requireAuth();

    // Verify all shifts belong to this user and aren't already acknowledged
    const shifts = await prisma.rosterShift.findMany({
      where: {
        id: { in: shiftIds },
        userId: user.id,
        acknowledgedAt: null,
      },
      select: { id: true },
    });

    if (shifts.length === 0) {
      return { success: false, error: "No eligible shifts to acknowledge" };
    }

    // Batch update
    const result = await prisma.rosterShift.updateMany({
      where: {
        id: { in: shifts.map(s => s.id) },
      },
      data: {
        acknowledgedAt: new Date(),
        acknowledgmentNote: note || null,
      },
    });

    revalidatePath("/my/rosters");

    return { 
      success: true, 
      acknowledgedCount: result.count,
      requestedCount: shiftIds.length 
    };
  } catch (error) {
    console.error("Error acknowledging shifts:", error);
    return { success: false, error: "Failed to acknowledge shifts" };
  }
}

// Get count of unacknowledged shifts for the current user
export async function getUnacknowledgedShiftsCount() {
  try {
    const user = await requireAuth();

    const count = await prisma.rosterShift.count({
      where: {
        userId: user.id,
        acknowledgedAt: null,
        roster: {
          status: RosterStatus.PUBLISHED,
        },
      },
    });

    return { success: true, count };
  } catch (error) {
    console.error("Error getting unacknowledged shifts count:", error);
    return { success: false, error: "Failed to get count", count: 0 };
  }
}

// Manager: Get acknowledgment summary for a roster
export async function getRosterAcknowledgmentSummary(rosterId: string) {
  try {
    await requireAuth();

    const shifts = await prisma.rosterShift.findMany({
      where: { rosterId },
      select: {
        id: true,
        userId: true,
        acknowledgedAt: true,
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    const total = shifts.length;
    const acknowledged = shifts.filter(s => s.acknowledgedAt).length;
    const unacknowledged = total - acknowledged;

    // Group by user
    const userSummary = new Map<string, {
      userId: string;
      userName: string;
      total: number;
      acknowledged: number;
      unacknowledged: number;
    }>();

    for (const shift of shifts) {
      if (!shift.userId) continue;
      
      const existing = userSummary.get(shift.userId);
      if (existing) {
        existing.total++;
        if (shift.acknowledgedAt) {
          existing.acknowledged++;
        } else {
          existing.unacknowledged++;
        }
      } else {
        userSummary.set(shift.userId, {
          userId: shift.userId,
          userName: `${shift.user?.firstName || ''} ${shift.user?.lastName || ''}`.trim() || 'Unknown',
          total: 1,
          acknowledged: shift.acknowledgedAt ? 1 : 0,
          unacknowledged: shift.acknowledgedAt ? 0 : 1,
        });
      }
    }

    return {
      success: true,
      summary: {
        total,
        acknowledged,
        unacknowledged,
        byUser: Array.from(userSummary.values()),
      },
    };
  } catch (error) {
    console.error("Error getting roster acknowledgment summary:", error);
    return { success: false, error: "Failed to get acknowledgment summary" };
  }
}
