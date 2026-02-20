"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import {
  createMessageSchema,
  updateMessageSchema,
  deleteMessageSchema,
  markAsReadSchema,
  toggleReactionSchema,
  type CreateMessageInput,
  type UpdateMessageInput,
  type DeleteMessageInput,
  type MarkAsReadInput,
  type ToggleReactionInput,
} from "@/lib/schemas/messages";
import {
  notifyNewDirectMessage,
  notifyMessageMention,
  notifyMessageReaction,
} from "@/lib/services/notifications";
import {
  encryptForStorage,
  decryptFromStorage,
  isEncrypted,
} from "@/lib/utils/encryption";
import {
  messageRateLimiter,
  combinedRateLimit,
} from "@/lib/utils/rate-limiter";
import {
  MESSAGE_EDIT_WINDOW_MINUTES,
  MAX_EDITS_PER_MESSAGE,
  MAX_MESSAGE_LENGTH,
  MAX_MENTIONS_PER_MESSAGE,
  ENCRYPTION_ENABLED,
  TRACK_DELIVERY_STATUS,
  canEditMessage,
  calculateExpirationDate,
  type DeliveryStatus,
  type ExpireType,
} from "@/lib/config/messaging";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract @mentions from message content
 * Supports @email, @username, and @firstname patterns
 */
function extractMentions(content: string): string[] {
  // Match @email.com patterns
  const emailRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const emailMatches = Array.from(content.matchAll(emailRegex), (match) => match[1]);

  // Match @username patterns (word characters, underscores, hyphens)
  const usernameRegex = /@([a-zA-Z0-9_-]{2,})(?!\S)/g;
  const usernameMatches = Array.from(content.matchAll(usernameRegex), (match) => match[1]);

  // Combine and dedupe
  return [...new Set([...emailMatches, ...usernameMatches])];
}

/**
 * Encrypt message content if encryption is enabled
 */
function encryptMessageContent(
  content: string,
  conversationId: string
): { content: string; isEncrypted: boolean } {
  if (!ENCRYPTION_ENABLED) {
    return { content, isEncrypted: false };
  }

  const encryptedContent = encryptForStorage(content, conversationId);
  return { content: encryptedContent, isEncrypted: true };
}

/**
 * Decrypt message content
 */
function decryptMessageContent(
  content: string,
  conversationId: string,
  messageIsEncrypted: boolean
): string {
  if (!messageIsEncrypted && !isEncrypted(content)) {
    // Legacy unencrypted message
    return content;
  }

  return decryptFromStorage(content, conversationId);
}

// ============================================================================
// MESSAGE QUERIES
// ============================================================================

/**
 * Get messages for a conversation with pagination
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  cursor?: string
) {
  const user = await requireAuth();

  try {
    // Check if user is a participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
      },
    });

    if (!participant) {
      return { error: "You don't have access to this conversation" };
    }

    // Get messages that haven't expired or been deleted
    const messages = await prisma.message.findMany({
      where: {
        conversationId,
        deletedAt: null,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
        ...(cursor
          ? {
              createdAt: {
                lt: new Date(cursor),
              },
            }
          : {}),
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Decrypt messages
    const decryptedMessages = messages.map((msg) => ({
      ...msg,
      content: decryptMessageContent(msg.content, conversationId, msg.isEncrypted),
    }));

    // Reverse to show oldest first
    const orderedMessages = decryptedMessages.reverse();

    return {
      success: true,
      messages: orderedMessages,
      hasMore: messages.length === limit,
      nextCursor:
        messages.length > 0
          ? messages[0].createdAt.toISOString()
          : undefined,
    };
  } catch (error) {
    console.error("Error fetching messages:", error);
    return { error: "Failed to fetch messages" };
  }
}

// ============================================================================
// MESSAGE ACTIONS
// ============================================================================

/**
 * Send a new message
 */
