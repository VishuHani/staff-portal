"use server";

import {
  actionFailure,
  actionSuccess,
  logActionError,
  revalidatePaths,
  type ActionResult,
} from "@/lib/utils/action-contract";
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

type PostListPayload = {
  posts: any[];
};

type PostPayload = {
  post: any;
};

type PostStatsPayload = {
  stats: {
    totalPosts: number;
    myPosts: number;
    myComments: number;
  };
};

/**
 * Helper: Check if user has permission to perform action in channel
 */
async function checkChannelPermission(
  userId: string,
  channelId: string,
  permissionKey: keyof Omit<ChannelPermissions, "isReadOnly" | "requiresApproval">
): Promise<{ allowed: boolean; error?: string; role?: string | null }> {
  const accessibleChannelIds = await getAccessibleChannelIds(userId);
  if (!accessibleChannelIds.includes(channelId)) {
    return { allowed: false, error: "Channel not found" };
  }

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
 * Filtered by venues: Users see their own posts + posts from authors in shared venues
 * Filtered by channels: Users see posts from accessible channels (venue-assigned or public)
 * 
 * FIX: Users can now see their own posts (previously excluded due to getSharedVenueUsers excluding self)
 */
export async function getPosts(
  filters?: FilterPostsInput
): Promise<ActionResult<PostListPayload>> {
  const user = await requireAuth();

  try {
    const validatedFilters = filters
      ? filterPostsSchema.parse(filters)
      : { limit: 20 };

    // Get users in shared venues for venue filtering
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Get accessible channels for venue-based channel filtering
    const accessibleChannelIds = await getAccessibleChannelIds(user.id);

    // Build the base filter conditions
    const buildWhereClause = () => {
      const channelIds = validatedFilters.channelId
        ? accessibleChannelIds.includes(validatedFilters.channelId)
          ? [validatedFilters.channelId]
          : []
        : accessibleChannelIds;

      // If specific channelId filter is provided, use simpler logic
      if (validatedFilters.channelId) {
        return {
          channelId: { in: channelIds },
          OR: [
            // User's own posts in this channel
            { authorId: user.id },
            // Posts from shared venue users in this channel
            { authorId: { in: sharedVenueUserIds } },
          ],
          ...(validatedFilters.authorId && {
            authorId: validatedFilters.authorId,
          }),
          ...(validatedFilters.pinned !== undefined && {
            pinned: validatedFilters.pinned,
          }),
        };
      }

      // General case: show posts from accessible channels
      return {
        channelId: { in: channelIds },
        OR: [
          // User's own posts in any accessible channel
          { authorId: user.id },
          // Posts from shared venue users in accessible channels
          { authorId: { in: sharedVenueUserIds } },
        ],
        ...(validatedFilters.authorId && {
          authorId: validatedFilters.authorId,
        }),
        ...(validatedFilters.pinned !== undefined && {
          pinned: validatedFilters.pinned,
        }),
      };
    };

    const posts = await prisma.post.findMany({
      where: buildWhereClause(),
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

    return actionSuccess({ posts });
  } catch (error) {
    logActionError("getPosts", error);
    return actionFailure("Failed to fetch posts");
  }
}

/**
 * Get a single post by ID with full details
 */
export async function getPostById(
  id: string
): Promise<ActionResult<PostPayload>> {
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
      return actionFailure("Post not found");
    }

    // VENUE FILTERING: Check if user has access to this post
    // FIX: Users can always access their own posts
    const isOwnPost = post.authorId === user.id;
    const hasVenueAccess = sharedVenueUserIds.includes(post.authorId);
    const accessibleChannelIds = await getAccessibleChannelIds(user.id);
    const hasChannelAccess = accessibleChannelIds.includes(post.channelId);
    
    if (!hasChannelAccess || (!isOwnPost && !hasVenueAccess)) {
      return actionFailure("Post not found");
    }

    return actionSuccess({ post });
  } catch (error) {
    logActionError("getPostById", error);
    return actionFailure("Failed to fetch post");
  }
}

/**
 * Create a new post
 */
export async function createPost(
  data: CreatePostInput
): Promise<ActionResult<PostPayload>> {
  const user = await requireAuth();

  // Check if user has permission to create posts
  const hasAccess = await canAccess("posts", "create");
  if (!hasAccess) {
    return actionFailure("You don't have permission to create posts");
  }

  const validatedFields = createPostSchema.safeParse(data);
  if (!validatedFields.success) {
    logActionError("createPost", validatedFields.error.flatten(), {
      validation: true,
    });
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
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
      return actionFailure(permissionCheck.error || "Permission denied");
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

    revalidatePaths("/posts");

    return actionSuccess({ post });
  } catch (error) {
    logActionError("createPost", error);
    return actionFailure("Failed to create post");
  }
}

/**
 * Update a post (own posts only)
 */
export async function updatePost(
  data: UpdatePostInput
): Promise<ActionResult<PostPayload>> {
  const user = await requireAuth();

  const validatedFields = updatePostSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
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
      return actionFailure("Post not found");
    }

    // Update own posts only. Cross-user edits are denied even if the channel would allow them.
    if (existingPost.authorId !== user.id) {
      return actionFailure("You can only edit your own posts");
    }

    // Check channel permission for own edits
    const permissionCheck = await checkChannelPermission(
      user.id,
      existingPost.channelId,
      "canEditOwnPosts"
    );

    if (!permissionCheck.allowed) {
      return actionFailure(permissionCheck.error || "Permission denied");
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

    revalidatePaths("/posts");

    return actionSuccess({ post });
  } catch (error) {
    logActionError("updatePost", error);
    return actionFailure("Failed to update post");
  }
}

