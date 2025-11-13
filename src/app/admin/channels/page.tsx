import { requireAuth } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelsPageClient } from "./channels-page-client";

export const metadata = {
  title: "Channel Management | Admin",
  description: "Manage channels and members",
};

async function getChannelsData(userId: string, isManager: boolean, managerVenueIds: string[] | null) {
  // Build channel filter based on user role
  let channelWhere: any = {};

  // If manager, filter to channels where all members are from manager's venues
  if (isManager && managerVenueIds && managerVenueIds.length > 0) {
    // Get channels assigned to manager's venues
    const channelVenues = await prisma.channelVenue.findMany({
      where: {
        venueId: { in: managerVenueIds },
      },
      select: { channelId: true },
    });

    const channelIds = channelVenues.map((cv) => cv.channelId);
    channelWhere.id = { in: channelIds };
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
      creator: {
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

  // If manager, filter to users from manager's venues
  if (isManager && managerVenueIds && managerVenueIds.length > 0) {
    userWhere.venues = {
      some: {
        venueId: { in: managerVenueIds },
      },
    };
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

  // If manager, filter to only manager's venues
  if (isManager && managerVenueIds && managerVenueIds.length > 0) {
    venueWhere.id = { in: managerVenueIds };
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

  // Check if user is a manager
  const isManager = userWithRole?.role.name === "MANAGER";
  const managerVenueIds = isManager && userWithRole.venues.length > 0
    ? userWithRole.venues.map((uv) => uv.venue.id)
    : null;

  const data = await getChannelsData(user.id, isManager, managerVenueIds);

  return (
    <ChannelsPageClient
      initialChannels={data.channels}
      allUsers={data.users}
      allRoles={data.roles}
      allVenues={data.venues}
      currentUserId={user.id}
    />
  );
}