export async function sendMessage(data: CreateMessageInput & {
  expireType?: ExpireType;
  expireDurationMs?: number;
}) {
  const user = await requireAuth();

  // Check rate limit
  const rateLimitResult = await combinedRateLimit(
    user.id,
    messageRateLimiter,
    "MESSAGE_SENT",
    30,
    60000
  );

  if (!rateLimitResult.allowed) {
    return {
      error: rateLimitResult.reason || "Rate limit exceeded",
      retryAfter: rateLimitResult.retryAfter,
    };
  }

  // Check permission
  const hasAccess = await canAccess("messages", "send");
  if (!hasAccess) {
    return { error: "You don't have permission to send messages" };
  }

  const validatedFields = createMessageSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { conversationId, content, mediaUrls, expireType, expireDurationMs } = validatedFields.data;

  // Validate message length
  if (content.length > MAX_MESSAGE_LENGTH) {
    return { error: `Message exceeds ${MAX_MESSAGE_LENGTH} character limit` };
  }

  try {
    // Check if user is a participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
      },
    });

    if (!participant) {
      return { error: "You don't have access to this conversation" };
    }

    // Get conversation details
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return { error: "Conversation not found" };
    }

    // Encrypt message content
    const { content: encryptedContent, isEncrypted } = encryptMessageContent(
      content,
      conversationId
    );

    // Calculate expiration
    const expiresAt = calculateExpirationDate(expireType || null, expireDurationMs);

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content: encryptedContent,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
        isEncrypted,
        deliveryStatus: TRACK_DELIVERY_STATUS ? "SENT" : undefined,
        expiresAt,
        expireType: expireType || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // Update conversation's last message info
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: new Date(),
        lastMessage: content.substring(0, 100),
      },
    });

    // Extract @mentions from message content
    const mentionedUsernames = extractMentions(content);

    // Get user IDs for mentioned users
    let mentionedUserIds = new Set<string>();
    if (mentionedUsernames.length > 0 && mentionedUsernames.length <= MAX_MENTIONS_PER_MESSAGE) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { in: mentionedUsernames, mode: "insensitive" } },
            { firstName: { in: mentionedUsernames, mode: "insensitive" } },
            { lastName: { in: mentionedUsernames, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      });

      mentionedUserIds = new Set(mentionedUsers.map((u) => u.id));

      // Notify mentioned users
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.id !== user.id) {
          const senderName =
            user.firstName || user.lastName
              ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
              : user.email;

          await notifyMessageMention(
            mentionedUser.id,
            user.id,
            message.id,
            conversationId,
            senderName
          );
        }
      }
    }

    // Create notifications for other participants
    const otherParticipants = conversation.participants.filter(
      (p) => p.userId !== user.id
    );

    const senderName =
      user.firstName || user.lastName
        ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
        : user.email;

    for (const participant of otherParticipants) {
      // Check if conversation is muted
      const isMuted =
        participant.mutedUntil && participant.mutedUntil > new Date();

      if (!isMuted && !mentionedUserIds.has(participant.userId)) {
        await notifyNewDirectMessage(
          participant.userId,
          user.id,
          message.id,
          conversationId,
          senderName,
          content
        );
      }
    }

    revalidatePath("/messages");

    // Return decrypted message
    return {
      success: true,
      message: {
        ...message,
        content, // Return plaintext to sender
      },
    };
  } catch (error) {
    console.error("Error sending message:", error);
    return { error: "Failed to send message" };
  }
}

/**
 * Update a message (own messages only)
 */
export async function updateMessage(data: UpdateMessageInput) {
  const user = await requireAuth();

  const validatedFields = updateMessageSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id, content } = validatedFields.data;

  try {
    const existingMessage = await prisma.message.findUnique({
      where: { id },
      include: {
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!existingMessage) {
      return { error: "Message not found" };
    }

    if (existingMessage.deletedAt) {
      return { error: "Cannot edit deleted message" };
    }

    // Check edit permissions
    const editCheck = canEditMessage(
      existingMessage.createdAt,
      existingMessage.senderId,
      user.id,
      0 // TODO: Track edit count
    );

    if (!editCheck.canEdit) {
      return { error: editCheck.reason };
    }

    // Get previous content for edit history
    const previousContent = decryptMessageContent(
      existingMessage.content,
      existingMessage.conversationId,
      existingMessage.isEncrypted
    );

    // Encrypt new content
    const { content: encryptedContent, isEncrypted } = encryptMessageContent(
      content,
      existingMessage.conversationId
    );

    // Build edit history
    const editHistory = existingMessage.editHistory
      ? JSON.parse(existingMessage.editHistory)
      : [];

    editHistory.push({
      content: encryptForStorage(previousContent, existingMessage.conversationId),
      editedAt: existingMessage.editedAt || existingMessage.updatedAt.toISOString(),
    });

    const message = await prisma.message.update({
      where: { id },
      data: {
        content: encryptedContent,
        isEdited: true,
        editedAt: new Date(),
        editHistory: JSON.stringify(editHistory),
        updatedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    revalidatePath("/messages");

    return {
      success: true,
      message: {
        ...message,
        content, // Return plaintext
      },
    };
  } catch (error) {
    console.error("Error updating message:", error);
    return { error: "Failed to update message" };
  }
}

/**
 * Delete a message (own messages only, or soft delete)
 */
export async function deleteMessage(data: DeleteMessageInput) {
  const user = await requireAuth();

  const validatedFields = deleteMessageSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id } = validatedFields.data;

  try {
    const existingMessage = await prisma.message.findUnique({
      where: { id },
    });

    if (!existingMessage) {
      return { error: "Message not found" };
    }

    if (existingMessage.senderId !== user.id) {
      return { error: "You can only delete your own messages" };
    }

    // Soft delete
    await prisma.message.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: user.id,
      },
    });

    revalidatePath("/messages");

    return { success: true };
  } catch (error) {
    console.error("Error deleting message:", error);
    return { error: "Failed to delete message" };
  }
}

