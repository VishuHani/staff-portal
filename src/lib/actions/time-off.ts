"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess, canAccessVenue } from "@/lib/rbac/access";
import { getSharedVenueUsers, getUserVenueIds } from "@/lib/utils/venue";
import {
  createTimeOffRequestSchema,
  updateTimeOffRequestSchema,
  reviewTimeOffRequestSchema,
  filterTimeOffRequestsSchema,
  type CreateTimeOffRequestInput,
  type UpdateTimeOffRequestInput,
  type ReviewTimeOffRequestInput,
  type FilterTimeOffRequestsInput,
} from "@/lib/schemas/time-off";
import {
  notifyTimeOffSubmitted,
  notifyTimeOffApproved,
  notifyTimeOffRejected,
  notifyTimeOffCancelled,
} from "@/lib/services/notifications";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { RosterStatus } from "@prisma/client";

/**
 * Recalculate shift conflicts when time-off is approved
 * This ensures existing shifts are flagged if they conflict with newly approved time-off
 */
async function recalculateShiftConflictsForTimeOff(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<void> {
  try {
    // Find all shifts for this user that fall within the time-off period
    const affectedShifts = await prisma.rosterShift.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
          lte: endDate,
        },
        roster: {
          status: { in: [RosterStatus.DRAFT, RosterStatus.APPROVED, RosterStatus.PUBLISHED] },
        },
      },
      include: {
        roster: {
          select: { id: true, status: true },
        },
      },
    });

    if (affectedShifts.length === 0) {
      return;
    }

    // Update all affected shifts to have a time-off conflict
    await prisma.rosterShift.updateMany({
      where: {
        id: { in: affectedShifts.map(s => s.id) },
      },
      data: {
        hasConflict: true,
        conflictType: "TIME_OFF",
      },
    });

    console.log(`[Time-Off] Updated ${affectedShifts.length} shifts with TIME_OFF conflict for user ${userId}`);
  } catch (error) {
    console.error("Error recalculating shift conflicts for time-off:", error);
    // Don't throw - this is a background operation
  }
}

/**
 * Get all time-off requests for the current user
 */
