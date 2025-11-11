"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { notifySystemAnnouncement } from "@/lib/services/notifications";
import {
  notificationHistoryFilterSchema,
  systemAnnouncementSchema,
  notificationStatsFilterSchema,
  type NotificationHistoryFilter,
  type SystemAnnouncementInput,
  type NotificationStatsFilter,
} from "@/lib/schemas/admin/notifications";
import { NotificationType } from "@prisma/client";

/**
 * Get notification statistics for admin dashboard
 */
export async function getNotificationStatistics(
  filters?: NotificationStatsFilter
) {
  const user = await requireAuth();
  const hasAccess = await canAccess("notifications", "read");

  if (!hasAccess) {
    return { error: "You don't have permission to view notification statistics" };
  }

  try {
    const validatedFilters = filters
      ? notificationStatsFilterSchema.parse(filters)
      : {};

    // Build date filter
    const dateFilter = validatedFilters.dateFrom || validatedFilters.dateTo
      ? {
          createdAt: {
            ...(validatedFilters.dateFrom && {
              gte: new Date(validatedFilters.dateFrom),
            }),
            ...(validatedFilters.dateTo && {
              lte: new Date(validatedFilters.dateTo),
            }),
          },
        }
      : {};

    // Build type filter
    const typeFilter = validatedFilters.type ? { type: validatedFilters.type } : {};

    // Total notifications
    const total = await prisma.notification.count({
      where: { ...dateFilter, ...typeFilter },
    });

    // Notifications today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalToday = await prisma.notification.count({
      where: {
        createdAt: { gte: today },
        ...typeFilter,
      },
    });

    // Notifications this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const totalThisWeek = await prisma.notification.count({
      where: {
        createdAt: { gte: weekAgo },
        ...typeFilter,
      },
    });

    // Read vs unread
    const unreadCount = await prisma.notification.count({
      where: {
        readAt: null,
        ...dateFilter,
        ...typeFilter,
      },
    });

    // By type breakdown
    const byType = await prisma.notification.groupBy({
      by: ["type"],
      _count: true,
      where: { ...dateFilter },
      orderBy: {
        _count: {
          type: "desc",
        },
      },
    });

    // By category (group types into categories)
    const messageTypes: NotificationType[] = [
      "NEW_MESSAGE",
      "MESSAGE_REPLY",
      "MESSAGE_MENTION",
      "MESSAGE_REACTION",
    ];
    const postTypes: NotificationType[] = [
      "POST_MENTION",
      "POST_PINNED",
      "POST_DELETED",
    ];
    const timeOffTypes: NotificationType[] = [
      "TIME_OFF_REQUEST",
      "TIME_OFF_APPROVED",
      "TIME_OFF_REJECTED",
      "TIME_OFF_CANCELLED",
    ];
    const systemTypes: NotificationType[] = [
      "USER_CREATED",
      "USER_UPDATED",
      "ROLE_CHANGED",
      "SYSTEM_ANNOUNCEMENT",
      "GROUP_REMOVED",
    ];

    const byCategory = {
      messages: byType
        .filter((t) => messageTypes.includes(t.type))
        .reduce((sum, t) => sum + t._count, 0),
      posts: byType
        .filter((t) => postTypes.includes(t.type))
        .reduce((sum, t) => sum + t._count, 0),
      timeOff: byType
        .filter((t) => timeOffTypes.includes(t.type))
        .reduce((sum, t) => sum + t._count, 0),
      system: byType
        .filter((t) => systemTypes.includes(t.type))
        .reduce((sum, t) => sum + t._count, 0),
    };

    // Recent announcements
    const recentAnnouncements = await prisma.notification.findMany({
      where: {
        type: "SYSTEM_ANNOUNCEMENT",
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 5,
      distinct: ["title"], // Get unique announcements
    });

    return {
      success: true,
      stats: {
        total,
        totalToday,
        totalThisWeek,
        readCount: total - unreadCount,
        unreadCount,
        readPercentage: total > 0 ? Math.round(((total - unreadCount) / total) * 100) : 0,
        byType: byType.map((t) => ({
          type: t.type,
          count: t._count,
        })),
        byCategory,
        recentAnnouncements,
      },
    };
  } catch (error) {
    console.error("Error fetching notification statistics:", error);
    return { error: "Failed to fetch statistics" };
  }
}

/**
 * Get notification history with filtering and pagination
 */