// ============================================================================
// READ RECEIPTS & DELIVERY STATUS
// ============================================================================

/**
 * Mark a message as read
 */
export async function markMessageAsRead(messageId: string) {
  const user = await requireAuth();

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    if (!message) {
      return { error: "Message not found" };
    }

    // Check if user is a participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: message.conversationId,
        userId: user.id,
      },
    });

    if (!participant) {
      return { error: "You don't have access to this conversation" };
    }

    // Don't mark own messages as read
    if (message.senderId === user.id) {
      return { success: true };
    }

    // Update message read status
    const updates: any = {};

    // Add user to readBy array if not already there
    if (!message.readBy.includes(user.id)) {
      updates.readBy = { push: user.id };
    }

    // Update delivery status if tracking enabled
    if (TRACK_DELIVERY_STATUS && message.deliveryStatus !== "READ") {
      updates.deliveryStatus = "READ";
      updates.readAt = new Date();
    }

    // Check if message should expire after read
    if (message.expireType === "AFTER_READ") {
      const allParticipants = message.conversation.participants;
      const newReadBy = [...message.readBy, user.id];
      const allRead = allParticipants.every((p) =>
        newReadBy.includes(p.userId)
      );

      if (allRead) {
        updates.expiresAt = new Date(); // Expire immediately
      }
    }

    if (Object.keys(updates).length > 0) {
      await prisma.message.update({
        where: { id: messageId },
        data: updates,
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error marking message as read:", error);
    return { error: "Failed to mark message as read" };
  }
}

/**
 * Mark all messages in a conversation as read
 */
export async function markConversationAsRead(data: MarkAsReadInput) {
  const user = await requireAuth();

  const validatedFields = markAsReadSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { conversationId } = validatedFields.data;

  try {
    // Check if user is a participant
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
      },
    });

    if (!participant) {
      return { error: "You don't have access to this conversation" };
    }

    // Update participant's lastReadAt
    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: {
        lastReadAt: new Date(),
      },
    });

    // Mark all unread messages as read
    const unreadMessages = await prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: user.id },
        deletedAt: null,
        NOT: {
          readBy: {
            has: user.id,
          },
        },
      },
      select: {
        id: true,
      },
    });

    for (const message of unreadMessages) {
      await prisma.message.update({
        where: { id: message.id },
        data: {
          readBy: {
            push: user.id,
          },
          ...(TRACK_DELIVERY_STATUS && {
            deliveryStatus: "READ",
            readAt: new Date(),
          }),
        },
      });
    }

    revalidatePath("/messages");

    return { success: true };
  } catch (error) {
    console.error("Error marking conversation as read:", error);
    return { error: "Failed to mark conversation as read" };
  }
}

/**
 * Get unread message count for a conversation or all conversations
 */
export async function getUnreadMessageCount(conversationId?: string) {
  const user = await requireAuth();

  try {
    if (conversationId) {
      // Get unread count for specific conversation
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId,
          userId: user.id,
        },
      });

      if (!participant) {
        return { error: "You don't have access to this conversation" };
      }

      const count = await prisma.message.count({
        where: {
          conversationId,
          senderId: { not: user.id },
          deletedAt: null,
          createdAt: {
            gt: participant.lastReadAt || new Date(0),
          },
        },
      });

      return { success: true, count };
    } else {
      // Get total unread count across all conversations
      const participants = await prisma.conversationParticipant.findMany({
        where: {
          userId: user.id,
        },
      });

      let totalCount = 0;

      for (const participant of participants) {
        const count = await prisma.message.count({
          where: {
            conversationId: participant.conversationId,
            senderId: { not: user.id },
            deletedAt: null,
            createdAt: {
              gt: participant.lastReadAt || new Date(0),
            },
          },
        });
        totalCount += count;
      }

      return { success: true, count: totalCount };
    }
  } catch (error) {
    console.error("Error getting unread count:", error);
    return { error: "Failed to get unread count" };
  }
}

