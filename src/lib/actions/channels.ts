"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getAccessibleChannelIds } from "@/lib/utils/venue";
import {
  createChannelSchema,
  updateChannelSchema,
  archiveChannelSchema,
  deleteChannelSchema,
  filterChannelsSchema,
  type CreateChannelInput,
  type UpdateChannelInput,
  type ArchiveChannelInput,
  type DeleteChannelInput,
  type FilterChannelsInput,
} from "@/lib/schemas/channels";

/**
 * Get all channels (filtered) with unread counts
 * Filtered by venues: Users only see channels assigned to their venues
 */
export async function getChannels(filters?: FilterChannelsInput) {
  const user = await requireAuth();

  try {
    const validatedFilters = filters
      ? filterChannelsSchema.parse(filters)
      : { includeArchived: false };

    // Get accessible channels for venue-based filtering
    const accessibleChannelIds = await getAccessibleChannelIds(user.id);

    const channels = await prisma.channel.findMany({
      where: {
        // VENUE FILTERING: Only show channels accessible to user's venues
        id: {
          in: accessibleChannelIds,
        },
        ...(validatedFilters.type && { type: validatedFilters.type }),
        ...(validatedFilters.includeArchived === false && { archived: false }),
      },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
        venues: {
          include: {
            venue: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
      },
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    });

    // Get unread counts for each channel
    const channelsWithUnread = await Promise.all(
      channels.map(async (channel) => {
        const unreadCount = await prisma.post.count({
          where: {
            channelId: channel.id,
            reads: {
              none: {
                userId: user.id,
              },
            },
          },
        });

        return {
          ...channel,
          unreadCount,
        };
      })
    );

    return { success: true, channels: channelsWithUnread };
  } catch (error) {
    console.error("Error fetching channels:", error);
    return { error: "Failed to fetch channels" };
  }
}

/**
 * Get a single channel by ID
 */
export async function getChannelById(id: string) {
  await requireAuth();

  try {
    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    if (!channel) {
      return { error: "Channel not found" };
    }

    return { success: true, channel };
  } catch (error) {
    console.error("Error fetching channel:", error);
    return { error: "Failed to fetch channel" };
  }
}

/**
 * Create a new channel (Admin/Manager only)
 */
export async function createChannel(data: CreateChannelInput) {
  const user = await requireAuth();

  // Check permissions
  const hasAccess = await canAccess("posts", "manage");
  if (!hasAccess) {
    return { error: "You don't have permission to create channels" };
  }

  const validatedFields = createChannelSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { name, description, type, icon, color, permissions, venueIds } =
    validatedFields.data;

  try {
    // Check if channel name already exists
    const existing = await prisma.channel.findUnique({
      where: { name },
    });

    if (existing) {
      return { error: "A channel with this name already exists" };
    }

    // Create channel with venue assignments
    const channel = await prisma.channel.create({
      data: {
        name,
        description,
        type,
        icon,
        color,
        permissions,
      },
    });

    // If venueIds are provided, create ChannelVenue assignments
    if (venueIds && venueIds.length > 0) {
      await prisma.channelVenue.createMany({
        data: venueIds.map((venueId) => ({
          channelId: channel.id,
          venueId,
        })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/posts");
    revalidatePath("/admin/channels");

    return { success: true, channel };
  } catch (error) {
    console.error("Error creating channel:", error);
    return { error: "Failed to create channel" };
  }
}

/**
 * Update a channel (Admin/Manager only)
 */
export async function updateChannel(data: UpdateChannelInput) {
  const user = await requireAuth();

  const hasAccess = await canAccess("posts", "manage");
  if (!hasAccess) {
    return { error: "You don't have permission to update channels" };
  }

  const validatedFields = updateChannelSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id, venueIds, ...updateData } = validatedFields.data;

  try {
    // Check if channel exists
    const existing = await prisma.channel.findUnique({
      where: { id },
    });

    if (!existing) {
      return { error: "Channel not found" };
    }

    // If updating name, check for duplicates
    if (updateData.name && updateData.name !== existing.name) {
      const duplicate = await prisma.channel.findUnique({
        where: { name: updateData.name },
      });

      if (duplicate) {
        return { error: "A channel with this name already exists" };
      }
    }

    // Update channel
    const channel = await prisma.channel.update({
      where: { id },
      data: updateData,
    });

    // If venueIds are provided, update venue assignments
    if (venueIds && venueIds.length > 0) {
      // Delete existing assignments
      await prisma.channelVenue.deleteMany({
        where: { channelId: id },
      });

      // Create new assignments
      await prisma.channelVenue.createMany({
        data: venueIds.map((venueId) => ({
          channelId: id,
          venueId,
        })),
        skipDuplicates: true,
      });
    }

    revalidatePath("/posts");
    revalidatePath("/admin/channels");

    return { success: true, channel };
  } catch (error) {
    console.error("Error updating channel:", error);
    return { error: "Failed to update channel" };
  }
}

/**
 * Archive/unarchive a channel (Admin/Manager only)
 */
export async function archiveChannel(data: ArchiveChannelInput) {
  const user = await requireAuth();

  const hasAccess = await canAccess("posts", "manage");
  if (!hasAccess) {
    return { error: "You don't have permission to archive channels" };
  }

  const validatedFields = archiveChannelSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id, archived } = validatedFields.data;

  try {
    const channel = await prisma.channel.update({
      where: { id },
      data: {
        archived,
        archivedAt: archived ? new Date() : null,
      },
    });

    revalidatePath("/posts");
    revalidatePath("/admin/channels");

    return { success: true, channel };
  } catch (error) {
    console.error("Error archiving channel:", error);
    return { error: "Failed to archive channel" };
  }
}

/**
 * Delete a channel (Admin only)
 */
export async function deleteChannel(data: DeleteChannelInput) {
  const user = await requireAuth();

  const hasAccess = await canAccess("posts", "manage");
  if (!hasAccess) {
    return { error: "You don't have permission to delete channels" };
  }

  const validatedFields = deleteChannelSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { id } = validatedFields.data;

  try {
    // Check if channel has posts
    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            posts: true,
          },
        },
      },
    });

    if (!channel) {
      return { error: "Channel not found" };
    }

    if (channel._count.posts > 0) {
      return {
        error: `Cannot delete channel with ${channel._count.posts} posts. Archive it instead.`,
      };
    }

    await prisma.channel.delete({
      where: { id },
    });

    revalidatePath("/posts");
    revalidatePath("/admin/channels");

    return { success: true };
  } catch (error) {
    console.error("Error deleting channel:", error);
    return { error: "Failed to delete channel" };
  }
}