export async function getMyTimeOffRequests() {
  const user = await requireAuth();

  try {
    const requests = await prisma.timeOffRequest.findMany({
      where: { userId: user.id },
      include: {
        reviewer: {
          select: {
            id: true,
            email: true,
            // PROFILE FIELDS:
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, requests };
  } catch (error) {
    console.error("Error fetching time-off requests:", error);
    return { error: "Failed to fetch time-off requests" };
  }
}

/**
 * Get all time-off requests (Manager/Admin only)
 * ENHANCED: Now respects venue-scoped permissions
 */
export async function getAllTimeOffRequests(filters?: FilterTimeOffRequestsInput) {
  const user = await requireAuth();

  // Check if user has global OR venue-specific permission to view team time-off
  const hasGlobalAccess = await canAccess("timeoff", "view_team");
  if (!hasGlobalAccess) {
    return { error: "You don't have permission to view team time-off requests" };
  }

  const validatedFilters = filters
    ? filterTimeOffRequestsSchema.safeParse(filters)
    : { success: true as const, data: {} as any };

  if (!validatedFilters.success) {
    return { error: "Invalid filters" };
  }

  try {
    // VENUE FILTERING: Get users from shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const filterData: any = validatedFilters.data;
    const where: any = {
      // VENUE FILTERING: Only show requests from shared venue users
      userId: { in: sharedVenueUserIds },
    };

    if (filterData.status) {
      where.status = filterData.status;
    }

    if (filterData.type) {
      where.type = filterData.type;
    }

    if (filterData.userId) {
      where.userId = filterData.userId;
    }

    if (filterData.startDate || filterData.endDate) {
      where.AND = [];

      if (filterData.startDate) {
        where.AND.push({
          endDate: { gte: filterData.startDate },
        });
      }

      if (filterData.endDate) {
        where.AND.push({
          startDate: { lte: filterData.endDate },
        });
      }
    }

    const requests = await prisma.timeOffRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            // PROFILE FIELDS:
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        reviewer: {
          select: {
            id: true,
            email: true,
            // PROFILE FIELDS:
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ startDate: "desc" }],
    });

    // Sort requests to prioritize current/upcoming ones
    // Order: Pending (upcoming first), then Approved/Rejected (upcoming first), then past requests
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const sortedRequests = requests.sort((a, b) => {
      const aEndDate = new Date(a.endDate);
      const bEndDate = new Date(b.endDate);

      aEndDate.setHours(0, 0, 0, 0);
      bEndDate.setHours(0, 0, 0, 0);

      const aIsUpcoming = aEndDate >= today;
      const bIsUpcoming = bEndDate >= today;
      const aIsPending = a.status === "PENDING";
      const bIsPending = b.status === "PENDING";

      // 1. Pending upcoming requests first
      if (aIsPending && aIsUpcoming && (!bIsPending || !bIsUpcoming)) return -1;
      if (bIsPending && bIsUpcoming && (!aIsPending || !aIsUpcoming)) return 1;

      // 2. Other upcoming requests
      if (aIsUpcoming && !bIsUpcoming) return -1;
      if (bIsUpcoming && !aIsUpcoming) return 1;

      // 3. Within same category (both upcoming or both past), sort by start date
      const aStartDate = new Date(a.startDate).getTime();
      const bStartDate = new Date(b.startDate).getTime();

      if (aIsUpcoming && bIsUpcoming) {
        // Upcoming: earliest first
        return aStartDate - bStartDate;
      } else {
        // Past: most recent first
        return bStartDate - aStartDate;
      }
    });

    return { success: true, requests: sortedRequests };
  } catch (error) {
    console.error("Error fetching all time-off requests:", error);
    return { error: "Failed to fetch time-off requests" };
  }
}

/**
 * Create a time-off request
 */
export async function createTimeOffRequest(data: CreateTimeOffRequestInput) {
  const user = await requireAuth();

  const validatedFields = createTimeOffRequestSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues[0]?.message || "Invalid fields" };
  }

  const { startDate, endDate, type, reason } = validatedFields.data;

  try {
    // Use transaction to prevent race condition when checking for overlaps
    const request = await prisma.$transaction(async (tx) => {
      // Check for overlapping requests
      const overlapping = await tx.timeOffRequest.findFirst({
        where: {
          userId: user.id,
          status: { in: ["PENDING", "APPROVED"] },
          OR: [
            {
              AND: [
                { startDate: { lte: startDate } },
                { endDate: { gte: startDate } },
              ],
            },
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: endDate } },
              ],
            },
            {
              AND: [
                { startDate: { gte: startDate } },
                { endDate: { lte: endDate } },
              ],
            },
          ],
        },
      });

      if (overlapping) {
        throw new Error(`You already have a ${overlapping.status.toLowerCase()} time-off request for overlapping dates`);
      }

      // Create the request within transaction
      return await tx.timeOffRequest.create({
        data: {
          userId: user.id,
          startDate,
          endDate,
          type,
          reason,
          status: "PENDING",
        },
      });
    });

    // Notify managers/admins about new time-off request
    try {
      // VENUE FILTERING: Get requester's venues (not all venues admin has access to)
      const requesterVenueIds = await getUserVenueIds(user.id);

      // Get all MANAGERS with permission to review time-off requests from requester's venues
      // EXCLUDES admins from venue-specific notifications
      const approvers = await prisma.user.findMany({
        where: {
          active: true,
          id: { not: user.id }, // SECURITY: Exclude requester from receiving own notifications
          // Only users in requester's venues
          venues: {
            some: {
              venueId: {
                in: requesterVenueIds,
              },
            },
          },
          // Must have approval permission
          role: {
            name: { not: "ADMIN" }, // EXCLUDE ADMINS from venue-specific notifications
            rolePermissions: {
              some: {
                permission: {
                  resource: "timeoff",
                  action: "update",
                },
              },
            },
          },
        },
        select: { id: true },
      });

      if (approvers.length > 0) {
        const requesterName = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email;

        await notifyTimeOffSubmitted(
          request.id,
          user.id,
          requesterName,
          startDate,
          endDate,
          approvers.map(a => a.id)
        );
      }
    } catch (error) {
      console.error("Error sending time-off notification:", error);
      // Don't fail the request if notification fails
    }

    revalidatePath("/time-off");
    revalidatePath("/admin/time-off");

    return { success: true, request };
  } catch (error: any) {
    console.error("Error creating time-off request:", error);

    // Check if error is about overlapping requests (from transaction)
    if (error.message && error.message.includes("overlapping dates")) {
      return { error: error.message };
    }

    return { error: "Failed to create time-off request" };
  }
}

