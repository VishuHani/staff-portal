import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { VenuePermissionsPageClient } from "./venue-permissions-page-client";
import { getAllVenues } from "@/lib/actions/admin/venues";
import { getAvailablePermissions } from "@/lib/actions/admin/venue-permissions";
import { prisma } from "@/lib/prisma";

export default async function AdminVenuePermissionsPage() {
  const user = await requireAdmin();

  const [venuesResult, permissionsResult] = await Promise.all([
    getAllVenues(),
    getAvailablePermissions(),
  ]);

  if (venuesResult.error || permissionsResult.error) {
    console.error("Error loading venue permissions page data");
    redirect("/dashboard?error=forbidden");
  }

  // Get count of users with venue permissions
  const totalAssignments = await prisma.userVenuePermission.count();

  return (
    <DashboardLayout user={user}>
      <div className="container max-w-7xl py-6">
        <VenuePermissionsPageClient
          venues={venuesResult.venues!}
          allPermissions={permissionsResult.permissions!}
          totalAssignments={totalAssignments}
        />
      </div>
    </DashboardLayout>
  );
}
