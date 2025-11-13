"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac/access";
import {
  type PermissionResource,
  type PermissionAction,
  type Permission,
} from "@/lib/rbac/permissions";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";

/**
 * VENUE-SCOPED PERMISSION MANAGEMENT ACTIONS
 *
 * These server actions allow admins to manage venue-specific permissions for users.
 * All actions require admin role and include comprehensive error handling.
 *
 * Use Cases:
 * - Grant a manager access to reports at a specific venue
 * - Give a manager permission to edit team schedules at their venue
 * - Remove venue-specific permissions when a user changes roles
 * - Bulk update permissions when assigning a user to a new venue
 */

/**
 * Get all venue-specific permissions for a user at a venue
 *
 * @param userId - The user's ID
 * @param venueId - The venue ID
 * @returns Array of permissions with metadata
 */
export async function getUserVenuePermissions(
  userId: string,
  venueId: string
) {
  try {
    await requireAdmin();

    const permissions = await prisma.userVenuePermission.findMany({
      where: {
        userId,
        venueId,
      },
      include: {
        permission: true,
        grantedByUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        grantedAt: "desc",
      },
    });

    return {
      success: true,
      permissions: permissions.map((vp) => ({
        id: vp.id,
        resource: vp.permission.resource as PermissionResource,
        action: vp.permission.action as PermissionAction,
        description: vp.permission.description,
        grantedAt: vp.grantedAt,
        grantedBy: {
          id: vp.grantedByUser.id,
          name: `${vp.grantedByUser.firstName || ""} ${vp.grantedByUser.lastName || ""}`.trim() || vp.grantedByUser.email,
          email: vp.grantedByUser.email,
        },
      })),
    };
  } catch (error) {
    console.error("Error getting user venue permissions:", error);
    return {
      success: false,
      error: "Failed to get user venue permissions",
    };
  }
}

/**
 * Get all permissions for a user at a venue (role + venue-specific)
 *
 * @param userId - The user's ID
 * @param venueId - The venue ID
 * @returns Combined permissions from role and venue-specific grants
 */
export async function getUserEffectiveVenuePermissions(
  userId: string,
  venueId: string
) {
  try {
    await requireAdmin();

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
        venuePermissions: {
          where: { venueId },
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    // Collect role permissions
    const rolePerms = user.role.rolePermissions.map((rp) => ({
      resource: rp.permission.resource as PermissionResource,
      action: rp.permission.action as PermissionAction,
      description: rp.permission.description,
      source: "role" as const,
    }));

    // Collect venue permissions
    const venuePerms = user.venuePermissions.map((vp) => ({
      resource: vp.permission.resource as PermissionResource,
      action: vp.permission.action as PermissionAction,
      description: vp.permission.description,
      source: "venue" as const,
    }));

    // Combine and deduplicate (prioritize venue-specific if duplicate)
    const allPerms = [...rolePerms, ...venuePerms];
    const uniquePerms = Array.from(
      new Map(
        allPerms.map((p) => [`${p.resource}:${p.action}`, p])
      ).values()
    );

    return {
      success: true,
      permissions: uniquePerms,
      rolePermissions: rolePerms,
      venuePermissions: venuePerms,
    };
  } catch (error) {
    console.error("Error getting effective venue permissions:", error);
    return {
      success: false,
      error: "Failed to get effective permissions",
    };
  }
}

/**
 * Grant a venue-specific permission to a user
 *
 * @param userId - The user to grant permission to
 * @param venueId - The venue ID
 * @param permissionId - The permission ID to grant
 * @returns Success status
 */
export async function grantUserVenuePermission(
  userId: string,
  venueId: string,
  permissionId: string
) {
  try {
    const admin = await requireAdmin();

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, active: true, email: true },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: "Cannot grant permissions to inactive user",
      };
    }

    // Check if venue exists
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, active: true, name: true },
    });

    if (!venue) {
      return {
        success: false,
        error: "Venue not found",
      };
    }

    if (!venue.active) {
      return {
        success: false,
        error: "Cannot grant permissions for inactive venue",
      };
    }

    // Check if permission exists
    const permission = await prisma.permission.findUnique({
      where: { id: permissionId },
      select: { id: true, resource: true, action: true },
    });

    if (!permission) {
      return {
        success: false,
        error: "Permission not found",
      };
    }

    // Check if permission already granted
    const existing = await prisma.userVenuePermission.findUnique({
      where: {
        userId_venueId_permissionId: {
          userId,
          venueId,
          permissionId,
        },
      },
    });

    if (existing) {
      return {
        success: false,
        error: "Permission already granted",
      };
    }

    // Grant the permission
    await prisma.userVenuePermission.create({
      data: {
        userId,
        venueId,
        permissionId,
        grantedBy: admin.id,
      },
    });

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "VENUE_PERMISSION_GRANTED",
        resourceType: "VenuePermission",
        resourceId: `${userId}-${venueId}-${permissionId}`,
        newValue: JSON.stringify({
          userId,
          userEmail: user.email,
          venueId,
          venueName: venue.name,
          permissionId,
          permission: `${permission.resource}:${permission.action}`,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail permission grant if audit log fails
    }

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: `Permission ${permission.resource}:${permission.action} granted to user at ${venue.name}`,
    };
  } catch (error) {
    console.error("Error granting venue permission:", error);
    return {
      success: false,
      error: "Failed to grant permission",
    };
  }
}

