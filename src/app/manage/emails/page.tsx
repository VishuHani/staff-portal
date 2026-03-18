import { requireAuth } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ManagerEmailsClient } from "./manager-emails-client";

export const metadata = {
  title: "Email Campaigns | Venue Management",
  description: "Manage email campaigns for your venues",
};

export default async function ManagerEmailsPage() {
  const user = await requireAuth();

  // Get user's venues
  const userVenues = await prisma.userVenue.findMany({
    where: { userId: user.id },
    include: {
      venue: {
        select: { id: true, name: true, code: true, active: true },
      },
    },
  });

  if (userVenues.length === 0) {
    redirect("/dashboard?error=no_venues");
  }

  const venues = userVenues.map((uv) => uv.venue);

  // Get roles for targeting
  const roles = await prisma.role.findMany({
    select: { id: true, name: true, description: true },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardLayout user={user}>
      <ManagerEmailsClient venues={venues} roles={roles} />
    </DashboardLayout>
  );
}
