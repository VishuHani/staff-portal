import { z } from "zod";
import { NotificationType } from "@prisma/client";

/**
 * Schema for filtering notification history
 */
export const notificationHistoryFilterSchema = z.object({
  userId: z.string().optional(),
  type: z.nativeEnum(NotificationType).optional(),
  readStatus: z.enum(["all", "read", "unread"]).optional(),
  dateFrom: z.string().optional(), // ISO date string
  dateTo: z.string().optional(), // ISO date string
  search: z.string().optional(),
  limit: z.number().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

export type NotificationHistoryFilter = z.infer<
  typeof notificationHistoryFilterSchema
>;

/**
 * Schema for system announcement
 */
export const systemAnnouncementSchema = z.object({
  title: z
    .string()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title must be less than 100 characters"),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(500, "Message must be less than 500 characters"),
  link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  targetRoles: z
    .array(z.string())
    .min(1, "Select at least one role")
    .default(["all"]),
});

export type SystemAnnouncementInput = z.infer<
  typeof systemAnnouncementSchema
>;

/**
 * Schema for notification statistics date range
 */
export const notificationStatsFilterSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  type: z.nativeEnum(NotificationType).optional(),
});

export type NotificationStatsFilter = z.infer<
  typeof notificationStatsFilterSchema
>;
