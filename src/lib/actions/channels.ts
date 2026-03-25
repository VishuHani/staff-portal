"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { hasAnyPermission } from "@/lib/rbac/permissions";
import { getAccessibleChannelIds, getUserVenueIds } from "@/lib/utils/venue";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { getAuditContext } from "@/lib/utils/audit-helpers";
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
 * Determine whether the user can manage channels across all venues.
 */
async function hasGlobalChannelScope(userId: string): Promise<boolean> {
  return hasAnyPermission(userId, [
    { resource: "stores", action: "view_all" },
    { resource: "stores", action: "manage" },
    { resource: "venues", action: "view_all" },
    { resource: "venues", action: "manage" },
    { resource: "admin", action: "manage_stores" },
    { resource: "posts", action: "edit_all" },
    { resource: "posts", action: "delete_all" },
  ]);
}

async function getOwnedVenueIds(userId: string): Promise<string[]> {
  const venueIds = await getUserVenueIds(userId);
  return venueIds;
}

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
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        icon: true,
        color: true,
        archived: true,
        isPublic: true, // Include public flag for UI indicators
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
  const user = await requireAuth();

  try {
    const hasGlobalScope = await hasGlobalChannelScope(user.id);
    const userVenueIds = hasGlobalScope ? [] : await getOwnedVenueIds(user.id);

    const channel = await prisma.channel.findUnique({
      where: { id },
      include: {
        venues: {
          select: {
            venueId: true,
          },
        },
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

    if (!hasGlobalScope && !channel.isPublic) {
      const hasVenueAccess = channel.venues.some((venue) =>
        userVenueIds.includes(venue.venueId)
      );

      if (!hasVenueAccess) {
        return { error: "Channel not found" };
      }
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

  let { name, description, type, icon, color, permissions, venueIds } =
    validatedFields.data;

  try {
    const userVenueIds = await getOwnedVenueIds(user.id);
    const hasGlobalScope = await hasGlobalChannelScope(user.id);

    if (!hasGlobalScope) {
      if (userVenueIds.length === 0) {
        return { error: "You don't have permission to create channels" };
      }

      if (!venueIds || venueIds.length === 0) {
        venueIds = userVenueIds;
      } else {
        const invalidVenueIds = venueIds.filter((venueId) => !userVenueIds.includes(venueId));
        if (invalidVenueIds.length > 0) {
          return {
            error: "You don't have permission to create channels for venues you do not own",
          };
        }
      }
    }

    venueIds = venueIds ? [...new Set(venueIds)] : venueIds;

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
        createdBy: user.id,
        memberCount: 0, // Will be updated when members are added
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

    // Audit log for channel creation
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "CHANNEL_CREATED",
      resourceType: "Channel",
      resourceId: channel.id,
      newValue: JSON.stringify({
        name: channel.name,
        description: channel.description,
        type: channel.type,
        icon: channel.icon,
        color: channel.color,
        venueIds: venueIds || [],
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/posts");
    revalidatePath("/manage/channels");

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

  let { id, venueIds, ...updateData } = validatedFields.data;

  try {
    // Check if channel exists
    const existing = await prisma.channel.findUnique({
      where: { id },
      include: {
        venues: {
          select: {
            venueId: true,
          },
        },
      },
    });

    if (!existing) {
      return { error: "Channel not found" };
    }

    const hasGlobalScope = await hasGlobalChannelScope(user.id);
    const userVenueIds = hasGlobalScope ? [] : await getOwnedVenueIds(user.id);

    if (!hasGlobalScope) {
      if (userVenueIds.length === 0) {
        return { error: "Channel not found" };
      }

      const hasVenueAccess =
        existing.isPublic ||
        existing.venues.some((venue) => userVenueIds.includes(venue.venueId));

      if (!hasVenueAccess) {
        return { error: "Channel not found" };
      }
    }

    if (!hasGlobalScope && venueIds) {
      const invalidVenueIds = venueIds.filter((venueId) => !userVenueIds.includes(venueId));
      if (invalidVenueIds.length > 0) {
        return {
          error: "Channel can only be assigned to venues you own",
        };
      }
      venueIds = [...new Set(venueIds)];
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

    // Audit log for channel update
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "CHANNEL_UPDATED",
      resourceType: "Channel",
      resourceId: id,
      oldValue: JSON.stringify({
        name: existing.name,
        description: existing.description,
        type: existing.type,
        icon: existing.icon,
        color: existing.color,
      }),
      newValue: JSON.stringify({
        ...updateData,
        venueIds: venueIds || [],
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/posts");
    revalidatePath("/manage/channels");

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
    const existingChannel = await prisma.channel.findUnique({
      where: { id },
      include: {
        venues: {
          select: {
            venueId: true,
          },
        },
      },
    });

    if (!existingChannel) {
      return { error: "Channel not found" };
    }

    const hasGlobalScope = await hasGlobalChannelScope(user.id);
    if (!hasGlobalScope) {
      const userVenueIds = await getOwnedVenueIds(user.id);
      const hasVenueAccess =
        existingChannel.isPublic ||
        existingChannel.venues.some((venue) => userVenueIds.includes(venue.venueId));

      if (!hasVenueAccess) {
        return { error: "Channel not found" };
      }
    }

    const channel = await prisma.channel.update({
      where: { id },
      data: {
        archived,
        archivedAt: archived ? new Date() : null,
      },
    });

    // Audit log for channel archive/restore
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: archived ? "CHANNEL_ARCHIVED" : "CHANNEL_RESTORED",
      resourceType: "Channel",
      resourceId: id,
      oldValue: JSON.stringify({
        name: existingChannel.name,
        archived: existingChannel.archived,
      }),
      newValue: JSON.stringify({
        name: channel.name,
        archived: channel.archived,
        archivedAt: channel.archivedAt,
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/posts");
    revalidatePath("/manage/channels");

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
        venues: {
          select: {
            venueId: true,
          },
        },
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

    const hasGlobalScope = await hasGlobalChannelScope(user.id);
    if (!hasGlobalScope) {
      const userVenueIds = await getOwnedVenueIds(user.id);
      const hasVenueAccess =
        channel.isPublic ||
        channel.venues.some((venue) => userVenueIds.includes(venue.venueId));

      if (!hasVenueAccess) {
        return { error: "Channel not found" };
      }
    }

    if (channel._count.posts > 0) {
      return {
        error: `Cannot delete channel with ${channel._count.posts} posts. Archive it instead.`,
      };
    }

    await prisma.channel.delete({
      where: { id },
    });

    // Audit log for channel deletion
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "CHANNEL_DELETED",
      resourceType: "Channel",
      resourceId: id,
      oldValue: JSON.stringify({
        name: channel.name,
        description: channel.description,
        type: channel.type,
      }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/posts");
    revalidatePath("/manage/channels");

    return { success: true };
  } catch (error) {
    console.error("Error deleting channel:", error);
    return { error: "Failed to delete channel" };
  }
}
