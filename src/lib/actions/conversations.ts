"use server";

import {
  actionFailure,
  actionSuccess,
  logActionError,
  revalidatePaths,
  type ActionResult,
} from "@/lib/utils/action-contract";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import {
  createConversationSchema,
  updateConversationSchema,
  addParticipantsSchema,
  removeParticipantSchema,
  muteConversationSchema,
  type CreateConversationInput,
  type UpdateConversationInput,
  type AddParticipantsInput,
  type RemoveParticipantInput,
  type MuteConversationInput,
} from "@/lib/schemas/messages";

type FieldErrors = Record<string, string[] | undefined>;

/**
 * Get all conversations for the current user
 */
export async function getConversations(
  limit = 50
): Promise<
  ActionResult<{ conversations: Awaited<ReturnType<typeof prisma.conversation.findMany>> }>
> {
  const user = await requireAuth();

  // Use "send" permission - if you can send messages, you can view your conversations
  const hasAccess = await canAccess("messages", "send");
  if (!hasAccess) {
    return actionFailure("You don't have permission to view messages");
  }

  try {
    // VENUE FILTERING: Get users in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const conversations = await prisma.conversation.findMany({
      where: {
        participants: {
          some: {
            userId: user.id,
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                // PROFILE FIELDS: Include name and avatar
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
        },
        messages: {
          orderBy: {
            createdAt: "desc",
          },
          take: 1, // Get last message
          include: {
            sender: {
              select: {
                id: true,
                email: true,
                // PROFILE FIELDS: Include name and avatar
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
      },
      orderBy: {
        lastMessageAt: "desc",
      },
      take: limit,
    });

    // VENUE FILTERING: Filter conversations to only include those with shared venue participants
    const filteredConversations = conversations.filter((conversation) => {
      // Keep conversation if at least one other participant (besides current user) is in shared venues
      const otherParticipants = conversation.participants.filter(
        (p) => p.userId !== user.id
      );
      return otherParticipants.some((p) =>
        sharedVenueUserIds.includes(p.userId)
      );
    });

    // Calculate unread count for each conversation
    const conversationsWithUnread = await Promise.all(
      filteredConversations.map(async (conversation) => {
        const participant = conversation.participants.find(
          (p) => p.userId === user.id
        );

        const unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            senderId: { not: user.id },
            createdAt: {
              gt: participant?.lastReadAt || new Date(0),
            },
          },
        });

        return {
          ...conversation,
          unreadCount,
        };
      })
    );

    return actionSuccess({ conversations: conversationsWithUnread });
  } catch (error) {
    logActionError("conversations.getConversations", error, { userId: user.id, limit });
    return actionFailure("Failed to fetch conversations");
  }
}

/**
 * Get a single conversation by ID
 */
export async function getConversationById(
  id: string
): Promise<
  ActionResult<{
    conversation: NonNullable<Awaited<ReturnType<typeof prisma.conversation.findUnique>>>;
  }>
> {
  const user = await requireAuth();

  // Use "send" permission - if you can send messages, you can view your conversations
  const hasAccess = await canAccess("messages", "send");
  if (!hasAccess) {
    return actionFailure("You don't have permission to view messages");
  }

  try {
    // VENUE FILTERING: Get users in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                // PROFILE FIELDS: Include name and avatar
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
        },
      },
    });

    if (!conversation) {
      return actionFailure("Conversation not found");
    }

    // Check if user is a participant
    const isParticipant = conversation.participants.some(
      (p) => p.userId === user.id
    );

    if (!isParticipant) {
      return actionFailure("You don't have access to this conversation");
    }

    // VENUE FILTERING: Check if at least one other participant is in shared venues
    const otherParticipants = conversation.participants.filter(
      (p) => p.userId !== user.id
    );
    const hasSharedVenueParticipants = otherParticipants.some((p) =>
      sharedVenueUserIds.includes(p.userId)
    );

    if (!hasSharedVenueParticipants) {
      return actionFailure("You don't have access to this conversation");
    }

    return actionSuccess({ conversation });
  } catch (error) {
    logActionError("conversations.getConversationById", error, { userId: user.id, conversationId: id });
    return actionFailure("Failed to fetch conversation");
  }
}

/**
 * Find or create a 1-on-1 conversation
 */
export async function findOrCreateConversation(
  otherUserId: string
): Promise<
  ActionResult<{
    conversation:
      | NonNullable<Awaited<ReturnType<typeof prisma.conversation.findUnique>>>
      | Awaited<ReturnType<typeof prisma.conversation.create>>;
  }>
