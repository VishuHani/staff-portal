import { z } from "zod";

/**
 * Channel types
 */
export const CHANNEL_TYPES = [
  { value: "ALL_STAFF", label: "All Staff" },
  { value: "MANAGERS", label: "Managers Only" },
  { value: "CUSTOM", label: "Custom" },
] as const;

export const CHANNEL_TYPE_VALUES = CHANNEL_TYPES.map((t) => t.value);

/**
 * Default channel colors
 */
export const CHANNEL_COLORS = [
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // purple
  "#ec4899", // pink
  "#06b6d4", // cyan
] as const;

/**
 * Schema for creating a new channel
 */
export const createChannelSchema = z.object({
  name: z
    .string()
    .min(2, "Channel name must be at least 2 characters")
    .max(50, "Channel name must not exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Channel name can only contain letters, numbers, spaces, and hyphens"),
  description: z
    .string()
    .max(200, "Description must not exceed 200 characters")
    .optional(),
  type: z.enum(CHANNEL_TYPE_VALUES as [string, ...string[]]),
  icon: z
    .string()
    .max(10, "Icon must not exceed 10 characters")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
    .optional(),
  permissions: z.string().optional(), // JSON string of permissions
});

/**
 * Schema for updating a channel
 */
export const updateChannelSchema = z.object({
  id: z.string().cuid("Invalid channel ID"),
  name: z
    .string()
    .min(2, "Channel name must be at least 2 characters")
    .max(50, "Channel name must not exceed 50 characters")
    .regex(/^[a-zA-Z0-9\s-]+$/, "Channel name can only contain letters, numbers, spaces, and hyphens")
    .optional(),
  description: z
    .string()
    .max(200, "Description must not exceed 200 characters")
    .optional(),
  type: z.enum(CHANNEL_TYPE_VALUES as [string, ...string[]]).optional(),
  icon: z
    .string()
    .max(10, "Icon must not exceed 10 characters")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid hex color format")
    .optional(),
  permissions: z.string().optional(),
});

/**
 * Schema for archiving/unarchiving a channel
 */
export const archiveChannelSchema = z.object({
  id: z.string().cuid("Invalid channel ID"),
  archived: z.boolean(),
});

/**
 * Schema for deleting a channel
 */
export const deleteChannelSchema = z.object({
  id: z.string().cuid("Invalid channel ID"),
});

/**
 * Schema for filtering channels
 */
export const filterChannelsSchema = z.object({
  type: z.enum(CHANNEL_TYPE_VALUES as [string, ...string[]]).optional(),
  includeArchived: z.boolean().optional().default(false),
});

// Type exports
export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type ArchiveChannelInput = z.infer<typeof archiveChannelSchema>;
export type DeleteChannelInput = z.infer<typeof deleteChannelSchema>;
export type FilterChannelsInput = z.infer<typeof filterChannelsSchema>;
