"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { createAuditLog } from "@/lib/actions/audit";
import {
  addChannelMembersSchema,
  removeChannelMembersSchema,
  updateMemberRoleSchema,
  getChannelMembersSchema,
  getUsersForChannelSchema,
  bulkAddMembersSchema,
  getChannelAnalyticsSchema,
  getManageableChannelsSchema,
  type AddChannelMembersInput,
  type RemoveChannelMembersInput,
  type UpdateMemberRoleInput,
  type GetChannelMembersInput,
  type GetUsersForChannelInput,
  type BulkAddMembersInput,
  type GetChannelAnalyticsInput,
  type GetManageableChannelsInput,
} from "@/lib/schemas/channel-members";
import { getFullName } from "@/lib/utils/profile";

/**
 * Permission Check: Can user manage channel members?
 * - Admins can manage all channels
 * - Channel creators can manage their channels
 * - Channel moderators can manage their channels
 * - Managers can manage channels where all members are from their venue(s)
 */
async function canManageChannel(
  userId: string,
  channelId: string
): Promise<{ allowed: boolean; reason?: string; isManager?: boolean }> {
  // Check if user has admin posts:manage permission
  const hasManagePermission = await canAccess("posts", "manage");
  if (hasManagePermission) {
    return { allowed: true, isManager: false };
  }

  // Check if user is creator or moderator of the channel
  const membership = await prisma.channelMember.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  });

  if (membership && ["CREATOR", "MODERATOR"].includes(membership.role)) {
    return { allowed: true, isManager: false };
  }

  // Check if user is a manager with venue-scoped access
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      venues: {
        include: {
          venue: true,
        },
      },
    },
  });

  // Check if manager role with posts:manage permission
  const isManager =
    user?.role.name === "MANAGER" &&
    user.role.rolePermissions.some(
      (rp) =>
        rp.permission.resource === "posts" && rp.permission.action === "manage"
    );

  if (isManager && user.venues.length > 0) {
    // Get manager's venue IDs
    const managerVenueIds = user.venues.map((uv) => uv.venue.id);

    // Get all channel members and check if they're all from manager's venues
    const channelMembers = await prisma.channelMember.findMany({
      where: { channelId },
      include: {
        user: {
          include: {
            venues: {
              include: {
                venue: true,
              },
            },
          },
        },
      },
    });

    // Check if all members are from manager's venues
    const allMembersInManagerVenues = channelMembers.every((member) => {
      return member.user.venues.some((uv) =>
        managerVenueIds.includes(uv.venue.id)
      );
    });

    if (allMembersInManagerVenues) {
      return { allowed: true, isManager: true };
    }
  }

  return {
    allowed: false,
    reason: "You don't have permission to manage this channel",
    isManager: false,
  };
}

/**
 * Helper: Get manager's venue IDs
 */
async function getManagerVenueIds(userId: string): Promise<string[] | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      venues: {
        include: {
          venue: true,
        },
      },
    },
  });

  if (user?.role.name === "MANAGER" && user.venues.length > 0) {
    return user.venues.map((uv) => uv.venue.id);
  }

  return null;
}

/**
 * Add members to a channel
 */
