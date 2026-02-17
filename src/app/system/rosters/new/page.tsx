import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CreateRosterForm } from "../../../manage/rosters/new/create-roster-form";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Create Roster | System Administration",
  description: "Create a new staff roster",
};

export default async function AdminCreateRosterPage() {
  const user = await requireAuth();

  // Only admins can access
  const hasAccess = await canAccess("rosters", "create");
  if (!hasAccess || user.role.name !== "ADMIN") {
    redirect("/system/rosters");
  }

  // Get all venues for admin
  const venues = await prisma.venue.findMany({
    where: { active: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });

  if (venues.length === 0) {
    return (
      <DashboardLayout user={user}>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Create Roster</h1>
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <p>No active venues found.</p>
            <p className="text-sm mt-1">Create a venue first before creating rosters.</p>
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
            Create a new roster for any venue
          </p>
        </div>

        {/* Reuse the create form */}
        <CreateRosterForm venues={venues} />
      </div>
    </DashboardLayout>
  );
}
