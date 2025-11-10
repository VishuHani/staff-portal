"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac/access";
import {
  createVenueSchema,
  updateVenueSchema,
  deleteVenueSchema,
  toggleVenueActiveSchema,
  type CreateVenueInput,
  type UpdateVenueInput,
  type DeleteVenueInput,
  type ToggleVenueActiveInput,
} from "@/lib/schemas/admin/venues";

/**
 * Get all venues
 * Admin only
 */
export async function getAllVenues() {
  await requireAdmin();

  try {
    const venues = await prisma.store.findMany({
      include: {
        _count: {
          select: {
            userVenues: true, // Count of users assigned to this venue
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, venues };
  } catch (error) {
    console.error("Error fetching venues:", error);
    return { error: "Failed to fetch venues" };
  }
}

/**
 * Get a single venue by ID
 * Admin only
 */
export async function getVenueById(venueId: string) {
  await requireAdmin();

  try {
    const venue = await prisma.store.findUnique({
      where: { id: venueId },
      include: {
        userVenues: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                profileImage: true,
                active: true,
                role: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        _count: {
          select: {
            userVenues: true,
          },
        },
      },
    });

    if (!venue) {
      return { error: "Venue not found" };
    }

    return { success: true, venue };
  } catch (error) {
    console.error("Error fetching venue:", error);
    return { error: "Failed to fetch venue" };
  }
}

/**
 * Get venue statistics
 * Admin only
 */
export async function getVenueStats() {
  await requireAdmin();

  try {
    const [total, active, inactive] = await Promise.all([
      prisma.store.count(),
      prisma.store.count({ where: { active: true } }),
      prisma.store.count({ where: { active: false } }),
    ]);

    return {
      success: true,
      stats: {
        total,
        active,
        inactive,
      },
    };
  } catch (error) {
    console.error("Error fetching venue stats:", error);
    return { error: "Failed to fetch venue statistics" };
  }
}

/**
 * Create a new venue
 * Admin only
 */
export async function createVenue(data: CreateVenueInput) {
  await requireAdmin();

  const validatedFields = createVenueSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { name, code, address, phone, email, active } = validatedFields.data;

  try {
    // Check if code already exists
    const existingVenue = await prisma.store.findUnique({
      where: { code },
    });

    if (existingVenue) {
      return { error: "A venue with this code already exists" };
    }

    const venue = await prisma.store.create({
      data: {
        name,
        code,
        active,
      },
    });

    revalidatePath("/admin/stores");

    return { success: true, venue };
  } catch (error) {
    console.error("Error creating venue:", error);
    return { error: "Failed to create venue" };
  }
}

/**
 * Update a venue
 * Admin only
 */
export async function updateVenue(data: UpdateVenueInput) {
  await requireAdmin();

  const validatedFields = updateVenueSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { venueId, name, code, address, phone, email, active } = validatedFields.data;

  try {
    // Check if code is already taken by another venue
    if (code) {
      const existingVenue = await prisma.store.findFirst({
        where: {
          code,
          NOT: {
            id: venueId,
          },
        },
      });

      if (existingVenue) {
        return { error: "Venue code already in use" };
      }
    }

    const venue = await prisma.store.update({
      where: { id: venueId },
      data: {
        ...(name && { name }),
        ...(code && { code }),
        ...(active !== undefined && { active }),
      },
      include: {
        _count: {
          select: {
            userVenues: true,
          },
        },
      },
    });

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${venueId}`);

    return { success: true, venue };
  } catch (error) {
    console.error("Error updating venue:", error);
    return { error: "Failed to update venue" };
  }
}

/**
 * Delete a venue
 * Admin only
 *
 * Note: This will also delete all UserVenue assignments due to cascade
 */
export async function deleteVenue(data: DeleteVenueInput) {
  await requireAdmin();

  const validatedFields = deleteVenueSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { venueId } = validatedFields.data;

  try {
    // Check if venue has users assigned
    const userCount = await prisma.userVenue.count({
      where: { venueId },
    });

    if (userCount > 0) {
      return {
        error: `Cannot delete venue: ${userCount} user${userCount !== 1 ? "s are" : " is"} assigned to this venue. Please reassign users first.`,
      };
    }

    // Check if this is a user's storeId (legacy field)
    const legacyUserCount = await prisma.user.count({
      where: { storeId: venueId },
    });

    if (legacyUserCount > 0) {
      return {
        error: `Cannot delete venue: ${legacyUserCount} user${legacyUserCount !== 1 ? "s have" : " has"} this venue set as their store. Please update users first.`,
      };
    }

    await prisma.store.delete({
      where: { id: venueId },
    });

    revalidatePath("/admin/stores");

    return { success: true };
  } catch (error) {
    console.error("Error deleting venue:", error);
    return { error: "Failed to delete venue" };
  }
}

/**
 * Toggle venue active status
 * Admin only
 */
export async function toggleVenueActive(data: ToggleVenueActiveInput) {
  await requireAdmin();

  const validatedFields = toggleVenueActiveSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { venueId } = validatedFields.data;

  try {
    // Get current venue state
    const venue = await prisma.store.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      return { error: "Venue not found" };
    }

    const newActiveStatus = !venue.active;

    // Toggle the active status
    const updatedVenue = await prisma.store.update({
      where: { id: venueId },
      data: { active: newActiveStatus },
      include: {
        _count: {
          select: {
            userVenues: true,
          },
        },
      },
    });

    revalidatePath("/admin/stores");
    revalidatePath(`/admin/stores/${venueId}`);

    return { success: true, venue: updatedVenue };
  } catch (error) {
    console.error("Error toggling venue active status:", error);
    return { error: "Failed to toggle venue status" };
  }
}

/**
 * Get all active venues (for dropdowns, etc.)
 * Admin only
 */
export async function getActiveVenues() {
  await requireAdmin();

  try {
    const venues = await prisma.store.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, venues };
  } catch (error) {
    console.error("Error fetching active venues:", error);
    return { error: "Failed to fetch venues" };
  }
}
