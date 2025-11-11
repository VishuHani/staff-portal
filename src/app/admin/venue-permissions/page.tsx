import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { VenuePermissionsPageClient } from "./venue-permissions-page-client";
import { getAllVenues } from "@/lib/actions/admin/venues";
import {
  getAvailablePermissions,
  getTotalVenuePermissionAssignments
} from "@/lib/actions/admin/venue-permissions";

export default async function AdminVenuePermissionsPage() {
  const user = await requireAdmin();

  const [venuesResult, permissionsResult, assignmentsResult] = await Promise.all([
    getAllVenues(),
    getAvailablePermissions(),
    getTotalVenuePermissionAssignments(),
  ]);

  if (venuesResult.error || permissionsResult.error || assignmentsResult.error) {
    console.error("Error loading venue permissions page data");
    redirect("/dashboard?error=forbidden");
  }

  const totalAssignments = assignmentsResult.count || 0;

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
