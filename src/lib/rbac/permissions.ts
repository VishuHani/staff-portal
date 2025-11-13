import { prisma } from "@/lib/prisma";

/**
 * Permission types based on database schema
 *
 * ENHANCED PERMISSION SYSTEM:
 * - Resources represent different areas of the application
 * - Actions represent specific operations within those resources
 * - Admin role bypasses all permission checks (see isAdmin() function)
 * - Manager and Staff roles use granular permissions with venue scoping
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
  | "audit"
  | "channels"
  | "reports"
  | "schedules"
  | "settings"
  | "admin";

/**
 * Permission actions with different scopes:
 * - view_own: View own records only
 * - view_team: View team records in shared venues
 * - view_all: View all records (admin level)
 * - edit_own: Edit own records only
 * - edit_team: Edit team records in shared venues
 * - edit_all: Edit all records (admin level)
 * - create: Create new records
 * - delete_own: Delete own records only
 * - delete_all: Delete any records
 * - approve: Approve requests/actions
 * - reject: Reject requests/actions
 * - cancel: Cancel approved requests
 * - export: Export data
 * - import: Import data
 * - moderate: Moderate content (posts, comments)
 * - publish: Publish content (schedules, announcements)
 * - manage_*: Manage specific admin features
 */
export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "manage"
  | "view_own"
  | "view_team"
  | "view_all"
  | "edit_own"
  | "edit_team"
  | "edit_all"
  | "delete_own"
  | "delete_all"
  | "approve"
  | "reject"
  | "cancel"
  | "export"
  | "export_team"
  | "export_all"
  | "import"
  | "moderate"
  | "publish"
  | "assign"
  | "unassign"
  | "archive"
  | "restore"
  | "send"
  | "view"
  | "view_ai"
  | "manage_users"
  | "manage_roles"
  | "manage_stores"
  | "manage_permissions"
  | "view_audit_logs"
  | "manage_settings";

export interface Permission {
  resource: PermissionResource;
  action: PermissionAction;
}

/**
 * Check if a user has a specific permission
 *
 * ENHANCED: Now supports venue-scoped permissions
 * - If venueId is provided, checks both role permissions AND user-venue permissions
 * - If venueId is not provided, only checks role permissions (global)
 * - Admin users bypass all permission checks (see isAdmin() function)
 *
 * @param userId - The user's ID
 * @param resource - The resource to check
 * @param action - The action to check
 * @param venueId - Optional venue ID for venue-scoped permission check
 * @returns true if user has permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
  venueId?: string
): Promise<boolean> {
  try {
    // Check if user is admin first (admin bypass)
    if (await isAdmin(userId)) {
      return true;
    }

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
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user || !user.active) {
      return false;
    }

    // Check role permissions (global/default permissions)
    const hasRolePermission = user.role.rolePermissions.some(
      (rp) =>
        rp.permission.resource === resource &&
        rp.permission.action === action
    );

    // If venueId is provided, also check venue-specific permissions
    if (venueId) {
      const hasVenuePermission = user.venuePermissions.some(
        (vp) =>
          vp.permission.resource === resource &&
          vp.permission.action === action &&
          vp.venueId === venueId
      );

      // User has permission if they have it via role OR via venue-specific grant
      return hasRolePermission || hasVenuePermission;
    }

    // No venue specified, just check role permissions
    return hasRolePermission;
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
 * Get all permissions for a user (role-based only, no venue-specific)
 * @param userId - The user's ID
 * @returns Array of permissions
 * @deprecated Use getUserEffectivePermissions() for complete permission list
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
 * Get all effective permissions for a user at a specific venue
 * Combines role permissions + venue-specific permissions
 *
 * @param userId - The user's ID
 * @param venueId - Optional venue ID to include venue-specific permissions
 * @returns Array of unique permissions
 */
