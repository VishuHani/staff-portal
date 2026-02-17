import { requireAdmin } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getAllVenues, getVenueStats } from "@/lib/actions/admin/venues";
import { StoresPageClient } from "./stores-page-client";
import { redirect } from "next/navigation";

export default async function AdminStoresPage() {
  const user = await requireAdmin();

  // Fetch venues and stats
  const [venuesResult, statsResult] = await Promise.all([
    getAllVenues(),
    getVenueStats(),
  ]);

  // Handle errors
  if (venuesResult.error || !venuesResult.venues) {
    console.error("Error fetching venues:", venuesResult.error);
    // Could redirect to error page or show error message
    return (
      <DashboardLayout user={user}>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Venue Management
            </h2>
            <p className="mt-2 text-red-600">
              Error loading venues: {venuesResult.error}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (statsResult.error || !statsResult.stats) {
    console.error("Error fetching stats:", statsResult.error);
    // Could redirect to error page or show error message
    return (
      <DashboardLayout user={user}>
        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Venue Management
            </h2>
            <p className="mt-2 text-red-600">
              Error loading statistics: {statsResult.error}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user}>
      <StoresPageClient
        venues={venuesResult.venues}
        stats={statsResult.stats}
      />
    </DashboardLayout>
  );
}
