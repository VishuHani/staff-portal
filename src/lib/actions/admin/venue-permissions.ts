"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAnyPermission } from "@/lib/rbac/access";
import {
  type PermissionResource,
  type PermissionAction,
  type Permission,
  isAdmin,
} from "@/lib/rbac/permissions";
import { revalidatePath } from "next/cache";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { getCurrentUser } from "@/lib/actions/auth";
import { getUserVenueIds } from "@/lib/utils/venue";
import { getAuditContext } from "@/lib/utils/audit-helpers";
import {
  notifyPermissionGranted,
  notifyPermissionRevoked,
} from "@/lib/services/notifications";

/**
 * VENUE-SCOPED PERMISSION MANAGEMENT ACTIONS
 *
 * These server actions allow admins and managers to manage venue-specific permissions for users.
 * Includes comprehensive permission hierarchy checks and error handling.
 *
 * Use Cases:
 * - Grant a manager access to reports at a specific venue
 * - Give a manager permission to edit team schedules at their venue
 * - Remove venue-specific permissions when a user changes roles
 * - Bulk update permissions when assigning a user to a new venue
 *
 * Permission Hierarchy:
 * - Admins can manage permissions for anyone (except themselves)
 * - Managers can manage permissions for STAFF users at their assigned venues
 * - Managers can view their own permissions (read-only)
 * - Managers cannot manage other managers or admins
 * - Staff cannot manage any permissions
 */

/**
 * Check if current user can manage venue permissions for target user
 *
 * @param currentUserId - The ID of the user attempting to manage permissions
 * @param targetUserId - The ID of the user whose permissions are being managed
 * @param venueId - The venue ID for scoped check
 * @param isReadOnly - If true, only checks read permission (viewing own permissions)
 * @returns Object with allowed status and optional error message
 */
async function canManageUserVenuePermissions(
  currentUserId: string,
  targetUserId: string,
  venueId: string,
  isReadOnly: boolean = false
): Promise<{ allowed: boolean; error?: string }> {
  try {
    // Get current user with role
    const currentUser = await prisma.user.findUnique({
      where: { id: currentUserId },
      include: {
        role: true,
      },
    });

    if (!currentUser || !currentUser.active) {
      return { allowed: false, error: "Current user not found or inactive" };
    }

    // Get target user with role
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: {
        role: true,
      },
    });

    if (!targetUser) {
      return { allowed: false, error: "Target user not found" };
    }

    // Check if current user is admin
    const currentUserIsAdmin = await isAdmin(currentUserId);

    // Rule 1: Admins can manage everyone
    if (currentUserIsAdmin) {
      // Admins can view anyone (including themselves in read-only mode)
      if (isReadOnly) {
        return { allowed: true };
      }
      // Admins cannot edit their own permissions
      if (currentUserId === targetUserId) {
        return { allowed: false, error: "Cannot edit your own permissions" };
      }
      return { allowed: true };
    }

    // Rule 2: Managers can view their own permissions (read-only)
    if (currentUserId === targetUserId && isReadOnly) {
      return { allowed: true };
    }

    // Rule 3: Cannot manage yourself (unless admin or read-only already checked)
    if (currentUserId === targetUserId) {
      return { allowed: false, error: "Cannot edit your own permissions" };
    }

    // Rule 4: Check if current user has manage permission
    const hasManagePermission = await prisma.rolePermission.findFirst({
      where: {
        roleId: currentUser.role.id,
        permission: {
          resource: "users",
          action: {
            in: ["edit_team", "manage"],
          },
        },
      },
    });

    if (!hasManagePermission) {
      return { allowed: false, error: "You don't have permission to manage user permissions" };
    }

    // Rule 5: Target user must not be admin (only admins can manage admins)
    const targetUserIsAdmin = await isAdmin(targetUserId);
    if (targetUserIsAdmin) {
      return { allowed: false, error: "Only admins can manage admin permissions" };
    }

    // Rule 6: Managers can only manage STAFF (not other managers)
    // Check if target is a manager
    const targetIsManager = await prisma.rolePermission.findFirst({
      where: {
        roleId: targetUser.role.id,
        permission: {
          action: "manage",
        },
      },
    });

    if (targetIsManager) {
      return { allowed: false, error: "Managers cannot manage other managers' permissions" };
    }

    // Rule 7: Manager must have access to the venue
    const currentUserVenues = await getUserVenueIds(currentUserId);
    if (!currentUserVenues.includes(venueId)) {
      return { allowed: false, error: "You don't have access to this venue" };
    }

    // Rule 8: Target user must be assigned to the venue
    const targetUserVenues = await getUserVenueIds(targetUserId);
    if (!targetUserVenues.includes(venueId)) {
      return { allowed: false, error: "Target user is not assigned to this venue" };
    }

    return { allowed: true };
  } catch (error) {
    console.error("Error checking permission management access:", error);
    return { allowed: false, error: "Failed to verify permissions" };
  }
}

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
    // Require at least manager permissions
    const currentUser = await requireAnyPermission([
      { resource: "users", action: "edit_team" },
      { resource: "users", action: "view_team" },
    ]);

    // Check if current user can manage this user's permissions (read-only check)
    const accessCheck = await canManageUserVenuePermissions(
      currentUser.id,
      userId,
      venueId,
      true // read-only
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        error: accessCheck.error || "Access denied",
      };
    }

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
 * @returns Combined permissions from role and venue-specific grants, plus isReadOnly flag
 */
