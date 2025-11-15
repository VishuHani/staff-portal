import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { TimeOffReportClient } from "./time-off-report-client";

export const metadata = {
  title: "Time-Off Report | Staff Portal",
  description: "View and analyze time-off requests and coverage impact",
};

export default async function TimeOffReportPage() {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Get venue-filtered users for dropdowns
  const sharedVenueUserIds = await getSharedVenueUsers(user.id);

  // Fetch venues for filter
  const venues = await prisma.venue.findMany({
    where: {
      active: true,
      userVenues: {
        some: {
          userId: { in: sharedVenueUserIds },
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Fetch roles for filter
  const roles = await prisma.role.findMany({
    where: {
      users: {
        some: {
          id: { in: sharedVenueUserIds },
        },
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Time-Off Report</h1>
          <p className="mt-2 text-muted-foreground">
            View and analyze staff time-off requests and their impact on coverage
          </p>
        </div>

        {/* Client Component */}
        <TimeOffReportClient venues={venues} roles={roles} />
      </div>
    </DashboardLayout>
  );
}
