"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { RosterStatus, ShiftSwapStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";

// Type for swap request with relations
export interface SwapRequestWithDetails {
  id: string;
  shiftId: string;
  requesterId: string;
  targetUserId: string | null;
  status: ShiftSwapStatus;
  reason: string | null;
  adminNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  shift: {
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    position: string | null;
    roster: {
      id: string;
      name: string;
      venue: { id: string; name: string };
    };
  };
  requester: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  targetUser: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  reviewer: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
}

// Request a shift swap
export async function requestShiftSwap(
  shiftId: string,
  targetUserId?: string,
  reason?: string
) {
  try {
    const user = await requireAuth();

    // Verify the shift belongs to this user
    const shift = await prisma.rosterShift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        userId: true,
        date: true,
        roster: {
          select: { 
            id: true, 
            status: true,
            venueId: true,
          },
        },
      },
    });

    if (!shift) {
      return { success: false, error: "Shift not found" };
    }

    if (shift.userId !== user.id) {
      return { success: false, error: "You can only request swaps for your own shifts" };
    }

    // Check if roster is published (swaps typically only for published rosters)
    if (shift.roster.status !== RosterStatus.PUBLISHED) {
      return { success: false, error: "Can only request swaps for published rosters" };
    }

    // Check for existing pending swap request
    const existingRequest = await prisma.shiftSwapRequest.findFirst({
      where: {
        shiftId,
        status: ShiftSwapStatus.PENDING,
      },
    });

    if (existingRequest) {
      return { success: false, error: "A pending swap request already exists for this shift" };
    }

    // If target user specified, verify they exist and are in the same venue
    if (targetUserId) {
      const targetUser = await prisma.user.findFirst({
        where: {
          id: targetUserId,
          active: true,
          deletedAt: null,
          OR: [
            { venueId: shift.roster.venueId },
            { venues: { some: { venueId: shift.roster.venueId } } },
          ],
        },
      });

      if (!targetUser) {
        return { success: false, error: "Target user not found or not eligible for this venue" };
      }
    }

    // Create the swap request
    const swapRequest = await prisma.shiftSwapRequest.create({
      data: {
        shiftId,
        requesterId: user.id,
        targetUserId: targetUserId || null,
        reason: reason || null,
        status: ShiftSwapStatus.PENDING,
      },
      include: {
        shift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            position: true,
            roster: {
              select: {
                id: true,
                name: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        targetUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });

    revalidatePath("/my/rosters");

    return { success: true, swapRequest };
  } catch (error) {
    console.error("Error requesting shift swap:", error);
    return { success: false, error: "Failed to request shift swap" };
  }
}

// Cancel a swap request (by requester)
export async function cancelSwapRequest(swapRequestId: string) {
  try {
    const user = await requireAuth();

    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapRequestId },
      select: { id: true, requesterId: true, status: true },
    });

    if (!swapRequest) {
      return { success: false, error: "Swap request not found" };
    }

    if (swapRequest.requesterId !== user.id) {
      return { success: false, error: "You can only cancel your own swap requests" };
    }

    if (swapRequest.status !== ShiftSwapStatus.PENDING) {
      return { success: false, error: "Can only cancel pending swap requests" };
    }

    await prisma.shiftSwapRequest.update({
      where: { id: swapRequestId },
      data: { status: ShiftSwapStatus.CANCELLED },
    });

    revalidatePath("/my/rosters");

    return { success: true };
  } catch (error) {
    console.error("Error cancelling swap request:", error);
    return { success: false, error: "Failed to cancel swap request" };
  }
}

