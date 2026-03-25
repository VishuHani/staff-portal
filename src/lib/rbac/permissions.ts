import { prisma } from "@/lib/prisma";
import type {
  Permission,
  PermissionAction,
  PermissionResource,
} from "./types";

/**
 * ============================================================================
 * ULTRA-GRANULAR PERMISSION SYSTEM
 * ============================================================================
 *
 * This permission system provides comprehensive access control with:
 *
 * 1. RESOURCE-LEVEL PERMISSIONS
 *    - Fine-grained resources for every app feature
 *    - Hierarchical resource organization
 *
 * 2. ACTION-LEVEL PERMISSIONS
 *    - Scope-based: view_own, view_team, view_all
 *    - CRUD: create, read, update, delete
 *    - Workflow: approve, reject, cancel, publish
 *    - Data: export, import, bulk operations
 *    - Admin: manage_*, impersonate, deactivate
 *
 * 3. FIELD-LEVEL PERMISSIONS (via FieldPermission model)
 *    - Control access to specific data fields
 *    - Sensitive data protection (pay rates, SSN, etc.)
 *
 * 4. CONDITIONAL PERMISSIONS (via ConditionalPermission model)
 *    - Context-based rules (venue match, status check)
 *    - Dynamic permission evaluation
 *
 * 5. TIME-BASED ACCESS (via TimeBasedAccess model)
 *    - Day-of-week restrictions
 *    - Time-of-day restrictions
 *    - Timezone support
 *
 * 6. VENUE-SCOPED PERMISSIONS
 *    - Permissions granted per venue
 *    - Cross-venue access control
 */

export type { Permission, PermissionAction, PermissionResource } from "./types";

type PermissionSnapshot = {
  active: boolean;
  roleName: string;
  rolePermissions: Permission[];
  venuePermissions: Array<{
    venueId: string;
    permission: Permission;
  }>;
};

const PERMISSION_CACHE_TTL_MS = 60 * 1000;
const permissionSnapshotCache = new Map<
  string,
  { value: PermissionSnapshot; expiresAt: number }
>();
const permissionSnapshotInFlight = new Map<
  string,
  Promise<PermissionSnapshot | null>
>();

function toPermission(resource: string, action: string): Permission {
  return {
    resource: resource as PermissionResource,
    action: action as PermissionAction,
  };
}

async function getPermissionSnapshot(
  userId: string
): Promise<PermissionSnapshot | null> {
  const cached = permissionSnapshotCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const inFlight = permissionSnapshotInFlight.get(userId);
  if (inFlight) {
    return inFlight;
  }

  const request = prisma.user
    .findUnique({
      where: { id: userId },
      select: {
        active: true,
        role: {
          select: {
            name: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    resource: true,
                    action: true,
                  },
                },
              },
            },
          },
        },
        venuePermissions: {
          select: {
            venueId: true,
            permission: {
              select: {
                resource: true,
                action: true,
              },
            },
          },
        },
      },
    })
    .then((user) => {
      if (!user || !user.active) {
        return null;
      }

      const snapshot: PermissionSnapshot = {
        active: user.active,
        roleName: user.role?.name || "STAFF",
        rolePermissions: (user.role?.rolePermissions || []).map((rp) =>
          toPermission(rp.permission.resource, rp.permission.action)
        ),
        venuePermissions: (user.venuePermissions || []).map((vp) => ({
          venueId: vp.venueId,
          permission: toPermission(
            vp.permission.resource,
            vp.permission.action
          ),
        })),
      };

      permissionSnapshotCache.set(userId, {
        value: snapshot,
        expiresAt: Date.now() + PERMISSION_CACHE_TTL_MS,
      });

      return snapshot;
    })
    .finally(() => {
      permissionSnapshotInFlight.delete(userId);
    });

  permissionSnapshotInFlight.set(userId, request);
  return request;
}

export function invalidatePermissionCache(userId?: string) {
  if (userId) {
    permissionSnapshotCache.delete(userId);
    return;
  }

  permissionSnapshotCache.clear();
}

