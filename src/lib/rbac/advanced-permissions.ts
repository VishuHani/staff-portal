import { prisma } from "@/lib/prisma";
import { PermissionResource, PermissionAction, isAdmin } from "./permissions";

/**
 * ADVANCED PERMISSION ENGINE
 *
 * This module provides enterprise-grade permission checks for:
 * - Field-level access control (read/write/none per resource field)
 * - Conditional permissions (business rule-based access)
 * - Time-based access restrictions (temporal permissions)
 *
 * These checks are layered on top of the base RBAC system.
 */

// ============================================================================
// FIELD-LEVEL PERMISSIONS
// ============================================================================

export type FieldAccessLevel = "read" | "write" | "none";

/**
 * Check if a user can access a specific field on a resource
 *
 * @param userId - The user's ID
 * @param resource - The resource (e.g., "User", "Post", "TimeOffRequest")
 * @param field - The field name (e.g., "email", "phone", "salary")
 * @param accessType - Type of access needed ("read" or "write")
 * @returns true if user can access the field, false otherwise
 */
export async function canAccessField(
  userId: string,
  resource: string,
  field: string,
  accessType: "read" | "write"
): Promise<boolean> {
  try {
    // Admin bypass
    if (await isAdmin(userId)) {
      return true;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            fieldPermissions: {
              where: {
                resource,
                field,
              },
            },
          },
        },
      },
    });

    if (!user || !user.active) {
      return false;
    }

    // If no field permission is defined, default to ALLOW
    // (field permissions are opt-in restrictions, not opt-out)
    if (user.role.fieldPermissions.length === 0) {
      return true;
    }

    // Check field permission
    const fieldPerm = user.role.fieldPermissions[0];

    if (fieldPerm.access === "none") {
      return false;
    }

    if (fieldPerm.access === "read" && accessType === "write") {
      return false; // Read-only field, cannot write
    }

    return true; // "read" or "write" access granted
  } catch (error) {
    console.error("Error checking field access:", error);
    return false;
  }
}

/**
 * Get all field permissions for a user on a specific resource
 * Useful for filtering data before sending to frontend
 *
 * @param userId - The user's ID
 * @param resource - The resource to check
 * @returns Map of field names to access levels
 */
export async function getUserFieldPermissions(
  userId: string,
  resource: string
): Promise<Map<string, FieldAccessLevel>> {
  try {
    // Admin has full access
    if (await isAdmin(userId)) {
      return new Map(); // Empty map = no restrictions
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            fieldPermissions: {
              where: { resource },
            },
          },
        },
      },
    });

    if (!user) {
      return new Map();
    }

    const fieldMap = new Map<string, FieldAccessLevel>();

    user.role.fieldPermissions.forEach((fp) => {
      fieldMap.set(fp.field, fp.access as FieldAccessLevel);
    });

    return fieldMap;
  } catch (error) {
    console.error("Error getting field permissions:", error);
    return new Map();
  }
}

/**
 * Filter an object's fields based on user's field permissions
 * Returns a new object with only allowed fields
 *
 * @param userId - The user's ID
 * @param resource - The resource type
 * @param data - The data object to filter
 * @param accessType - Type of access ("read" or "write")
 * @returns Filtered object with only accessible fields
 */
export async function filterFieldsByPermission<T extends Record<string, any>>(
  userId: string,
  resource: string,
  data: T,
  accessType: "read" | "write"
): Promise<Partial<T>> {
  const fieldPerms = await getUserFieldPermissions(userId, resource);

  // If no restrictions (admin or no field permissions), return all data
  if (fieldPerms.size === 0) {
    return data;
  }

  const filtered: Partial<T> = {};

  for (const [key, value] of Object.entries(data)) {
    const access = fieldPerms.get(key);

    // If no explicit permission, allow access (opt-in restriction model)
    if (!access) {
      filtered[key as keyof T] = value;
      continue;
    }

    // Check access level
    if (access === "none") {
      continue; // Skip this field
    }

    if (access === "read" && accessType === "write") {
      continue; // Read-only field, skip for write operations
    }

    filtered[key as keyof T] = value;
  }

  return filtered;
}

// ============================================================================
// CONDITIONAL PERMISSIONS
// ============================================================================

export interface PermissionCondition {
  field: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not_in" | "contains";
  value: any;
}

/**
 * Evaluate a conditional permission against data
 *
 * @param condition - The condition to evaluate
 * @param data - The data object to check against
 * @returns true if condition is met, false otherwise
 */
function evaluateCondition(
  condition: PermissionCondition,
  data: Record<string, any>
): boolean {
  const fieldValue = data[condition.field];
  const { operator, value } = condition;

  switch (operator) {
    case "=":
      return fieldValue === value;
    case "!=":
      return fieldValue !== value;
    case ">":
      return fieldValue > value;
    case "<":
      return fieldValue < value;
    case ">=":
      return fieldValue >= value;
    case "<=":
      return fieldValue <= value;
    case "in":
      return Array.isArray(value) && value.includes(fieldValue);
    case "not_in":
      return Array.isArray(value) && !value.includes(fieldValue);
    case "contains":
      return String(fieldValue).includes(String(value));
    default:
      return false;
  }
}

