"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac/access";
import {
  createRoleSchema,
  updateRoleSchema,
  deleteRoleSchema,
  assignPermissionsSchema,
  type CreateRoleInput,
  type UpdateRoleInput,
  type DeleteRoleInput,
  type AssignPermissionsInput,
} from "@/lib/schemas/admin/roles";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";

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
export async function createRole(data: CreateRoleInput & { permissionIds?: string[] }) {
  const admin = await requireAdmin();

  const validatedFields = createRoleSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { name, description } = validatedFields.data;

  try {
    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return { error: "Role name already exists" };
    }

    // Create role with permissions if provided
    const role = await prisma.role.create({
      data: {
        name,
        description,
        ...(data.permissionIds && data.permissionIds.length > 0 && {
          rolePermissions: {
            create: data.permissionIds.map((permissionId) => ({
              permissionId,
            })),
          },
        }),
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "ROLE_CREATED",
        resourceType: "Role",
        resourceId: role.id,
        newValue: JSON.stringify({
          name,
          description,
          permissionIds: data.permissionIds || [],
          permissionCount: role.rolePermissions.length,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail role creation if audit log fails
    }

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
export async function updateRole(data: UpdateRoleInput & { permissionIds?: string[] }) {
  const admin = await requireAdmin();

  const validatedFields = updateRoleSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { roleId, name, description } = validatedFields.data;

  try {
    // Get current role state for audit log
    const oldRole = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!oldRole) {
      return { error: "Role not found" };
    }

    // Check if role name is being changed and if it's already taken
    if (name) {
      const existingRole = await prisma.role.findFirst({
        where: {
          name,
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
    if (data.permissionIds !== undefined) {
      // Delete existing permissions
      await prisma.rolePermission.deleteMany({
        where: { roleId },
      });

      // Create new permissions
      if (data.permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({
            roleId,
            permissionId,
          })),
        });
      }
    }

    // Update role details
    const role = await prisma.role.update({
      where: { id: roleId },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
      },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "ROLE_UPDATED",
        resourceType: "Role",
        resourceId: roleId,
        oldValue: JSON.stringify({
          name: oldRole.name,
          description: oldRole.description,
          permissionCount: oldRole.rolePermissions.length,
        }),
        newValue: JSON.stringify({
          name: role.name,
          description: role.description,
          permissionCount: role.rolePermissions.length,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail role update if audit log fails
    }

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
export async function deleteRole(data: DeleteRoleInput) {
  const admin = await requireAdmin();

  const validatedFields = deleteRoleSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { roleId } = validatedFields.data;

  try {
    // Prevent deletion of system roles
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return { error: "Role not found" };
    }

    const systemRoles = ["ADMIN", "MANAGER", "STAFF"];
    if (systemRoles.includes(role.name)) {
      return { error: "Cannot delete system roles (ADMIN, MANAGER, STAFF)" };
    }

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

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "ROLE_DELETED",
        resourceType: "Role",
        resourceId: roleId,
        oldValue: JSON.stringify({
          name: role.name,
          description: role.description,
          permissionCount: role.rolePermissions.length,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail role deletion if audit log fails
    }

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
export async function assignPermissionsToRole(data: AssignPermissionsInput) {
  const admin = await requireAdmin();

  const validatedFields = assignPermissionsSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { roleId, permissionIds } = validatedFields.data;

  try {
    // Get role info and old permissions for audit log
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      return { error: "Role not found" };
    }

    const oldPermissionIds = role.rolePermissions.map(rp => rp.permissionId);

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

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "ROLE_PERMISSIONS_UPDATED",
        resourceType: "Role",
        resourceId: roleId,
        oldValue: JSON.stringify({
          roleName: role.name,
          permissionIds: oldPermissionIds,
          permissionCount: oldPermissionIds.length,
        }),
        newValue: JSON.stringify({
          roleName: role.name,
          permissionIds,
          permissionCount: permissionIds.length,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail permission assignment if audit log fails
    }

    revalidatePath("/admin/roles");
    revalidatePath(`/admin/roles/${roleId}`);

    return { success: true };
  } catch (error) {
    console.error("Error assigning permissions:", error);
    return { error: "Failed to assign permissions" };
  }
}
