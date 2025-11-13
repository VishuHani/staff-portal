import { requireAuth } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelSettingsClient } from "./settings-client";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const channel = await prisma.channel.findUnique({
    where: { id: params.id },
    select: { name: true },
  });

  return {
    title: channel ? `${channel.name} Settings | Channel Management` : "Channel Not Found",
  };
}

async function getChannelSettingsData(channelId: string, userId: string, isManager: boolean, managerVenueIds: string[] | null) {
  // Get channel with full details
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
      creator: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
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
      _count: {
        select: {
          members: true,
          posts: true,
        },
      },
    },
  });

  if (!channel) {
    return null;
  }

  // Build venue filter based on user role
  let venueWhere: any = { active: true };

  // If manager, filter to only manager's venues
  if (isManager && managerVenueIds && managerVenueIds.length > 0) {
    venueWhere.id = { in: managerVenueIds };
  }

  // Get all venues for dropdown
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
    channel,
    venues,
  };
}

export default async function ChannelSettingsPage({ params }: { params: { id: string } }) {
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

  const data = await getChannelSettingsData(params.id, user.id, isManager, managerVenueIds);

  if (!data) {
    notFound();
  }

  return (
    <ChannelSettingsClient
      channel={data.channel}
      venues={data.venues}
      currentUserId={user.id}
      isManager={isManager}
    />
  );
}
