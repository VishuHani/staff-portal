import { z } from "zod";

/**
 * Schema Definitions for Channel Member Management
 */

// Channel member role enum
export const channelMemberRoleSchema = z.enum([
  "CREATOR",
  "MODERATOR",
  "MEMBER",
]);

// How member was added
export const addedViaSchema = z.enum([
  "manual",
  "role_based",
  "venue_based",
  "bulk_import",
]);

// Add members to channel
export const addChannelMembersSchema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
  userIds: z.array(z.string()).min(1, "At least one user is required"),
  role: channelMemberRoleSchema.default("MEMBER"),
  addedVia: addedViaSchema.default("manual"),
});

// Remove members from channel
export const removeChannelMembersSchema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
  userIds: z.array(z.string()).min(1, "At least one user is required"),
});

// Update member role
export const updateMemberRoleSchema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
  userId: z.string().min(1, "User ID is required"),
  role: channelMemberRoleSchema,
});

// Get channel members filters
export const getChannelMembersSchema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
  role: channelMemberRoleSchema.optional(),
  search: z.string().optional(),
  limit: z.number().optional(),
  offset: z.number().optional(),
});

// User selection for channel creation
export const getUsersForChannelSchema = z.object({
  // Selection type
  selectionType: z.enum(["all", "by_role", "by_venue", "by_user"]),

  // Role-based selection
  roleIds: z.array(z.string()).optional(),

  // Venue-based selection
  venueIds: z.array(z.string()).optional(),

  // Individual user selection
  userIds: z.array(z.string()).optional(),

  // Filters
  excludeUserIds: z.array(z.string()).optional(),
  activeOnly: z.boolean().default(true),
  search: z.string().optional(),
});

// Bulk add members
export const bulkAddMembersSchema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
  selectionCriteria: getUsersForChannelSchema,
  role: channelMemberRoleSchema.default("MEMBER"),
});

// Channel member analytics
export const getChannelAnalyticsSchema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
});

// Get channels user can manage
export const getManageableChannelsSchema = z.object({
  includeArchived: z.boolean().default(false),
  venueId: z.string().optional(), // For managers: filter by venue
});

/**
 * TypeScript types derived from schemas
 */
export type ChannelMemberRole = z.infer<typeof channelMemberRoleSchema>;
export type AddedVia = z.infer<typeof addedViaSchema>;
export type AddChannelMembersInput = z.infer<typeof addChannelMembersSchema>;
export type RemoveChannelMembersInput = z.infer<
  typeof removeChannelMembersSchema
>;
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;
export type GetChannelMembersInput = z.infer<typeof getChannelMembersSchema>;
export type GetUsersForChannelInput = z.infer<typeof getUsersForChannelSchema>;
export type BulkAddMembersInput = z.infer<typeof bulkAddMembersSchema>;
export type GetChannelAnalyticsInput = z.infer<
  typeof getChannelAnalyticsSchema
>;
export type GetManageableChannelsInput = z.infer<
  typeof getManageableChannelsSchema
>;
