"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac/access";
import { createClient } from "@/lib/auth/supabase-server";
import {
  createUserSchema,
  updateUserSchema,
  deleteUserSchema,
  toggleUserActiveSchema,
  type CreateUserInput,
  type UpdateUserInput,
  type DeleteUserInput,
  type ToggleUserActiveInput,
} from "@/lib/schemas/admin/users";
import bcrypt from "bcryptjs";

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

/**
 * Create a new user
 * Admin only
 */
export async function createUser(data: CreateUserInput) {
  await requireAdmin();

  const validatedFields = createUserSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { email, password, roleId, storeId, active } = validatedFields.data;

  try {
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: "Email already in use" };
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        roleId,
        storeId: storeId || null,
        active,
      },
      include: {
        role: true,
        store: true,
      },
    });

    revalidatePath("/admin/users");

    return { success: true, user };
  } catch (error) {
    console.error("Error creating user:", error);
    return { error: "Failed to create user" };
  }
}

/**
 * Update user with validation
 * Admin only
 */
export async function updateUser(data: UpdateUserInput) {
  await requireAdmin();

  const validatedFields = updateUserSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { userId, email, roleId, storeId, active } = validatedFields.data;

  try {
    // Check if email is already taken by another user
    if (email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email,
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
        ...(email && { email }),
        ...(roleId && { roleId }),
        ...(storeId !== undefined && { storeId }),
        ...(active !== undefined && { active }),
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
 * Delete user with validation
 * Admin only
 */
export async function deleteUser(data: DeleteUserInput) {
  await requireAdmin();

  const validatedFields = deleteUserSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { userId } = validatedFields.data;

  try {
    // Delete from our database (cascade will handle related records)
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
 * Toggle user active status
 * Admin only
 */
export async function toggleUserActive(data: ToggleUserActiveInput) {
  await requireAdmin();

  const validatedFields = toggleUserActiveSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { userId } = validatedFields.data;

  try {
    // Get current user state
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return { error: "User not found" };
    }

    // Toggle the active status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { active: !user.active },
      include: {
        role: true,
        store: true,
      },
    });

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return { success: true, user: updatedUser };
  } catch (error) {
    console.error("Error toggling user active status:", error);
    return { error: "Failed to toggle user status" };
  }
}

/**
 * Get all roles
 * Admin only
 */
export async function getAllRoles() {
  await requireAdmin();

  try {
    const roles = await prisma.role.findMany({
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, roles };
  } catch (error) {
    console.error("Error fetching roles:", error);
    return { error: "Failed to fetch roles" };
  }
}

/**
 * Get all stores
 * Admin only
 */
export async function getAllStores() {
  await requireAdmin();

  try {
    const stores = await prisma.store.findMany({
      where: {
        active: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return { success: true, stores };
  } catch (error) {
    console.error("Error fetching stores:", error);
    return { error: "Failed to fetch stores" };
  }
}
