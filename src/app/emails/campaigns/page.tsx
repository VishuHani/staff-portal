import { redirect } from "next/navigation";
import { requireAuth, isAdmin } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailsPageClient } from "@/app/system/emails/emails-page-client";

export const metadata = {
  title: "Campaigns | Emails",
  description: "Create, organize, and send email campaigns",
};

export default async function EmailsCampaignsPage() {
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "campaigns"))) {
    redirect("/dashboard?error=access_denied");
  }

  const isUserAdmin = await isAdmin(user.id);

  if (!isUserAdmin) {
    const userVenues = await prisma.userVenue.findMany({
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
    : [];

  return (
    <DashboardLayout user={user}>
      <EmailsPageClient isAdmin={isUserAdmin} venues={venues} />
    </DashboardLayout>
  );
}
