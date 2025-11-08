"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac/access";

/**
 * Get all roles with their permissions
 * Admin only
 */
export async function getAllRoles() {
  await requireAdmin();

  try {
    const roles = await prisma.role.findMany({
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
        _count: {
          select: {
            users: true,
          },
        },
      },
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
 * Get all available permissions
 * Admin only
 */
export async function getAllPermissions() {
  await requireAdmin();

  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    return { success: true, permissions };
  } catch (error) {
    console.error("Error fetching permissions:", error);
    return { error: "Failed to fetch permissions" };
  }
}

/**
 * Create a new role
 * Admin only
 */
export async function createRole(data: {
  name: string;
  description?: string;
  permissionIds: string[];
}) {
  await requireAdmin();

  try {
    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: data.name },
    });

    if (existingRole) {
      return { error: "Role name already exists" };
    }

    const role = await prisma.role.create({
      data: {
        name: data.name,
        description: data.description,
        rolePermissions: {
          create: data.permissionIds.map((permissionId) => ({
            permissionId,
          })),
        },
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    revalidatePath("/admin/roles");

    return { success: true, role };
  } catch (error) {
    console.error("Error creating role:", error);
    return { error: "Failed to create role" };
  }
}

/**
 * Update a role
 * Admin only
 */
export async function updateRole(
  roleId: string,
  data: {
    name?: string;
    description?: string;
    permissionIds?: string[];
  }
) {
  await requireAdmin();

  try {
    // Check if role name is being changed and if it's already taken
    if (data.name) {
      const existingRole = await prisma.role.findFirst({
        where: {
          name: data.name,
          NOT: {
            id: roleId,
          },
        },
      });

      if (existingRole) {
        return { error: "Role name already exists" };
      }
    }

    // Update role permissions if provided
    if (data.permissionIds) {
      // Delete existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // Create new permissions
      await prisma.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    }

    // Update role details
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleId}`);

    return { success: true, role };
  } catch (error) {
    console.error("Error updating role:", error);
    return { error: "Failed to update role" };
  }
}

/**
 * Delete a role
 * Admin only - Cannot delete if users are assigned
 */
export async function deleteRole(roleId: string) {
  await requireAdmin();

  try {
    // Check if any users have this role
    const usersWithRole = await prisma.user.count({
      where: { roleId },
    });

    if (usersWithRole > 0) {
      return {
        error: `Cannot delete role. ${usersWithRole} user(s) still assigned to this role.`,
      };
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    revalidatePath("/admin/roles");

    return { success: true };
  } catch (error) {
    console.error("Error deleting role:", error);
    return { error: "Failed to delete role" };
  }
}

/**
 * Assign permissions to a role
 * Admin only
 */
export async function assignPermissionsToRole(
  roleId: string,
  permissionIds: string[]
) {
  await requireAdmin();

  try {
    // Delete existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Create new permissions
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });

    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleId}`);

    return { success: true };
  } catch (error) {
    console.error("Error assigning permissions:", error);
    return { error: "Failed to assign permissions" };
  }
}
