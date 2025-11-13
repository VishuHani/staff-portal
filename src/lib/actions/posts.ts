"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess, canAccessVenue } from "@/lib/rbac/access";
import { getSharedVenueUsers, getAccessibleChannelIds } from "@/lib/utils/venue";
import {
  createPostSchema,
  updatePostSchema,
  deletePostSchema,
  pinPostSchema,
  filterPostsSchema,
  type CreatePostInput,
  type UpdatePostInput,
  type DeletePostInput,
  type PinPostInput,
  type FilterPostsInput,
} from "@/lib/schemas/posts";
import {
  parseChannelPermissions,
  hasPermissionLevel,
  type ChannelPermissions,
} from "@/lib/types/channel-permissions";

/**
 * Helper: Check if user has permission to perform action in channel
 */
async function checkChannelPermission(
  userId: string,
  channelId: string,
  permissionKey: keyof Omit<ChannelPermissions, "isReadOnly" | "requiresApproval">
): Promise<{ allowed: boolean; error?: string; role?: "CREATOR" | "MODERATOR" | "MEMBER" | null }> {
  // Get channel with permissions
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      archived: true,
      permissions: true,
      members: {
        where: { userId },
        select: { role: true },
      },
    },
  });

  if (!channel) {
    return { allowed: false, error: "Channel not found" };
  }

  if (channel.archived) {
    return { allowed: false, error: "Channel is archived" };
  }

  // Parse channel permissions
  const permissions = parseChannelPermissions(channel.permissions);

  // Check read-only mode
  if (permissions.isReadOnly && permissionKey === "canCreatePosts") {
    return { allowed: false, error: "Channel is in read-only mode" };
  }

  // Check if user is a member
  const membership = channel.members[0];
  const isMember = !!membership;
  const userRole = membership?.role || null;

  // Get required permission level
  const requiredLevel = permissions[permissionKey];

  // Check permission
  const hasPermission = hasPermissionLevel(userRole, requiredLevel, isMember);

  if (!hasPermission) {
    return {
      allowed: false,
      error: `You don't have permission to perform this action in this channel`,
      role: userRole,
    };
  }

  return { allowed: true, role: userRole };
}

/**
 * Get posts with filtering and pagination
 * Filtered by venues: Users only see posts from authors in their shared venues
 * Filtered by channels: Users only see posts from channels assigned to their venues
 */