/**
 * Cancel a time-off request (staff can only cancel their own pending requests)
 */
export async function cancelTimeOffRequest(data: UpdateTimeOffRequestInput) {
  const user = await requireAuth();

  const validatedFields = updateTimeOffRequestSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: "Invalid fields" };
  }

  const { id } = validatedFields.data;

  try {
    // Get the request
    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return { error: "Time-off request not found" };
    }

    // Check ownership
    if (request.userId !== user.id) {
      return { error: "You can only cancel your own requests" };
    }

    // Check status
    if (request.status !== "PENDING") {
      return { error: "You can only cancel pending requests" };
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    // Notify managers/admins about cancellation
    try {
      // VENUE FILTERING: Get users from shared venues
      const sharedVenueUserIds = await getSharedVenueUsers(user.id);

      // Get all users with permission to review time-off requests from shared venues
      const approvers = await prisma.user.findMany({
        where: {
          // VENUE FILTERING: Only notify approvers from shared venues
          id: { in: sharedVenueUserIds },
          active: true,
          role: {
            rolePermissions: {
              some: {
                permission: {
                  resource: "timeoff",
                  action: "update",
                },
              },
            },
          },
        },
        select: { id: true },
      });

      if (approvers.length > 0) {
        const requesterName = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`
          : user.email;

        await notifyTimeOffCancelled(
          request.id,
          user.id,
          requesterName,
          request.startDate,
          request.endDate,
          approvers.map(a => a.id)
        );
      }
    } catch (error) {
      console.error("Error sending time-off cancellation notification:", error);
      // Don't fail the cancellation if notification fails
    }

    revalidatePath("/time-off");
    revalidatePath("/admin/time-off");

    return { success: true, request: updated };
  } catch (error) {
    console.error("Error cancelling time-off request:", error);
    return { error: "Failed to cancel time-off request" };
  }
}

/**
 * Review a time-off request (Manager/Admin only)
 * ENHANCED: Now checks venue-scoped permissions
 */
export async function reviewTimeOffRequest(data: ReviewTimeOffRequestInput) {
  const user = await requireAuth();

  const validatedFields = reviewTimeOffRequestSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues[0]?.message || "Invalid fields" };
  }

  const { id, status, notes } = validatedFields.data;

  try {
    // Get the request with requester's venue information
    // Include version field for optimistic locking
    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: {
        user: {
          include: {
            venues: {
              where: { isPrimary: true },
              include: {
                venue: true,
              },
            },
          },
        },
      },
    });

    if (!request) {
      return { error: "Time-off request not found" };
    }

    // SECURITY: Prevent self-approval vulnerability
    // Managers cannot approve or reject their own time-off requests
    if (request.userId === user.id) {
      return { error: "You cannot approve or reject your own time-off request" };
    }

    // Store the current version for optimistic locking
    const currentVersion = request.version;

    // Get requester's primary venue
    const requesterPrimaryVenue = request.user.venues.find((uv) => uv.isPrimary);

    if (!requesterPrimaryVenue) {
      // Fallback to global permission check if no venue assigned
      const hasAccess = await canAccess("timeoff", "approve");
      if (!hasAccess) {
        return { error: "You don't have permission to review time-off requests" };
      }
    } else {
      // VENUE-SCOPED PERMISSION CHECK: Check if reviewer has approval permission at requester's venue
      const hasVenueAccess = await canAccessVenue(
        "timeoff",
        "approve",
        requesterPrimaryVenue.venueId
      );

      if (!hasVenueAccess) {
        return {
          error: `You don't have permission to approve time-off requests for ${requesterPrimaryVenue.venue.name}`
        };
      }
    }

    // VENUE FILTERING: Double-check shared venues for additional safety
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    if (!sharedVenueUserIds.includes(request.userId)) {
      return { error: "You don't have access to this time-off request" };
    }

    // Check if already reviewed
    if (request.status !== "PENDING") {
      return { error: `This request has already been ${request.status.toLowerCase()}` };
    }

    // Optimistic locking: Update only if version matches
    const updated = await prisma.timeOffRequest.updateMany({
      where: {
        id,
        version: currentVersion, // Only update if version hasn't changed
      },
      data: {
        status,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        notes,
        version: { increment: 1 }, // Increment version
      },
    });

    // Check if update was successful (row count > 0 means version matched)
    if (updated.count === 0) {
      return {
        error: "This request has been modified by another user. Please refresh and try again."
      };
    }

    // Fetch the updated request with user details for notifications
    const updatedRequest = await prisma.timeOffRequest.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            // PROFILE FIELDS:
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!updatedRequest) {
      return { error: "Failed to fetch updated request" };
    }

    // Create audit log
    try {
      const requesterName = updatedRequest.user.firstName && updatedRequest.user.lastName
        ? `${updatedRequest.user.firstName} ${updatedRequest.user.lastName}`
        : updatedRequest.user.email;

      await createAuditLog({
        userId: user.id,
        actionType: status === "APPROVED" ? "TIMEOFF_APPROVED" : "TIMEOFF_REJECTED",
        resourceType: "TimeOffRequest",
        resourceId: id,
        oldValue: JSON.stringify({
          requestId: id,
          status: "PENDING",
          userId: request.userId,
          requesterName,
          startDate: request.startDate,
          endDate: request.endDate,
          type: request.type,
        }),
        newValue: JSON.stringify({
          requestId: id,
          status,
          userId: request.userId,
          requesterName,
          reviewerId: user.id,
          startDate: request.startDate,
          endDate: request.endDate,
          type: request.type,
          notes: notes || null,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail the review if audit log fails
    }

    // Notify requester about decision
    try {
      const reviewerName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

      if (status === "APPROVED") {
        await notifyTimeOffApproved(
          request.id,
          request.userId,
          user.id,
          reviewerName,
          request.startDate,
          request.endDate
        );

        // IMPORTANT: Recalculate conflicts for all existing shifts during this time-off period
        // This ensures that any shifts that now conflict with the approved time-off are flagged
        await recalculateShiftConflictsForTimeOff(
          request.userId,
          request.startDate,
          request.endDate
        );
      } else if (status === "REJECTED") {
        await notifyTimeOffRejected(
          request.id,
          request.userId,
          user.id,
          reviewerName,
          request.startDate,
          request.endDate,
          notes || undefined
        );
      }
    } catch (error) {
      console.error("Error sending time-off decision notification:", error);
      // Don't fail the review if notification fails
    }

    revalidatePath("/time-off");
    revalidatePath("/admin/time-off");

    return { success: true, request: updatedRequest };
  } catch (error) {
    console.error("Error reviewing time-off request:", error);
    return { error: "Failed to review time-off request" };
  }
}

/**
 * Get time-off statistics (for dashboard)
 */
export async function getTimeOffStats() {
  const user = await requireAuth();

  try {
    const [myRequests, pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.timeOffRequest.count({
        where: { userId: user.id },
      }),
      prisma.timeOffRequest.count({
        where: { userId: user.id, status: "PENDING" },
      }),
      prisma.timeOffRequest.count({
        where: { userId: user.id, status: "APPROVED" },
      }),
      prisma.timeOffRequest.count({
        where: { userId: user.id, status: "REJECTED" },
      }),
    ]);

    return {
      success: true,
      stats: {
        total: myRequests,
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
    };
  } catch (error) {
    console.error("Error fetching time-off stats:", error);
    return { error: "Failed to fetch time-off statistics" };
  }
}

/**
 * Get pending time-off requests count (for managers)
 * ENHANCED: Respects venue-scoped permissions
 */
export async function getPendingTimeOffCount() {
  const user = await requireAuth();

  const hasAccess = await canAccess("timeoff", "view_team");
  if (!hasAccess) {
    return { count: 0 };
  }

  try {
    // VENUE FILTERING: Get users from shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const count = await prisma.timeOffRequest.count({
      where: {
        status: "PENDING",
        // VENUE FILTERING: Only count requests from shared venue users
        userId: { in: sharedVenueUserIds },
      },
    });

    return { success: true, count };
  } catch (error) {
    console.error("Error fetching pending count:", error);
    return { count: 0 };
  }
}
