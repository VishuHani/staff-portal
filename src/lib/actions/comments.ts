"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess, canAccessVenue } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import {
  createCommentSchema,
  updateCommentSchema,
  deleteCommentSchema,
  type CreateCommentInput,
  type UpdateCommentInput,
  type DeleteCommentInput,
} from "@/lib/schemas/posts";
import { notifyPostMention, notifyMessageReply } from "@/lib/services/notifications";

/**
 * Helper function to extract @mentions from comment content
 */
function extractMentions(content: string): string[] {
  const mentionRegex = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  const matches = content.matchAll(mentionRegex);
  const emails = Array.from(matches, (match) => match[1]);
  return [...new Set(emails)]; // Remove duplicates
}

/**
 * Get comments for a post (returns hierarchical structure with replies)
 */
export async function getCommentsByPostId(postId: string) {
  const user = await requireAuth();

  try {
    // Get all comments for the post
    const allComments = await prisma.comment.findMany({
      where: { postId },
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
      orderBy: {
        createdAt: "asc",
      },
    });

    // Build hierarchical structure
    const commentMap = new Map();
    const topLevelComments: any[] = [];

    // First pass: create map of all comments
    allComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    // Second pass: build hierarchy
    allComments.forEach((comment) => {
      const commentWithReplies = commentMap.get(comment.id);
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies.push(commentWithReplies);
        }
      } else {
        topLevelComments.push(commentWithReplies);
      }
    });

    return { success: true, comments: topLevelComments };
  } catch (error) {
    console.error("Error fetching comments:", error);
    return { error: "Failed to fetch comments" };
  }
}

/**
 * Create a new comment
 */
export async function createComment(data: CreateCommentInput) {
  const user = await requireAuth();

  // Check if user has permission to create comments
  const hasAccess = await canAccess("posts", "create");
  if (!hasAccess) {
    return { error: "You don't have permission to comment" };
  }

  const validatedFields = createCommentSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { postId, parentId, content } = validatedFields.data;

  try {
    // Verify post exists
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: {
        channelId: true,
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

    // If this is a reply, verify parent comment exists
    let parentComment = null;
    if (parentId) {
      parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        include: {
          user: {
            select: {
              id: true,
            },
          },
        },
      });

      if (!parentComment) {
        return { error: "Parent comment not found" };
      }
    }

    const comment = await prisma.comment.create({
      data: {
        postId,
        parentId: parentId || null,
        userId: user.id,
        content,
      },
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
    });

    // Extract mentions and notify mentioned users
    const mentionedEmails = extractMentions(content);
    const notifiedUserIds = new Set<string>();

    if (mentionedEmails.length > 0) {
      // VENUE FILTERING: Only allow mentions of users in shared venues
      const sharedVenueUserIds = await getSharedVenueUsers(user.id);

      // Get mentioned users (filtered by shared venues)
      const mentionedUsers = await prisma.user.findMany({
        where: {
          email: {
            in: mentionedEmails,
          },
          id: {
            in: sharedVenueUserIds,
          },
        },
        select: {
          id: true,
          email: true,
        },
      });

      // Notify mentioned users using notification service
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.id !== user.id) {
          await notifyPostMention(
            mentionedUser.id,
            user.id,
            postId,
            post.channelId,
            user.email
          );
          notifiedUserIds.add(mentionedUser.id);
        }
      }
    }

    // Create notification for parent comment author or post author
    if (parentComment && parentComment.user.id !== user.id && !notifiedUserIds.has(parentComment.user.id)) {
      // Notify parent comment author for replies
      await notifyMessageReply(
        parentComment.user.id,
        user.id,
        comment.id,
        post.channelId,
        user.email
      );
    } else if (!parentId && post.author.id !== user.id && !notifiedUserIds.has(post.author.id)) {
      // Notify post author for top-level comments
      await notifyMessageReply(
        post.author.id,
        user.id,
        comment.id,
        post.channelId,
        user.email
      );
    }

    revalidatePath("/posts");

    return { success: true, comment };
  } catch (error) {
    console.error("Error creating comment:", error);
    return { error: "Failed to create comment" };
  }
}

