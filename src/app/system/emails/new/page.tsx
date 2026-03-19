import { requireAuth } from "@/lib/rbac/access";
import { isAdmin } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { NewCampaignClient } from "./new-campaign-client";

export const metadata = {
  title: "New Email Campaign | System Admin",
  description: "Create a new email campaign",
};

export default async function NewCampaignPage() {
  const user = await requireAuth();
  const isUserAdmin = await isAdmin(user.id);

  let userVenues: Array<{ venueId: string }> = [];
  if (!isUserAdmin) {
    // Check if user is a venue manager
    const { prisma } = await import("@/lib/prisma");
    userVenues = await prisma.userVenue.findMany({
      where: { userId: user.id },
      select: { venueId: true },
    });

    if (userVenues.length === 0) {
      redirect("/dashboard?error=access_denied");
    }
  }

  // Get venues for targeting
  const { prisma } = await import("@/lib/prisma");
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

  // Get roles for targeting
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardLayout user={user}>
      <NewCampaignClient
        isAdmin={isUserAdmin}
        venues={venues}
        roles={roles}
      />
    </DashboardLayout>
  );
}