export async function getPosts(filters?: FilterPostsInput) {
  const user = await requireAuth();

  try {
    const validatedFilters = filters
      ? filterPostsSchema.parse(filters)
      : { limit: 20 };

    // Get users in shared venues for venue filtering
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Get accessible channels for venue-based channel filtering
    const accessibleChannelIds = await getAccessibleChannelIds(user.id);

    const posts = await prisma.post.findMany({
      where: {
        // VENUE FILTERING: Only show posts from users in shared venues
        authorId: {
          in: sharedVenueUserIds,
        },
        // CHANNEL FILTERING: Only show posts from accessible channels
        channelId: {
          in: accessibleChannelIds,
        },
        ...(validatedFilters.channelId && {
          channelId: validatedFilters.channelId,
        }),
        ...(validatedFilters.authorId && {
          authorId: validatedFilters.authorId,
        }),
        ...(validatedFilters.pinned !== undefined && {
          pinned: validatedFilters.pinned,
        }),
      },
      include: {
        author: {
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
        channel: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        _count: {
          select: {
            comments: true,
            reactions: true,
          },
        },
        reactions: {
          select: {
            userId: true,
            emoji: true,
          },
        },
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      take: validatedFilters.limit,
      ...(validatedFilters.cursor && {
        cursor: {
          id: validatedFilters.cursor,
        },
        skip: 1, // Skip the cursor
      }),
    });

    return { success: true, posts };
  } catch (error) {
    console.error("Error fetching posts:", error);
    return { error: "Failed to fetch posts" };
  }
}

/**
 * Get a single post by ID with full details
 */
export async function getPostById(id: string) {
  const user = await requireAuth();

  try {
    // Get users in shared venues for venue access check
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const post = await prisma.post.findUnique({
      where: { id },
      include: {
        author: {
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
        channel: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
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
        },
        reactions: {
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
    if (!sharedVenueUserIds.includes(post.authorId)) {
      return { error: "Post not found" };
    }

    return { success: true, post };
  } catch (error) {
    console.error("Error fetching post:", error);
    return { error: "Failed to fetch post" };
  }
}

/**
 * Create a new post
 */
export async function createPost(data: CreatePostInput) {
  const user = await requireAuth();

  // Check if user has permission to create posts
  const hasAccess = await canAccess("posts", "create");
  if (!hasAccess) {
    return { error: "You don't have permission to create posts" };
  }

  const validatedFields = createPostSchema.safeParse(data);
  if (!validatedFields.success) {
    console.error("Validation error:", validatedFields.error.flatten());
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { channelId, content, mediaUrls } = validatedFields.data;

  try {
    // Check channel-level permission to create posts
    const permissionCheck = await checkChannelPermission(
      user.id,
      channelId,
      "canCreatePosts"
    );

    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "Permission denied" };
    }

    // Convert mediaUrls array to JSON string
    const mediaUrlsJson = mediaUrls ? JSON.stringify(mediaUrls) : null;

    const post = await prisma.post.create({
      data: {
        channelId,
        authorId: user.id,
        content,
        mediaUrls: mediaUrlsJson,
      },
      include: {
        author: {
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
        channel: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    revalidatePath("/posts");

    return { success: true, post };
  } catch (error) {
    console.error("Error creating post:", error);
    return { error: "Failed to create post" };
  }
}

/**
 * Update a post (own posts only)
 */
export async function updatePost(data: UpdatePostInput) {
  const user = await requireAuth();

  const validatedFields = updatePostSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id, content } = validatedFields.data;

  try {
    // Check if post exists
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        channelId: true,
      },
    });

    if (!existingPost) {
      return { error: "Post not found" };
    }

    // Check if user owns the post (for canEditOwnPosts)
    const isOwnPost = existingPost.authorId === user.id;

    // Check channel permission
    const permissionKey = isOwnPost ? "canEditOwnPosts" : "canEditAnyPosts";
    const permissionCheck = await checkChannelPermission(
      user.id,
      existingPost.channelId,
      permissionKey
    );

    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "Permission denied" };
    }

    const post = await prisma.post.update({
      where: { id },
      data: {
        content,
        edited: true,
        editedAt: new Date(),
      },
      include: {
        author: {
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
        channel: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
      },
    });

    revalidatePath("/posts");

    return { success: true, post };
  } catch (error) {
    console.error("Error updating post:", error);
    return { error: "Failed to update post" };
  }
}

/**
 * Delete a post (own posts or admin/manager)
 */
export async function deletePost(data: DeletePostInput) {
  const user = await requireAuth();

  const validatedFields = deletePostSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id } = validatedFields.data;

  try {
    // Check if post exists
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        authorId: true,
        channelId: true,
      },
    });

    if (!existingPost) {
      return { error: "Post not found" };
    }

    // Check if user owns the post (for canDeleteOwnPosts)
    const isOwnPost = existingPost.authorId === user.id;

    // Check channel permission
    const permissionKey = isOwnPost ? "canDeleteOwnPosts" : "canDeleteAnyPosts";
    const permissionCheck = await checkChannelPermission(
      user.id,
      existingPost.channelId,
      permissionKey
    );

    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "Permission denied" };
    }

    await prisma.post.delete({
      where: { id },
    });

    revalidatePath("/posts");

    return { success: true };
  } catch (error) {
    console.error("Error deleting post:", error);
    return { error: "Failed to delete post" };
  }
}

/**
 * Pin/unpin a post (admin/manager only)
 * ENHANCED: Now uses venue-scoped permissions
 */
