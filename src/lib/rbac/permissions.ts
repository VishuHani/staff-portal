import { prisma } from "@/lib/prisma";

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

/**
 * Permission Resources - All application areas that can be controlled
 *
 * Organized by category:
 * - Core: users, roles, stores, venues, positions
 * - Scheduling: availability, timeoff, rosters, schedules
 * - Communication: posts, comments, reactions, messages, conversations, channels
 * - Intelligence: ai, reports
 * - System: audit, notifications, announcements, settings, media, dashboard, profile
 */
export type PermissionResource =
  // Core Resources
  | "users"
  | "roles"
  | "stores"
  | "venues"
  | "positions"
  // Scheduling Resources
  | "availability"
  | "timeoff"
  | "rosters"
  | "schedules"
  // Communication Resources
  | "posts"
  | "comments"
  | "reactions"
  | "messages"
  | "conversations"
  | "channels"
  // Intelligence Resources
  | "ai"
  | "reports"
  // System Resources
  | "audit"
  | "notifications"
  | "announcements"
  | "settings"
  | "media"
  | "dashboard"
  | "profile"
  | "admin";

/**
 * Permission Actions - Operations that can be performed on resources
 *
 * Categories:
 * 1. Basic CRUD: create, read, update, delete
 * 2. Scope-based: view_own, view_team, view_all, edit_own, edit_team, edit_all
 * 3. Ownership: delete_own, delete_all
 * 4. Workflow: approve, reject, cancel, publish
 * 5. Data Operations: export, import, export_team, export_all
 * 6. Content: moderate, pin, archive, restore
 * 7. Assignment: assign, unassign
 * 8. Communication: send
 * 9. Bulk Operations: bulk_create, bulk_update, bulk_delete
 * 10. Admin: manage_*, impersonate, deactivate, reactivate
 * 11. Sensitive: view_sensitive
 * 12. AI: view_ai, use_ai, manage_ai
 */
export type PermissionAction =
  // Basic CRUD
  | "create"
  | "read"
  | "update"
  | "delete"
  | "edit"
  | "manage"
  // View Scopes
  | "view"
  | "view_own"
  | "view_team"
  | "view_all"
  | "view_sensitive"  // Access to sensitive fields (pay rates, SSN, etc.)
  // Edit Scopes
  | "edit_own"
  | "edit_team"
  | "edit_all"
  // Delete Scopes
  | "delete_own"
  | "delete_all"
  // Workflow Actions
  | "approve"
  | "reject"
  | "cancel"
  | "publish"
  | "submit"
  | "recall"
  | "finalize"
  // Data Operations
  | "export"
  | "export_team"
  | "export_all"
  | "export_anonymized"
  | "import"
  | "import_own"
  | "import_team"
  | "import_all"
  // Content Moderation
  | "moderate"
  | "pin"
  | "unpin"
  | "archive"
  | "restore"
  // Assignment
  | "assign"
  | "unassign"
  // Communication
  | "send"
  // Bulk Operations
  | "bulk_create"
  | "bulk_update"
  | "bulk_delete"
  | "bulk_assign"
  // Admin Actions
  | "manage_users"
  | "manage_roles"
  | "manage_stores"
  | "manage_permissions"
  | "manage_settings"
  | "manage_positions"
  | "manage_hours"
  | "view_audit_logs"
  | "impersonate"
  | "deactivate"
  | "reactivate"
  // AI Actions
  | "view_ai"
  | "use_ai"
  | "manage_ai"
  // Copy/Duplicate
  | "copy"
  | "duplicate";

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
