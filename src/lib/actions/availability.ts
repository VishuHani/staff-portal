"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import {
  addAvailabilitySlotSchema,
  updateAvailabilitySlotSchema,
  removeAvailabilitySlotSchema,
  bulkUpdateAvailabilitySchema,
  validateNoOverlaps,
  getOverlapError,
  MAX_SLOTS_PER_DAY,
  type AddAvailabilitySlotInput,
  type UpdateAvailabilitySlotInput,
  type RemoveAvailabilitySlotInput,
  type BulkUpdateAvailabilityInput,
  type TimeSlot,
} from "@/lib/schemas/availability";

/**
 * Get current user's availability - grouped by day with multiple slots
 */
export async function getMyAvailability() {
  const user = await requireAuth();

  try {
    const slots = await prisma.availability.findMany({
      where: { userId: user.id },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    // Group slots by day and sort chronologically
    const availabilityByDay: Record<number, TimeSlot[]> = {};

    for (let day = 0; day < 7; day++) {
      const daySlots = slots
        .filter((slot) => slot.dayOfWeek === day)
        .map((slot) => ({
          id: slot.id,
          startTime: slot.startTime,
          endTime: slot.endTime,
        }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      availabilityByDay[day] = daySlots;
    }

    return { success: true, availability: availabilityByDay };
  } catch (error) {
    console.error("Error fetching availability:", error);
    return { error: "Failed to fetch availability" };
  }
}

/**
 * Add a new availability slot
 */
export async function addAvailabilitySlot(data: AddAvailabilitySlotInput) {
  const user = await requireAuth();

  const validatedFields = addAvailabilitySlotSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.errors[0]?.message || "Invalid fields" };
  }

  const { dayOfWeek, startTime, endTime } = validatedFields.data;

  try {
    // Check existing slots for this day
    const existingSlots = await prisma.availability.findMany({
      where: {
        userId: user.id,
        dayOfWeek,
      },
    });

    // Validate max slots per day
    if (existingSlots.length >= MAX_SLOTS_PER_DAY) {
      return { error: `Maximum ${MAX_SLOTS_PER_DAY} slots allowed per day` };
    }

    // Check for overlaps with existing slots
    const allSlots: TimeSlot[] = [
      ...existingSlots.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      { startTime, endTime },
    ];

    if (!validateNoOverlaps(allSlots)) {
      const overlapError = getOverlapError(allSlots);
      return { error: overlapError || "Time slots overlap" };
    }

    // Create new slot
    const slot = await prisma.availability.create({
      data: {
        userId: user.id,
        dayOfWeek,
        startTime,
        endTime,
      },
    });

    revalidatePath("/availability");
    revalidatePath("/admin/availability");

    return { success: true, slot };
  } catch (error) {
    console.error("Error adding availability slot:", error);
    return { error: "Failed to add availability slot" };
  }
}

/**
 * Update an existing availability slot
 */
export async function updateAvailabilitySlot(data: UpdateAvailabilitySlotInput) {
  const user = await requireAuth();

  const validatedFields = updateAvailabilitySlotSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.errors[0]?.message || "Invalid fields" };
  }

  const { slotId, startTime, endTime } = validatedFields.data;

  try {
    // Verify slot belongs to user
    const existingSlot = await prisma.availability.findUnique({
      where: { id: slotId },
    });

    if (!existingSlot) {
      return { error: "Slot not found" };
    }

    if (existingSlot.userId !== user.id) {
      return { error: "You don't have permission to update this slot" };
    }

    // Get all other slots for the same day
    const otherSlots = await prisma.availability.findMany({
      where: {
        userId: user.id,
        dayOfWeek: existingSlot.dayOfWeek,
        id: { not: slotId },
      },
    });

    // Check for overlaps
    const allSlots: TimeSlot[] = [
      ...otherSlots.map((s) => ({
        id: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
      })),
      { id: slotId, startTime, endTime },
    ];

    if (!validateNoOverlaps(allSlots)) {
      const overlapError = getOverlapError(allSlots);
      return { error: overlapError || "Time slots overlap" };
    }

    // Update slot
    const slot = await prisma.availability.update({
      where: { id: slotId },
      data: { startTime, endTime },
    });

    revalidatePath("/availability");
    revalidatePath("/admin/availability");

    return { success: true, slot };
  } catch (error) {
    console.error("Error updating availability slot:", error);
    return { error: "Failed to update availability slot" };
  }
}