> {
  const user = await requireAuth();

  // Use "send" permission - if you can send messages, you can start conversations
  const hasAccess = await canAccess("messages", "send");
  if (!hasAccess) {
    return actionFailure("You don't have permission to create conversations");
  }

  try {
    // VENUE FILTERING: Validate that other user is in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    if (!sharedVenueUserIds.includes(otherUserId)) {
      return actionFailure("You can only create conversations with users in your venues");
    }

    // Check if conversation already exists
    const existingConversation = await prisma.conversation.findFirst({
      where: {
        type: "ONE_ON_ONE",
        participants: {
          every: {
            OR: [{ userId: user.id }, { userId: otherUserId }],
          },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                // PROFILE FIELDS: Include name and avatar
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
        },
      },
    });

    if (existingConversation) {
      return actionSuccess({ conversation: existingConversation });
    }

    // Create new conversation
    const conversation = await prisma.conversation.create({
      data: {
        type: "ONE_ON_ONE",
        participants: {
          create: [{ userId: user.id }, { userId: otherUserId }],
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                // PROFILE FIELDS: Include name and avatar
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
        },
      },
    });

    revalidatePaths("/messages");

    return actionSuccess({ conversation });
  } catch (error) {
    logActionError("conversations.findOrCreateConversation", error, { userId: user.id, otherUserId });
    return actionFailure("Failed to create conversation");
  }
}

/**
 * Create a group conversation
 */
export async function createGroupConversation(
  data: CreateConversationInput
): Promise<
  ActionResult<{
    conversation: Awaited<ReturnType<typeof prisma.conversation.create>>;
    errors: FieldErrors;
  }>
> {
  const user = await requireAuth();

  // Use "send" permission - if you can send messages, you can start conversations
  const hasAccess = await canAccess("messages", "send");
  if (!hasAccess) {
    return actionFailure("You don't have permission to create conversations");
  }

  const validatedFields = createConversationSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { participantIds, type, name } = validatedFields.data;

  if (type !== "GROUP") {
    return actionFailure("This function is only for group conversations");
  }

  if (!name) {
    return actionFailure("Group conversations must have a name");
  }

  try {
    // VENUE FILTERING: Validate all participants are in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    const invalidParticipants = participantIds.filter(
      (id) => !sharedVenueUserIds.includes(id)
    );
    if (invalidParticipants.length > 0) {
      return actionFailure(
        "You can only add users from your venues to the conversation"
      );
    }

    // Add current user to participants if not included
    const allParticipantIds = Array.from(
      new Set([user.id, ...participantIds])
    );

    const conversation = await prisma.conversation.create({
      data: {
        type,
        name,
        participants: {
          create: allParticipantIds.map((userId) => ({ userId })),
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                // PROFILE FIELDS: Include name and avatar
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
        },
      },
    });

    // Create notifications for all participants except current user
    for (const participantId of participantIds) {
      if (participantId !== user.id) {
        await prisma.notification.create({
          data: {
            userId: participantId,
            type: "NEW_MESSAGE",
            title: "Added to group conversation",
            message: `${user.email} added you to "${name}"`,
            link: `/messages?conversationId=${conversation.id}`,
          },
        });
      }
    }

    revalidatePaths("/messages");

    return actionSuccess({ conversation });
  } catch (error) {
    logActionError("conversations.createGroupConversation", error, { userId: user.id, participantIds });
    return actionFailure("Failed to create group conversation");
  }
}

/**
 * Update a conversation (name, etc.)
 */
export async function updateConversation(
  data: UpdateConversationInput
): Promise<
  ActionResult<{
    conversation: Awaited<ReturnType<typeof prisma.conversation.update>>;
    errors: FieldErrors;
  }>
> {
  const user = await requireAuth();

  const validatedFields = updateConversationSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { id, name } = validatedFields.data;

  try {
    // Check if user is a participant
    const existingConversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!existingConversation) {
      return actionFailure("Conversation not found");
    }

    const isParticipant = existingConversation.participants.some(
      (p) => p.userId === user.id
    );

    if (!isParticipant) {
      return actionFailure("You don't have access to this conversation");
    }

    const conversation = await prisma.conversation.update({
      where: { id },
      data: { name },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                // PROFILE FIELDS: Include name and avatar
                firstName: true,
                lastName: true,
                profileImage: true,
              },
            },
          },
        },
      },
    });

    revalidatePaths("/messages");

    return actionSuccess({ conversation });
  } catch (error) {
    logActionError("conversations.updateConversation", error, { userId: user.id, conversationId: id });
    return actionFailure("Failed to update conversation");
  }
}

/**
 * Delete a conversation (only for group creators or if 1-on-1)
 */
export async function deleteConversation(id: string): Promise<ActionResult> {
  const user = await requireAuth();

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return actionFailure("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId === user.id
    );

    if (!isParticipant) {
      return actionFailure("You don't have access to this conversation");
    }

    // For group conversations, only allow deletion by creator (first participant)
    // For 1-on-1, allow either participant to delete
    if (conversation.type === "GROUP") {
      const creator = conversation.participants[0];
      if (creator.userId !== user.id) {
        return actionFailure(
          "Only the conversation creator can delete group conversations"
        );
      }
    }

    await prisma.conversation.delete({
      where: { id },
    });

    revalidatePaths("/messages");

    return actionSuccess({});
  } catch (error) {
    logActionError("conversations.deleteConversation", error, { userId: user.id, conversationId: id });
    return actionFailure("Failed to delete conversation");
  }
}