/**
 * Delete a post (own posts or admin/manager)
 */
export async function deletePost(data: DeletePostInput) {
  const user = await requireAuth();

  const validatedFields = deletePostSchema.safeParse(data);
  if (!validatedFields.success) {
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
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
      return actionFailure("Post not found");
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
      return actionFailure(permissionCheck.error || "Permission denied");
    }

    await prisma.post.delete({
      where: { id },
    });

    revalidatePaths("/posts");

    return actionSuccess({});
  } catch (error) {
    logActionError("deletePost", error);
    return actionFailure("Failed to delete post");
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
    return actionFailure(
      validatedFields.error.issues[0]?.message || "Invalid fields"
    );
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
      return actionFailure("Post not found");
    }

    // Check channel permission to pin posts
    const permissionCheck = await checkChannelPermission(
      user.id,
      existingPost.channelId,
      "canPinPosts"
    );

    if (!permissionCheck.allowed) {
      return actionFailure(permissionCheck.error || "Permission denied");
    }

    const post = await prisma.post.update({
      where: { id },
      data: { pinned },
    });

    revalidatePaths("/posts");

    return actionSuccess({ post });
  } catch (error) {
    logActionError("pinPost", error);
    return actionFailure("Failed to pin post");
  }
}

/**
 * Get posts by current user
 */
export async function getMyPosts(): Promise<ActionResult<PostListPayload>> {
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

    return actionSuccess({ posts });
  } catch (error) {
    logActionError("getMyPosts", error);
    return actionFailure("Failed to fetch your posts");
  }
}

/**
 * Get post statistics
 */
export async function getPostStats(): Promise<ActionResult<PostStatsPayload>> {
  const user = await requireAuth();

  try {
    // Get users in shared venues for venue filtering
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    const accessibleChannelIds = await getAccessibleChannelIds(user.id);

    const [totalPosts, myPosts, totalComments] = await Promise.all([
      // VENUE FILTERING: Only count posts from users in shared venues
      prisma.post.count({
        where: {
          channelId: { in: accessibleChannelIds },
          authorId: { in: sharedVenueUserIds },
        },
      }),
      prisma.post.count({ where: { authorId: user.id } }),
      prisma.comment.count({ where: { userId: user.id } }),
    ]);

    return actionSuccess({
      stats: {
        totalPosts,
        myPosts,
        myComments: totalComments,
      },
    });
  } catch (error) {
    logActionError("getPostStats", error);
    return actionFailure("Failed to fetch statistics");
  }
}

/**
 * Mark a post as read by the current user
 */
export async function markPostAsRead(postId: string) {
  const user = await requireAuth();

  try {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { channelId: true },
    });

    if (!post) {
      return actionFailure("Post not found");
    }

    const accessibleChannelIds = await getAccessibleChannelIds(user.id);
    if (!accessibleChannelIds.includes(post.channelId)) {
      return actionFailure("Post not found");
    }

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
    revalidatePaths("/posts");

    return actionSuccess({});
  } catch (error) {
    logActionError("markPostAsRead", error);
    return actionFailure("Failed to mark post as read");
  }
}

/**
 * Mark multiple posts as read (bulk operation)
 */
export async function markPostsAsRead(postIds: string[]) {
  const user = await requireAuth();

  try {
    const accessibleChannelIds = await getAccessibleChannelIds(user.id);
    const posts = await prisma.post.findMany({
      where: {
        id: { in: postIds },
      },
      select: {
        id: true,
        channelId: true,
      },
    });

    if (posts.length !== postIds.length) {
      return actionFailure("Post not found");
    }

    const hasInaccessiblePost = posts.some(
      (post) => !accessibleChannelIds.includes(post.channelId)
    );
    if (hasInaccessiblePost) {
      return actionFailure("Post not found");
    }

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

    revalidatePaths("/posts");

    return actionSuccess({});
  } catch (error) {
    logActionError("markPostsAsRead", error);
    return actionFailure("Failed to mark posts as read");
  }
}

/**
 * Get unread count for a specific channel
 */
export async function getUnreadCountForChannel(
  channelId: string
): Promise<ActionResult<{ unreadCount: number }>> {
  const user = await requireAuth();

  try {
    const accessibleChannelIds = await getAccessibleChannelIds(user.id);
    if (!accessibleChannelIds.includes(channelId)) {
      return actionFailure("Channel not found");
    }

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

    return actionSuccess({ unreadCount });
  } catch (error) {
    logActionError("getUnreadCountForChannel", error);
    return actionFailure("Failed to get unread count");
  }
}
