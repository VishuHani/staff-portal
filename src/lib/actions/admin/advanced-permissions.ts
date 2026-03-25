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
import { z } from "zod";

// ============================================================================
// FIELD PERMISSION SCHEMAS
// ============================================================================

const fieldPermissionSchema = z.object({
  roleId: z.string().cuid(),
  resource: z.string().min(1),
  field: z.string().min(1),
  access: z.enum(["read", "write", "none"]),
});

const deleteFieldPermissionSchema = z.object({
  id: z.string().cuid(),
});

export type FieldPermissionInput = z.infer<typeof fieldPermissionSchema>;
export type DeleteFieldPermissionInput = z.infer<
  typeof deleteFieldPermissionSchema
>;

// ============================================================================
// CONDITIONAL PERMISSION SCHEMAS
// ============================================================================

const conditionalPermissionSchema = z.object({
  roleId: z.string().cuid(),
  resource: z.string().min(1),
  action: z.string().min(1),
  conditions: z.object({
    field: z.string().min(1),
    operator: z.enum([
      "=",
      "!=",
      ">",
      "<",
      ">=",
      "<=",
      "in",
      "not_in",
      "contains",
    ]),
    value: z.any(),
  }),
});

const deleteConditionalPermissionSchema = z.object({
  id: z.string().cuid(),
});

export type ConditionalPermissionInput = z.infer<
  typeof conditionalPermissionSchema
>;
export type DeleteConditionalPermissionInput = z.infer<
  typeof deleteConditionalPermissionSchema
>;

// ============================================================================
// TIME-BASED ACCESS SCHEMAS
// ============================================================================

const timeBasedAccessSchema = z.object({
  roleId: z.string().cuid(),
  resource: z.string().min(1),
  action: z.string().min(1),
  daysOfWeek: z.array(z.number().int().min(1).max(7)),
  startTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/), // HH:MM format
  endTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  timezone: z.string().default("UTC"),
});

const deleteTimeBasedAccessSchema = z.object({
  id: z.string().cuid(),
});

export type TimeBasedAccessInput = z.infer<typeof timeBasedAccessSchema>;
export type DeleteTimeBasedAccessInput = z.infer<
  typeof deleteTimeBasedAccessSchema
>;

async function requireAdvancedPermissionAccess() {
  return requireAnyPermission(SYSTEM_PERMISSIONS.permissionsManage);
}

// ============================================================================
// FIELD PERMISSION ACTIONS
// ============================================================================

/**
 * Get all field permissions for a role
 */
export async function getFieldPermissions(roleId: string) {
  await requireAdvancedPermissionAccess();

  try {
    const permissions = await prisma.fieldPermission.findMany({
      where: { roleId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ resource: "asc" }, { field: "asc" }],
    });

    return actionSuccess({ permissions });
  } catch (error) {
    logActionError("Error fetching field permissions", error, { roleId });
    return actionFailure("Failed to fetch field permissions");
  }
}

/**
 * Create a field permission
 */
