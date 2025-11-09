import { prisma } from "@/lib/prisma";
import { NotificationType } from "@prisma/client";

/**
 * Universal Notification Service
 * Centralized service for creating notifications across all features
 */

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  link?: string | null;
}

/**
 * Core function to create a single notification
 * Prevents duplicate notifications within 5 minutes
 */
export async function createNotification(params: CreateNotificationParams) {
  try {
    // Check for duplicate notification in last 5 minutes
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const existingNotification = await prisma.notification.findFirst({
      where: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        createdAt: { gte: fiveMinutesAgo },
      },
    });

    if (existingNotification) {
      console.log("Duplicate notification prevented:", params.type);
      return null;
    }

    // Create the notification
    const notification = await prisma.notification.create({
      data: {
        userId: params.userId,
        type: params.type,
        title: params.title,
        message: params.message || "",
        link: params.link,
      },
    });

    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    return null;
  }
}

/**
 * Create multiple notifications in batch
 * Useful for broadcasting to multiple users
 */
export async function createBulkNotifications(
  params: Omit<CreateNotificationParams, "userId">,
  userIds: string[]
) {
  try {
    const notifications = await prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        type: params.type,
        title: params.title,
        message: params.message || "",
        link: params.link,
      })),
      skipDuplicates: true,
    });

    return notifications;
  } catch (error) {
    console.error("Error creating bulk notifications:", error);
    return null;
  }
}

// ============================================================================
// MESSAGE NOTIFICATIONS
// ============================================================================

/**
 * Notify user when mentioned in a message
 */
export async function notifyMessageMention(
  mentionedUserId: string,
  senderId: string,
  messageId: string,
  channelId: string,
  senderName: string
) {
  return createNotification({
    userId: mentionedUserId,
    type: "MESSAGE_MENTION",
    title: `${senderName} mentioned you`,
    message: "You were mentioned in a message",
    link: `/messages?channel=${channelId}&message=${messageId}`,
  });
}

/**
 * Notify user when someone replies to their message
 */
export async function notifyMessageReply(
  originalAuthorId: string,
  replyAuthorId: string,
  messageId: string,
  channelId: string,
  replyAuthorName: string
) {
  return createNotification({
    userId: originalAuthorId,
    type: "MESSAGE_REPLY",
    title: `${replyAuthorName} replied to your message`,
    message: "Someone replied to your message",
    link: `/messages?channel=${channelId}&message=${messageId}`,
  });
}

/**
 * Notify user when someone reacts to their message
 */
export async function notifyMessageReaction(
  messageAuthorId: string,
  reactorId: string,
  messageId: string,
  channelId: string,
  reactorName: string,
  emoji: string
) {
  return createNotification({
    userId: messageAuthorId,
    type: "MESSAGE_REACTION",
    title: `${reactorName} reacted ${emoji}`,
    message: "Someone reacted to your message",
    link: `/messages?channel=${channelId}&message=${messageId}`,
  });
}

/**
 * Notify user of new direct message
 */
export async function notifyNewDirectMessage(
  recipientId: string,
  senderId: string,
  messageId: string,
  channelId: string,
  senderName: string,
  messagePreview: string
) {
  return createNotification({
    userId: recipientId,
    type: "NEW_MESSAGE",
    title: `${senderName} sent you a message`,
    message: messagePreview.substring(0, 100),
    link: `/messages?channel=${channelId}`,
  });
}

// ============================================================================
// TIME-OFF NOTIFICATIONS
// ============================================================================

/**
 * Notify admin/manager when time-off request is submitted
 */
export async function notifyTimeOffSubmitted(
  requestId: string,
  requesterId: string,
  requesterName: string,
  startDate: Date,
  endDate: Date,
  approverIds: string[]
) {
  const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  return createBulkNotifications(
    {
      type: "TIME_OFF_REQUEST",
      title: `${requesterName} requested time off`,
      message: `Time off request for ${dateRange}`,
      link: `/time-off?request=${requestId}`,
    },
    approverIds
  );
}

/**
 * Notify requester when time-off is approved
 */
export async function notifyTimeOffApproved(
  requestId: string,
  requesterId: string,
  approverId: string,
  approverName: string,
  startDate: Date,
  endDate: Date
) {
  const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  return createNotification({
    userId: requesterId,
    type: "TIME_OFF_APPROVED",
    title: "Time off request approved",
    message: `Your time off request for ${dateRange} has been approved by ${approverName}`,
    link: `/time-off?request=${requestId}`,
  });
}

/**
 * Notify requester when time-off is rejected
 */