export async function pinPost(data: PinPostInput) {
  const user = await requireAuth();

  const validatedFields = pinPostSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id, pinned } = validatedFields.data;

  try {
    // Get the post to check permissions
    const existingPost = await prisma.post.findUnique({
      where: { id },
      select: {
        id: true,
        channelId: true,
      },
    });

    if (!existingPost) {
      return { error: "Post not found" };
    }

    // Check channel permission to pin posts
    const permissionCheck = await checkChannelPermission(
      user.id,
      existingPost.channelId,
      "canPinPosts"
    );

    if (!permissionCheck.allowed) {
      return { error: permissionCheck.error || "Permission denied" };
    }

    const post = await prisma.post.update({
      where: { id },
      data: { pinned },
    });

    revalidatePath("/posts");

    return { success: true, post };
  } catch (error) {
    console.error("Error pinning post:", error);
    return { error: "Failed to pin post" };
  }
}

/**
 * Get posts by current user
 */
export async function getMyPosts() {
  const user = await requireAuth();

  try {
    const posts = await prisma.post.findMany({
      where: { authorId: user.id },
      include: {
        channel: {
          select: {
            id: true,
            name: true,
            color: true,
            icon: true,
          },
        },
        _count: {
          select: {
            comments: true,
            reactions: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return { success: true, posts };
  } catch (error) {
    console.error("Error fetching my posts:", error);
    return { error: "Failed to fetch your posts" };
  }
}

/**
 * Get post statistics
 */
export async function getPostStats() {
  const user = await requireAuth();

  try {
    // Get users in shared venues for venue filtering
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const [totalPosts, myPosts, totalComments] = await Promise.all([
      // VENUE FILTERING: Only count posts from users in shared venues
      prisma.post.count({
        where: {
          authorId: { in: sharedVenueUserIds },
        },
      }),
      prisma.post.count({ where: { authorId: user.id } }),
      prisma.comment.count({ where: { userId: user.id } }),
    ]);

    return {
      success: true,
      stats: {
        totalPosts,
        myPosts,
        myComments: totalComments,
      },
    };
  } catch (error) {
    console.error("Error fetching post stats:", error);
    return { error: "Failed to fetch statistics" };
  }
}

/**
 * Mark a post as read by the current user
 */
export async function markPostAsRead(postId: string) {
  const user = await requireAuth();

  try {
    // Use upsert to avoid duplicates
    await prisma.postRead.upsert({
      where: {
        userId_postId: {
          userId: user.id,
          postId: postId,
        },
      },
      create: {
        userId: user.id,
        postId: postId,
      },
      update: {
        readAt: new Date(),
      },
    });

    // Revalidate to update unread counts
    revalidatePath("/posts");

    return { success: true };
  } catch (error) {
    console.error("Error marking post as read:", error);
    return { error: "Failed to mark post as read" };
  }
}

/**
 * Mark multiple posts as read (bulk operation)
 */
export async function markPostsAsRead(postIds: string[]) {
  const user = await requireAuth();

  try {
    // Create read records for all posts that haven't been read yet
    const readRecords = postIds.map((postId) => ({
      userId: user.id,
      postId: postId,
      readAt: new Date(),
    }));

    // Use createMany with skipDuplicates to avoid errors
    await prisma.postRead.createMany({
      data: readRecords,
      skipDuplicates: true,
    });

    revalidatePath("/posts");

    return { success: true };
  } catch (error) {
    console.error("Error marking posts as read:", error);
    return { error: "Failed to mark posts as read" };
  }
}

/**
 * Get unread count for a specific channel
 */
export async function getUnreadCountForChannel(channelId: string) {
  const user = await requireAuth();

  try {
    // Count posts in channel that the user hasn't read
    const unreadCount = await prisma.post.count({
      where: {
        channelId: channelId,
        reads: {
          none: {
            userId: user.id,
          },
        },
      },
    });

    return { success: true, unreadCount };
  } catch (error) {
    console.error("Error getting unread count:", error);
    return { error: "Failed to get unread count" };
  }
}
