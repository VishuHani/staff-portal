/**
 * ============================================================================
 * FIELD-LEVEL PERMISSION SYSTEM
 * ============================================================================
 *
 * This module provides granular control over which data fields a user can
 * access based on their role and the action being performed.
 *
 * Features:
 * - Define which fields are visible/editable per resource
 * - Protect sensitive data (pay rates, SSN, etc.)
 * - Scope-based field access (own, team, all)
 * - Custom field-level validation
 *
 * Usage:
 *   const fields = await getAccessibleFields(userId, 'users', 'view');
 *   // Returns: ['firstName', 'lastName', 'email', ...]
 */

import { prisma } from "@/lib/prisma";
import { isAdmin } from "./permissions";

/**
 * Field access levels
 */
export type FieldAccessLevel = "none" | "read" | "write";

/**
 * Field permission context
 */
export interface FieldPermissionContext {
  userId: string;
  resource: string;
  action: "view" | "edit" | "create";
  targetUserId?: string; // For checking if viewing own record
  venueId?: string;
}

/**
 * Sensitive fields that require special permission
 */
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  users: [
    "weekdayRate",
    "saturdayRate",
    "sundayRate",
    "dateOfBirth",
    "phone",
    "bio",
    "password",
  ],
  rosters: [
    "shifts.payRate",
    "shifts.breakMinutes",
  ],
  timeoff: [
    "reason",
    "notes",
  ],
};

/**
 * Default field permissions by resource and role
 * These define what fields each role can see/edit by default
 */
export const DEFAULT_FIELD_PERMISSIONS: Record<string, Record<string, Record<string, FieldAccessLevel>>> = {
  users: {
    STAFF: {
      // Staff can only view/edit their own basic fields
      firstName: "write",
      lastName: "write",
      email: "read",
      phone: "write",
      bio: "write",
      profileImage: "write",
      // Cannot see pay rates, DOB, etc.
    },
    MANAGER: {
      // Managers can view team members' info
      firstName: "write",
      lastName: "write",
      email: "read",
      phone: "write",
      bio: "read",
      profileImage: "write",
      venueId: "write",
      active: "write",
      // Cannot see pay rates without explicit permission
    },
    ADMIN: {
      // Admins can access all fields
      firstName: "write",
      lastName: "write",
      email: "write",
      phone: "write",
      bio: "write",
      profileImage: "write",
      venueId: "write",
      roleId: "write",
      active: "write",
      weekdayRate: "write",
      saturdayRate: "write",
      sundayRate: "write",
      dateOfBirth: "write",
    },
  },
  rosters: {
    STAFF: {
      // Staff can only view basic roster info
      name: "read",
      startDate: "read",
      endDate: "read",
      status: "read",
    },
    MANAGER: {
      // Managers can edit rosters
      name: "write",
      description: "write",
      startDate: "write",
      endDate: "write",
      status: "write",
      venueId: "write",
    },
    ADMIN: {
      // Admins have full access
      name: "write",
      description: "write",
      startDate: "write",
      endDate: "write",
      status: "write",
      venueId: "write",
      sourceFileUrl: "write",
    },
  },
  timeoff: {
    STAFF: {
      // Staff can create/view own requests
      startDate: "write",
      endDate: "write",
      type: "write",
      reason: "write",
      status: "read",
    },
    MANAGER: {
      // Managers can approve/reject
      startDate: "read",
      endDate: "read",
      type: "read",
      reason: "read",
      status: "write",
      notes: "write",
      reviewedBy: "write",
    },
    ADMIN: {
      // Admins have full access
      startDate: "write",
      endDate: "write",
      type: "write",
      reason: "write",
      status: "write",
      notes: "write",
      reviewedBy: "write",
    },
  },
};

/**
 * Get accessible fields for a user on a resource
 *
 * @param context - Field permission context
 * @returns Object with accessible fields and their access levels
 */
