"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";

/**
 * Get all active users (for conversation creation, etc.)
 */
export async function getUsers() {
  const user = await requireAuth();

  const hasAccess = await canAccess("messages", "create");
  if (!hasAccess) {
    return { error: "You don't have permission to view users" };
  }

  try {
    const users = await prisma.user.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        email: true,
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
