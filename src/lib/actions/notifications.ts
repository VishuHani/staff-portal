"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import {
  getNotificationsSchema,
  markAsReadSchema,
  markAllAsReadSchema,
  deleteNotificationSchema,
  deleteAllReadSchema,
  getUnreadCountSchema,
  createNotificationSchema,
  createBulkNotificationsSchema,
  broadcastAnnouncementSchema,
  type GetNotificationsInput,
  type MarkAsReadInput,
  type MarkAllAsReadInput,
  type DeleteNotificationInput,
  type DeleteAllReadInput,
  type GetUnreadCountInput,
  type CreateNotificationInput,
  type CreateBulkNotificationsInput,
  type BroadcastAnnouncementInput,
} from "@/lib/schemas/notifications";
import { createNotification, createBulkNotifications } from "@/lib/services/notifications";

/**
 * Get paginated notifications for a user with optional filters
 */
export async function getAllNotifications(input: GetNotificationsInput) {
  try {
    const currentUser = await requireAuth();

    // Validate input
    const validated = getNotificationsSchema.parse(input);

    // Users can only view their own notifications
    if (currentUser.id !== validated.userId) {
      return { error: "You can only view your own notifications" };
    }

    // Build where clause
    const where: any = {
      userId: validated.userId,
    };

    if (validated.unreadOnly) {
      where.readAt = null;
    }

    if (validated.type) {
      where.type = validated.type;
    }

    // Cursor-based pagination
    if (validated.cursor) {
      where.id = { lt: validated.cursor };
    }

    // Fetch notifications
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: validated.limit,
    });

    // Get next cursor
    const nextCursor = notifications.length === validated.limit
      ? notifications[notifications.length - 1].id
      : null;

    return {
      notifications,
      nextCursor,
      hasMore: notifications.length === validated.limit,
    };
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return { error: "Failed to fetch notifications" };
  }
}

/**
 * Get unread notification count for badge display
 */
export async function getUnreadCount(input: GetUnreadCountInput) {
  try {
    const currentUser = await requireAuth();

    const validated = getUnreadCountSchema.parse(input);

    // Users can only view their own count
    if (currentUser.id !== validated.userId) {
      return { error: "You can only view your own notifications" };
    }

    const count = await prisma.notification.count({
      where: {
        userId: validated.userId,
        readAt: null,
      },
    });

    return { count };
  } catch (error) {
    console.error("Error getting unread count:", error);
    return { error: "Failed to get unread count" };
  }
}

/**
 * Mark a single notification as read
 */
export async function markAsRead(input: MarkAsReadInput) {
  try {
    const currentUser = await requireAuth();

    const validated = markAsReadSchema.parse(input);

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id: validated.notificationId },
      select: { userId: true },
    });

    if (!notification) {
      return { error: "Notification not found" };
    }

    if (notification.userId !== currentUser.id) {
      return { error: "You can only mark your own notifications as read" };
    }

    // Mark as read
    await prisma.notification.update({
      where: { id: validated.notificationId },
      data: { readAt: new Date() },
    });

    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return { error: "Failed to mark notification as read" };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(input: MarkAllAsReadInput) {
  try {
    const currentUser = await requireAuth();

    const validated = markAllAsReadSchema.parse(input);

    // Users can only mark their own notifications
    if (currentUser.id !== validated.userId) {
      return { error: "You can only mark your own notifications as read" };
    }

    await prisma.notification.updateMany({
      where: {
        userId: validated.userId,
        readAt: null,
      },
      data: { readAt: new Date() },
    });

    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error marking all as read:", error);
    return { error: "Failed to mark all notifications as read" };
  }
}

/**
 * Delete a single notification
 */
export async function deleteNotification(input: DeleteNotificationInput) {
  try {
    const currentUser = await requireAuth();

    const validated = deleteNotificationSchema.parse(input);

    // Verify notification belongs to user
    const notification = await prisma.notification.findUnique({
      where: { id: validated.notificationId },
      select: { userId: true },
    });

    if (!notification) {
      return { error: "Notification not found" };
    }

    if (notification.userId !== currentUser.id) {
      return { error: "You can only delete your own notifications" };
    }

    await prisma.notification.delete({
      where: { id: validated.notificationId },
    });

    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error deleting notification:", error);
    return { error: "Failed to delete notification" };
  }
}

/**
 * Delete all read notifications for a user
 */
export async function deleteAllRead(input: DeleteAllReadInput) {
  try {
    const currentUser = await requireAuth();

    const validated = deleteAllReadSchema.parse(input);

    // Users can only delete their own notifications
    if (currentUser.id !== validated.userId) {
      return { error: "You can only delete your own notifications" };
    }

    await prisma.notification.deleteMany({
      where: {
        userId: validated.userId,
        readAt: { not: null },
      },
    });

    revalidatePath("/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error deleting all read notifications:", error);
    return { error: "Failed to delete notifications" };
  }
}

/**
 * Create a single notification (Admin only)
 */
export async function createNotificationAction(input: CreateNotificationInput) {
  try {
    const currentUser = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("notifications", "create");
    if (!hasPermission) {
      return { error: "You don't have permission to create notifications" };
    }

    const validated = createNotificationSchema.parse(input);

    const notification = await createNotification(validated);

    if (!notification) {
      return { error: "Failed to create notification" };
    }

    revalidatePath("/notifications");
    return { success: true, notification };
  } catch (error) {
    console.error("Error creating notification:", error);
    return { error: "Failed to create notification" };
  }
}

/**
 * Create bulk notifications (Admin only)
 */
export async function createBulkNotificationsAction(input: CreateBulkNotificationsInput) {
  try {
    const currentUser = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("notifications", "create");
    if (!hasPermission) {
      return { error: "You don't have permission to create notifications" };
    }

    const validated = createBulkNotificationsSchema.parse(input);

    const { userIds, ...notificationData } = validated;

    const result = await createBulkNotifications(notificationData, userIds);

    if (!result) {
      return { error: "Failed to create notifications" };
    }

    revalidatePath("/notifications");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    return { error: "Failed to create notifications" };
  }
}

/**
 * Broadcast system announcement to all users or specific roles (Admin only)
 */
export async function broadcastAnnouncement(input: BroadcastAnnouncementInput) {
  try {
    const currentUser = await requireAuth();

    // Check permission
    const hasPermission = await canAccess("notifications", "create");
    if (!hasPermission) {
      return { error: "You don't have permission to broadcast announcements" };
    }

    const validated = broadcastAnnouncementSchema.parse(input);

    // Get target users
    let targetUsers;
    if (validated.targetRoles && validated.targetRoles.length > 0) {
      // Broadcast to specific roles
      targetUsers = await prisma.user.findMany({
        where: {
          active: true,
          role: {
            name: { in: validated.targetRoles },
          },
        },
        select: { id: true },
      });
    } else {
      // Broadcast to all active users
      targetUsers = await prisma.user.findMany({
        where: { active: true },
        select: { id: true },
      });
    }

    const userIds = targetUsers.map((u) => u.id);

    if (userIds.length === 0) {
      return { error: "No users found to broadcast to" };
    }

    // Create bulk notifications
    const result = await createBulkNotifications(
      {
        type: "SYSTEM_ANNOUNCEMENT",
        title: validated.title,
        message: validated.message,
        link: validated.actionUrl,
      },
      userIds
    );

    if (!result) {
      return { error: "Failed to broadcast announcement" };
    }

    revalidatePath("/notifications");
    return { success: true, count: result.count };
  } catch (error) {
    console.error("Error broadcasting announcement:", error);
    return { error: "Failed to broadcast announcement" };
  }
}
