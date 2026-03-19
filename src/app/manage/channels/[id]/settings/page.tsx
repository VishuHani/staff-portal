import { requireAuth } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelSettingsClient } from "./settings-client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";
import { getCurrentUser } from "@/lib/actions/auth";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) {
    return {
      title: "Channel Not Found",
    };
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
            },
          },
        },
      },
    },
  });

  const channel = await prisma.channel.findUnique({
    where: { id },
    include: {
      venues: {
        select: {
          venueId: true,
        },
      },
    },
  });

  const isAdmin = userWithRole?.role.name === "ADMIN";
  const userVenueIds = userWithRole?.venues.map((uv) => uv.venue.id) || [];
  const canAccessChannel =
    !!channel &&
    (isAdmin || channel.isPublic || channel.venues.some((venue) => userVenueIds.includes(venue.venueId)));

  return {
    title: canAccessChannel ? `${channel!.name} Settings | Channel Management` : "Channel Not Found",
  };
}

async function getChannelSettingsData(channelId: string, isAdmin: boolean, userVenueIds: string[] | null) {
  // Get channel with full details
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    include: {
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
      createdByUser: {
        select: {
          firstName: true,
          lastName: true,
          email: true,
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

  // Non-admin users only see their assigned venues
  if (!isAdmin) {
    if (userVenueIds && userVenueIds.length > 0) {
      venueWhere.id = { in: userVenueIds };
    } else {
      venueWhere.id = "impossible-id-no-venues";
    }
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

export default async function ChannelSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  const userVenues = userWithRole?.venues ?? [];
  const userVenueIds = userVenues.map((uv) => uv.venue.id);
  const isAdmin = userWithRole?.role.name === "ADMIN";

  const data = await getChannelSettingsData(id, isAdmin, isAdmin ? null : userVenueIds);

  if (!data) {
    notFound();
  }

  const canAccessChannel =
    userWithRole?.role.name === "ADMIN" ||
    data.channel.isPublic ||
    data.channel.venues.some((venue) => userVenueIds.includes(venue.venue.id));

  if (!canAccessChannel) {
    notFound();
  }

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
      <ChannelSettingsClient
        channel={data.channel}
        venues={data.venues}
        currentUserId={user.id}
        isManager={!isAdmin && userWithRole?.role.name === "MANAGER"}
      />
    </DashboardLayout>
  );
}
