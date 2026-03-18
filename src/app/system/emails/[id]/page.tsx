import { requireAuth } from "@/lib/rbac/access";
import { isAdmin } from "@/lib/rbac/access";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CampaignDetailClient } from "./campaign-detail-client";

export const metadata = {
  title: "Email Campaign | System Admin",
  description: "View email campaign details",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();
  const isUserAdmin = await isAdmin(user.id);

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: params.id },
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      venue: {
        select: { id: true, name: true, code: true },
      },
      emailTemplate: {
        select: { id: true, name: true, category: true },
      },
      recipients: {
        take: 100,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          userId: true,
          email: true,
          name: true,
          status: true,
          sentAt: true,
          deliveredAt: true,
          openedAt: true,
          openedCount: true,
          clickedAt: true,
          clickedCount: true,
          error: true,
          bounceReason: true,
        },
      },
      analytics: true,
    },
  });

  if (!campaign) {
    notFound();
  }

  // Check permissions
  if (!isUserAdmin && campaign.venueId) {
    const userVenues = await prisma.userVenue.findMany({
      where: { userId: user.id },
      select: { venueId: true },
    });

    if (!userVenues.some((uv) => uv.venueId === campaign.venueId)) {
      redirect("/dashboard?error=access_denied");
    }
  }

  // Get venues and roles for editing
  const venues = await prisma.venue.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const roles = await prisma.role.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardLayout user={user}>
      <CampaignDetailClient
        campaign={JSON.parse(JSON.stringify(campaign))}
        isAdmin={isUserAdmin}
        venues={venues}
        roles={roles}
      />
    </DashboardLayout>
  );
}
