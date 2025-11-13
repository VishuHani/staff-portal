import { requireAuth } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelDetailClient } from "./channel-detail-client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const channel = await prisma.channel.findUnique({
    where: { id },
    select: { name: true },
  });

  return {
    title: channel ? `${channel.name} | Channel Management` : "Channel Not Found",
  };
}

async function getChannelData(channelId: string, userId: string, isManager: boolean, managerVenueIds: string[] | null) {
  // Get channel with all details
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
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
          { role: "asc" },
          { addedAt: "desc" },
        ],
      },
    },
  });

  if (!channel) {
    return null;
  }

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

  // Get all active users for adding new members
  const allUsers = await prisma.user.findMany({
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

  return {
    channel,
    allUsers,
  };
}

export default async function ChannelDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
  const isManager = userWithRole?.role.name === "MANAGER";
  const managerVenueIds = isManager && userWithRole.venues.length > 0
    ? userWithRole.venues.map((uv) => uv.venue.id)
    : null;

  const data = await getChannelData(id, user.id, isManager, managerVenueIds);

  if (!data) {
    notFound();
  }

  // Get unread counts for header
  const [unreadResult, messageCountResult] = await Promise.all([
    getUnreadCount({ userId: user.id }),
    getUnreadMessageCount(),
  ]);

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
      unreadMessageCount={messageCountResult.count || 0}
    >
      <ChannelDetailClient
        channel={data.channel}
        allUsers={data.allUsers}
        currentUserId={user.id}
      />
    </DashboardLayout>
  );
}
