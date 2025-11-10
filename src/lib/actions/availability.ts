"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import {
  updateAvailabilitySchema,
  bulkUpdateAvailabilitySchema,
  validateTimeRange,
  ALL_DAY_START,
  ALL_DAY_END,
  type UpdateAvailabilityInput,
  type BulkUpdateAvailabilityInput,
} from "@/lib/schemas/availability";

/**
 * Get current user's availability for all days of the week
 */
export async function getMyAvailability() {
  const user = await requireAuth();

  try {
    const availability = await prisma.availability.findMany({
      where: { userId: user.id },
      orderBy: { dayOfWeek: "asc" },
    });

    // Ensure all 7 days exist (create defaults if missing)
    const allDays = [];
    for (let day = 0; day < 7; day++) {
      const existing = availability.find((a) => a.dayOfWeek === day);
      if (existing) {
        allDays.push(existing);
      } else {
        // Create default availability for missing days
        const newAvailability = await prisma.availability.create({
          data: {
            userId: user.id,
            dayOfWeek: day,
            isAvailable: false,
            isAllDay: false,
            startTime: null,
            endTime: null,
          },
        });
        allDays.push(newAvailability);
      }
    }

    return { success: true, availability: allDays };
  } catch (error) {
    console.error("Error fetching availability:", error);
    return { error: "Failed to fetch availability" };
  }
}

/**
 * Update availability for a single day
 */
export async function updateAvailability(data: UpdateAvailabilityInput) {
  const user = await requireAuth();

  const validatedFields = updateAvailabilitySchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues[0]?.message || "Invalid fields" };
  }

  const { dayOfWeek, isAvailable, isAllDay, startTime, endTime } = validatedFields.data;

  // Set times based on availability and all-day status
  let finalStartTime = startTime;
  let finalEndTime = endTime;

  if (!isAvailable) {
    // Not available: clear times
    finalStartTime = null;
    finalEndTime = null;
  } else if (isAllDay) {
    // All day: set to 00:00 - 23:59
    finalStartTime = ALL_DAY_START;
    finalEndTime = ALL_DAY_END;
  } else {
    // Specific times: validate
    if (!startTime || !endTime) {
      return { error: "Start and end times are required when not all day" };
    }
    if (!validateTimeRange(startTime, endTime)) {
      return { error: "End time must be after start time" };
    }
  }

  try {
    const availability = await prisma.availability.upsert({
      where: {
        userId_dayOfWeek: {
          userId: user.id,
          dayOfWeek,
        },
      },
      update: {
        isAvailable,
        isAllDay,
        startTime: finalStartTime,
        endTime: finalEndTime,
      },
      create: {
        userId: user.id,
        dayOfWeek,
        isAvailable,
        isAllDay,
        startTime: finalStartTime,
        endTime: finalEndTime,
      },
    });

    revalidatePath("/availability");
    revalidatePath("/admin/availability");

    return { success: true, availability };
  } catch (error) {
    console.error("Error updating availability:", error);
    return { error: "Failed to update availability" };
  }
}

/**
 * Bulk update availability for multiple days
 */
export async function bulkUpdateAvailability(data: BulkUpdateAvailabilityInput) {
  const user = await requireAuth();

  const validatedFields = bulkUpdateAvailabilitySchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues[0]?.message || "Invalid fields" };
  }

  const { availability } = validatedFields.data;

  // Process each day's data
  const processedData = availability.map((day) => {
    let finalStartTime = day.startTime;
    let finalEndTime = day.endTime;

    if (!day.isAvailable) {
      // Not available: clear times
      finalStartTime = null;
      finalEndTime = null;
    } else if (day.isAllDay) {
      // All day: set to 00:00 - 23:59
      finalStartTime = ALL_DAY_START;
      finalEndTime = ALL_DAY_END;
    } else {
      // Specific times: validate
      if (!day.startTime || !day.endTime) {
        throw new Error(`Day ${day.dayOfWeek}: Start and end times are required when not all day`);
      }
      if (!validateTimeRange(day.startTime, day.endTime)) {
        throw new Error(`Day ${day.dayOfWeek}: End time must be after start time`);
      }
    }

    return {
      dayOfWeek: day.dayOfWeek,
      isAvailable: day.isAvailable,
      isAllDay: day.isAllDay,
      startTime: finalStartTime,
      endTime: finalEndTime,
    };
  });

  try {
    // Update all days in a transaction
    const results = await prisma.$transaction(
      processedData.map((day) =>
        prisma.availability.upsert({
          where: {
            userId_dayOfWeek: {
              userId: user.id,
              dayOfWeek: day.dayOfWeek,
            },
          },
          update: {
            isAvailable: day.isAvailable,
            isAllDay: day.isAllDay,
            startTime: day.startTime,
            endTime: day.endTime,
          },
          create: {
            userId: user.id,
            dayOfWeek: day.dayOfWeek,
            isAvailable: day.isAvailable,
            isAllDay: day.isAllDay,
            startTime: day.startTime,
            endTime: day.endTime,
          },
        })
      )
    );

    revalidatePath("/availability");
    revalidatePath("/admin/availability");

    return { success: true, availability: results };
  } catch (error: any) {
    console.error("Error bulk updating availability:", error);
    return { error: error.message || "Failed to update availability" };
  }
}

