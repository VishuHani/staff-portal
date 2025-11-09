import { z } from "zod";

/**
 * Schema for creating a new role
 */
export const createRoleSchema = z.object({
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must not exceed 50 characters")
    .regex(/^[A-Z_]+$/, "Role name must be uppercase letters and underscores only"),
  description: z
    .string()
    .max(200, "Description must not exceed 200 characters")
    .optional(),
});

/**
 * Schema for updating a role
 */
export const updateRoleSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  name: z
    .string()
    .min(2, "Role name must be at least 2 characters")
    .max(50, "Role name must not exceed 50 characters")
    .regex(/^[A-Z_]+$/, "Role name must be uppercase letters and underscores only")
    .optional(),
  description: z
    .string()
    .max(200, "Description must not exceed 200 characters")
    .optional(),
});

/**
 * Schema for deleting a role
 */
export const deleteRoleSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
});

/**
 * Schema for assigning permissions to a role
 */
export const assignPermissionsSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  permissionIds: z.array(z.string()).min(1, "At least one permission is required"),
});

/**
 * Schema for removing permissions from a role
 */
export const removePermissionsSchema = z.object({
  roleId: z.string().min(1, "Role ID is required"),
  permissionIds: z.array(z.string()).min(1, "At least one permission is required"),
});

/**
 * TypeScript types inferred from schemas
 */
export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type DeleteRoleInput = z.infer<typeof deleteRoleSchema>;
export type AssignPermissionsInput = z.infer<typeof assignPermissionsSchema>;
export type RemovePermissionsInput = z.infer<typeof removePermissionsSchema>;
