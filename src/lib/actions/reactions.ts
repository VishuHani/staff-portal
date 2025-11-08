"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import {
  addReactionSchema,
  removeReactionSchema,
  type AddReactionInput,
  type RemoveReactionInput,
} from "@/lib/schemas/posts";

/**
 * Get reactions for a post
 */
export async function getReactionsByPostId(postId: string) {
  const user = await requireAuth();

  try {
    const reactions = await prisma.reaction.findMany({
      where: { postId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          hasReacted: false,
        };
      }

      acc[reaction.emoji].count++;
      acc[reaction.emoji].users.push({
        id: reaction.user.id,
        email: reaction.user.email,
      });

      if (reaction.userId === user.id) {
        acc[reaction.emoji].hasReacted = true;
      }

      return acc;
    }, {} as Record<string, { emoji: string; count: number; users: { id: string; email: string }[]; hasReacted: boolean }>);

    return {
      success: true,
      reactions: Object.values(groupedReactions),
    };
  } catch (error) {
    console.error("Error fetching reactions:", error);
    return { error: "Failed to fetch reactions" };
  }
}

/**
 * Add a reaction to a post
 */
export async function addReaction(data: AddReactionInput) {
  const user = await requireAuth();

  // Check if user has permission to react
  const hasAccess = await canAccess("posts", "create");
  if (!hasAccess) {
    return { error: "You don't have permission to react to posts" };
  }

  const validatedFields = addReactionSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { postId, emoji } = validatedFields.data;

  try {
    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!post) {
      return { error: "Post not found" };
    }

    // Check if user already reacted with this emoji
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        postId_userId_emoji: {
          postId,
          userId: user.id,
          emoji,
        },
      },
    });

    if (existingReaction) {
      return { error: "You've already reacted with this emoji" };
    }

    const reaction = await prisma.reaction.create({
      data: {
        postId,
        userId: user.id,
        emoji,
      },
    });

    // Create notification for post author (if not reacting to own post)
    if (post.author.id !== user.id) {
      await prisma.notification.create({
        data: {
          userId: post.author.id,
          type: "REACTION",
          title: "New reaction on your post",
          message: `${user.email} reacted with ${emoji}`,
          link: `/posts?postId=${postId}`,
        },
      });
    }

    revalidatePath("/posts");

    return { success: true, reaction };
  } catch (error) {
    console.error("Error adding reaction:", error);
    return { error: "Failed to add reaction" };
  }
}

/**
 * Remove a reaction from a post
 */
export async function removeReaction(data: RemoveReactionInput) {
  const user = await requireAuth();

  const validatedFields = removeReactionSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { postId, emoji } = validatedFields.data;

  try {
    // Find the reaction
    const reaction = await prisma.reaction.findUnique({
      where: {
        postId_userId_emoji: {
          postId,
          userId: user.id,
          emoji,
        },
      },
    });

    if (!reaction) {
      return { error: "Reaction not found" };
    }

    await prisma.reaction.delete({
      where: {
        id: reaction.id,
      },
    });

    revalidatePath("/posts");

    return { success: true };
  } catch (error) {
    console.error("Error removing reaction:", error);
    return { error: "Failed to remove reaction" };
  }
}

/**
 * Toggle a reaction (add if doesn't exist, remove if exists)
 */
export async function toggleReaction(data: AddReactionInput) {
  const user = await requireAuth();

  const validatedFields = addReactionSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { postId, emoji } = validatedFields.data;

  try {
    // Check if reaction exists
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        postId_userId_emoji: {
          postId,
          userId: user.id,
          emoji,
        },
      },
    });

    if (existingReaction) {
      // Remove reaction
      await prisma.reaction.delete({
        where: {
          id: existingReaction.id,
        },
      });

      revalidatePath("/posts");

      return { success: true, action: "removed" as const };
    } else {
      // Add reaction
      const result = await addReaction(data);
      return { ...result, action: "added" as const };
    }
  } catch (error) {
    console.error("Error toggling reaction:", error);
    return { error: "Failed to toggle reaction" };
  }
}

/**
 * Get my reactions
 */
export async function getMyReactions() {
  const user = await requireAuth();

  try {
    const reactions = await prisma.reaction.findMany({
      where: { userId: user.id },
      include: {
        post: {
          select: {
            id: true,
            content: true,
            channel: {
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
      take: 20,
    });

    return { success: true, reactions };
  } catch (error) {
    console.error("Error fetching my reactions:", error);
    return { error: "Failed to fetch your reactions" };
  }
}

/**
 * Get reactions for a comment
 */
export async function getReactionsByCommentId(commentId: string) {
  const user = await requireAuth();

  try {
    const reactions = await prisma.reaction.findMany({
      where: { commentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    });

    // Group reactions by emoji
    const groupedReactions = reactions.reduce((acc, reaction) => {
      if (!acc[reaction.emoji]) {
        acc[reaction.emoji] = {
          emoji: reaction.emoji,
          count: 0,
          users: [],
          hasReacted: false,
        };
      }

      acc[reaction.emoji].count++;
      acc[reaction.emoji].users.push({
        id: reaction.user.id,
        email: reaction.user.email,
      });

      if (reaction.userId === user.id) {
        acc[reaction.emoji].hasReacted = true;
      }

      return acc;
    }, {} as Record<string, { emoji: string; count: number; users: { id: string; email: string }[]; hasReacted: boolean }>);

    return {
      success: true,
      reactions: Object.values(groupedReactions),
    };
  } catch (error) {
    console.error("Error fetching comment reactions:", error);
    return { error: "Failed to fetch comment reactions" };
  }
}

/**
 * Toggle a reaction on a comment (add if doesn't exist, remove if exists)
 */
export async function toggleCommentReaction(data: { commentId: string; emoji: string }) {
  const user = await requireAuth();

  // Check if user has permission to react
  const hasAccess = await canAccess("posts", "create");
  if (!hasAccess) {
    return { error: "You don't have permission to react to comments" };
  }

  const { commentId, emoji } = data;

  try {
    // Verify comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        user: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!comment) {
      return { error: "Comment not found" };
    }

    // Check if reaction exists
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        commentId_userId_emoji: {
          commentId,
          userId: user.id,
          emoji,
        },
      },
    });

    if (existingReaction) {
      // Remove reaction
      await prisma.reaction.delete({
        where: {
          id: existingReaction.id,
        },
      });

      revalidatePath("/posts");

      return { success: true, action: "removed" as const };
    } else {
      // Add reaction
      const reaction = await prisma.reaction.create({
        data: {
          commentId,
          userId: user.id,
          emoji,
        },
      });

      // Create notification for comment author (if not reacting to own comment)
      if (comment.user.id !== user.id) {
        await prisma.notification.create({
          data: {
            userId: comment.user.id,
            type: "REACTION",
            title: "New reaction on your comment",
            message: `${user.email} reacted with ${emoji}`,
            link: `/posts?postId=${comment.postId}`,
          },
        });
      }

      revalidatePath("/posts");

      return { success: true, action: "added" as const, reaction };
    }
  } catch (error) {
    console.error("Error toggling comment reaction:", error);
    return { error: "Failed to toggle comment reaction" };
  }
}
