import { canAccess, requireAuth } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelsPageClient } from "./channels-page-client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";
import { hasAnyPermission } from "@/lib/rbac/permissions";

export const metadata = {
  title: "Channel Management | Admin",
  description: "Manage channels and members",
};

async function getChannelsData(
  hasGlobalVenueScope: boolean,
  userVenueIds: string[] | null
) {
  const noVenueAccess =
    !hasGlobalVenueScope && (!userVenueIds || userVenueIds.length === 0);
  let channelWhere: any = {};

  if (!hasGlobalVenueScope) {
    if (noVenueAccess) {
      channelWhere.id = "impossible-id-no-venues";
    } else if (userVenueIds) {
      channelWhere.OR = [
        { isPublic: true },
        {
          venues: {
            some: {
              venueId: { in: userVenueIds },
            },
          },
        },
      ];
    }
  }

  // Get all channels with member counts and creator info
  const channels = await prisma.channel.findMany({
    where: channelWhere,
    include: {
        _count: {
          select: {
            members: true,
            posts: true,
          },
        },
        createdByUser: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      members: {
        where: {
          role: { in: ["CREATOR", "MODERATOR"] },
        },
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              profileImage: true,
            },
          },
        },
      },
    },
    orderBy: [
      { archived: "asc" },
      { name: "asc" },
    ],
  });

  // Build user filter based on venue scope
  let userWhere: any = { active: true };

  if (!hasGlobalVenueScope) {
    if (noVenueAccess) {
      userWhere.id = "impossible-id-no-venues";
    } else if (userVenueIds) {
      userWhere.venues = {
        some: {
          venueId: { in: userVenueIds },
        },
      };
    }
  }

  // Get all active users for wizard
  const users = await prisma.user.findMany({
    where: userWhere,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
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
    orderBy: [
      { firstName: "asc" },
      { lastName: "asc" },
    ],
  });

  // Get all roles for filtering
  const roles = await prisma.role.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  // Build venue filter based on venue scope
  let venueWhere: any = { active: true };

  if (!hasGlobalVenueScope) {
    if (noVenueAccess) {
      venueWhere.id = "impossible-id-no-venues";
    } else if (userVenueIds) {
      venueWhere.id = { in: userVenueIds };
    }
  }

  // Get all venues for filtering
  const venues = await prisma.venue.findMany({
    where: venueWhere,
    select: {
      id: true,
      name: true,
      code: true,
    },
    orderBy: { name: "asc" },
  });

  return {
    channels,
    users,
    roles,
    venues,
  };
}

export default async function AdminChannelsPage() {
  const user = await requireAuth();

  const [hasManagePermission, hasGlobalVenueScope] = await Promise.all([
    canAccess("posts", "manage"),
    hasAnyPermission(user.id, [
      { resource: "stores", action: "view_all" },
      { resource: "stores", action: "manage" },
      { resource: "venues", action: "view_all" },
      { resource: "venues", action: "manage" },
      { resource: "admin", action: "manage_stores" },
    ]),
  ]);

  if (!hasManagePermission) {
    redirect("/dashboard");
  }

  const userWithRole = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      role: true,
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

  const userVenues = userWithRole?.venues ?? [];
  const userVenueIds = hasGlobalVenueScope && userVenues.length > 0
    ? null
    : userVenues.map((uv) => uv.venue.id);

  const data = await getChannelsData(hasGlobalVenueScope, userVenueIds);

  // Get unread counts for header
  const [unreadResult, messageCountResult] = await Promise.all([
    getUnreadCount({ userId: user.id }),
    getUnreadMessageCount(),
  ]);
  const unreadMessageCount = messageCountResult.success
    ? (messageCountResult.count ?? 0)
    : 0;

  return (
    <DashboardLayout
      user={{
        id: user.id,
        email: user.email,
        firstName: userWithRole?.firstName,
        lastName: userWithRole?.lastName,
        role: {
          name: userWithRole?.role.name || "STAFF",
        },
      }}
      unreadCount={unreadResult.count || 0}
      unreadMessageCount={unreadMessageCount}
    >
      <ChannelsPageClient
        initialChannels={data.channels}
        allUsers={data.users}
        allRoles={data.roles}
        allVenues={data.venues}
        currentUserId={user.id}
      />
    </DashboardLayout>
  );
}