export async function addChannelMembers(data: AddChannelMembersInput) {
  const user = await requireAuth();

  const validatedFields = addChannelMembersSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { channelId, userIds, role, addedVia } = validatedFields.data;

  try {
    // Permission check
    const canManage = await canManageChannel(user.id, channelId);
    if (!canManage.allowed) {
      return { error: canManage.reason || "Permission denied" };
    }

    // Verify channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      return { error: "Channel not found" };
    }

    if (channel.archived) {
      return { error: "Cannot add members to archived channel" };
    }

    // If user is a manager, verify all users being added are from their venues
    if (canManage.isManager) {
      const managerVenueIds = await getManagerVenueIds(user.id);

      if (managerVenueIds && managerVenueIds.length > 0) {
        // Get full user details including venues
        const usersWithVenues = await prisma.user.findMany({
          where: {
            id: { in: userIds },
          },
          include: {
            venues: {
              include: {
                venue: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },
        });

        // Check if all users are from manager's venues
        const usersNotInVenues = usersWithVenues.filter((u) => {
          return !u.venues.some((uv) => managerVenueIds.includes(uv.venue.id));
        });

        if (usersNotInVenues.length > 0) {
          const userNames = usersNotInVenues
            .map((u) => getFullName(u))
            .join(", ");
          return {
            error: `As a manager, you can only add members from your venue(s). The following users are not from your venues: ${userNames}`,
          };
        }
      }
    }

    // Verify all users exist and are active
    const users = await prisma.user.findMany({
      where: {
        id: { in: userIds },
        active: true,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (users.length !== userIds.length) {
      return { error: "One or more users not found or inactive" };
    }

    // Add members (upsert to avoid duplicates)
    const membersAdded: string[] = [];
    const membersAlreadyExist: string[] = [];

    for (const userId of userIds) {
      const existing = await prisma.channelMember.findUnique({
        where: {
          channelId_userId: {
            channelId,
            userId,
          },
        },
      });

      if (existing) {
        const userName = users.find((u) => u.id === userId);
        membersAlreadyExist.push(getFullName(userName!));
        continue;
      }

      await prisma.channelMember.create({
        data: {
          channelId,
          userId,
          role,
          addedBy: user.id,
          addedVia,
        },
      });

      membersAdded.push(userId);
    }

    // Update channel member count
    const newMemberCount = await prisma.channelMember.count({
      where: { channelId },
    });

    await prisma.channel.update({
      where: { id: channelId },
      data: { memberCount: newMemberCount },
    });

    // Audit log
    await createAuditLog({
      actionType: "CHANNEL_MEMBERS_ADDED",
      resourceType: "channel",
      resourceId: channelId,
      newValue: JSON.stringify({
        addedCount: membersAdded.length,
        userIds: membersAdded,
        role,
        addedVia,
      }),
    });

    revalidatePath("/posts");
    revalidatePath("/admin/channels");

    return {
      success: true,
      membersAdded: membersAdded.length,
      membersAlreadyExist: membersAlreadyExist.length,
      existingMembers: membersAlreadyExist,
      newMemberCount,
    };
  } catch (error) {
    console.error("Error adding channel members:", error);
    return { error: "Failed to add channel members" };
  }
}

/**
 * Remove members from a channel
 */
export async function removeChannelMembers(data: RemoveChannelMembersInput) {
  const user = await requireAuth();

  const validatedFields = removeChannelMembersSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { channelId, userIds } = validatedFields.data;

  try {
    // Permission check
    const canManage = await canManageChannel(user.id, channelId);
    if (!canManage.allowed) {
      return { error: canManage.reason || "Permission denied" };
    }

    // Verify channel exists
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        members: {
          where: { role: "CREATOR" },
        },
      },
    });

    if (!channel) {
      return { error: "Channel not found" };
    }

    // Prevent removing the last creator
    const creatorsToRemove = await prisma.channelMember.count({
      where: {
        channelId,
        userId: { in: userIds },
        role: "CREATOR",
      },
    });

    const totalCreators = channel.members.length;

    if (creatorsToRemove > 0 && totalCreators - creatorsToRemove === 0) {
      return { error: "Cannot remove all creators from channel" };
    }

    // Remove members
    const result = await prisma.channelMember.deleteMany({
      where: {
        channelId,
        userId: { in: userIds },
      },
    });

    // Update channel member count
    const newMemberCount = await prisma.channelMember.count({
      where: { channelId },
    });

    await prisma.channel.update({
      where: { id: channelId },
      data: { memberCount: newMemberCount },
    });

    // Audit log
    await createAuditLog({
      actionType: "CHANNEL_MEMBERS_REMOVED",
      resourceType: "channel",
      resourceId: channelId,
      newValue: JSON.stringify({
        removedCount: result.count,
        userIds,
      }),
    });

    revalidatePath("/posts");
    revalidatePath("/admin/channels");

    return {
      success: true,
      membersRemoved: result.count,
      newMemberCount,
    };
  } catch (error) {
    console.error("Error removing channel members:", error);
    return { error: "Failed to remove channel members" };
  }
}

/**
 * Update member role in a channel
 */
export async function updateMemberRole(data: UpdateMemberRoleInput) {
  const user = await requireAuth();

  const validatedFields = updateMemberRoleSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { channelId, userId, role } = validatedFields.data;

  try {
    // Permission check
    const canManage = await canManageChannel(user.id, channelId);
    if (!canManage.allowed) {
      return { error: canManage.reason || "Permission denied" };
    }

    // Verify member exists
    const member = await prisma.channelMember.findUnique({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
    });

    if (!member) {
      return { error: "Member not found in channel" };
    }

    const oldRole = member.role;

    // If demoting from CREATOR, ensure at least one creator remains
    if (oldRole === "CREATOR" && role !== "CREATOR") {
      const creatorCount = await prisma.channelMember.count({
        where: {
          channelId,
          role: "CREATOR",
        },
      });

      if (creatorCount <= 1) {
        return { error: "Cannot demote the last creator" };
      }
    }

    // Update role
    const updatedMember = await prisma.channelMember.update({
      where: {
        channelId_userId: {
          channelId,
          userId,
        },
      },
      data: { role },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    // Audit log
    await createAuditLog({
      actionType: "CHANNEL_MEMBER_ROLE_UPDATED",
      resourceType: "channel",
      resourceId: channelId,
      oldValue: oldRole,
      newValue: role,
    });

    revalidatePath("/posts");
    revalidatePath("/admin/channels");

    return {
      success: true,
      member: updatedMember,
      message: `Updated ${getFullName(updatedMember.user)} to ${role}`,
    };
  } catch (error) {
    console.error("Error updating member role:", error);
    return { error: "Failed to update member role" };
  }
}

/**
 * Get channel members with filters
 */
export async function getChannelMembers(data: GetChannelMembersInput) {
  const user = await requireAuth();

  const validatedFields = getChannelMembersSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { channelId, role, search, limit = 50, offset = 0 } = validatedFields.data;

  try {
    // Build where clause
    const where: any = {
      channelId,
      ...(role && { role }),
    };

    // Add search filter
    if (search) {
      where.user = {
        OR: [
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    // Get members
    const [members, totalCount] = await Promise.all([
      prisma.channelMember.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              profileImage: true,
              role: {
                select: {
                  name: true,
                },
              },
              venues: {
                include: {
                  venue: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
          addedByUser: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: [
          { role: "asc" }, // CREATOR, MODERATOR, MEMBER
          { addedAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      prisma.channelMember.count({ where }),
    ]);

    return {
      success: true,
      members,
      pagination: {
        total: totalCount,
        limit,
        offset,
        hasMore: offset + limit < totalCount,
      },
    };
  } catch (error) {
    console.error("Error fetching channel members:", error);
    return { error: "Failed to fetch channel members" };
  }
}

/**
 * Get users for channel creation based on selection criteria
 */
export async function getUsersForChannel(data: GetUsersForChannelInput) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("posts", "manage");
  if (!hasAccess) {
    return { error: "You don't have permission to manage channels" };
  }

  const validatedFields = getUsersForChannelSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const {
    selectionType,
    roleIds,
    venueIds,
    userIds,
    excludeUserIds,
    activeOnly,
    search,
  } = validatedFields.data;

  try {
    let where: any = {
      ...(activeOnly && { active: true }),
      ...(excludeUserIds && { id: { notIn: excludeUserIds } }),
    };

    // If user is a manager, filter to only users from their venues
    const managerVenueIds = await getManagerVenueIds(user.id);
    if (managerVenueIds && managerVenueIds.length > 0) {
      // Manager scoping: only show users from manager's venues
      where.venues = {
        some: {
          venueId: { in: managerVenueIds },
        },
      };
    }

    // Apply selection type filters
    switch (selectionType) {
      case "all":
        // No additional filters (manager venue filter already applied above)
        break;

      case "by_role":
        if (!roleIds || roleIds.length === 0) {
          return { error: "Role IDs required for role-based selection" };
        }
        where.roleId = { in: roleIds };
        break;

      case "by_venue":
        if (!venueIds || venueIds.length === 0) {
          return { error: "Venue IDs required for venue-based selection" };
        }
        // If manager, ensure venue filter is combined with manager's venues
        if (managerVenueIds && managerVenueIds.length > 0) {
          // Intersect the requested venues with manager's venues
          const allowedVenueIds = venueIds.filter((id) =>
            managerVenueIds.includes(id)
          );
          if (allowedVenueIds.length === 0) {
            return {
              error:
                "You don't have access to the selected venue(s). Please select from your assigned venues.",
            };
          }
          where.venues = {
            some: {
              venueId: { in: allowedVenueIds },
            },
          };
        } else {
          where.venues = {
            some: {
              venueId: { in: venueIds },
            },
          };
        }
        break;

      case "by_user":
        if (!userIds || userIds.length === 0) {
          return { error: "User IDs required for user-based selection" };
        }
        where.id = { in: userIds };
        break;
    }

    // Add search filter
    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
      ];
    }

    // Fetch users
    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
        active: true,
        role: {
          select: {
            name: true,
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
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return {
      success: true,
      users,
      count: users.length,
    };
  } catch (error) {
    console.error("Error fetching users for channel:", error);
    return { error: "Failed to fetch users" };
  }
}

/**
 * Bulk add members based on selection criteria
 */
export async function bulkAddMembers(data: BulkAddMembersInput) {
  const user = await requireAuth();

  const validatedFields = bulkAddMembersSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { channelId, selectionCriteria, role } = validatedFields.data;

  try {
    // Permission check
    const canManage = await canManageChannel(user.id, channelId);
    if (!canManage.allowed) {
      return { error: canManage.reason || "Permission denied" };
    }

    // Get users based on criteria
    const usersResult = await getUsersForChannel(selectionCriteria);

    if (!usersResult.success || !usersResult.users) {
      return { error: usersResult.error || "Failed to get users" };
    }

    // Add members
    const userIds = usersResult.users.map((u) => u.id);

    const result = await addChannelMembers({
      channelId,
      userIds,
      role,
      addedVia:
        selectionCriteria.selectionType === "by_role"
          ? "role_based"
          : selectionCriteria.selectionType === "by_venue"
          ? "venue_based"
          : "bulk_import",
    });

    return result;
  } catch (error) {
    console.error("Error bulk adding members:", error);
    return { error: "Failed to bulk add members" };
  }
}

/**
 * Get channel analytics
 */
export async function getChannelAnalytics(data: GetChannelAnalyticsInput) {
  const user = await requireAuth();

  const validatedFields = getChannelAnalyticsSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { channelId } = validatedFields.data;

  try {
    // Get channel with basic stats
    const channel = await prisma.channel.findUnique({
      where: { id: channelId },
      include: {
        _count: {
          select: {
            posts: true,
            members: true,
          },
        },
      },
    });

    if (!channel) {
      return { error: "Channel not found" };
    }

    // Get role distribution
    const roleDistribution = await prisma.channelMember.groupBy({
      by: ["role"],
      where: { channelId },
      _count: true,
    });

    // Get addedVia distribution
    const addedViaDistribution = await prisma.channelMember.groupBy({
      by: ["addedVia"],
      where: { channelId },
      _count: true,
    });

    // Get recent activity (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = await prisma.post.count({
      where: {
        channelId,
        createdAt: { gte: thirtyDaysAgo },
      },
    });

    const recentMembers = await prisma.channelMember.count({
      where: {
        channelId,
        addedAt: { gte: thirtyDaysAgo },
      },
    });

    // Get top contributors (users with most posts)
    const topContributors = await prisma.post.groupBy({
      by: ["authorId"],
      where: { channelId },
      _count: true,
      orderBy: { _count: { authorId: "desc" } },
      take: 5,
    });

    // Fetch contributor details
    const contributorDetails = await prisma.user.findMany({
      where: {
        id: { in: topContributors.map((c) => c.authorId) },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        profileImage: true,
      },
    });

    const topContributorsWithDetails = topContributors.map((contributor) => {
      const userDetail = contributorDetails.find(
        (u) => u.id === contributor.authorId
      );
      return {
        user: userDetail,
        postCount: contributor._count,
      };
    });

    // Calculate trend data (last 12 weeks)
    const weeks = 12;
    const trendData: Array<{
      week: string;
      posts: number;
      members: number;
      cumulativeMembers: number;
    }> = [];

    const now = new Date();
    for (let i = weeks - 1; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - (i * 7));

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);

      // Count posts in this week
      const weekPosts = await prisma.post.count({
        where: {
          channelId,
          createdAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
      });

      // Count new members added in this week
      const weekMembers = await prisma.channelMember.count({
        where: {
          channelId,
          addedAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
      });

      // Count total members at end of this week
      const cumulativeMembers = await prisma.channelMember.count({
        where: {
          channelId,
          addedAt: {
            lt: weekEnd,
          },
        },
      });

      trendData.push({
        week: weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        posts: weekPosts,
        members: weekMembers,
        cumulativeMembers,
      });
    }

    // Calculate engagement metrics
    const totalEngagement = await prisma.post.count({
      where: { channelId },
    });

    const avgPostsPerMember = channel._count.members > 0
      ? totalEngagement / channel._count.members
      : 0;

    // Calculate weekly averages
    const avgPostsPerWeek = trendData.length > 0
      ? trendData.reduce((sum, week) => sum + week.posts, 0) / trendData.length
      : 0;

    const avgMembersPerWeek = trendData.length > 0
      ? trendData.reduce((sum, week) => sum + week.members, 0) / trendData.length
      : 0;

    return {
      success: true,
      analytics: {
        channel: {
          id: channel.id,
          name: channel.name,
          type: channel.type,
          memberCount: channel._count.members,
          postCount: channel._count.posts,
          createdAt: channel.createdAt,
        },
        memberStats: {
          total: channel._count.members,
          byRole: roleDistribution.map((r) => ({
            role: r.role,
            count: r._count,
          })),
          byAddedVia: addedViaDistribution.map((a) => ({
            addedVia: a.addedVia || "unknown",
            count: a._count,
          })),
        },
        recentActivity: {
          postsLast30Days: recentPosts,
          membersAddedLast30Days: recentMembers,
        },
        topContributors: topContributorsWithDetails,
        trends: {
          weeklyData: trendData,
          metrics: {
            avgPostsPerMember,
            avgPostsPerWeek,
            avgMembersPerWeek,
          },
        },
      },
    };
  } catch (error) {
    console.error("Error fetching channel analytics:", error);
    return { error: "Failed to fetch channel analytics" };
  }
}

/**
 * Get channels the user can manage
 * Admins: All channels
 * Creators/Moderators: Their channels
 * Managers: Venue-scoped channels (TODO: Phase 6)
 */
export async function getManageableChannels(data: GetManageableChannelsInput) {
  const user = await requireAuth();

  const validatedFields = getManageableChannelsSchema.safeParse(data);
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues[0]?.message || "Invalid fields",
    };
  }

  const { includeArchived, venueId } = validatedFields.data;

  try {
    // Check if user is admin
    const hasManagePermission = await canAccess("posts", "manage");

    let where: any = {
      ...(includeArchived === false && { archived: false }),
    };

    if (hasManagePermission) {
      // Admins can manage all channels
      if (venueId) {
        // Filter by venue if specified
        where.venues = {
          some: { venueId },
        };
      }
    } else {
      // Non-admins can only manage channels where they are CREATOR or MODERATOR
      where.members = {
        some: {
          userId: user.id,
          role: { in: ["CREATOR", "MODERATOR"] },
        },
      };
    }

    const channels = await prisma.channel.findMany({
      where,
      include: {
        _count: {
          select: {
            members: true,
            posts: true,
          },
        },
        creator: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: [{ archived: "asc" }, { name: "asc" }],
    });

    return {
      success: true,
      channels,
    };
  } catch (error) {
    console.error("Error fetching manageable channels:", error);
    return { error: "Failed to fetch channels" };
  }
}