// ============================================================================
// MESSAGE SEARCH
// ============================================================================

/**
 * Search messages across conversations
 */
export async function searchMessages(query: string, limit = 50) {
  const user = await requireAuth();

  if (!query || query.trim().length < 2) {
    return { error: "Search query must be at least 2 characters" };
  }

  try {
    // VENUE FILTERING: Get users in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Get user's conversation IDs
    const participants = await prisma.conversationParticipant.findMany({
      where: {
        userId: user.id,
      },
      select: {
        conversationId: true,
      },
    });

    const conversationIds = participants.map((p) => p.conversationId);

    // Search messages
    const messages = await prisma.message.findMany({
      where: {
        conversationId: {
          in: conversationIds,
        },
        senderId: {
          in: sharedVenueUserIds,
        },
        deletedAt: null,
        content: {
          contains: query,
          mode: "insensitive",
        },
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        conversation: {
          select: {
            id: true,
            type: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    });

    // Decrypt messages for display
    const decryptedMessages = messages.map((msg) => ({
      ...msg,
      content: decryptMessageContent(msg.content, msg.conversationId, msg.isEncrypted),
    }));

    return { success: true, messages: decryptedMessages };
  } catch (error) {
    console.error("Error searching messages:", error);
    return { error: "Failed to search messages" };
  }
}

// ============================================================================
// REACTIONS
// ============================================================================

/**
 * Toggle a reaction on a message
 */
export async function toggleReaction(data: ToggleReactionInput) {
  const user = await requireAuth();

  const validatedFields = toggleReactionSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { messageId, emoji } = validatedFields.data;

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            participants: {
              where: {
                userId: user.id,
              },
            },
          },
        },
      },
    });

    if (!message) {
      return { error: "Message not found" };
    }

    if (message.deletedAt) {
      return { error: "Cannot react to deleted message" };
    }

    // Check if user is a participant
    if (message.conversation.participants.length === 0) {
      return { error: "You don't have access to this conversation" };
    }

    // Parse existing reactions
    const reactions: Array<{ emoji: string; userId: string }> = message.reactions
      ? JSON.parse(message.reactions)
      : [];

    // Check if user already reacted with this emoji
    const existingReactionIndex = reactions.findIndex(
      (r) => r.userId === user.id && r.emoji === emoji
    );

    let reactionAdded = false;

    if (existingReactionIndex !== -1) {
      // Remove the reaction
      reactions.splice(existingReactionIndex, 1);
    } else {
      // Add the reaction
      reactions.push({ emoji, userId: user.id });
      reactionAdded = true;
    }

    // Update message
    await prisma.message.update({
      where: { id: messageId },
      data: {
        reactions: reactions.length > 0 ? JSON.stringify(reactions) : null,
      },
    });

    // Send notification to message author
    if (reactionAdded && message.senderId !== user.id) {
      const reactorName =
        user.firstName || user.lastName
          ? `${user.firstName || ""} ${user.lastName || ""}`.trim()
          : user.email;

      await notifyMessageReaction(
        message.senderId,
        user.id,
        messageId,
        message.conversationId,
        reactorName,
        emoji
      );
    }

    revalidatePath("/messages");

    return { success: true };
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return { error: "Failed to toggle reaction" };
  }
}

// ============================================================================
// MESSAGE EXPIRATION CLEANUP
// ============================================================================

/**
 * Delete expired messages (should be called by a cron job)
 */
export async function cleanupExpiredMessages() {
  try {
    const now = new Date();

    // Find and delete expired messages
    const result = await prisma.message.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
        expireType: "TIMED",
      },
    });

    // Find messages that should expire after all recipients have read
    const afterReadMessages = await prisma.message.findMany({
      where: {
        expireType: "AFTER_READ",
        expiresAt: null,
      },
      include: {
        conversation: {
          include: {
            participants: true,
          },
        },
      },
    });

    for (const message of afterReadMessages) {
      const allParticipants = message.conversation.participants;
      const allRead = allParticipants.every((p) =>
        message.readBy.includes(p.userId)
      );

      if (allRead) {
        await prisma.message.delete({
          where: { id: message.id },
        });
      }
    }

    return {
      success: true,
      deletedCount: result.count + afterReadMessages.length,
    };
  } catch (error) {
    console.error("Error cleaning up expired messages:", error);
    return { error: "Failed to cleanup expired messages" };
  }
}