export async function createFieldPermission(data: FieldPermissionInput) {
  await requireAdvancedPermissionAccess();

  const validatedFields = fieldPermissionSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { roleId, resource, field, access } = validatedFields.data;

  try {
    // Check if permission already exists
    const existing = await prisma.fieldPermission.findUnique({
      where: {
        roleId_resource_field: {
          roleId,
          resource,
          field,
        },
      },
    });

    if (existing) {
      return actionFailure("Field permission already exists for this role");
    }

    const permission = await prisma.fieldPermission.create({
      data: {
        roleId,
        resource,
        field,
        access,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePaths(["/admin/permissions"]);

    return actionSuccess({ permission });
  } catch (error) {
    logActionError("Error creating field permission", error, {
      roleId,
      resource,
      field,
    });
    return actionFailure("Failed to create field permission");
  }
}

/**
 * Delete a field permission
 */
export async function deleteFieldPermission(data: DeleteFieldPermissionInput) {
  await requireAdvancedPermissionAccess();

  const validatedFields = deleteFieldPermissionSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { id } = validatedFields.data;

  try {
    await prisma.fieldPermission.delete({
      where: { id },
    });

    revalidatePaths(["/admin/permissions"]);

    return actionSuccess({});
  } catch (error) {
    logActionError("Error deleting field permission", error, { id });
    return actionFailure("Failed to delete field permission");
  }
}

// ============================================================================
// CONDITIONAL PERMISSION ACTIONS
// ============================================================================

/**
 * Get all conditional permissions for a role
 */
export async function getConditionalPermissions(roleId: string) {
  await requireAdvancedPermissionAccess();

  try {
    const permissions = await prisma.conditionalPermission.findMany({
      where: { roleId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    return actionSuccess({ permissions });
  } catch (error) {
    logActionError("Error fetching conditional permissions", error, { roleId });
    return actionFailure("Failed to fetch conditional permissions");
  }
}

/**
 * Create a conditional permission
 */
export async function createConditionalPermission(
  data: ConditionalPermissionInput
) {
  await requireAdvancedPermissionAccess();

  const validatedFields = conditionalPermissionSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { roleId, resource, action, conditions } = validatedFields.data;

  try {
    const permission = await prisma.conditionalPermission.create({
      data: {
        roleId,
        resource,
        action,
        conditions,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePaths(["/admin/permissions"]);

    return actionSuccess({ permission });
  } catch (error) {
    logActionError("Error creating conditional permission", error, {
      roleId,
      resource,
      action,
    });
    return actionFailure("Failed to create conditional permission");
  }
}

/**
 * Delete a conditional permission
 */
export async function deleteConditionalPermission(
  data: DeleteConditionalPermissionInput
) {
  await requireAdvancedPermissionAccess();

  const validatedFields = deleteConditionalPermissionSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { id } = validatedFields.data;

  try {
    await prisma.conditionalPermission.delete({
      where: { id },
    });

    revalidatePaths(["/admin/permissions"]);

    return actionSuccess({});
  } catch (error) {
    logActionError("Error deleting conditional permission", error, { id });
    return actionFailure("Failed to delete conditional permission");
  }
}

// ============================================================================
// TIME-BASED ACCESS ACTIONS
// ============================================================================

/**
 * Get all time-based access rules for a role
 */
export async function getTimeBasedAccess(roleId: string) {
  await requireAdvancedPermissionAccess();

  try {
    const rules = await prisma.timeBasedAccess.findMany({
      where: { roleId },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [{ resource: "asc" }, { action: "asc" }],
    });

    return actionSuccess({ rules });
  } catch (error) {
    logActionError("Error fetching time-based access", error, { roleId });
    return actionFailure("Failed to fetch time-based access");
  }
}

/**
 * Create a time-based access rule
 */
export async function createTimeBasedAccess(data: TimeBasedAccessInput) {
  await requireAdvancedPermissionAccess();

  const validatedFields = timeBasedAccessSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { roleId, resource, action, daysOfWeek, startTime, endTime, timezone } =
    validatedFields.data;

  try {
    const rule = await prisma.timeBasedAccess.create({
      data: {
        roleId,
        resource,
        action,
        daysOfWeek,
        startTime,
        endTime,
        timezone,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    revalidatePaths(["/admin/permissions"]);

    return actionSuccess({ rule });
  } catch (error) {
    logActionError("Error creating time-based access", error, {
      roleId,
      resource,
      action,
    });
    return actionFailure("Failed to create time-based access");
  }
}

/**
 * Delete a time-based access rule
 */
export async function deleteTimeBasedAccess(data: DeleteTimeBasedAccessInput) {
  await requireAdvancedPermissionAccess();

  const validatedFields = deleteTimeBasedAccessSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { id } = validatedFields.data;

  try {
    await prisma.timeBasedAccess.delete({
      where: { id },
    });

    revalidatePaths(["/admin/permissions"]);

    return actionSuccess({});
  } catch (error) {
    logActionError("Error deleting time-based access", error, { id });
    return actionFailure("Failed to delete time-based access");
  }
}

// ============================================================================
// GET ALL ADVANCED PERMISSIONS FOR A ROLE
// ============================================================================

/**
 * Get all advanced permissions for a role (field, conditional, time-based)
 */
export async function getAllAdvancedPermissions(
  roleId: string
): Promise<
  ActionResult<{
    fieldPermissions: Awaited<ReturnType<typeof prisma.fieldPermission.findMany>>;
    conditionalPermissions: Awaited<ReturnType<typeof prisma.conditionalPermission.findMany>>;
    timeBasedAccess: Awaited<ReturnType<typeof prisma.timeBasedAccess.findMany>>;
  }>
> {
  await requireAdvancedPermissionAccess();

  try {
    const [fieldPerms, conditionalPerms, timeBasedRules] = await Promise.all([
      prisma.fieldPermission.findMany({
        where: { roleId },
        orderBy: [{ resource: "asc" }, { field: "asc" }],
      }),
      prisma.conditionalPermission.findMany({
        where: { roleId },
        orderBy: [{ resource: "asc" }, { action: "asc" }],
      }),
      prisma.timeBasedAccess.findMany({
        where: { roleId },
        orderBy: [{ resource: "asc" }, { action: "asc" }],
      }),
    ]);

    return actionSuccess({
      fieldPermissions: fieldPerms,
      conditionalPermissions: conditionalPerms,
      timeBasedAccess: timeBasedRules,
    });
  } catch (error) {
    logActionError("Error fetching advanced permissions", error, { roleId });
    return actionFailure("Failed to fetch advanced permissions");
  }
}
