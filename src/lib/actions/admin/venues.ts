"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAnyPermission } from "@/lib/rbac/access";
import { getUserVenueIds } from "@/lib/utils/venue";
import { isAdmin } from "@/lib/rbac/permissions";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import {
  actionFailure,
  actionSuccess,
  isPrismaUniqueViolation,
  logActionError,
  revalidatePaths,
  type ActionResult,
} from "@/lib/utils/action-contract";
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
export async function getAllVenues(): Promise<
  ActionResult<{ venues: Awaited<ReturnType<typeof prisma.venue.findMany>> }>
> {
  await requireAdmin();

  try {
    const venues = await prisma.venue.findMany({
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

    return actionSuccess({ venues });
  } catch (error) {
    logActionError("Error fetching venues", error);
    return actionFailure("Failed to fetch venues");
  }
}

/**
 * Get a single venue by ID
 * Admin only
 */
export async function getVenueById(
  venueId: string
): Promise<
  ActionResult<{
    venue: NonNullable<Awaited<ReturnType<typeof prisma.venue.findUnique>>>;
  }>
> {
  await requireAdmin();

  try {
    const venue = await prisma.venue.findUnique({
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
      return actionFailure("Venue not found");
    }

    return actionSuccess({ venue });
  } catch (error) {
    logActionError("Error fetching venue", error, { venueId });
    return actionFailure("Failed to fetch venue");
  }
}

/**
 * Get venue statistics
 * Admin only
 */
export async function getVenueStats(): Promise<
  ActionResult<{
    stats: {
      total: number;
      active: number;
      inactive: number;
    };
  }>
> {
  await requireAdmin();

  try {
    const [total, active, inactive] = await Promise.all([
      prisma.venue.count(),
      prisma.venue.count({ where: { active: true } }),
      prisma.venue.count({ where: { active: false } }),
    ]);

    return actionSuccess({
      stats: {
        total,
        active,
        inactive,
      },
    });
  } catch (error) {
    logActionError("Error fetching venue stats", error);
    return actionFailure("Failed to fetch venue statistics");
  }
}

/**
 * Create a new venue
 * Admin only
 */
export async function createVenue(
  data: CreateVenueInput
): Promise<
  ActionResult<{ venue: Awaited<ReturnType<typeof prisma.venue.create>> }>
> {
  const admin = await requireAdmin();

  const validatedFields = createVenueSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const {
    name,
    code,
    address,
    phone,
    email,
    active,
    businessHoursStart,
    businessHoursEnd,
    operatingDays,
  } = validatedFields.data;

  try {
    const venue = await prisma.venue.create({
      data: {
        name,
        code,
        active,
        businessHoursStart,
        businessHoursEnd,
        operatingDays,
      },
    });

    // Audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "VENUE_CREATED",
        resourceType: "Venue",
        resourceId: venue.id,
        newValue: JSON.stringify({
          name,
          code,
          active,
          businessHoursStart,
          businessHoursEnd,
          operatingDays,
        }),
      });
    } catch (auditError) {
      logActionError("Error creating venue audit log", auditError, {
        venueId: venue.id,
      });
    }

    revalidatePaths(["/admin/stores"]);

    return actionSuccess({ venue });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return actionFailure("A venue with this code already exists");
    }

    logActionError("Error creating venue", error, { code });
    return actionFailure("Failed to create venue");
  }
}

/**
 * Update a venue
 * Admin only
 */
export async function updateVenue(
  data: UpdateVenueInput
): Promise<
  ActionResult<{ venue: Awaited<ReturnType<typeof prisma.venue.update>> }>
> {
  const admin = await requireAdmin();

  const validatedFields = updateVenueSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const {
    venueId,
    name,
    code,
    address,
    phone,
    email,
    active,
    businessHoursStart,
    businessHoursEnd,
    operatingDays,
  } = validatedFields.data;

  try {
    // Get old venue data for audit log
    const oldVenue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!oldVenue) {
      return actionFailure("Venue not found");
    }

    const venue = await prisma.venue.update({
      where: { id: venueId },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(active !== undefined && { active }),
        ...(businessHoursStart !== undefined && { businessHoursStart }),
        ...(businessHoursEnd !== undefined && { businessHoursEnd }),
        ...(operatingDays !== undefined && { operatingDays }),
      },
      include: {
        _count: {
          select: {
            userVenues: true,
          },
        },
      },
    });

    // Audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "VENUE_UPDATED",
        resourceType: "Venue",
        resourceId: venueId,
        oldValue: JSON.stringify({
          name: oldVenue.name,
          code: oldVenue.code,
          active: oldVenue.active,
          businessHoursStart: oldVenue.businessHoursStart,
          businessHoursEnd: oldVenue.businessHoursEnd,
          operatingDays: oldVenue.operatingDays,
        }),
        newValue: JSON.stringify({
          name: name ?? oldVenue.name,
          code: code ?? oldVenue.code,
          active: active ?? oldVenue.active,
          businessHoursStart: businessHoursStart ?? oldVenue.businessHoursStart,
          businessHoursEnd: businessHoursEnd ?? oldVenue.businessHoursEnd,
          operatingDays: operatingDays ?? oldVenue.operatingDays,
        }),
      });
    } catch (auditError) {
      logActionError("Error updating venue audit log", auditError, { venueId });
    }

    revalidatePaths(["/admin/stores", `/admin/stores/${venueId}`]);

    return actionSuccess({ venue });
  } catch (error) {
    if (isPrismaUniqueViolation(error)) {
      return actionFailure("Venue code already in use");
    }

    logActionError("Error updating venue", error, { venueId });
    return actionFailure("Failed to update venue");
  }
}

