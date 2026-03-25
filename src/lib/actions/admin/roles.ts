"use server";

import { prisma } from "@/lib/prisma";
import { requireAnyPermission } from "@/lib/rbac/access";
import { SYSTEM_PERMISSIONS } from "@/lib/rbac/system-permissions";
import {
  actionFailure,
  actionSuccess,
  logActionError,
  revalidatePaths,
  type ActionResult,
} from "@/lib/utils/action-contract";
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
import { getAuditContext } from "@/lib/utils/audit-helpers";

// System roles that cannot be renamed or deleted
const SYSTEM_ROLES = ["ADMIN", "MANAGER", "STAFF"];
type RoleListPayload = Awaited<ReturnType<typeof prisma.role.findMany>>;
type PermissionListPayload = Awaited<
  ReturnType<typeof prisma.permission.findMany>
>;

async function requireRolesReadAccess() {
  return requireAnyPermission(SYSTEM_PERMISSIONS.rolesRead);
}

async function requireRolesManageAccess() {
  return requireAnyPermission(SYSTEM_PERMISSIONS.rolesManage);
}

/**
 * Get all roles with their permissions
 * Admin only
 */
export async function getAllRoles(): Promise<
  ActionResult<{ roles: RoleListPayload }>
> {
  await requireRolesReadAccess();

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

    return actionSuccess({ roles });
  } catch (error) {
    logActionError("admin.roles.getAllRoles", error);
    return actionFailure("Failed to fetch roles");
  }
}

/**
 * Get all available permissions
 * Admin only
 */
export async function getAllPermissions(): Promise<
  ActionResult<{ permissions: PermissionListPayload }>
> {
  await requireRolesReadAccess();

  try {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    return actionSuccess({ permissions });
  } catch (error) {
    logActionError("admin.roles.getAllPermissions", error);
    return actionFailure("Failed to fetch permissions");
  }
}

/**
 * Create a new role
 * Admin only
 */