export async function getAccessibleFields(
  context: FieldPermissionContext
): Promise<{ fields: string[]; accessLevels: Record<string, FieldAccessLevel> }> {
  const { userId, resource, action, targetUserId } = context;

  try {
    // Admin has access to all fields
    if (await isAdmin(userId)) {
      const allFields = getAllResourceFields(resource);
      const accessLevels: Record<string, FieldAccessLevel> = {};
      allFields.forEach((field) => {
        accessLevels[field] = action === "view" ? "read" : "write";
      });
      return { fields: allFields, accessLevels };
    }

    // Get user's role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user || !user.active) {
      return { fields: [], accessLevels: {} };
    }

    const roleName = user.role.name;
    const isOwnRecord = targetUserId === userId;

    // Get default permissions for role
    const rolePermissions = DEFAULT_FIELD_PERMISSIONS[resource]?.[roleName] || {};

    // Check for field-level overrides in database
    const fieldOverrides = await prisma.fieldPermission.findMany({
      where: {
        roleId: user.roleId,
        resource,
      },
    });

    // Merge default permissions with overrides
    const accessLevels: Record<string, FieldAccessLevel> = { ...rolePermissions };

    for (const override of fieldOverrides) {
      accessLevels[override.field] = override.access as FieldAccessLevel;
    }

    // If viewing own record, allow additional fields
    if (isOwnRecord && action === "view") {
      const ownFields = getOwnRecordFields(resource);
      for (const field of ownFields) {
        if (!accessLevels[field]) {
          accessLevels[field] = "read";
        }
      }
    }

    // Filter fields based on action
    const fields = Object.entries(accessLevels)
      .filter(([_, level]) => {
        if (action === "view") {
          return level === "read" || level === "write";
        }
        return level === "write";
      })
      .map(([field]) => field);

    return { fields, accessLevels };
  } catch (error) {
    console.error("Error getting accessible fields:", error);
    return { fields: [], accessLevels: {} };
  }
}

/**
 * Check if user can access a specific field
 *
 * @param context - Field permission context
 * @param field - Field name to check
 * @returns true if user can access the field
 */
export async function canAccessField(
  context: FieldPermissionContext,
  field: string
): Promise<boolean> {
  const { fields } = await getAccessibleFields(context);
  return fields.includes(field);
}

/**
 * Filter an object to only include accessible fields
 *
 * @param context - Field permission context
 * @param data - Data object to filter
 * @returns Filtered object with only accessible fields
 */
export async function filterAccessibleFields<T extends Record<string, unknown>>(
  context: FieldPermissionContext,
  data: T
): Promise<Partial<T>> {
  const { fields } = await getAccessibleFields(context);
  const filtered: Partial<T> = {};

  for (const field of fields) {
    if (field in data) {
      filtered[field as keyof T] = data[field as keyof T];
    }
  }

  return filtered;
}

/**
 * Check if a field is sensitive
 *
 * @param resource - Resource name
 * @param field - Field name
 * @returns true if field is sensitive
 */
export function isSensitiveField(resource: string, field: string): boolean {
  return SENSITIVE_FIELDS[resource]?.includes(field) || false;
}

/**
 * Get all fields for a resource (for admin use)
 *
 * @param resource - Resource name
 * @returns Array of all field names
 */
function getAllResourceFields(resource: string): string[] {
  const allPermissions = DEFAULT_FIELD_PERMISSIONS[resource] || {};
  const fieldSet = new Set<string>();

  for (const rolePerms of Object.values(allPermissions)) {
    for (const field of Object.keys(rolePerms)) {
      fieldSet.add(field);
    }
  }

  return Array.from(fieldSet);
}

/**
 * Get fields that users can always see on their own records
 *
 * @param resource - Resource name
 * @returns Array of field names
 */
function getOwnRecordFields(resource: string): string[] {
  const ownFields: Record<string, string[]> = {
    users: ["firstName", "lastName", "email", "phone", "bio", "profileImage", "dateOfBirth"],
    timeoff: ["startDate", "endDate", "type", "reason", "status", "notes"],
    rosters: ["name", "startDate", "endDate", "status"],
  };

  return ownFields[resource] || [];
}

/**
 * Validate that data only contains accessible fields
 * Throws an error if inaccessible fields are present
 *
 * @param context - Field permission context
 * @param data - Data to validate
 * @throws Error if inaccessible fields are present
 */
export async function validateFieldAccess<T extends Record<string, unknown>>(
  context: FieldPermissionContext,
  data: T
): Promise<void> {
  const { fields } = await getAccessibleFields(context);
  const inaccessibleFields = Object.keys(data).filter(
    (key) => !fields.includes(key)
  );

  if (inaccessibleFields.length > 0) {
    throw new Error(
      `Access denied to fields: ${inaccessibleFields.join(", ")}`
    );
  }
}

/**
 * Get field permission summary for a user
 * Useful for displaying what fields a user can access
 *
 * @param userId - User ID
 * @param resource - Resource name
 * @returns Summary of field permissions
 */
export async function getFieldPermissionSummary(
  userId: string,
  resource: string
): Promise<{
  viewable: string[];
  editable: string[];
  sensitive: string[];
}> {
  const viewContext: FieldPermissionContext = {
    userId,
    resource,
    action: "view",
  };
  const editContext: FieldPermissionContext = {
    userId,
    resource,
    action: "edit",
  };

  const { fields: viewable } = await getAccessibleFields(viewContext);
  const { fields: editable } = await getAccessibleFields(editContext);
  const sensitive = SENSITIVE_FIELDS[resource] || [];

  return {
    viewable,
    editable,
    sensitive: sensitive.filter((s) => viewable.includes(s)),
  };
}
