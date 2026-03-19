import { redirect } from "next/navigation";
import { requireAuth, isAdmin } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { NewCampaignClient } from "@/app/system/emails/new/new-campaign-client";

export const metadata = {
  title: "New Campaign | Emails",
  description: "Create a new email campaign",
};

export default async function EmailsCampaignsNewPage() {
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "campaigns"))) {
    redirect("/dashboard?error=access_denied");
  }

  const isUserAdmin = await isAdmin(user.id);

  let userVenues: Array<{ venueId: string }> = [];
  if (!isUserAdmin) {
    userVenues = await prisma.userVenue.findMany({
      where: { userId: user.id },
      select: { venueId: true },
    });

    if (userVenues.length === 0) {
      redirect("/dashboard?error=access_denied");
    }
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
          id: { in: userVenues.map((uv) => uv.venueId) },
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
      <NewCampaignClient isAdmin={isUserAdmin} venues={venues} roles={roles} />
    </DashboardLayout>
  );
}
