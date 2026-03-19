import { requireAuth } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelsPageClient } from "./channels-page-client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";
import { getUserVenueIds } from "@/lib/utils/venue";

export const metadata = {
  title: "Channel Management | Admin",
  description: "Manage channels and members",
};

async function getChannelsData(isAdmin: boolean, userVenueIds: string[] | null) {
  // Build channel filter based on user role
  const noVenueAccess = !isAdmin && (!userVenueIds || userVenueIds.length === 0);
  let channelWhere: any = {};

  // Non-admin users only see channels assigned to their venues or public channels
  if (!isAdmin) {
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

  // Build user filter based on user role
  let userWhere: any = { active: true };

  // Non-admin users only see users from their venues
  if (!isAdmin) {
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

  // Build venue filter based on user role
  let venueWhere: any = { active: true };

  // Non-admin users only see their assigned venues
  if (!isAdmin) {
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

  // Check if user has posts:manage permission (admin or manager)
  const userWithRole = await prisma.user.findUnique({
    where: { id: user.id },
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

  const hasManagePermission = userWithRole?.role.rolePermissions.some(
    (rp) => rp.permission.resource === "posts" && rp.permission.action === "manage"
  );

  if (!hasManagePermission) {
    redirect("/dashboard");
  }

  const isAdmin = userWithRole?.role.name === "ADMIN";
  const userVenues = userWithRole?.venues ?? [];
  const userVenueIds = isAdmin && userVenues.length > 0
    ? null
    : userVenues.map((uv) => uv.venue.id);

  const data = await getChannelsData(isAdmin, userVenueIds);

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