/**
 * Check if a user has a specific permission
 *
 * ENHANCED: Now supports venue-scoped permissions
 * - If venueId is provided, checks both role permissions AND user-venue permissions
 * - If venueId is not provided, checks role permissions AND venue grants from any venue
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
    const snapshot = await getPermissionSnapshot(userId);
    if (!snapshot) {
      return false;
    }

    if (snapshot.roleName === "ADMIN") {
      return true;
    }

    const hasRolePermission = snapshot.rolePermissions.some(
      (permission) =>
        permission.resource === resource && permission.action === action
    );

    const hasVenuePermission = snapshot.venuePermissions.some(
      (entry) =>
        (!venueId || entry.venueId === venueId) &&
        entry.permission.resource === resource &&
        entry.permission.action === action
    );

    // User has permission if they have it via role OR via venue-specific grant
    return hasRolePermission || hasVenuePermission;
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
  const snapshot = await getPermissionSnapshot(userId);
  if (!snapshot) {
    return false;
  }

  if (snapshot.roleName === "ADMIN") {
    return true;
  }

  return permissions.every((permission) => {
    const hasRolePermission = snapshot.rolePermissions.some(
      (candidate) =>
        candidate.resource === permission.resource &&
        candidate.action === permission.action
    );
    const hasVenuePermission = snapshot.venuePermissions.some(
      (entry) =>
        entry.permission.resource === permission.resource &&
        entry.permission.action === permission.action
    );

    return hasRolePermission || hasVenuePermission;
  });
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
  const snapshot = await getPermissionSnapshot(userId);
  if (!snapshot) {
    return false;
  }

  if (snapshot.roleName === "ADMIN") {
    return true;
  }

  return permissions.some((permission) => {
    const hasRolePermission = snapshot.rolePermissions.some(
      (candidate) =>
        candidate.resource === permission.resource &&
        candidate.action === permission.action
    );
    const hasVenuePermission = snapshot.venuePermissions.some(
      (entry) =>
        entry.permission.resource === permission.resource &&
        entry.permission.action === permission.action
    );

    return hasRolePermission || hasVenuePermission;
  });
}

/**
 * Get all permissions for a user (role-based only, no venue-specific)
 * @param userId - The user's ID
 * @returns Array of permissions
 * @deprecated Use getUserEffectivePermissions() for complete permission list
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  try {
    const snapshot = await getPermissionSnapshot(userId);
    if (!snapshot) {
      return [];
    }

    return snapshot.rolePermissions;
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
    const snapshot = await getPermissionSnapshot(userId);
    if (!snapshot) {
      return [];
    }

    // Admin has all permissions
    if (snapshot.roleName === "ADMIN") {
      // Return all possible permissions (admin bypass means they have everything)
      return [];
    }

    const rolePerms = snapshot.rolePermissions;
    const venuePerms = venueId
      ? snapshot.venuePermissions
          .filter((vp) => vp.venueId === venueId)
          .map((vp) => vp.permission)
      : snapshot.venuePermissions.map((vp) => vp.permission);

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
    const snapshot = await getPermissionSnapshot(userId);
    if (!snapshot) {
      return false;
    }

    // Check if user has any manage permission
    return snapshot.rolePermissions.some(
      (permission) => permission.action === "manage"
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
    const snapshot = await getPermissionSnapshot(userId);
    return snapshot?.roleName === "ADMIN";
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

/**
 * UNIFIED PERMISSION CHECK
 * 
 * Comprehensive permission check that evaluates:
 * 1. Base RBAC permission (role-based)
 * 2. Venue-specific permissions (if venueId provided)
 * 
 * This is the recommended entry point for all permission checks.
 * 
 * @param userId - The user's ID
 * @param resource - The resource to check
 * @param action - The action to check
 * @param options - Optional venue context
 * @returns true if user has permission
 */
export async function checkPermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
  options?: {
    venueId?: string;
  }
): Promise<boolean> {
  return hasPermission(userId, resource, action, options?.venueId);
}

/**
 * Check multiple permissions at once with detailed results
 * 
 * @param userId - The user's ID
 * @param permissions - Array of permissions to check
 * @param venueId - Optional venue context for all checks
 * @returns Object with overall result and individual check results
 */
export async function checkPermissions(
  userId: string,
  permissions: Array<{ resource: PermissionResource; action: PermissionAction }>,
  venueId?: string
): Promise<{
  allowed: boolean;
  results: Array<{ resource: PermissionResource; action: PermissionAction; allowed: boolean }>;
}> {
  const results = await Promise.all(
    permissions.map(async (p) => ({
      resource: p.resource,
      action: p.action,
      allowed: await hasPermission(userId, p.resource, p.action, venueId),
    }))
  );

  return {
    allowed: results.every((r) => r.allowed),
    results,
  };
}