export async function getUserEffectiveVenuePermissions(
  userId: string,
  venueId: string
) {
  try {
    // Require at least manager permissions
    const currentUser = await requireAnyPermission([
      { resource: "users", action: "edit_team" },
      { resource: "users", action: "view_team" },
    ]);

    // Check if current user can view this user's permissions
    const accessCheck = await canManageUserVenuePermissions(
      currentUser.id,
      userId,
      venueId,
      true // read-only check first
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        error: accessCheck.error || "Access denied",
      };
    }

    // Determine if this is read-only mode (viewing own permissions or no edit permission)
    const writeAccessCheck = await canManageUserVenuePermissions(
      currentUser.id,
      userId,
      venueId,
      false // write check
    );
    const isReadOnly = !writeAccessCheck.allowed;

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
      isReadOnly, // Indicate if user can only view (not edit)
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
    // Require at least manager permissions
    const currentUser = await requireAnyPermission([
      { resource: "users", action: "edit_team" },
    ]);

    // Check if current user can manage this user's permissions (write access)
    const accessCheck = await canManageUserVenuePermissions(
      currentUser.id,
      userId,
      venueId,
      false // write access required
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        error: accessCheck.error || "Access denied",
      };
    }

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
        grantedBy: currentUser.id,
      },
    });

    // Get granter name for notification
    const granterName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.email;

    // Create audit log with IP address
    const auditContext = await getAuditContext();
    try {
      await createAuditLog({
        userId: currentUser.id,
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
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail permission grant if audit log fails
    }

    // Send notification to user
    try {
      await notifyPermissionGranted(
        userId,
        currentUser.id,
        granterName,
        `${permission.resource}:${permission.action}`,
        venue.name
      );
    } catch (error) {
      console.error("Error sending permission notification:", error);
      // Don't fail permission grant if notification fails
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
    // Require at least manager permissions
    const currentUser = await requireAnyPermission([
      { resource: "users", action: "edit_team" },
    ]);

    // Check if current user can manage this user's permissions (write access)
    const accessCheck = await canManageUserVenuePermissions(
      currentUser.id,
      userId,
      venueId,
      false // write access required
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        error: accessCheck.error || "Access denied",
      };
    }

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

    // Get revoker name for notification
    const revokerName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.email;

    // Create audit log with IP address
    const auditContext = await getAuditContext();
    if (existingPermission) {
      try {
        await createAuditLog({
          userId: currentUser.id,
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
          ipAddress: auditContext.ipAddress,
        });
      } catch (error) {
        console.error("Error creating audit log:", error);
        // Don't fail permission revocation if audit log fails
      }
    }

    // Send notification to user
    if (existingPermission) {
      try {
        await notifyPermissionRevoked(
          userId,
          currentUser.id,
          revokerName,
          `${existingPermission.permission.resource}:${existingPermission.permission.action}`,
          existingPermission.venue.name
        );
      } catch (error) {
        console.error("Error sending permission notification:", error);
        // Don't fail permission revocation if notification fails
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
    // Require at least manager permissions
    const currentUser = await requireAnyPermission([
      { resource: "users", action: "edit_team" },
    ]);

    // Check if current user can manage this user's permissions (write access)
    const accessCheck = await canManageUserVenuePermissions(
      currentUser.id,
      userId,
      venueId,
      false // write access required
    );

    if (!accessCheck.allowed) {
      return {
        success: false,
        error: accessCheck.error || "Access denied",
      };
    }

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
            grantedBy: currentUser.id,
          })),
        });
      }
    });

    // Calculate granted and revoked counts for notification
    const grantedCount = permissionIds.filter(id => !oldPermissionIds.includes(id)).length;
    const revokedCount = oldPermissionIds.filter(id => !permissionIds.includes(id)).length;

    // Get changer name for notification
    const changerName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.email;

    // Create audit log with IP address
    const auditContext = await getAuditContext();
    try {
      await createAuditLog({
        userId: currentUser.id,
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
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail bulk update if audit log fails
    }

    // Send notification to user about permission changes
    if (grantedCount > 0 || revokedCount > 0) {
      try {
        const { notifyPermissionsBulkChanged } = await import("@/lib/services/notifications");
        await notifyPermissionsBulkChanged(
          userId,
          currentUser.id,
          changerName,
          grantedCount,
          revokedCount,
          venue.name
        );
      } catch (error) {
        console.error("Error sending permission notification:", error);
        // Don't fail bulk update if notification fails
      }
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
    // Require at least manager permissions
    await requireAnyPermission([
      { resource: "users", action: "edit_team" },
      { resource: "users", action: "view_team" },
    ]);

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
    // Require at least manager permissions
    const currentUser = await requireAnyPermission([
      { resource: "users", action: "edit_team" },
      { resource: "users", action: "view_team" },
    ]);

    // Check if user is admin
    const currentUserIsAdmin = await isAdmin(currentUser.id);

    // Managers can only view users at their assigned venues
    if (!currentUserIsAdmin) {
      const currentUserVenues = await getUserVenueIds(currentUser.id);
      if (!currentUserVenues.includes(venueId)) {
        return {
          success: false,
          error: "You don't have access to this venue",
        };
      }
    }

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
    // Require at least manager permissions
    const currentUser = await requireAnyPermission([
      { resource: "users", action: "edit_team" },
      { resource: "users", action: "view_team" },
    ]);

    // Check if user is admin
    const currentUserIsAdmin = await isAdmin(currentUser.id);

    let whereClause: any = {};

    // Managers can only count permissions at their assigned venues
    if (!currentUserIsAdmin) {
      const currentUserVenues = await getUserVenueIds(currentUser.id);
      if (currentUserVenues.length === 0) {
        return {
          success: true,
          count: 0,
        };
      }

      whereClause = {
        venueId: {
          in: currentUserVenues,
        },
      };
    }

    const count = await prisma.userVenuePermission.count({
      where: whereClause,
    });

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

/**
 * Bulk grant permissions to all users with a specific role at a venue
 * Admin only
 *
 * @param roleId - The role ID to target
 * @param venueId - The venue ID
 * @param permissionIds - Array of permission IDs to grant
 * @returns Success status with count of affected users
 */
export async function bulkGrantPermissionsByRole(
  roleId: string,
  venueId: string,
  permissionIds: string[]
) {
  try {
    // Admin only
    const currentUser = await requireAdmin();

    // Validate role
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      select: { id: true, name: true },
    });

    if (!role) {
      return {
        success: false,
        error: "Role not found",
      };
    }

    // Prevent modifying admin permissions
    if (role.name === "ADMIN") {
      return {
        success: false,
        error: "Cannot bulk modify admin permissions",
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

    if (!venue.active) {
      return {
        success: false,
        error: "Cannot grant permissions for inactive venue",
      };
    }

    // Validate all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
      select: { id: true, resource: true, action: true },
    });

    if (permissions.length !== permissionIds.length) {
      return {
        success: false,
        error: "One or more permissions not found",
      };
    }

    // Get all users with this role at this venue
    const usersWithRoleAtVenue = await prisma.user.findMany({
      where: {
        roleId,
        active: true,
        venues: {
          some: { venueId },
        },
      },
      select: { id: true },
    });

    const activeUserIds = usersWithRoleAtVenue.map((u) => u.id);

    if (activeUserIds.length === 0) {
      return {
        success: false,
        error: "No active users with this role at the specified venue",
      };
    }

    // Get granter name for notification
    const granterName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.email;

    // Create permission grants (skip duplicates)
    let grantedCount = 0;
    for (const userId of activeUserIds) {
      for (const permissionId of permissionIds) {
        try {
          await prisma.userVenuePermission.create({
            data: {
              userId,
              venueId,
              permissionId,
              grantedBy: currentUser.id,
            },
          });
          grantedCount++;
        } catch (error) {
          // Skip duplicates (unique constraint violation)
        }
      }
    }

    // Create audit log with IP address
    const auditContext = await getAuditContext();
    try {
      await createAuditLog({
        userId: currentUser.id,
        actionType: "VENUE_PERMISSIONS_BULK_GRANTED_BY_ROLE",
        resourceType: "VenuePermission",
        resourceId: `${roleId}-${venueId}`,
        newValue: JSON.stringify({
          roleId,
          roleName: role.name,
          venueId,
          venueName: venue.name,
          permissionIds,
          userCount: activeUserIds.length,
          grantedCount,
        }),
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
    }

    // Send notifications to affected users
    const { notifyPermissionGranted } = await import("@/lib/services/notifications");
    for (const userId of activeUserIds) {
      try {
        await notifyPermissionGranted(
          userId,
          currentUser.id,
          granterName,
          `${permissions.length} permissions`,
          venue.name
        );
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }

    revalidatePath("/admin/users");

    return {
      success: true,
      message: `Granted ${grantedCount} permissions to ${activeUserIds.length} users with role ${role.name} at ${venue.name}`,
      userCount: activeUserIds.length,
      grantedCount,
    };
  } catch (error) {
    console.error("Error bulk granting permissions by role:", error);
    return {
      success: false,
      error: "Failed to grant permissions",
    };
  }
}

/**
 * Bulk grant permissions to multiple users at a venue
 * Admin only
 *
 * @param userIds - Array of user IDs
 * @param venueId - The venue ID
 * @param permissionIds - Array of permission IDs to grant
 * @returns Success status with count of affected users
 */
export async function bulkGrantPermissionsToUsers(
  userIds: string[],
  venueId: string,
  permissionIds: string[]
) {
  try {
    // Admin only
    const currentUser = await requireAdmin();

    if (userIds.length === 0) {
      return {
        success: false,
        error: "No users specified",
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

    if (!venue.active) {
      return {
        success: false,
        error: "Cannot grant permissions for inactive venue",
      };
    }

    // Validate all permissions exist
    const permissions = await prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
      select: { id: true, resource: true, action: true },
    });

    if (permissions.length !== permissionIds.length) {
      return {
        success: false,
        error: "One or more permissions not found",
      };
    }

    // Validate all users exist and are active
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        active: true,
      },
      select: { id: true },
    });

    if (users.length !== userIds.length) {
      return {
        success: false,
        error: "One or more users not found or inactive",
      };
    }

    // Get granter name for notification
    const granterName = currentUser.firstName && currentUser.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`
      : currentUser.email;

    // Create permission grants (skip duplicates)
    let grantedCount = 0;
    for (const userId of userIds) {
      for (const permissionId of permissionIds) {
        try {
          await prisma.userVenuePermission.create({
            data: {
              userId,
              venueId,
              permissionId,
              grantedBy: currentUser.id,
            },
          });
          grantedCount++;
        } catch (error) {
          // Skip duplicates (unique constraint violation)
        }
      }
    }

    // Create audit log with IP address
    const auditContext = await getAuditContext();
    try {
      await createAuditLog({
        userId: currentUser.id,
        actionType: "VENUE_PERMISSIONS_BULK_GRANTED_TO_USERS",
        resourceType: "VenuePermission",
        resourceId: venueId,
        newValue: JSON.stringify({
          userIds,
          userCount: userIds.length,
          venueId,
          venueName: venue.name,
          permissionIds,
          grantedCount,
        }),
        ipAddress: auditContext.ipAddress,
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
    }

    // Send notifications to affected users
    const { notifyPermissionGranted } = await import("@/lib/services/notifications");
    for (const userId of userIds) {
      try {
        await notifyPermissionGranted(
          userId,
          currentUser.id,
          granterName,
          `${permissions.length} permissions`,
          venue.name
        );
      } catch (error) {
        console.error("Error sending notification:", error);
      }
    }

    revalidatePath("/admin/users");

    return {
      success: true,
      message: `Granted ${grantedCount} permissions to ${userIds.length} users at ${venue.name}`,
      userCount: userIds.length,
      grantedCount,
    };
  } catch (error) {
    console.error("Error bulk granting permissions to users:", error);
    return {
      success: false,
      error: "Failed to grant permissions",
    };
  }
}
