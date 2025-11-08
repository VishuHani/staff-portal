import { prisma } from "@/lib/prisma";

/**
 * Permission types based on database schema
 */
export type PermissionResource =
  | "users"
  | "roles"
  | "stores"
  | "availability"
  | "timeoff"
  | "posts"
  | "messages"
  | "notifications"
  | "audit";

export type PermissionAction = "create" | "read" | "update" | "delete" | "manage";

export interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
}

/**
 * Check if a user has a specific permission
 * @param userId - The user's ID
 * @param resource - The resource to check
 * @param action - The action to check
 * @returns true if user has permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction
): Promise<boolean> {
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
      },
    });

    if (!user || !user.active) {
      return false;
    }

    // Check if user's role has the specific permission
    return user.role.rolePermissions.some(
      (rp) =>
        rp.permission.resource === resource &&
        rp.permission.action === action
    );
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Check if a user has multiple permissions (ALL required)
 * @param userId - The user's ID
 * @param permissions - Array of permissions to check
 * @returns true if user has all permissions, false otherwise
 */
export async function hasAllPermissions(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map((p) => hasPermission(userId, p.resource, p.action))
  );
  return checks.every((check) => check === true);
}

/**
 * Check if a user has any of the specified permissions (OR)
 * @param userId - The user's ID
 * @param permissions - Array of permissions to check
 * @returns true if user has at least one permission, false otherwise
 */
export async function hasAnyPermission(
  userId: string,
  permissions: Permission[]
): Promise<boolean> {
  const checks = await Promise.all(
    permissions.map((p) => hasPermission(userId, p.resource, p.action))
  );
  return checks.some((check) => check === true);
}

/**
 * Get all permissions for a user
 * @param userId - The user's ID
 * @returns Array of permissions
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
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
      },
    });

    if (!user) {
      return [];
    }

    return user.role.rolePermissions.map((rp) => ({
      resource: rp.permission.resource as PermissionResource,
      action: rp.permission.action as PermissionAction,
    }));
  } catch (error) {
    console.error("Error getting user permissions:", error);
    return [];
  }
}

/**
 * Check if user has manage permission for any resource
 * @param userId - The user's ID
 * @returns true if user has any manage permission
 */
export async function isManager(userId: string): Promise<boolean> {
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
      },
    });

    if (!user || !user.active) {
      return false;
    }

    // Check if user has any manage permission
    return user.role.rolePermissions.some(
      (rp) => rp.permission.action === "manage"
    );
  } catch (error) {
    console.error("Error checking manager status:", error);
    return false;
  }
}

/**
 * Check if user is admin (has role "ADMIN")
 * @param userId - The user's ID
 * @returns true if user is admin
 */
export async function isAdmin(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: true,
      },
    });

    if (!user || !user.active) {
      return false;
    }

    return user.role.name === "ADMIN";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}
