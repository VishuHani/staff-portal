import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import {
  hasPermission,
  hasAllPermissions,
  hasAnyPermission,
  isAdmin,
  isManager,
  hasVenuePermission,
  getUserEffectivePermissions,
  type Permission,
  type PermissionResource,
  type PermissionAction,
} from "./permissions";

/**
 * Require authentication - redirect to login if not authenticated
 * @returns The authenticated user
 */
export async function requireAuth() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.active) {
    redirect("/login?error=inactive");
  }

  return user;
}

/**
 * Require specific permission - redirect if user doesn't have it
 * @param resource - The resource to check
 * @param action - The action to check
 * @returns The authenticated user
 */
export async function requirePermission(
  resource: PermissionResource,
  action: PermissionAction
) {
  const user = await requireAuth();

  const hasAccess = await hasPermission(user.id, resource, action);

  if (!hasAccess) {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}

/**
 * Require all specified permissions
 * @param permissions - Array of permissions required
 * @returns The authenticated user
 */
export async function requireAllPermissions(permissions: Permission[]) {
  const user = await requireAuth();

  const hasAccess = await hasAllPermissions(user.id, permissions);

  if (!hasAccess) {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}

/**
 * Require any of the specified permissions
 * @param permissions - Array of permissions (at least one required)
 * @returns The authenticated user
 */
export async function requireAnyPermission(permissions: Permission[]) {
  const user = await requireAuth();

  const hasAccess = await hasAnyPermission(user.id, permissions);

  if (!hasAccess) {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}

/**
 * Require admin role
 * @returns The authenticated admin user
 */
export async function requireAdmin() {
  const user = await requireAuth();

  const isAdminUser = await isAdmin(user.id);

  if (!isAdminUser) {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}

/**
 * Require manager or admin role
 * @returns The authenticated manager/admin user
 */
export async function requireManager() {
  const user = await requireAuth();

  const isManagerUser = await isManager(user.id);
  const isAdminUser = await isAdmin(user.id);

  if (!isManagerUser && !isAdminUser) {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}

/**
 * Check if current user has permission (non-redirecting)
 * @param resource - The resource to check
 * @param action - The action to check
 * @returns true if user has permission, false otherwise
 */
export async function canAccess(
  resource: PermissionResource,
  action: PermissionAction
): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return false;
    }

    return await hasPermission(user.id, resource, action);
  } catch (error) {
    console.error("Error checking access:", error);
    return false;
  }
}

/**
 * Check if current user is admin (non-redirecting)
 * @returns true if user is admin, false otherwise
 */
export async function canAccessAdmin(): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return false;
    }

    return await isAdmin(user.id);
  } catch (error) {
    console.error("Error checking admin access:", error);
    return false;
  }
}

/**
 * Check if current user is manager or admin (non-redirecting)
 * @returns true if user is manager or admin, false otherwise
 */
export async function canAccessManager(): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return false;
    }

    const isManagerUser = await isManager(user.id);
    const isAdminUser = await isAdmin(user.id);

    return isManagerUser || isAdminUser;
  } catch (error) {
    console.error("Error checking manager access:", error);
    return false;
  }
}

/**
 * VENUE-SCOPED PERMISSION FUNCTIONS
 * These functions check permissions with venue context
 */

/**
 * Check if current user has permission at a specific venue (non-redirecting)
 * @param resource - The resource to check
 * @param action - The action to check
 * @param venueId - The venue ID for scoped check
 * @returns true if user has permission at that venue, false otherwise
 */
export async function canAccessVenue(
  resource: PermissionResource,
  action: PermissionAction,
  venueId: string
): Promise<boolean> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return false;
    }

    return await hasVenuePermission(user.id, resource, action, venueId);
  } catch (error) {
    console.error("Error checking venue access:", error);
    return false;
  }
}

/**
 * Require specific permission at a venue - redirect if user doesn't have it
 * @param resource - The resource to check
 * @param action - The action to check
 * @param venueId - The venue ID for scoped check
 * @returns The authenticated user
 */
export async function requireVenuePermission(
  resource: PermissionResource,
  action: PermissionAction,
  venueId: string
) {
  const user = await requireAuth();

  const hasAccess = await hasVenuePermission(user.id, resource, action, venueId);

  if (!hasAccess) {
    redirect("/dashboard?error=forbidden");
  }

  return user;
}

/**
 * Get all effective permissions for current user at a venue
 * Useful for UI rendering (showing/hiding features based on permissions)
 * @param venueId - Optional venue ID for venue-specific permissions
 * @returns Array of permissions
 */
export async function getCurrentUserEffectivePermissions(
  venueId?: string
): Promise<Permission[]> {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return [];
    }

    return await getUserEffectivePermissions(user.id, venueId);
  } catch (error) {
    console.error("Error getting current user effective permissions:", error);
    return [];
  }
}
