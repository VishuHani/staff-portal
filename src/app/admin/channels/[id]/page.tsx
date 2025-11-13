import { requireAuth } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ChannelDetailClient } from "./channel-detail-client";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const channel = await prisma.channel.findUnique({
    where: { id: params.id },
    select: { name: true },
  });

  return {
    title: channel ? `${channel.name} | Channel Management` : "Channel Not Found",
  };
}

async function getChannelData(channelId: string) {
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

  // Get all active users for adding new members
  const allUsers = await prisma.user.findMany({
    where: { active: true },
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

export default async function ChannelDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();

  // Check if user has posts:manage permission
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
    },
  });

  const hasManagePermission = userWithRole?.role.rolePermissions.some(
    (rp) => rp.permission.resource === "posts" && rp.permission.action === "manage"
  );

  if (!hasManagePermission) {
    redirect("/dashboard");
  }

  const data = await getChannelData(params.id);

  if (!data) {
    notFound();
  }

  return (
    <ChannelDetailClient
      channel={data.channel}
      allUsers={data.allUsers}
      currentUserId={user.id}
    />
  );
}
