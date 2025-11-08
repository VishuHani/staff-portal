"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
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

/**
 * Get messages for a conversation with pagination
 */
export async function getMessages(
  conversationId: string,
  limit = 50,
  cursor?: string
) {
  const user = await requireAuth();

  // Messages are available to all authenticated users
  // Future: Add permission check if needed: canAccess("messages", "read")

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

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
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

    // Reverse to show oldest first
    const orderedMessages = messages.reverse();

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

/**
 * Send a new message
 */
export async function sendMessage(data: CreateMessageInput) {
  const user = await requireAuth();

  const hasAccess = await canAccess("messages", "create");
  if (!hasAccess) {
    return { error: "You don't have permission to send messages" };
  }

  const validatedFields = createMessageSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { conversationId, content, mediaUrls } = validatedFields.data;

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
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return { error: "Conversation not found" };
    }

    // Create message
    const message = await prisma.message.create({
      data: {
        conversationId,
        senderId: user.id,
        content,
        mediaUrls: mediaUrls ? JSON.stringify(mediaUrls) : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
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

    // Create notifications for other participants
    const otherParticipants = conversation.participants.filter(
      (p) => p.userId !== user.id
    );

    for (const participant of otherParticipants) {
      // Check if conversation is muted
      const isMuted =
        participant.mutedUntil && participant.mutedUntil > new Date();

      if (!isMuted) {
        const notificationMessage =
          conversation.type === "ONE_ON_ONE"
            ? `${user.email}: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`
            : `${user.email} in ${conversation.name || "group"}: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`;

        await prisma.notification.create({
          data: {
            userId: participant.userId,
            type: "MESSAGE",
            title: "New message",
            message: notificationMessage,
            link: `/messages?conversationId=${conversationId}`,
          },
        });
      }
    }

    revalidatePath("/messages");

    return { success: true, message };
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
    });

    if (!existingMessage) {
      return { error: "Message not found" };
    }

    if (existingMessage.senderId !== user.id) {
      return { error: "You can only edit your own messages" };
    }

    // Don't allow editing messages older than 15 minutes
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    if (existingMessage.createdAt < fifteenMinutesAgo) {
      return { error: "Messages can only be edited within 15 minutes" };
    }

    const message = await prisma.message.update({
      where: { id },
      data: {
        content,
        updatedAt: new Date(),
      },
      include: {
        sender: {
          select: {
            id: true,
            email: true,
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

    return { success: true, message };
  } catch (error) {
    console.error("Error updating message:", error);
    return { error: "Failed to update message" };
  }
}

/**
 * Delete a message (own messages only)
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

    await prisma.message.delete({
      where: { id },
    });

    revalidatePath("/messages");

    return { success: true };
  } catch (error) {
    console.error("Error deleting message:", error);
    return { error: "Failed to delete message" };
  }
}

/**
 * Mark a message as read
 */
export async function markMessageAsRead(messageId: string) {
  const user = await requireAuth();

  try {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
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

    // Add user to readBy array if not already there
    if (!message.readBy.includes(user.id)) {
      await prisma.message.update({
        where: { id: messageId },
        data: {
          readBy: {
            push: user.id,
          },
          readAt: new Date(),
        },
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

/**
 * Search messages across conversations
 */
export async function searchMessages(query: string, limit = 50) {
  const user = await requireAuth();

  // Messages are available to all authenticated users
  // Future: Add permission check if needed: canAccess("messages", "read")

  if (!query || query.trim().length < 2) {
    return { error: "Search query must be at least 2 characters" };
  }

  try {
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

    return { success: true, messages };
  } catch (error) {
    console.error("Error searching messages:", error);
    return { error: "Failed to search messages" };
  }
}

/**
 * Toggle a reaction on a message
 * If the user already reacted with this emoji, remove it. Otherwise, add it.
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

    if (existingReactionIndex !== -1) {
      // Remove the reaction
      reactions.splice(existingReactionIndex, 1);
    } else {
      // Add the reaction
      reactions.push({ emoji, userId: user.id });
    }

    // Update message
    await prisma.message.update({
      where: { id: messageId },
      data: {
        reactions: reactions.length > 0 ? JSON.stringify(reactions) : null,
      },
    });

    revalidatePath("/messages");

    return { success: true };
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return { error: "Failed to toggle reaction" };
  }
}