/**
 * Remove an availability slot
 */
export async function removeAvailabilitySlot(data: RemoveAvailabilitySlotInput) {
  const user = await requireAuth();

  const validatedFields = removeAvailabilitySlotSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: "Invalid slot ID" };
  }

  const { slotId } = validatedFields.data;

  try {
    // Verify slot belongs to user
    const existingSlot = await prisma.availability.findUnique({
      where: { id: slotId },
    });

    if (!existingSlot) {
      return { error: "Slot not found" };
    }

    if (existingSlot.userId !== user.id) {
      return { error: "You don't have permission to remove this slot" };
    }

    // Delete slot
    await prisma.availability.delete({
      where: { id: slotId },
    });

    revalidatePath("/availability");
    revalidatePath("/admin/availability");

    return { success: true };
  } catch (error) {
    console.error("Error removing availability slot:", error);
    return { error: "Failed to remove availability slot" };
  }
}

/**
 * Bulk update availability for multiple days with multiple slots
 */
export async function bulkUpdateAvailability(data: BulkUpdateAvailabilityInput) {
  const user = await requireAuth();

  const validatedFields = bulkUpdateAvailabilitySchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.errors[0]?.message || "Invalid fields" };
  }

  const { availability } = validatedFields.data;

  try {
    // Validate each day's slots
    for (const [dayStr, slots] of Object.entries(availability)) {
      const day = parseInt(dayStr);

      // Check max slots
      if (slots.length > MAX_SLOTS_PER_DAY) {
        return { error: `Maximum ${MAX_SLOTS_PER_DAY} slots allowed per day` };
      }

      // Check for overlaps
      if (slots.length > 0 && !validateNoOverlaps(slots)) {
        const overlapError = getOverlapError(slots);
        return { error: `Day ${day}: ${overlapError || "Time slots overlap"}` };
      }
    }

    // Update in transaction
    await prisma.$transaction(async (tx) => {
      // Delete all existing availability for this user
      await tx.availability.deleteMany({
        where: { userId: user.id },
      });

      // Create new slots
      const createOperations = [];
      for (const [dayStr, slots] of Object.entries(availability)) {
        const dayOfWeek = parseInt(dayStr);

        for (const slot of slots) {
          createOperations.push(
            tx.availability.create({
              data: {
                userId: user.id,
                dayOfWeek,
                startTime: slot.startTime,
                endTime: slot.endTime,
              },
            })
          );
        }
      }

      await Promise.all(createOperations);
    });

    revalidatePath("/availability");
    revalidatePath("/admin/availability");

    return { success: true };
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
          },
          orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
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
    const [totalUsers, allSlots] = await Promise.all([
      prisma.user.count({ where: { active: true } }),
      prisma.availability.findMany({
        select: {
          userId: true,
          dayOfWeek: true,
        },
      }),
    ]);

    // Calculate stats per day
    const statsByDay = Array.from({ length: 7 }, (_, dayOfWeek) => {
      // Get unique users with at least one slot on this day
      const usersWithSlots = new Set(
        allSlots.filter((slot) => slot.dayOfWeek === dayOfWeek).map((slot) => slot.userId)
      );

      const available = usersWithSlots.size;
      const unavailable = totalUsers - available;

      return {
        dayOfWeek,
        available,
        unavailable,
        total: totalUsers,
        percentage: totalUsers > 0 ? Math.round((available / totalUsers) * 100) : 0,
      };
    });

    // Calculate users with at least one day configured
    const usersWithAnySlots = new Set(allSlots.map((slot) => slot.userId));
    const usersConfigured = usersWithAnySlots.size;

    return {
      success: true,
      stats: {
        totalUsers,
        usersConfigured,
        usersNotConfigured: totalUsers - usersConfigured,
        byDay: statsByDay,
      },
    };
  } catch (error) {
    console.error("Error fetching availability stats:", error);
    return { error: "Failed to fetch availability statistics" };
  }
}
