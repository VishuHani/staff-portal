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
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();
  const isUserAdmin = await isAdmin(user.id);

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id },
    include: {
      creator: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      venue: {
        select: { id: true, name: true, code: true },
      },
      email: {
        select: {
          id: true,
          name: true,
          category: true,
          subject: true,
          previewText: true,
          htmlContent: true,
          textContent: true,
          emailType: true,
        },
      },
      recipients: {
        take: 100,
        orderBy: [{ sentAt: "desc" }, { id: "desc" }],
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

  if (!campaign.email) {
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

  // Get venues for targeting display
  const venues = await prisma.venue.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  const detailCampaign = {
    ...campaign,
    subject: campaign.customSubject || campaign.email.subject,
    previewText: campaign.email.previewText,
    htmlContent: campaign.customHtml || campaign.email.htmlContent,
    textContent: campaign.email.textContent,
    emailType: campaign.email.emailType,
    emailTemplate: {
      id: campaign.email.id,
      name: campaign.email.name,
      category: campaign.email.category,
    },
  };

  return (
    <DashboardLayout user={user}>
      <CampaignDetailClient
        campaign={JSON.parse(JSON.stringify(detailCampaign))}
        isAdmin={isUserAdmin}
        venues={venues}
      />
    </DashboardLayout>
  );
}