/**
 * Add participants to a group conversation
 */
export async function addParticipants(
  data: AddParticipantsInput
): Promise<ActionResult<{ errors: FieldErrors }>> {
  const user = await requireAuth();

  const validatedFields = addParticipantsSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { conversationId, userIds } = validatedFields.data;

  try {
    // VENUE FILTERING: Validate all new participants are in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    const invalidUsers = userIds.filter(
      (id) => !sharedVenueUserIds.includes(id)
    );
    if (invalidUsers.length > 0) {
      return actionFailure(
        "You can only add users from your venues to the conversation"
      );
    }

    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return actionFailure("Conversation not found");
    }

    if (conversation.type !== "GROUP") {
      return actionFailure("Can only add participants to group conversations");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId === user.id
    );

    if (!isParticipant) {
      return actionFailure("You don't have access to this conversation");
    }

    // Filter out users who are already participants
    const existingParticipantIds = conversation.participants.map(
      (p) => p.userId
    );
    const newUserIds = userIds.filter(
      (id) => !existingParticipantIds.includes(id)
    );

    if (newUserIds.length === 0) {
      return actionFailure("All users are already participants");
    }

    // Add new participants
    await prisma.conversationParticipant.createMany({
      data: newUserIds.map((userId) => ({
        conversationId,
        userId,
      })),
    });

    // Create notifications for new participants
    for (const userId of newUserIds) {
      await prisma.notification.create({
        data: {
          userId,
          type: "NEW_MESSAGE",
          title: "Added to group conversation",
          message: `${user.email} added you to "${conversation.name || "a group conversation"}"`,
          link: `/messages?conversationId=${conversationId}`,
        },
      });
    }

    revalidatePaths("/messages");

    return actionSuccess({});
  } catch (error) {
    logActionError("conversations.addParticipants", error, { userId: user.id, conversationId, userIds });
    return actionFailure("Failed to add participants");
  }
}

/**
 * Remove a participant from a group conversation
 */
export async function removeParticipant(
  data: RemoveParticipantInput
): Promise<ActionResult<{ errors: FieldErrors }>> {
  const user = await requireAuth();

  const validatedFields = removeParticipantSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { conversationId, userId: targetUserId } = validatedFields.data;

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return actionFailure("Conversation not found");
    }

    if (conversation.type !== "GROUP") {
      return actionFailure("Can only remove participants from group conversations");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId === user.id
    );

    if (!isParticipant) {
      return actionFailure("You don't have access to this conversation");
    }

    // Creator can remove anyone, others can only remove themselves
    const creator = conversation.participants[0];
    if (creator.userId !== user.id && targetUserId !== user.id) {
      return actionFailure("You don't have permission to remove this participant");
    }

    await prisma.conversationParticipant.deleteMany({
      where: {
        conversationId,
        userId: targetUserId,
      },
    });

    revalidatePaths("/messages");

    return actionSuccess({});
  } catch (error) {
    logActionError("conversations.removeParticipant", error, { userId: user.id, conversationId, targetUserId });
    return actionFailure("Failed to remove participant");
  }
}

/**
 * Leave a conversation
 */
export async function leaveConversation(
  conversationId: string
): Promise<ActionResult> {
  const user = await requireAuth();

  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: true,
      },
    });

    if (!conversation) {
      return actionFailure("Conversation not found");
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId === user.id
    );

    if (!isParticipant) {
      return actionFailure("You are not a participant in this conversation");
    }

    // Remove user from participants
    await prisma.conversationParticipant.deleteMany({
      where: {
        conversationId,
        userId: user.id,
      },
    });

    revalidatePaths("/messages");

    return actionSuccess({});
  } catch (error) {
    logActionError("conversations.leaveConversation", error, { userId: user.id, conversationId });
    return actionFailure("Failed to leave conversation");
  }
}

/**
 * Mute/unmute a conversation
 */
export async function muteConversation(
  data: MuteConversationInput
): Promise<ActionResult<{ errors: FieldErrors }>> {
  const user = await requireAuth();

  const validatedFields = muteConversationSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
  }

  const { conversationId, duration } = validatedFields.data;

  try {
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId,
        userId: user.id,
      },
    });

    if (!participant) {
      return actionFailure("You are not a participant in this conversation");
    }

    // Calculate mute until time (or null to unmute)
    const mutedUntil = duration
      ? new Date(Date.now() + duration * 60 * 60 * 1000) // hours to milliseconds
      : null;

    await prisma.conversationParticipant.update({
      where: { id: participant.id },
      data: { mutedUntil },
    });

    revalidatePaths("/messages");

    return actionSuccess({});
  } catch (error) {
    logActionError("conversations.muteConversation", error, { userId: user.id, conversationId });
    return actionFailure("Failed to mute conversation");
  }
}
