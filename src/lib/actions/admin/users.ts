"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac/access";
import { createClient } from "@/lib/auth/supabase-server";

/**
 * Get all users with their roles and stores
 * Admin only
 */
export async function getAllUsers() {
  await requireAdmin();

  try {
    const users = await prisma.user.findMany({
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        store: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return { success: true, users };
  } catch (error) {
    console.error("Error fetching users:", error);
    return { error: "Failed to fetch users" };
  }
}

/**
 * Get a single user by ID
 * Admin only
 */
export async function getUserById(userId: string) {
  await requireAdmin();

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: true,
              },
            },
          },
        },
        store: true,
        availability: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
        timeOffRequests: {
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      },
    });

    if (!user) {
      return { error: "User not found" };
    }

    return { success: true, user };
  } catch (error) {
    console.error("Error fetching user:", error);
    return { error: "Failed to fetch user" };
  }
}

/**
 * Update user details
 * Admin only
 */
export async function updateUser(
  userId: string,
  data: {
    email?: string;
    firstName?: string;
    lastName?: string;
    roleId?: string;
    storeId?: string | null;
    active?: boolean;
  }
) {
  await requireAdmin();

  try {
    // Check if email is already taken by another user
    if (data.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: data.email,
          NOT: {
            id: userId,
          },
        },
      });

      if (existingUser) {
        return { error: "Email already in use" };
      }
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.roleId && { roleId: data.roleId }),
        ...(data.storeId !== undefined && { storeId: data.storeId }),
        ...(data.active !== undefined && { active: data.active }),
      },
      include: {
        role: true,
        store: true,
      },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, user };
  } catch (error) {
    console.error("Error updating user:", error);
    return { error: "Failed to update user" };
  }
}

/**
 * Deactivate a user
 * Admin only
 */
export async function deactivateUser(userId: string) {
  await requireAdmin();

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { active: false },
    });

    // Sign out the user from Supabase
    const supabase = await createClient();
    await supabase.auth.admin.deleteUser(userId);

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, user };
  } catch (error) {
    console.error("Error deactivating user:", error);
    return { error: "Failed to deactivate user" };
  }
}

/**
 * Activate a user
 * Admin only
 */
export async function activateUser(userId: string) {
  await requireAdmin();

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { active: true },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, user };
  } catch (error) {
    console.error("Error activating user:", error);
    return { error: "Failed to activate user" };
  }
}

/**
 * Delete a user permanently
 * Admin only - USE WITH CAUTION
 */
export async function deleteUser(userId: string) {
  await requireAdmin();

  try {
    // Delete from Supabase Auth first
    const supabase = await createClient();
    await supabase.auth.admin.deleteUser(userId);

    // Then delete from our database (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    revalidatePath("/admin/users");

    return { success: true };
  } catch (error) {
    console.error("Error deleting user:", error);
    return { error: "Failed to delete user" };
  }
}

/**
 * Get user statistics
 * Admin only
 */
export async function getUserStats() {
  await requireAdmin();

  try {
    const [total, active, byRole] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.groupBy({
        by: ["roleId"],
        _count: true,
      }),
    ]);

    const roles = await prisma.role.findMany();
    const roleStats = byRole.map((stat) => ({
      role: roles.find((r) => r.id === stat.roleId)?.name || "Unknown",
      count: stat._count,
    }));

    return {
      success: true,
      stats: {
        total,
        active,
        inactive: total - active,
        byRole: roleStats,
      },
    };
  } catch (error) {
    console.error("Error fetching user stats:", error);
    return { error: "Failed to fetch user statistics" };
  }
}
