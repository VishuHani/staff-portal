import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CreateRosterForm } from "./create-roster-form";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Create Roster | Team Management",
  description: "Create a new staff roster",
};

export default async function CreateRosterPage() {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("rosters", "create");
  if (!hasAccess) {
    redirect("/manage/rosters");
  }

  // Get venues the user has access to
  let venues;
  if (user.role.name === "ADMIN") {
    venues = await prisma.venue.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  } else {
    // Manager - only their venues
    const userVenues = await prisma.userVenue.findMany({
      where: { userId: user.id },
      include: {
        venue: {
          select: { id: true, name: true, code: true, active: true },
        },
      },
    });
    venues = userVenues
      .filter((uv) => uv.venue.active)
      .map((uv) => uv.venue);
  }

  if (venues.length === 0) {
    return (
      <DashboardLayout user={user}>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Create Roster</h1>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <p>You don't have access to any venues.</p>
            <p className="text-sm mt-1">Contact an administrator to get venue access.</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Create Roster</h1>
          <p className="text-muted-foreground mt-1">
            Create a new roster for your venue
          </p>
        </div>

        {/* Form */}
        <CreateRosterForm venues={venues} />
      </div>
    </DashboardLayout>
  );
}