/**
 * Get all users' availability (Admin/Manager only)
 * Filtered by venues: Managers only see availability for users in their shared venues
 * ENHANCED: Now uses venue-scoped permissions
 */
export async function getAllUsersAvailability(filters?: {
  dayOfWeek?: number;
  storeId?: string;
}) {
  const user = await requireAuth();

  // Check if user has permission to view team availability
  const hasAccess = await canAccess("availability", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team availability" };
  }

  try {
    // VENUE FILTERING: Get users in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const users = await prisma.user.findMany({
      where: {
        active: true,
        // VENUE FILTERING: Only show users from shared venues
        id: {
          in: sharedVenueUserIds,
        },
        ...(filters?.storeId && { storeId: filters.storeId }),
      },
      select: {
        id: true,
        email: true,
        // PROFILE FIELDS: Include name and avatar
        firstName: true,
        lastName: true,
        profileImage: true,
        role: {
          select: {
            id: true,
            name: true,
          },
        },
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        availability: {
          where: {
            ...(filters?.dayOfWeek !== undefined && {
              dayOfWeek: filters.dayOfWeek,
            }),
          },
          orderBy: { dayOfWeek: "asc" },
        },
      },
      orderBy: { email: "asc" },
    });

    return { success: true, users };
  } catch (error) {
    console.error("Error fetching all availability:", error);
    return { error: "Failed to fetch availability" };
  }
}

/**
 * Get availability statistics (Admin/Manager only)
 * Filtered by venues: Managers only see stats for users in their shared venues
 * ENHANCED: Now uses venue-scoped permissions
 */
export async function getAvailabilityStats() {
  const user = await requireAuth();

  const hasAccess = await canAccess("availability", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team availability stats" };
  }

  try {
    // VENUE FILTERING: Get users in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const [totalUsers, availabilityByDay] = await Promise.all([
      // VENUE FILTERING: Count only users in shared venues
      prisma.user.count({
        where: {
          active: true,
          id: { in: sharedVenueUserIds },
        }
      }),
      // VENUE FILTERING: Group only availability from shared venue users
      prisma.availability.groupBy({
        by: ["dayOfWeek", "isAvailable"],
        where: {
          userId: { in: sharedVenueUserIds },
        },
        _count: true,
      }),
    ]);

    // Calculate stats per day
    const statsByDay = Array.from({ length: 7 }, (_, dayOfWeek) => {
      const available = availabilityByDay.find(
        (stat) => stat.dayOfWeek === dayOfWeek && stat.isAvailable
      )?._count || 0;

      const unavailable = availabilityByDay.find(
        (stat) => stat.dayOfWeek === dayOfWeek && !stat.isAvailable
      )?._count || 0;

      const notSet = totalUsers - (available + unavailable);

      return {
        dayOfWeek,
        available,
        unavailable,
        notSet,
        total: totalUsers,
        percentage: totalUsers > 0 ? Math.round((available / totalUsers) * 100) : 0,
      };
    });

    // Calculate users with at least one day configured
    // VENUE FILTERING: Count only shared venue users
    const usersWithAvailability = await prisma.user.count({
      where: {
        active: true,
        id: { in: sharedVenueUserIds },
        availability: {
          some: {
            isAvailable: true,
          },
        },
      },
    });

    return {
      success: true,
      stats: {
        totalUsers,
        usersConfigured: usersWithAvailability,
        usersNotConfigured: totalUsers - usersWithAvailability,
        byDay: statsByDay,
      },
    };
  } catch (error) {
    console.error("Error fetching availability stats:", error);
    return { error: "Failed to fetch availability statistics" };
  }
}