export async function createRole(data: CreateRoleInput & { permissionIds?: string[] }) {
  const actor = await requireRolesManageAccess();

  const validatedFields = createRoleSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(validatedFields.error.issues[0]?.message || "Invalid fields");
  }

  const { name, description } = validatedFields.data;

  try {
    // Check if role name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name },
    });

    if (existingRole) {
      return actionFailure("Role name already exists");
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

    // Create audit log with IP address
    try {
      const auditContext = await getAuditContext();
      await createAuditLog({
        userId: actor.id,
        actionType: "ROLE_CREATED",
        resourceType: "Role",
        resourceId: role.id,
        newValue: JSON.stringify({
          name,
          description,
          permissionIds: data.permissionIds || [],
          permissionCount: role.rolePermissions.length,
        }),
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      logActionError("admin.roles.createRole.auditLog", error, { roleName: name });
      // Don't fail role creation if audit log fails
    }

    revalidatePaths("/admin/roles");

    return actionSuccess({ role });
  } catch (error) {
    logActionError("admin.roles.createRole", error, { name });
    return actionFailure("Failed to create role");
  }
}

/**
 * Update a role
 * Admin only
 */
export async function updateRole(data: UpdateRoleInput & { permissionIds?: string[] }) {
  const actor = await requireRolesManageAccess();

  const validatedFields = updateRoleSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(validatedFields.error.issues[0]?.message || "Invalid fields");
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
      return actionFailure("Role not found");
    }

    // Prevent renaming system roles
    if (SYSTEM_ROLES.includes(oldRole.name) && name && name !== oldRole.name) {
      return actionFailure("Cannot rename system roles (ADMIN, MANAGER, STAFF)");
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
        return actionFailure("Role name already exists");
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

    // Create audit log with IP address
    try {
      const auditContext = await getAuditContext();
      await createAuditLog({
        userId: actor.id,
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
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      logActionError("admin.roles.updateRole.auditLog", error, { roleId });
      // Don't fail role update if audit log fails
    }

    revalidatePaths("/admin/roles", `/admin/roles/${roleId}`);

    return actionSuccess({ role });
  } catch (error) {
    logActionError("admin.roles.updateRole", error, { roleId: data.roleId });
    return actionFailure("Failed to update role");
  }
}

/**
 * Delete a role
 * Admin only - Cannot delete if users are assigned
 */
export async function deleteRole(data: DeleteRoleInput) {
  const actor = await requireRolesManageAccess();

  const validatedFields = deleteRoleSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(validatedFields.error.issues[0]?.message || "Invalid fields");
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
      return actionFailure("Role not found");
    }

    // Prevent deletion of system roles
    if (SYSTEM_ROLES.includes(role.name)) {
      return actionFailure("Cannot delete system roles (ADMIN, MANAGER, STAFF)");
    }

    // Check if any users have this role
    const usersWithRole = await prisma.user.count({
      where: { roleId },
    });

    if (usersWithRole > 0) {
      return actionFailure(
        `Cannot delete role. ${usersWithRole} user(s) still assigned to this role.`
      );
    }

    await prisma.role.delete({
      where: { id: roleId },
    });

    // Create audit log with IP address
    try {
      const auditContext = await getAuditContext();
      await createAuditLog({
        userId: actor.id,
        actionType: "ROLE_DELETED",
        resourceType: "Role",
        resourceId: roleId,
        oldValue: JSON.stringify({
          name: role.name,
          description: role.description,
          permissionCount: role.rolePermissions.length,
        }),
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      logActionError("admin.roles.deleteRole.auditLog", error, { roleId });
      // Don't fail role deletion if audit log fails
    }

    revalidatePaths("/admin/roles");

    return actionSuccess({});
  } catch (error) {
    logActionError("admin.roles.deleteRole", error, { roleId: data.roleId });
    return actionFailure("Failed to delete role");
  }
}

/**
 * Assign permissions to a role
 * Admin only
 */
export async function assignPermissionsToRole(data: AssignPermissionsInput) {
  const actor = await requireRolesManageAccess();

  const validatedFields = assignPermissionsSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(validatedFields.error.issues[0]?.message || "Invalid fields");
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
      return actionFailure("Role not found");
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

    // Create audit log with IP address
    try {
      const auditContext = await getAuditContext();
      await createAuditLog({
        userId: actor.id,
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
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      logActionError("admin.roles.assignPermissionsToRole.auditLog", error, { roleId });
      // Don't fail permission assignment if audit log fails
    }

    revalidatePaths("/admin/roles", `/admin/roles/${roleId}`);

    return actionSuccess({});
  } catch (error) {
    logActionError("admin.roles.assignPermissionsToRole", error, { roleId: data.roleId });
    return actionFailure("Failed to assign permissions");
  }
}

/**
 * Clone a role with all its permissions
 * Admin only
 */
export async function cloneRole(sourceRoleId: string, newName: string) {
  const actor = await requireRolesManageAccess();

  if (!newName || newName.trim().length < 2) {
    return actionFailure("Role name must be at least 2 characters");
  }

  // Validate name format
  if (!/^[A-Z_]+$/.test(newName)) {
    return actionFailure("Role name must be uppercase letters and underscores only");
  }

  try {
    // Get source role with permissions
    const sourceRole = await prisma.role.findUnique({
      where: { id: sourceRoleId },
      include: {
        rolePermissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!sourceRole) {
      return actionFailure("Source role not found");
    }

    // Check if new name already exists
    const existingRole = await prisma.role.findUnique({
      where: { name: newName },
    });

    if (existingRole) {
      return actionFailure("Role name already exists");
    }

    // Create new role with cloned permissions
    const newRole = await prisma.role.create({
      data: {
        name: newName,
        description: `Cloned from ${sourceRole.name}`,
        rolePermissions: {
          create: sourceRole.rolePermissions.map((rp) => ({
            permissionId: rp.permissionId,
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

    // Create audit log with IP address
    try {
      const auditContext = await getAuditContext();
      await createAuditLog({
        userId: actor.id,
        actionType: "ROLE_CREATED",
        resourceType: "Role",
        resourceId: newRole.id,
        newValue: JSON.stringify({
          name: newRole.name,
          description: newRole.description,
          clonedFrom: sourceRole.name,
          permissionCount: newRole.rolePermissions.length,
        }),
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      logActionError("admin.roles.cloneRole.auditLog", error, { sourceRoleId, newName });
      // Don't fail role clone if audit log fails
    }

    revalidatePaths("/admin/roles");

    return actionSuccess({ role: newRole });
  } catch (error) {
    logActionError("admin.roles.cloneRole", error, { sourceRoleId, newName });
    return actionFailure("Failed to clone role");
  }
}