/**
 * Check if user has conditional permission for a specific action
 *
 * @param userId - The user's ID
 * @param resource - The resource type
 * @param action - The action being performed
 * @param data - The data object to check conditions against
 * @returns true if user has permission (or no conditions apply), false otherwise
 */
export async function hasConditionalPermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
  data: Record<string, any>
): Promise<boolean> {
  try {
    // Admin bypass
    if (await isAdmin(userId)) {
      return true;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            conditionalPermissions: {
              where: {
                resource,
                action,
              },
            },
          },
        },
      },
    });

    if (!user || !user.active) {
      return false;
    }

    // If no conditional permissions defined, allow by default
    // (conditional permissions are additional restrictions, not requirements)
    if (user.role.conditionalPermissions.length === 0) {
      return true;
    }

    // Evaluate all conditions - ALL must pass
    for (const condPerm of user.role.conditionalPermissions) {
      const condition = condPerm.conditions as PermissionCondition;

      if (!evaluateCondition(condition, data)) {
        return false; // Condition failed
      }
    }

    return true; // All conditions passed
  } catch (error) {
    console.error("Error checking conditional permission:", error);
    return false;
  }
}

// ============================================================================
// TIME-BASED ACCESS
// ============================================================================

/**
 * Check if user has time-based access for a specific action at the current time
 *
 * @param userId - The user's ID
 * @param resource - The resource type
 * @param action - The action being performed
 * @param timezone - Optional timezone to check against (defaults to UTC)
 * @returns true if user has access at current time, false otherwise
 */
export async function hasTimeBasedAccess(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
  timezone: string = "UTC"
): Promise<boolean> {
  try {
    // Admin bypass
    if (await isAdmin(userId)) {
      return true;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            timeBasedAccess: {
              where: {
                resource,
                action,
              },
            },
          },
        },
      },
    });

    if (!user || !user.active) {
      return false;
    }

    // If no time-based restrictions, allow by default
    if (user.role.timeBasedAccess.length === 0) {
      return true;
    }

    // Get current time in the specified timezone
    const now = new Date();
    const currentDay = now.getUTCDay() === 0 ? 7 : now.getUTCDay(); // Convert Sunday from 0 to 7
    const currentTime = now.toISOString().substring(11, 16); // HH:MM format

    // Check all time-based restrictions - ANY match grants access
    for (const timeAccess of user.role.timeBasedAccess) {
      // Check if current day is allowed
      if (!timeAccess.daysOfWeek.includes(currentDay)) {
        continue;
      }

      // Check if current time is within allowed range
      if (currentTime >= timeAccess.startTime && currentTime <= timeAccess.endTime) {
        return true; // Found a matching time window
      }
    }

    return false; // No matching time window found
  } catch (error) {
    console.error("Error checking time-based access:", error);
    return false;
  }
}

/**
 * Get user's allowed time windows for a specific action
 * Useful for showing users when they can perform an action
 *
 * @param userId - The user's ID
 * @param resource - The resource type
 * @param action - The action
 * @returns Array of time windows with days and time ranges
 */
export async function getUserTimeWindows(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction
): Promise<
  Array<{
    daysOfWeek: number[];
    startTime: string;
    endTime: string;
    timezone: string;
  }>
> {
  try {
    // Admin has no restrictions
    if (await isAdmin(userId)) {
      return [];
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        role: {
          include: {
            timeBasedAccess: {
              where: {
                resource,
                action,
              },
            },
          },
        },
      },
    });

    if (!user) {
      return [];
    }

    return user.role.timeBasedAccess.map((ta) => ({
      daysOfWeek: ta.daysOfWeek,
      startTime: ta.startTime,
      endTime: ta.endTime,
      timezone: ta.timezone,
    }));
  } catch (error) {
    console.error("Error getting time windows:", error);
    return [];
  }
}

// ============================================================================
// COMBINED ADVANCED PERMISSION CHECK
// ============================================================================

/**
 * Comprehensive permission check that evaluates:
 * 1. Base RBAC permission (from permissions.ts)
 * 2. Conditional permissions (if data provided)
 * 3. Time-based access restrictions
 *
 * This is the main entry point for advanced permission checks.
 *
 * @param userId - The user's ID
 * @param resource - The resource type
 * @param action - The action being performed
 * @param options - Optional conditions and data
 * @returns true if all permission checks pass, false otherwise
 */
export async function hasAdvancedPermission(
  userId: string,
  resource: PermissionResource,
  action: PermissionAction,
  options?: {
    data?: Record<string, any>;
    checkTime?: boolean;
    timezone?: string;
  }
): Promise<boolean> {
  try {
    // Note: Base RBAC check should be done by caller using hasPermission()
    // This function only handles ADVANCED permissions (conditional & time-based)

    // Check conditional permissions if data provided
    if (options?.data) {
      const conditionalOk = await hasConditionalPermission(
        userId,
        resource,
        action,
        options.data
      );

      if (!conditionalOk) {
        return false;
      }
    }

    // Check time-based access if requested
    if (options?.checkTime) {
      const timeOk = await hasTimeBasedAccess(
        userId,
        resource,
        action,
        options.timezone
      );

      if (!timeOk) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Error in advanced permission check:", error);
    return false;
  }
}
