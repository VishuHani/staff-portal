"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
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
 */
export async function getAllTimeOffRequests(filters?: FilterTimeOffRequestsInput) {
  const user = await requireAuth();

  const hasAccess = await canAccess("timeoff", "read");
  if (!hasAccess) {
    return { error: "You don't have permission to view all time-off requests" };
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
            store: {
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
      orderBy: [{ status: "asc" }, { startDate: "asc" }],
    });

    return { success: true, requests };
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
    // Check for overlapping requests
    const overlapping = await prisma.timeOffRequest.findFirst({
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
      return {
        error: `You already have a ${overlapping.status.toLowerCase()} time-off request for overlapping dates`,
      };
    }

    const request = await prisma.timeOffRequest.create({
      data: {
        userId: user.id,
        startDate,
        endDate,
        type,
        reason,
        status: "PENDING",
      },
    });

    // Notify managers/admins about new time-off request
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
  } catch (error) {
    console.error("Error creating time-off request:", error);
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
 */
export async function reviewTimeOffRequest(data: ReviewTimeOffRequestInput) {
  const user = await requireAuth();

  const hasAccess = await canAccess("timeoff", "update");
  if (!hasAccess) {
    return { error: "You don't have permission to review time-off requests" };
  }

  const validatedFields = reviewTimeOffRequestSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues[0]?.message || "Invalid fields" };
  }

  const { id, status, notes } = validatedFields.data;

  try {
    // VENUE FILTERING: Get users from shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Get the request
    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return { error: "Time-off request not found" };
    }

    // VENUE FILTERING: Check if request is from a user in shared venues
    if (!sharedVenueUserIds.includes(request.userId)) {
      return { error: "You don't have access to this time-off request" };
    }

    // Check if already reviewed
    if (request.status !== "PENDING") {
      return { error: `This request has already been ${request.status.toLowerCase()}` };
    }

    const updated = await prisma.timeOffRequest.update({
      where: { id },
      data: {
        status,
        reviewedBy: user.id,
        reviewedAt: new Date(),
        notes,
      },
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

    return { success: true, request: updated };
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
 */
export async function getPendingTimeOffCount() {
  const user = await requireAuth();

  const hasAccess = await canAccess("timeoff", "read");
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
