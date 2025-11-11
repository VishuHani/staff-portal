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
import { createUserInBothSystems } from "@/lib/auth/admin-user";
import {
  notifyUserWelcome,
  notifyRoleChanged,
  notifyUserActivated,
  notifyUserDeactivated,
} from "@/lib/services/notifications";
import { getCurrentUser } from "@/lib/actions/auth";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";

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
        store: true, // Legacy field
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                code: true,
                active: true,
              },
            },
          },
        },
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
 * Create a new user in BOTH Supabase Auth and Prisma database
 * Admin only
 *
 * This ensures the user can log in (requires existence in both systems)
 */
export async function createUser(data: CreateUserInput) {
  const admin = await requireAdmin();

  const validatedFields = createUserSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { email, password, firstName, lastName, phone, roleId, storeId, venueIds, primaryVenueId, active } = validatedFields.data;

  try {
    // Create user in BOTH Supabase Auth and Prisma database
    const result = await createUserInBothSystems({
      email,
      password,
      firstName,
      lastName,
      phone: phone || null,
      roleId,
      storeId: storeId || null,
      active,
      profileCompletedAt: new Date(), // Admin-created users have complete profiles
    });

    if (!result.success) {
      return { error: result.error || "Failed to create user" };
    }

    // Create UserVenue assignments if venueIds are provided
    if (venueIds && venueIds.length > 0) {
      const userVenueData = venueIds.map((venueId) => ({
        userId: result.userId!,
        venueId,
        isPrimary: venueId === primaryVenueId,
      }));

      await prisma.userVenue.createMany({
        data: userVenueData,
      });
    }

    // Fetch the created user with relations for the response
    const user = await prisma.user.findUnique({
      where: { id: result.userId },
      include: {
        role: true,
        store: true,
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                code: true,
                active: true,
              },
            },
          },
        },
      },
    });

    // Send welcome notification
    try {
      const userName = user?.firstName && user?.lastName
        ? `${user.firstName} ${user.lastName}`
        : user?.email || email;

      await notifyUserWelcome(result.userId!, userName);
    } catch (error) {
      console.error("Error sending welcome notification:", error);
      // Don't fail user creation if notification fails
    }

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "USER_CREATED",
        resourceType: "User",
        resourceId: result.userId!,
        newValue: JSON.stringify({
          email,
          firstName,
          lastName,
          phone,
          roleId,
          storeId,
          active,
          venueIds,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail user creation if audit log fails
    }

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
  const admin = await requireAdmin();

  const validatedFields = updateUserSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { userId, email, firstName, lastName, phone, roleId, storeId, venueIds, primaryVenueId, active } = validatedFields.data;

  try {
    // Get current user state before update
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!currentUser) {
      return { error: "User not found" };
    }

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

    // Update venue assignments if venueIds are provided
    if (venueIds && venueIds.length > 0) {
      // Delete existing venue assignments
      await prisma.userVenue.deleteMany({
        where: { userId },
      });

      // Create new venue assignments
      const userVenueData = venueIds.map((venueId) => ({
        userId,
        venueId,
        isPrimary: venueId === primaryVenueId,
      }));

      await prisma.userVenue.createMany({
        data: userVenueData,
      });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(email && { email }),
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(roleId && { roleId }),
        ...(storeId !== undefined && { storeId }),
        ...(active !== undefined && { active }),
      },
      include: {
        role: true,
        store: true,
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                code: true,
                active: true,
              },
            },
          },
        },
      },
    });

    // Send notifications for relevant changes
    try {
      const adminName = admin.firstName && admin.lastName
        ? `${admin.firstName} ${admin.lastName}`
        : admin.email;

      // Notify if role changed
      if (roleId && roleId !== currentUser.roleId) {
        await notifyRoleChanged(
          userId,
          admin.id,
          adminName,
          currentUser.role.name,
          user.role.name
        );
      }

      // Notify if active status changed
      if (active !== undefined && active !== currentUser.active) {
        if (active) {
          await notifyUserActivated(userId, admin.id, adminName);
        } else {
          await notifyUserDeactivated(userId, admin.id, adminName);
        }
      }
    } catch (error) {
      console.error("Error sending user update notification:", error);
      // Don't fail the update if notification fails
    }

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "USER_UPDATED",
        resourceType: "User",
        resourceId: userId,
        oldValue: JSON.stringify({
          email: currentUser.email,
          firstName: currentUser.firstName,
          lastName: currentUser.lastName,
          phone: currentUser.phone,
          roleId: currentUser.roleId,
          storeId: currentUser.storeId,
          active: currentUser.active,
        }),
        newValue: JSON.stringify({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          phone: user.phone,
          roleId: user.roleId,
          storeId: user.storeId,
          active: user.active,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail the update if audit log fails
    }

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
  const admin = await requireAdmin();

  const validatedFields = deleteUserSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { userId } = validatedFields.data;

  try {
    // Get user info before deletion for audit log
    const userToDelete = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!userToDelete) {
      return { error: "User not found" };
    }

    // Delete from our database (cascade will handle related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "USER_DELETED",
        resourceType: "User",
        resourceId: userId,
        oldValue: JSON.stringify({
          email: userToDelete.email,
          firstName: userToDelete.firstName,
          lastName: userToDelete.lastName,
          roleId: userToDelete.roleId,
          roleName: userToDelete.role.name,
          active: userToDelete.active,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail deletion if audit log fails
    }

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
  const admin = await requireAdmin();

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

    const newActiveStatus = !user.active;

    // Toggle the active status
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { active: newActiveStatus },
      include: {
        role: true,
        store: true,
      },
    });

    // Send notification about status change
    try {
      const adminName = admin.firstName && admin.lastName
        ? `${admin.firstName} ${admin.lastName}`
        : admin.email;

      if (newActiveStatus) {
        await notifyUserActivated(userId, admin.id, adminName);
      } else {
        await notifyUserDeactivated(userId, admin.id, adminName);
      }
    } catch (error) {
      console.error("Error sending user status notification:", error);
      // Don't fail the toggle if notification fails
    }

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: newActiveStatus ? "USER_ACTIVATED" : "USER_DEACTIVATED",
        resourceType: "User",
        resourceId: userId,
        oldValue: JSON.stringify({ active: user.active }),
        newValue: JSON.stringify({ active: newActiveStatus }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail the toggle if audit log fails
    }

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
