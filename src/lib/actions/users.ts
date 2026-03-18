"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { hasPermission } from "@/lib/rbac/permissions";

/**
 * Get all active users (for conversation creation, etc.)
 * VENUE FILTERING: Only returns users from shared venues
 */
export async function getUsers() {
  const user = await requireAuth();

  // Use "send" permission for messages (not "create")
  const hasAccess = await canAccess("messages", "send");
  if (!hasAccess) {
    return { error: "You don't have permission to view users" };
  }

  try {
    // VENUE FILTERING: Get users in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const users = await prisma.user.findMany({
      where: {
        // VENUE FILTERING: Only show users from shared venues
        id: { in: sharedVenueUserIds },
        active: true,
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
            name: true,
          },
        },
      },
      orderBy: {
        email: "asc",
      },
    });

    return { success: true, users };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { error: "Failed to fetch users" };
  }
}

/**
 * Get users for a specific venue (for document assignment, etc.)
 * Checks if the current user has permission to view users at this venue
 */
export async function getUsersByVenue(venueId: string) {
  const user = await requireAuth();

  try {
    // Check if user has permission to assign documents at this venue
    const canAssign = await hasPermission(user.id, "documents", "create", venueId);
    
    if (!canAssign) {
      return { error: "You don't have permission to view users at this venue" };
    }

    // Get all users assigned to this venue
    const users = await prisma.user.findMany({
      where: {
        active: true,
        venues: {
          some: {
            venueId: venueId,
          },
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        profileImage: true,
      },
      orderBy: {
        email: "asc",
      },
    });

    return { success: true, users };
  } catch (error) {
    console.error("Error fetching users by venue:", error);
    return { error: "Failed to fetch users" };
  }
}
