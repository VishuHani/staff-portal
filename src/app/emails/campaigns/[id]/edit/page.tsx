import { notFound, redirect } from "next/navigation";
import { requireAuth, isAdmin } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EditCampaignClient } from "./edit-campaign-client";

export const metadata = {
  title: "Edit Campaign | Emails",
  description: "Update a draft email campaign",
};

export default async function EmailsCampaignEditPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "campaigns"))) {
    redirect("/dashboard?error=access_denied");
  }

  const isUserAdmin = await isAdmin(user.id);

  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: params.id },
    include: {
      email: {
        select: {
          id: true,
          name: true,
          subject: true,
          htmlContent: true,
          emailType: true,
          category: true,
        },
      },
      segment: {
        select: { id: true, name: true, description: true },
      },
    },
  });

  if (!campaign) {
    notFound();
  }

  if (!isUserAdmin && campaign.venueId) {
    const userVenues = await prisma.userVenue.findMany({
      where: { userId: user.id },
      select: { venueId: true },
    });

    if (!userVenues.some((uv) => uv.venueId === campaign.venueId)) {
      redirect("/dashboard?error=access_denied");
    }
  }

  if (campaign.status !== "DRAFT") {
    redirect(`/emails/campaigns/${campaign.id}`);
  }

  const venues = isUserAdmin
    ? await prisma.venue.findMany({
        where: { active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      })
    : await prisma.venue.findMany({
        where: {
          active: true,
          userVenues: {
            some: {
              userId: user.id,
            },
          },
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      });

  const roles = await prisma.role.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardLayout user={user}>
      <EditCampaignClient
        campaign={JSON.parse(JSON.stringify(campaign))}
        isAdmin={isUserAdmin}
        venues={venues}
        roles={roles}
      />
    </DashboardLayout>
  );
}