export async function getNotificationHistory(filters: NotificationHistoryFilter) {
  const user = await requireAuth();
  const hasAccess = await canAccess("notifications", "read");

  if (!hasAccess) {
    return { error: "You don't have permission to view notification history" };
  }

  try {
    const validatedFilters = notificationHistoryFilterSchema.parse(filters);

    // Build where clause
    const where: any = {};

    if (validatedFilters.userId) {
      where.userId = validatedFilters.userId;
    }

    if (validatedFilters.type) {
      where.type = validatedFilters.type;
    }

    if (validatedFilters.readStatus === "read") {
      where.readAt = { not: null };
    } else if (validatedFilters.readStatus === "unread") {
      where.readAt = null;
    }

    if (validatedFilters.dateFrom || validatedFilters.dateTo) {
      where.createdAt = {
        ...(validatedFilters.dateFrom && {
          gte: new Date(validatedFilters.dateFrom),
        }),
        ...(validatedFilters.dateTo && {
          lte: new Date(validatedFilters.dateTo),
        }),
      };
    }

    if (validatedFilters.search) {
      where.OR = [
        { title: { contains: validatedFilters.search, mode: "insensitive" } },
        { message: { contains: validatedFilters.search, mode: "insensitive" } },
      ];
    }

    // Add cursor for pagination
    if (validatedFilters.cursor) {
      where.id = { lt: validatedFilters.cursor };
    }

    const notifications = await prisma.notification.findMany({
      where,
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: validatedFilters.limit || 50,
    });

    return {
      success: true,
      notifications,
      hasMore: notifications.length === (validatedFilters.limit || 50),
      nextCursor:
        notifications.length > 0
          ? notifications[notifications.length - 1].id
          : undefined,
    };
  } catch (error) {
    console.error("Error fetching notification history:", error);
    return { error: "Failed to fetch notification history" };
  }
}

/**
 * Get all users grouped by role for announcement targeting
 */
export async function getUsersByRole() {
  const user = await requireAuth();
  const hasAccess = await canAccess("notifications", "create");

  if (!hasAccess) {
    return { error: "You don't have permission to send announcements" };
  }

  try {
    const roles = await prisma.role.findMany({
      include: {
        users: {
          where: {
            active: true,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    });

    return {
      success: true,
      roles: roles.map((role) => ({
        name: role.name,
        userCount: role.users.length,
        users: role.users,
      })),
    };
  } catch (error) {
    console.error("Error fetching users by role:", error);
    return { error: "Failed to fetch users" };
  }
}

/**
 * Send system announcement to selected roles
 */
export async function sendSystemAnnouncement(data: SystemAnnouncementInput) {
  const user = await requireAuth();
  const hasAccess = await canAccess("notifications", "create");

  if (!hasAccess) {
    return { error: "You don't have permission to send announcements" };
  }

  const validatedFields = systemAnnouncementSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { title, message, link, targetRoles } = validatedFields.data;

  try {
    // Get user IDs for selected roles
    let userIds: string[] = [];

    if (targetRoles.includes("all")) {
      // Send to all active users
      const users = await prisma.user.findMany({
        where: { active: true },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    } else {
      // Send to specific roles
      const users = await prisma.user.findMany({
        where: {
          active: true,
          role: {
            name: { in: targetRoles },
          },
        },
        select: { id: true },
      });
      userIds = users.map((u) => u.id);
    }

    if (userIds.length === 0) {
      return { error: "No active users found for selected roles" };
    }

    // Use existing notifySystemAnnouncement function
    await notifySystemAnnouncement(
      title,
      message,
      userIds,
      link || undefined
    );

    return {
      success: true,
      message: `Announcement sent to ${userIds.length} user(s)`,
      recipientCount: userIds.length,
    };
  } catch (error) {
    console.error("Error sending system announcement:", error);
    return { error: "Failed to send announcement" };
  }
}

/**
 * Get announcement history with read receipts
 */
export async function getAnnouncementHistory() {
  const user = await requireAuth();
  const hasAccess = await canAccess("notifications", "read");

  if (!hasAccess) {
    return { error: "You don't have permission to view announcements" };
  }

  try {
    // Get unique announcements (by title) with read statistics
    const announcements = await prisma.notification.findMany({
      where: {
        type: "SYSTEM_ANNOUNCEMENT",
      },
      include: {
        user: {
          select: {
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 50,
    });

    // Group by title and calculate stats
    const grouped = new Map();

    for (const announcement of announcements) {
      const key = announcement.title;
      if (!grouped.has(key)) {
        const allWithSameTitle = announcements.filter(
          (a) => a.title === announcement.title
        );
        const readCount = allWithSameTitle.filter((a) => a.readAt !== null).length;

        grouped.set(key, {
          title: announcement.title,
          message: announcement.message,
          link: announcement.link,
          createdAt: announcement.createdAt,
          totalRecipients: allWithSameTitle.length,
          readCount,
          readPercentage: Math.round((readCount / allWithSameTitle.length) * 100),
        });
      }
    }

    return {
      success: true,
      announcements: Array.from(grouped.values()),
    };
  } catch (error) {
    console.error("Error fetching announcement history:", error);
    return { error: "Failed to fetch announcement history" };
  }
}