/**
 * Update a comment (own comments only)
 */
export async function updateComment(data: UpdateCommentInput) {
  const user = await requireAuth();

  const validatedFields = updateCommentSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id, content } = validatedFields.data;

  try {
    // Check if comment exists and user owns it
    const existingComment = await prisma.comment.findUnique({
      where: { id },
    });

    if (!existingComment) {
      return { error: "Comment not found" };
    }

    if (existingComment.userId !== user.id) {
      return { error: "You can only edit your own comments" };
    }

    const comment = await prisma.comment.update({
      where: { id },
      data: {
        content,
        edited: true,
        editedAt: new Date(),
      },
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
    });

    revalidatePath("/posts");

    return { success: true, comment };
  } catch (error) {
    console.error("Error updating comment:", error);
    return { error: "Failed to update comment" };
  }
}

/**
 * Delete a comment (own comments or admin/manager)
 * ENHANCED: Now uses venue-scoped permissions
 */
export async function deleteComment(data: DeleteCommentInput) {
  const user = await requireAuth();

  const validatedFields = deleteCommentSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id } = validatedFields.data;

  try {
    const existingComment = await prisma.comment.findUnique({
      where: { id },
      include: {
        post: {
          include: {
            channel: {
              include: {
                venues: true,
              },
            },
          },
        },
      },
    });

    if (!existingComment) {
      return { error: "Comment not found" };
    }

    // Check if user owns the comment or has moderate permission at the channel's venues
    if (existingComment.userId !== user.id) {
      // VENUE-SCOPED PERMISSION CHECK: Check if user can moderate at ANY of the channel's venues
      let hasModeratePermission = false;

      for (const channelVenue of existingComment.post.channel.venues) {
        if (await canAccessVenue("posts", "moderate", channelVenue.venueId)) {
          hasModeratePermission = true;
          break;
        }
      }

      if (!hasModeratePermission) {
        return { error: "You don't have permission to delete this comment" };
      }
    }

    await prisma.comment.delete({
      where: { id },
    });

    revalidatePath("/posts");

    return { success: true };
  } catch (error) {
    console.error("Error deleting comment:", error);
    return { error: "Failed to delete comment" };
  }
}

/**
 * Get all participants in a post (post author + all commenters)
 */
export async function getPostParticipants(postId: string) {
  const user = await requireAuth();

  try {
    // VENUE FILTERING: Get users in shared venues
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: {
          select: {
            id: true,
            email: true,
            // PROFILE FIELDS: Include name and avatar
            firstName: true,
            lastName: true,
            profileImage: true,
          },
        },
        comments: {
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

    if (!post) {
      return { error: "Post not found" };
    }

    // VENUE FILTERING: Check if user has access to this post
    if (!sharedVenueUserIds.includes(post.author.id)) {
      return { error: "Post not found" };
    }

    type Participant = {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      profileImage: string | null;
    };

    // Collect all unique participants
    const participantsMap = new Map<string, Participant>();

    // Add post author
    participantsMap.set(post.author.id, post.author);

    // Add all commenters (only those in shared venues)
    post.comments.forEach((comment) => {
      if (sharedVenueUserIds.includes(comment.user.id)) {
        participantsMap.set(comment.user.id, comment.user);
      }
    });

    // Convert to array and exclude current user
    const participants = Array.from(participantsMap.values()).filter(
      (p) => p.id !== user.id
    );

    return { success: true, participants };
  } catch (error) {
    console.error("Error fetching post participants:", error);
    return { error: "Failed to fetch participants" };
  }
}

/**
 * Get my comments
 */
export async function getMyComments() {
  const user = await requireAuth();

  try {
    const comments = await prisma.comment.findMany({
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
      take: 10,
    });

    return { success: true, comments };
  } catch (error) {
    console.error("Error fetching my comments:", error);
    return { error: "Failed to fetch your comments" };
  }
}