/**
 * ============================================================================
 * COMPREHENSIVE PERMISSION MATRIX
 * ============================================================================
 *
 * This matrix documents the ultra-granular permission system.
 * Use this as a reference when assigning permissions to roles.
 *
 * ============================================================================
 * CORE RESOURCES
 * ============================================================================
 *
 * Resource: users
 * - view_own: View own user profile
 * - view_team: View users in assigned venues
 * - view_all: View all users (admin)
 * - view_sensitive: View sensitive fields (pay rates, SSN, DOB)
 * - edit_own: Edit own profile
 * - edit_team: Edit users in assigned venues
 * - edit_all: Edit all users (admin)
 * - create: Create new users
 * - delete_own: Delete own account (soft delete)
 * - delete_all: Deactivate any user
 * - deactivate: Deactivate users
 * - reactivate: Reactivate deactivated users
 * - impersonate: Login as another user (admin only)
 * - bulk_create: Create multiple users at once
 * - bulk_update: Update multiple users at once
 * - bulk_assign: Assign multiple users to venues/roles
 *
 * Resource: roles
 * - view: View available roles
 * - view_all: View all roles including permissions
 * - create: Create new roles
 * - edit: Edit role details
 * - delete: Delete unused roles
 * - manage: Full role management
 * - assign: Assign roles to users
 *
 * Resource: stores / venues
 * - view: View venue details
 * - view_all: View all venues
 * - create: Create new venues
 * - edit: Edit venue settings
 * - delete: Delete/archives venues
 * - manage: Full venue management
 * - manage_positions: Manage venue positions
 * - manage_hours: Manage business hours
 *
 * Resource: positions
 * - view: View positions
 * - create: Create new positions
 * - edit: Edit position details
 * - delete: Delete positions
 * - assign: Assign positions to staff
 *
 * ============================================================================
 * SCHEDULING RESOURCES
 * ============================================================================
 *
 * Resource: availability
 * - view_own: View own availability
 * - edit_own: Edit own availability
 * - view_team: View team availability in assigned venues
 * - edit_team: Edit team availability in assigned venues
 * - view_all: View all availability (admin)
 * - edit_all: Edit all availability (admin)
 * - export: Export availability data
 *
 * Resource: timeoff
 * - create: Create own time-off requests
 * - view_own: View own time-off requests
 * - view_team: View team time-off requests
 * - view_all: View all time-off requests (admin)
 * - edit_own: Edit own pending requests
 * - edit_all: Edit any time-off request (admin)
 * - approve: Approve time-off requests
 * - reject: Reject time-off requests
 * - cancel: Cancel approved time-off requests
 * - export: Export time-off data
 *
 * Resource: rosters
 * - view_own: View own roster/shifts
 * - view_team: View team rosters
 * - view_all: View all rosters (admin)
 * - create: Create new rosters
 * - edit: Edit draft rosters
 * - edit_team: Edit team rosters
 * - edit_all: Edit all rosters (admin)
 * - delete: Delete rosters
 * - submit: Submit roster for approval
 * - approve: Approve roster
 * - reject: Reject roster
 * - publish: Publish roster
 * - archive: Archive rosters
 * - restore: Restore archived rosters
 * - copy: Copy/duplicate rosters
 * - import: Import rosters from files
 * - export: Export rosters
 * - bulk_create: Create multiple rosters
 * - bulk_update: Update multiple rosters
 *
 * Resource: schedules
 * - view_own: View own schedule
 * - view_team: View team schedules
 * - view_all: View all schedules (admin)
 * - edit_team: Edit team schedules
 * - publish: Publish schedules
 *
 * ============================================================================
 * COMMUNICATION RESOURCES
 * ============================================================================
 *
 * Resource: posts
 * - view: View posts in accessible channels
 * - create: Create posts
 * - edit_own: Edit own posts
 * - edit_all: Edit any post (admin)
 * - delete_own: Delete own posts
 * - delete_all: Delete any post (admin)
 * - pin: Pin posts
 * - unpin: Unpin posts
 * - moderate: Moderate posts (pin, lock, delete)
 *
 * Resource: comments
 * - view: View comments
 * - create: Create comments
 * - edit_own: Edit own comments
 * - delete_own: Delete own comments
 * - delete_all: Delete any comment (moderator)
 * - moderate: Moderate comments
 *
 * Resource: reactions
 * - view: View reactions
 * - create: Add reactions
 * - delete_own: Remove own reactions
 * - delete_all: Remove any reaction (moderator)
 *
 * Resource: messages
 * - send: Send direct messages
 * - view: View own conversations
 * - view_all: View all conversations (admin)
 * - delete_own: Delete own messages
 * - export: Export message history
 *
 * Resource: conversations
 * - view: View own conversations
 * - create: Start new conversations
 * - edit: Edit conversation details
 * - archive: Archive conversations
 * - add_participants: Add participants to group chats
 * - remove_participants: Remove participants
 *
 * Resource: channels
 * - view: View accessible channels
 * - create: Create new channels
 * - edit: Edit channel settings
 * - delete: Delete channels
 * - archive: Archive channels
 * - restore: Restore archived channels
 * - moderate: Moderate channel content
 * - manage: Full channel management
 * - assign: Assign members to channels
 *
 * ============================================================================
 * INTELLIGENCE RESOURCES
 * ============================================================================
 *
 * Resource: ai
 * - view_ai: View AI features
 * - use_ai: Use AI chat/assistance
 * - manage_ai: Configure AI settings
 * - view_sensitive: View AI usage logs
 *
 * Resource: reports
 * - view: View basic reports
 * - view_team: View team reports
 * - view_all: View all reports (admin)
 * - export: Export reports
 * - export_team: Export team reports
 * - export_all: Export all reports (admin)
 * - export_anonymized: Export anonymized data
 * - create: Create custom reports
 *
 * ============================================================================
 * SYSTEM RESOURCES
 * ============================================================================
 *
 * Resource: audit
 * - view: View own audit trail
 * - view_all: View all audit logs (admin)
 * - export: Export audit logs
 * - delete: Delete old audit logs
 *
 * Resource: notifications
 * - view: View own notifications
 * - send: Send notifications to others
 * - manage: Manage notification templates
 * - broadcast: Send system-wide broadcasts
 *
 * Resource: announcements
 * - view: View announcements
 * - create: Create announcements
 * - edit: Edit announcements
 * - delete: Delete announcements
 * - send: Send announcements to users
 *
 * Resource: settings
 * - view: View settings
 * - edit: Edit own settings
 * - manage_settings: Manage system settings
 *
 * Resource: media
 * - view: View media files
 * - upload: Upload media files
 * - delete_own: Delete own uploaded files
 * - delete_all: Delete any file (admin)
 *
 * Resource: dashboard
 * - view: View dashboard
 * - customize: Customize dashboard layout
 * - manage: Manage dashboard widgets
 *
 * Resource: profile
 * - view_own: View own profile
 * - edit_own: Edit own profile
 * - view_sensitive: View sensitive profile data
 *
 * Resource: admin
 * - manage_users: Full user management
 * - manage_roles: Manage roles and permissions
 * - manage_stores: Manage venue/store settings
 * - manage_permissions: Manage permission assignments
 * - view_audit_logs: View system audit logs
 * - manage_settings: Manage system settings
 * - impersonate: Impersonate other users
 *
 * ============================================================================
 * ROLE DEFAULTS
 * ============================================================================
 *
 * ADMIN: Bypasses all permission checks (no specific permissions needed)
 *
 * MANAGER (Base Permissions):
 * - users: view_team, edit_team, view_sensitive
 * - availability: view_own, edit_own, view_team, edit_team
 * - timeoff: create, view_own, view_team, approve, reject
 * - rosters: view_team, create, edit, submit, publish, copy, import, export
 * - schedules: view_own, view_team, edit_team, publish
 * - posts: create, view, edit_own, delete_own, moderate, pin
 * - comments: view, create, edit_own, delete_own, moderate
 * - messages: send, view
 * - channels: view, create, edit, moderate, assign
 * - reports: view_team, export_team
 * - ai: view_ai, use_ai
 * - media: view, upload, delete_own
 * - dashboard: view, customize
 *
 * STAFF (Base Permissions):
 * - users: view_own, edit_own
 * - availability: view_own, edit_own
 * - timeoff: create, view_own, edit_own, cancel
 * - rosters: view_own
 * - schedules: view_own
 * - posts: create, view, edit_own, delete_own
 * - comments: view, create, edit_own, delete_own
 * - reactions: view, create, delete_own
 * - messages: send, view
 * - channels: view
 * - reports: view (limited)
 * - media: view, upload, delete_own
 * - dashboard: view
 * - profile: view_own, edit_own
 */
