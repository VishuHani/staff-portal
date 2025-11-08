"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
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

  const hasAccess = await canAccess("time_off", "read");
  if (!hasAccess) {
    return { error: "You don't have permission to view all time-off requests" };
  }

  const validatedFilters = filters
    ? filterTimeOffRequestsSchema.safeParse(filters)
    : { success: true, data: {} };

  if (!validatedFilters.success) {
    return { error: "Invalid filters" };
  }

  try {
    const where: any = {};

    if (validatedFilters.data.status) {
      where.status = validatedFilters.data.status;
    }

    if (validatedFilters.data.type) {
      where.type = validatedFilters.data.type;
    }

    if (validatedFilters.data.userId) {
      where.userId = validatedFilters.data.userId;
    }

    if (validatedFilters.data.startDate || validatedFilters.data.endDate) {
      where.AND = [];

      if (validatedFilters.data.startDate) {
        where.AND.push({
          endDate: { gte: validatedFilters.data.startDate },
        });
      }

      if (validatedFilters.data.endDate) {
        where.AND.push({
          startDate: { lte: validatedFilters.data.endDate },
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
    return { error: validatedFields.error.errors[0]?.message || "Invalid fields" };
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

  const hasAccess = await canAccess("time_off", "update");
  if (!hasAccess) {
    return { error: "You don't have permission to review time-off requests" };
  }

  const validatedFields = reviewTimeOffRequestSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.errors[0]?.message || "Invalid fields" };
  }

  const { id, status, notes } = validatedFields.data;

  try {
    // Get the request
    const request = await prisma.timeOffRequest.findUnique({
      where: { id },
    });

    if (!request) {
      return { error: "Time-off request not found" };
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
            email: true,
          },
        },
      },
    });

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

  const hasAccess = await canAccess("time_off", "read");
  if (!hasAccess) {
    return { count: 0 };
  }

  try {
    const count = await prisma.timeOffRequest.count({
      where: { status: "PENDING" },
    });

    return { success: true, count };
  } catch (error) {
    console.error("Error fetching pending count:", error);
    return { count: 0 };
  }
}
