import { requireAuth } from "@/lib/rbac/access";
import { isAdmin } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmailsPageClient } from "./emails-page-client";

export const metadata = {
  title: "Email Campaigns | System Admin",
  description: "Manage email campaigns and broadcasts",
};

export default async function EmailsPage() {
  const user = await requireAuth();
  const isUserAdmin = await isAdmin(user.id);

  if (!isUserAdmin) {
    // Check if user is a venue manager
    const { prisma } = await import("@/lib/prisma");
    const userVenues = await prisma.userVenue.findMany({
      where: { userId: user.id },
      select: { venueId: true },
    });

    if (userVenues.length === 0) {
      redirect("/dashboard?error=access_denied");
    }
  }

  return (
    <DashboardLayout user={user}>
      <EmailsPageClient isAdmin={isUserAdmin} />
    </DashboardLayout>
  );
}
