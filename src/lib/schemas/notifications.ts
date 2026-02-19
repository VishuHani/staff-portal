import { z } from "zod";
import { NotificationType } from "@prisma/client";

/**
 * Notification Validation Schemas
 * Type-safe validation for all notification operations
 */

// Notification type enum validation
export const notificationTypeSchema = z.enum([
  "NEW_MESSAGE",
  "MESSAGE_REPLY",
  "MESSAGE_MENTION",
  "MESSAGE_REACTION",
  "POST_MENTION",
  "POST_PINNED",
  "POST_DELETED",
  "TIME_OFF_REQUEST",
  "TIME_OFF_APPROVED",
  "TIME_OFF_REJECTED",
  "TIME_OFF_CANCELLED",
  "USER_CREATED",
  "USER_UPDATED",
  "ROLE_CHANGED",
  "SYSTEM_ANNOUNCEMENT",
  "GROUP_REMOVED",
  "ROSTER_PUBLISHED",
  "ROSTER_UPDATED",
  "ROSTER_SHIFT_REMINDER",
  "ROSTER_CONFLICT",
  "ROSTER_PENDING_REVIEW",
  "PERMISSION_GRANTED",
  "PERMISSION_REVOKED",
]);

// Schema for creating a notification
export const createNotificationSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  type: notificationTypeSchema,
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  message: z.string().max(500, "Message too long").optional().nullable(),
  actionUrl: z.string().max(500, "URL too long").optional().nullable(),
  actionLabel: z.string().max(50, "Label too long").optional().nullable(),
  senderId: z.string().optional().nullable(),
  relatedId: z.string().optional().nullable(),
});

// Schema for bulk notification creation
export const createBulkNotificationsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, "At least one user ID required"),
  type: notificationTypeSchema,
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  message: z.string().max(500, "Message too long").optional().nullable(),
  actionUrl: z.string().max(500, "URL too long").optional().nullable(),
  actionLabel: z.string().max(50, "Label too long").optional().nullable(),
  senderId: z.string().optional().nullable(),
  relatedId: z.string().optional().nullable(),
});

// Schema for filtering notifications
export const getNotificationsSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  unreadOnly: z.boolean().optional().default(false),
  type: notificationTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  cursor: z.string().optional(),
});

// Schema for marking notification as read
export const markAsReadSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

// Schema for marking all as read
export const markAllAsReadSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// Schema for deleting a notification
export const deleteNotificationSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required"),
  userId: z.string().min(1, "User ID is required"),
});

// Schema for deleting all read notifications
export const deleteAllReadSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// Schema for getting unread count
export const getUnreadCountSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// Schema for broadcasting system announcement
export const broadcastAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  message: z.string().min(1, "Message is required").max(500, "Message too long"),
  actionUrl: z.string().max(500, "URL too long").optional(),
  actionLabel: z.string().max(50, "Label too long").optional(),
  targetRoles: z.array(z.string()).optional(), // If empty, broadcast to all users
});

// Type inference for TypeScript
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type CreateBulkNotificationsInput = z.infer<typeof createBulkNotificationsSchema>;
export type GetNotificationsInput = z.infer<typeof getNotificationsSchema>;
export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;
export type MarkAllAsReadInput = z.infer<typeof markAllAsReadSchema>;
export type DeleteNotificationInput = z.infer<typeof deleteNotificationSchema>;
export type DeleteAllReadInput = z.infer<typeof deleteAllReadSchema>;
export type GetUnreadCountInput = z.infer<typeof getUnreadCountSchema>;
export type BroadcastAnnouncementInput = z.infer<typeof broadcastAnnouncementSchema>;