/**
 * Revoke a venue-specific permission from a user
 *
 * @param userId - The user to revoke permission from
 * @param venueId - The venue ID
 * @param permissionId - The permission ID to revoke
 * @returns Success status
 */
export async function revokeUserVenuePermission(
  userId: string,
  venueId: string,
  permissionId: string
) {
  try {
    const admin = await requireAdmin();

    // Get permission info before deleting for audit log
    const existingPermission = await prisma.userVenuePermission.findUnique({
      where: {
        userId_venueId_permissionId: {
          userId,
          venueId,
          permissionId,
        },
      },
      include: {
        user: { select: { email: true } },
        venue: { select: { name: true } },
        permission: { select: { resource: true, action: true } },
      },
    });

    const deleted = await prisma.userVenuePermission.deleteMany({
      where: {
        userId,
        venueId,
        permissionId,
      },
    });

    if (deleted.count === 0) {
      return {
        success: false,
        error: "Permission not found or already revoked",
      };
    }

    // Create audit log
    if (existingPermission) {
      try {
        await createAuditLog({
          userId: admin.id,
          actionType: "VENUE_PERMISSION_REVOKED",
          resourceType: "VenuePermission",
          resourceId: `${userId}-${venueId}-${permissionId}`,
          oldValue: JSON.stringify({
            userId,
            userEmail: existingPermission.user.email,
            venueId,
            venueName: existingPermission.venue.name,
            permissionId,
            permission: `${existingPermission.permission.resource}:${existingPermission.permission.action}`,
          }),
        });
      } catch (error) {
        console.error("Error creating audit log:", error);
        // Don't fail permission revocation if audit log fails
      }
    }

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: "Permission revoked successfully",
    };
  } catch (error) {
    console.error("Error revoking venue permission:", error);
    return {
      success: false,
      error: "Failed to revoke permission",
    };
  }
}

/**
 * Bulk update venue permissions for a user
 * This replaces all venue-specific permissions with the provided list
 *
 * @param userId - The user to update permissions for
 * @param venueId - The venue ID
 * @param permissionIds - Array of permission IDs to grant
 * @returns Success status
 */