export async function notifyTimeOffRejected(
  requestId: string,
  requesterId: string,
  rejectorId: string,
  rejectorName: string,
  startDate: Date,
  endDate: Date,
  reason?: string
) {
  const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  return createNotification({
    userId: requesterId,
    type: "TIME_OFF_REJECTED",
    title: "Time off request rejected",
    message: reason
      ? `Your time off request for ${dateRange} was rejected: ${reason}`
      : `Your time off request for ${dateRange} was rejected by ${rejectorName}`,
    link: `/time-off?request=${requestId}`,
  });
}

/**
 * Notify relevant users when time-off is cancelled
 */
export async function notifyTimeOffCancelled(
  requestId: string,
  requesterId: string,
  requesterName: string,
  startDate: Date,
  endDate: Date,
  notifyUserIds: string[]
) {
  const dateRange = `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;

  return createBulkNotifications(
    {
      type: "TIME_OFF_CANCELLED",
      title: `${requesterName} cancelled time off`,
      message: `Time off for ${dateRange} has been cancelled`,
      link: `/time-off`,
    },
    notifyUserIds
  );
}

// ============================================================================
// ADMIN ACTION NOTIFICATIONS
// ============================================================================

/**
 * Send welcome notification to new user
 */
export async function notifyUserWelcome(userId: string, userName: string) {
  return createNotification({
    userId,
    type: "USER_CREATED",
    title: "Welcome to Staff Portal!",
    message: `Welcome ${userName}! Your account has been created successfully.`,
    link: "/settings/profile",
  });
}

/**
 * Notify user when their role is changed
 */
export async function notifyRoleChanged(
  userId: string,
  adminId: string,
  adminName: string,
  oldRole: string,
  newRole: string
) {
  return createNotification({
    userId,
    type: "ROLE_CHANGED",
    title: "Your role has been updated",
    message: `Your role has been changed from ${oldRole} to ${newRole} by ${adminName}`,
    link: "/settings",
  });
}

/**
 * Notify user when their account is activated
 */
export async function notifyUserActivated(
  userId: string,
  adminId: string,
  adminName: string
) {
  return createNotification({
    userId,
    type: "USER_UPDATED",
    title: "Account activated",
    message: `Your account has been activated by ${adminName}`,
    link: "/dashboard",
  });
}

/**
 * Notify user when their account is deactivated
 */
export async function notifyUserDeactivated(
  userId: string,
  adminId: string,
  adminName: string,
  reason?: string
) {
  return createNotification({
    userId,
    type: "USER_UPDATED",
    title: "Account deactivated",
    message: reason
      ? `Your account has been deactivated: ${reason}`
      : `Your account has been deactivated by ${adminName}`,
  });
}

// ============================================================================
// POST NOTIFICATIONS
// ============================================================================

/**
 * Notify user when mentioned in a post
 */
export async function notifyPostMention(
  mentionedUserId: string,
  postAuthorId: string,
  postId: string,
  channelId: string,
  authorName: string
) {
  return createNotification({
    userId: mentionedUserId,
    type: "POST_MENTION",
    title: `${authorName} mentioned you in a post`,
    message: "You were mentioned in a post",
    link: `/posts?channel=${channelId}&post=${postId}`,
  });
}

/**
 * Notify channel members when a post is pinned
 */
export async function notifyPostPinned(
  postId: string,
  channelId: string,
  pinnerId: string,
  pinnerName: string,
  postTitle: string,
  memberIds: string[]
) {
  return createBulkNotifications(
    {
      type: "POST_PINNED",
      title: "Post pinned",
      message: `${pinnerName} pinned: ${postTitle}`,
      link: `/posts?channel=${channelId}&post=${postId}`,
    },
    memberIds
  );
}

/**
 * Notify post author when their post is deleted
 */
export async function notifyPostDeleted(
  postAuthorId: string,
  deleterId: string,
  deleterName: string,
  postTitle: string,
  reason?: string
) {
  return createNotification({
    userId: postAuthorId,
    type: "POST_DELETED",
    title: "Your post was deleted",
    message: reason
      ? `"${postTitle}" was deleted by ${deleterName}: ${reason}`
      : `"${postTitle}" was deleted by ${deleterName}`,
  });
}

// ============================================================================
// SYSTEM NOTIFICATIONS
// ============================================================================

/**
 * Broadcast system announcement to all users or specific roles
 */
export async function notifySystemAnnouncement(
  title: string,
  message: string,
  userIds: string[],
  link?: string
) {
  return createBulkNotifications(
    {
      type: "SYSTEM_ANNOUNCEMENT",
      title,
      message,
      link,
    },
    userIds
  );
}

/**
 * Notify users when removed from a group/channel
 */
export async function notifyGroupRemoved(
  userId: string,
  groupName: string,
  removerId: string,
  removerName: string
) {
  return createNotification({
    userId,
    type: "GROUP_REMOVED",
    title: `Removed from ${groupName}`,
    message: `You have been removed from ${groupName} by ${removerName}`,
  });
}