export async function getUserEffectivePermissions(
  userId: string,
  venueId?: string
): Promise<Permission[]> {
  try {
    // Admin has all permissions
    if (await isAdmin(userId)) {
      // Return all possible permissions (admin bypass means they have everything)
      return [];
    }

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
          where: venueId ? { venueId } : undefined,
          include: {
            permission: true,
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    // Collect role permissions
    const rolePerms = user.role.rolePermissions.map((rp) => ({
      resource: rp.permission.resource as PermissionResource,
      action: rp.permission.action as PermissionAction,
    }));

    // Collect venue permissions if venueId provided
    const venuePerms = user.venuePermissions.map((vp) => ({
      resource: vp.permission.resource as PermissionResource,
      action: vp.permission.action as PermissionAction,
    }));

    // Combine and deduplicate
    const allPerms = [...rolePerms, ...venuePerms];
    const uniquePerms = Array.from(
      new Map(
        allPerms.map((p) => [`${p.resource}:${p.action}`, p])
      ).values()
    );

    return uniquePerms;
  } catch (error) {
    console.error("Error getting effective permissions:", error);
    return [];
  }
}

/**
 * Check if user has a specific permission at a venue
 * Convenience wrapper around hasPermission with venue context
 *
 * @param userId - The user's ID
 * @param resource - The resource to check
 * @param action - The action to check
 * @param venueId - Venue ID for venue-scoped check
 * @returns true if user has permission at that venue
 */
export async function hasVenuePermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
  venueId: string
): Promise<boolean> {
  return hasPermission(userId, resource, action, venueId);
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
 *
 * IMPORTANT: Admin users bypass ALL permission checks.
 * This is the single source of truth for admin status.
 * Do NOT implement custom admin checks elsewhere.
 *
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

/**
 * PERMISSION MATRIX
 *
 * This matrix documents the comprehensive permission system.
 * Use this as a reference when assigning permissions to roles.
 *
 * Resource: availability
 * - view_own: View own availability/schedule
 * - edit_own: Edit own availability/schedule
 * - view_team: View team availability in assigned venues
 * - edit_team: Edit team availability in assigned venues
 * - view_all: View all availability (admin)
 * - edit_all: Edit all availability (admin)
 *
 * Resource: timeoff
 * - create: Create own time-off requests
 * - view_own: View own time-off requests
 * - view_team: View team time-off requests in assigned venues
 * - approve: Approve/reject time-off requests
 * - reject: Reject time-off requests
 * - cancel: Cancel approved time-off requests
 * - view_all: View all time-off requests (admin)
 * - edit_all: Edit all time-off requests (admin)
 *
 * Resource: posts
 * - create: Create posts in accessible channels
 * - view: View posts in accessible channels
 * - edit_own: Edit own posts
 * - delete_own: Delete own posts
 * - moderate: Pin/delete any posts, manage content
 * - edit_all: Edit any posts (admin)
 * - delete_all: Delete any posts (admin)
 *
 * Resource: messages
 * - send: Send direct messages
 * - view: View own conversations
 * - delete_own: Delete own messages
 * - view_all: View all conversations (admin)
 *
 * Resource: channels
 * - create: Create new channels
 * - edit: Edit channel settings
 * - archive: Archive channels
 * - delete: Delete channels (no posts)
 * - moderate: Moderate channel content
 *
 * Resource: users
 * - view_team: View users in assigned venues
 * - edit_team: Edit users in assigned venues
 * - create: Create new users
 * - view_all: View all users (admin)
 * - edit_all: Edit all users (admin)
 * - delete: Deactivate users
 *
 * Resource: reports
 * - view_team: View reports for assigned venues
 * - export_team: Export data for assigned venues
 * - view_all: View all reports (admin)
 * - export_all: Export all data (admin)
 *
 * Resource: schedules
 * - view_own: View own schedule
 * - view_team: View team schedules
 * - edit_team: Edit team schedules
 * - publish: Publish schedules
 *
 * Resource: admin
 * - manage_users: Full user management
 * - manage_roles: Manage roles and permissions
 * - manage_stores: Manage venue/store settings
 * - manage_permissions: Manage permission assignments
 * - view_audit_logs: View system audit logs
 * - manage_settings: Manage system settings
 *
 * ROLE DEFAULTS:
 *
 * ADMIN: Bypasses all permission checks (no specific permissions needed)
 *
 * MANAGER (Base Permissions):
 * - availability: view_own, edit_own, view_team, edit_team
 * - timeoff: create, view_own, view_team, approve
 * - posts: create, view, edit_own, delete_own, moderate
 * - messages: send, view
 * - users: view_team, edit_team
 * - channels: create, edit, moderate
 * - schedules: view_own, view_team, edit_team, publish
 * - reports: view_team, export_team
 *
 * STAFF (Base Permissions):
 * - availability: view_own, edit_own
 * - timeoff: create, view_own
 * - posts: create, view, edit_own, delete_own
 * - messages: send, view
 * - schedules: view_own
 */