export async function bulkUpdateUserVenuePermissions(
  userId: string,
  venueId: string,
  permissionIds: string[]
) {
  try {
    const admin = await requireAdmin();

    // Validate user
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, active: true },
    });

    if (!user) {
      return {
        success: false,
        error: "User not found",
      };
    }

    if (!user.active) {
      return {
        success: false,
        error: "Cannot update permissions for inactive user",
      };
    }

    // Validate venue
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, active: true, name: true },
    });

    if (!venue) {
      return {
        success: false,
        error: "Venue not found",
      };
    }

    // Validate all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
      select: { id: true },
    });

    if (permissions.length !== permissionIds.length) {
      return {
        success: false,
        error: "One or more permissions not found",
      };
    }

    // Get old permissions before transaction for audit log
    const oldPermissions = await prisma.userVenuePermission.findMany({
      where: {
        userId,
        venueId,
      },
      select: { permissionId: true },
    });
    const oldPermissionIds = oldPermissions.map(p => p.permissionId);

    // Use transaction to delete old and create new permissions
    await prisma.$transaction(async (tx) => {
      // Delete all existing venue permissions for this user at this venue
      await tx.userVenuePermission.deleteMany({
        where: {
          userId,
          venueId,
        },
      });

      // Create new permissions
      if (permissionIds.length > 0) {
        await tx.userVenuePermission.createMany({
          data: permissionIds.map((permissionId) => ({
            userId,
            venueId,
            permissionId,
            grantedBy: admin.id,
          })),
        });
      }
    });

    // Create audit log
    try {
      await createAuditLog({
        userId: admin.id,
        actionType: "VENUE_PERMISSIONS_BULK_UPDATED",
        resourceType: "VenuePermission",
        resourceId: `${userId}-${venueId}`,
        oldValue: JSON.stringify({
          userId,
          venueId,
          venueName: venue.name,
          permissionIds: oldPermissionIds,
          permissionCount: oldPermissionIds.length,
        }),
        newValue: JSON.stringify({
          userId,
          venueId,
          venueName: venue.name,
          permissionIds,
          permissionCount: permissionIds.length,
        }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail bulk update if audit log fails
    }

    revalidatePath("/admin/users");
    revalidatePath(`/admin/users/${userId}`);

    return {
      success: true,
      message: `Updated ${permissionIds.length} permissions for user at ${venue.name}`,
    };
  } catch (error) {
    console.error("Error bulk updating venue permissions:", error);
    return {
      success: false,
      error: "Failed to update permissions",
    };
  }
}

/**
 * Get all available permissions grouped by resource
 * Useful for rendering permission selection UI
 *
 * @returns All permissions organized by resource
 */
export async function getAvailablePermissions() {
  try {
    await requireAdmin();

    const permissions = await prisma.permission.findMany({
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    // Group by resource
    const grouped = permissions.reduce(
      (acc, perm) => {
        const resource = perm.resource as PermissionResource;
        if (!acc[resource]) {
          acc[resource] = [];
        }
        acc[resource].push({
          id: perm.id,
          resource: perm.resource as PermissionResource,
          action: perm.action as PermissionAction,
          description: perm.description || "",
        });
        return acc;
      },
      {} as Record<
        PermissionResource,
        Array<{
          id: string;
          resource: PermissionResource;
          action: PermissionAction;
          description: string;
        }>
      >
    );

    return {
      success: true,
      permissions: grouped,
      total: permissions.length,
    };
  } catch (error) {
    console.error("Error getting available permissions:", error);
    return {
      success: false,
      error: "Failed to get available permissions",
    };
  }
}

/**
 * Get all users with venue-specific permissions at a venue
 * Useful for venue-specific permission audits
 *
 * @param venueId - The venue ID
 * @returns List of users with venue permissions
 */
export async function getUsersWithVenuePermissions(venueId: string) {
  try {
    await requireAdmin();

    const usersWithPerms = await prisma.userVenuePermission.findMany({
      where: { venueId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            active: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
        permission: true,
      },
      orderBy: {
        grantedAt: "desc",
      },
    });

    // Group by user
    const grouped = usersWithPerms.reduce(
      (acc, vp) => {
        const userId = vp.user.id;
        if (!acc[userId]) {
          acc[userId] = {
            user: {
              id: vp.user.id,
              name: `${vp.user.firstName || ""} ${vp.user.lastName || ""}`.trim() || vp.user.email,
              email: vp.user.email,
              active: vp.user.active,
              role: vp.user.role.name,
            },
            permissions: [],
          };
        }
        acc[userId].permissions.push({
          id: vp.id,
          resource: vp.permission.resource as PermissionResource,
          action: vp.permission.action as PermissionAction,
          description: vp.permission.description,
          grantedAt: vp.grantedAt,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          user: {
            id: string;
            name: string;
            email: string;
            active: boolean;
            role: string;
          };
          permissions: Array<{
            id: string;
            resource: PermissionResource;
            action: PermissionAction;
            description: string | null;
            grantedAt: Date;
          }>;
        }
      >
    );

    return {
      success: true,
      users: Object.values(grouped),
      total: Object.keys(grouped).length,
    };
  } catch (error) {
    console.error("Error getting users with venue permissions:", error);
    return {
      success: false,
      error: "Failed to get users",
    };
  }
}

/**
 * Get total count of venue permission assignments
 * Used for statistics display
 *
 * @returns Count of all venue permission assignments
 */
export async function getTotalVenuePermissionAssignments() {
  try {
    await requireAdmin();

    const count = await prisma.userVenuePermission.count();

    return {
      success: true,
      count,
    };
  } catch (error) {
    console.error("Error getting venue permission count:", error);
    return {
      success: false,
      error: "Failed to get count",
      count: 0,
    };
  }
}
