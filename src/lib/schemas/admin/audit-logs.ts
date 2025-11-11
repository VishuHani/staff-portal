import { z } from "zod";

/**
 * Schema for filtering audit logs
 */
export const auditLogFilterSchema = z.object({
  userId: z.string().optional(),
  actionType: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  startDate: z.string().optional(), // ISO date string
  endDate: z.string().optional(),   // ISO date string
  limit: z.number().min(1).max(500).default(50),
  offset: z.number().min(0).default(0),
});

export type AuditLogFilterInput = z.input<typeof auditLogFilterSchema>;

/**
 * Supported action types (standardize across application)
 */
export const ACTION_TYPES = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "VIEW",
  "EXPORT",
  "IMPORT",
  "APPROVE",
  "REJECT",
  "ACTIVATE",
  "DEACTIVATE",
] as const;

/**
 * Supported resource types (match PermissionResource)
 */
export const RESOURCE_TYPES = [
  "users",
  "roles",
  "stores",
  "availability",
  "timeoff",
  "posts",
  "messages",
  "channels",
  "permissions",
] as const;