// Get my swap requests (as requester)
export async function getMySwapRequests(): Promise<{
  success: boolean;
  error?: string;
  requests?: SwapRequestWithDetails[];
}> {
  try {
    const user = await requireAuth();

    const requests = await prisma.shiftSwapRequest.findMany({
      where: { requesterId: user.id },
      include: {
        shift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            position: true,
            roster: {
              select: {
                id: true,
                name: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        targetUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, requests: requests as SwapRequestWithDetails[] };
  } catch (error) {
    console.error("Error fetching swap requests:", error);
    return { success: false, error: "Failed to fetch swap requests", requests: [] };
  }
}

// Get swap requests targeting me (as target user)
export async function getSwapRequestsTargetingMe(): Promise<{
  success: boolean;
  error?: string;
  requests?: SwapRequestWithDetails[];
}> {
  try {
    const user = await requireAuth();

    const requests = await prisma.shiftSwapRequest.findMany({
      where: {
        targetUserId: user.id,
        status: ShiftSwapStatus.PENDING,
      },
      include: {
        shift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            position: true,
            roster: {
              select: {
                id: true,
                name: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        targetUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, requests: requests as SwapRequestWithDetails[] };
  } catch (error) {
    console.error("Error fetching swap requests:", error);
    return { success: false, error: "Failed to fetch swap requests", requests: [] };
  }
}

// Manager: Get all swap requests for a venue
export async function getVenueSwapRequests(venueId: string): Promise<{
  success: boolean;
  error?: string;
  requests?: SwapRequestWithDetails[];
}> {
  try {
    const user = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission", requests: [] };
    }

    const requests = await prisma.shiftSwapRequest.findMany({
      where: {
        shift: {
          roster: { venueId },
        },
      },
      include: {
        shift: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            position: true,
            roster: {
              select: {
                id: true,
                name: true,
                venue: { select: { id: true, name: true } },
              },
            },
          },
        },
        requester: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        targetUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        reviewer: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, requests: requests as SwapRequestWithDetails[] };
  } catch (error) {
    console.error("Error fetching venue swap requests:", error);
    return { success: false, error: "Failed to fetch swap requests", requests: [] };
  }
}

// Manager: Approve a swap request
export async function approveSwapRequest(
  swapRequestId: string,
  adminNotes?: string
) {
  try {
    const user = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to approve swaps" };
    }

    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapRequestId },
      include: {
        shift: {
          select: {
            id: true,
            userId: true,
            roster: { select: { venueId: true } },
          },
        },
      },
    });

    if (!swapRequest) {
      return { success: false, error: "Swap request not found" };
    }

    if (swapRequest.status !== ShiftSwapStatus.PENDING) {
      return { success: false, error: "Can only approve pending swap requests" };
    }

    // If no target user specified, manager must assign one
    if (!swapRequest.targetUserId) {
      return { success: false, error: "No target user specified for this swap" };
    }

    // Perform the swap in a transaction
    await prisma.$transaction([
      // Update the shift to the new user
      prisma.rosterShift.update({
        where: { id: swapRequest.shiftId },
        data: { userId: swapRequest.targetUserId },
      }),
      // Update the swap request status
      prisma.shiftSwapRequest.update({
        where: { id: swapRequestId },
        data: {
          status: ShiftSwapStatus.APPROVED,
          reviewedBy: user.id,
          reviewedAt: new Date(),
          adminNotes: adminNotes || null,
        },
      }),
    ]);

    revalidatePath("/my/rosters");
    revalidatePath("/manage/rosters");

    return { success: true };
  } catch (error) {
    console.error("Error approving swap request:", error);
    return { success: false, error: "Failed to approve swap request" };
  }
}

// Manager: Reject a swap request
export async function rejectSwapRequest(
  swapRequestId: string,
  adminNotes?: string
) {
  try {
    const user = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to reject swaps" };
    }

    const swapRequest = await prisma.shiftSwapRequest.findUnique({
      where: { id: swapRequestId },
    });

    if (!swapRequest) {
      return { success: false, error: "Swap request not found" };
    }

    if (swapRequest.status !== ShiftSwapStatus.PENDING) {
      return { success: false, error: "Can only reject pending swap requests" };
    }

    await prisma.shiftSwapRequest.update({
      where: { id: swapRequestId },
      data: {
        status: ShiftSwapStatus.REJECTED,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        adminNotes: adminNotes || null,
      },
    });

    revalidatePath("/my/rosters");
    revalidatePath("/manage/rosters");

    return { success: true };
  } catch (error) {
    console.error("Error rejecting swap request:", error);
    return { success: false, error: "Failed to reject swap request" };
  }
}

// Manager: Directly assign a shift to a different user (admin override)
export async function reassignShift(
  shiftId: string,
  newUserId: string,
  reason?: string
) {
  try {
    const user = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("rosters", "edit");
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to reassign shifts" };
    }

    const shift = await prisma.rosterShift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        userId: true,
        roster: {
          select: { id: true, venueId: true },
        },
      },
    });

    if (!shift) {
      return { success: false, error: "Shift not found" };
    }

    // Verify the new user is eligible for this venue
    const newUser = await prisma.user.findFirst({
      where: {
        id: newUserId,
        active: true,
        deletedAt: null,
        OR: [
          { venueId: shift.roster.venueId },
          { venues: { some: { venueId: shift.roster.venueId } } },
        ],
      },
    });

    if (!newUser) {
      return { success: false, error: "Target user not found or not eligible for this venue" };
    }

    // Update the shift
    await prisma.rosterShift.update({
      where: { id: shiftId },
      data: { userId: newUserId },
    });

    revalidatePath("/manage/rosters");

    return { success: true };
  } catch (error) {
    console.error("Error reassigning shift:", error);
    return { success: false, error: "Failed to reassign shift" };
  }
}

// Get eligible users for swap (same venue, active)
export async function getEligibleSwapUsers(shiftId: string) {
  try {
    const user = await requireAuth();

    const shift = await prisma.rosterShift.findUnique({
      where: { id: shiftId },
      select: {
        id: true,
        userId: true,
        roster: {
          select: { venueId: true },
        },
      },
    });

    if (!shift) {
      return { success: false, error: "Shift not found", users: [] };
    }

    // Get all active users for this venue except the current shift owner
    const users = await prisma.user.findMany({
      where: {
        active: true,
        deletedAt: null,
        id: { not: shift.userId },
        OR: [
          { venueId: shift.roster.venueId },
          { venues: { some: { venueId: shift.roster.venueId } } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return { success: true, users };
  } catch (error) {
    console.error("Error fetching eligible swap users:", error);
    return { success: false, error: "Failed to fetch eligible users", users: [] };
  }
}
