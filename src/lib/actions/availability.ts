"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import {
  updateAvailabilitySchema,
  bulkUpdateAvailabilitySchema,
  validateTimeRange,
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
    return { error: "Invalid fields" };
  }

  const { dayOfWeek, isAvailable, startTime, endTime } = validatedFields.data;

  // Validate time range
  if (isAvailable && startTime && endTime) {
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
        startTime: isAvailable ? startTime : null,
        endTime: isAvailable ? endTime : null,
      },
      create: {
        userId: user.id,
        dayOfWeek,
        isAvailable,
        startTime: isAvailable ? startTime : null,
        endTime: isAvailable ? endTime : null,
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
    return { error: "Invalid fields" };
  }

  const { availability } = validatedFields.data;

  // Validate all time ranges
  for (const day of availability) {
    if (day.isAvailable && day.startTime && day.endTime) {
      if (!validateTimeRange(day.startTime, day.endTime)) {
        return { error: `Invalid time range for day ${day.dayOfWeek}` };
      }
    }
  }

  try {
    // Update all days in a transaction
    const results = await prisma.$transaction(
      availability.map((day) =>
        prisma.availability.upsert({
          where: {
            userId_dayOfWeek: {
              userId: user.id,
              dayOfWeek: day.dayOfWeek,
            },
          },
          update: {
            isAvailable: day.isAvailable,
            startTime: day.isAvailable ? day.startTime : null,
            endTime: day.isAvailable ? day.endTime : null,
          },
          create: {
            userId: user.id,
            dayOfWeek: day.dayOfWeek,
            isAvailable: day.isAvailable,
            startTime: day.isAvailable ? day.startTime : null,
            endTime: day.isAvailable ? day.endTime : null,
          },
        })
      )
    );

    revalidatePath("/availability");
    revalidatePath("/admin/availability");

    return { success: true, availability: results };
  } catch (error) {
    console.error("Error bulk updating availability:", error);
    return { error: "Failed to update availability" };
  }
}

/**
 * Get all users' availability (Admin/Manager only)
 */
export async function getAllUsersAvailability(filters?: {
  dayOfWeek?: number;
  isAvailable?: boolean;
  storeId?: string;
}) {
  const user = await requireAuth();

  // Check if user has permission to view all availability
  const hasAccess = await canAccess("availability", "read");
  if (!hasAccess) {
    return { error: "You don't have permission to view all availability" };
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        active: true,
        ...(filters?.storeId && { storeId: filters.storeId }),
      },
      include: {
        role: true,
        store: true,
        availability: {
          where: {
            ...(filters?.dayOfWeek !== undefined && {
              dayOfWeek: filters.dayOfWeek,
            }),
            ...(filters?.isAvailable !== undefined && {
              isAvailable: filters.isAvailable,
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
 * Get availability statistics (Admin only)
 */
export async function getAvailabilityStats() {
  const user = await requireAuth();

  const hasAccess = await canAccess("availability", "read");
  if (!hasAccess) {
    return { error: "You don't have permission to view availability stats" };
  }

  try {
    const [totalUsers, availabilityByDay] = await Promise.all([
      prisma.user.count({ where: { active: true } }),
      prisma.availability.groupBy({
        by: ["dayOfWeek", "isAvailable"],
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
      };
    });

    return {
      success: true,
      stats: {
        totalUsers,
        byDay: statsByDay,
      },
    };
  } catch (error) {
    console.error("Error fetching availability stats:", error);
    return { error: "Failed to fetch availability statistics" };
  }
}