/**
 * Delete a venue
 * Admin only
 *
 * Note: This will also delete all UserVenue assignments due to cascade
 */
export async function deleteVenue(
  data: DeleteVenueInput
): Promise<ActionResult<{}>> {
  const admin = await requireAdmin();

  const validatedFields = deleteVenueSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { venueId } = validatedFields.data;

  try {
    // Get venue data for audit log before deletion
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      return actionFailure("Venue not found");
    }

    // Check if venue has users assigned
    const userCount = await prisma.userVenue.count({
      where: { venueId },
    });

    if (userCount > 0) {
      return actionFailure(
        `Cannot delete venue: ${userCount} user${userCount !== 1 ? "s are" : " is"} assigned to this venue. Please reassign users first.`
      );
    }

    // Check if this is a user's venueId (legacy single-venue field)
    const legacyUserCount = await prisma.user.count({
      where: { venueId: venueId },
    });

    if (legacyUserCount > 0) {
      return actionFailure(
        `Cannot delete venue: ${legacyUserCount} user${legacyUserCount !== 1 ? "s have" : " has"} this venue set as their primary venue. Please update users first.`
      );
    }

    await prisma.venue.delete({
      where: { id: venueId },
    });

    // Audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "VENUE_DELETED",
        resourceType: "Venue",
        resourceId: venueId,
        oldValue: JSON.stringify({
          name: venue.name,
          code: venue.code,
          active: venue.active,
        }),
      });
    } catch (auditError) {
      logActionError("Error deleting venue audit log", auditError, { venueId });
    }

    revalidatePaths(["/admin/stores"]);

    return actionSuccess({});
  } catch (error) {
    logActionError("Error deleting venue", error, { venueId });
    return actionFailure("Failed to delete venue");
  }
}

/**
 * Toggle venue active status
 * Admin only
 */
export async function toggleVenueActive(
  data: ToggleVenueActiveInput
): Promise<
  ActionResult<{ venue: Awaited<ReturnType<typeof prisma.venue.update>> }>
> {
  await requireAdmin();

  const validatedFields = toggleVenueActiveSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { venueId } = validatedFields.data;

  try {
    // Get current venue state
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      return actionFailure("Venue not found");
    }

    const newActiveStatus = !venue.active;

    // Toggle the active status
    const updatedVenue = await prisma.venue.update({
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

    revalidatePaths(["/admin/stores", `/admin/stores/${venueId}`]);

    return actionSuccess({ venue: updatedVenue });
  } catch (error) {
    logActionError("Error toggling venue active status", error, { venueId });
    return actionFailure("Failed to toggle venue status");
  }
}

/**
 * Get all active venues (for dropdowns, etc.)
 * Admin/Manager with permissions
 */
export async function getActiveVenues(): Promise<
  ActionResult<{
    venues: {
      id: string;
      name: string;
      code: string;
      active: boolean;
      businessHoursStart: string | null;
      businessHoursEnd: string | null;
      operatingDays: Prisma.JsonValue;
    }[];
  }>
> {
  // Allow managers and admins with appropriate permissions
  const currentUser = await requireAnyPermission([
    { resource: "users", action: "view_team" },
    { resource: "users", action: "view_all" },
  ]);

  try {
    // Check if user is admin
    const userIsAdmin = await isAdmin(currentUser.id);

    // Build query based on user's permissions
    let whereClause: any = {
      active: true,
    };

    if (!userIsAdmin) {
      // Manager: Filter venues by their assigned venues
      const venueIds = await getUserVenueIds(currentUser.id);
      if (venueIds.length === 0) {
        // No venues assigned - return empty list
        return actionSuccess({ venues: [] });
      }

      whereClause = {
        active: true,
        id: {
          in: venueIds,
        },
      };
    }

    const venues = await prisma.venue.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        code: true,
        active: true,
        businessHoursStart: true,
        businessHoursEnd: true,
        operatingDays: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return actionSuccess({ venues });
  } catch (error) {
    logActionError("Error fetching active venues", error);
    return actionFailure("Failed to fetch venues");
  }
}
