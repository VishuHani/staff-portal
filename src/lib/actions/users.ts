"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";

/**
 * Get all active users (for conversation creation, etc.)
 * VENUE FILTERING: Only returns users from shared venues
 */
export async function getUsers() {
  const user = await requireAuth();

  const hasAccess = await canAccess("messages", "create");
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
