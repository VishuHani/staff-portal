import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DocumentsDashboardClient } from "./documents-dashboard-client";
import { getDocumentAnalytics } from "@/lib/actions/documents/analytics";
import { getAuditStats } from "@/lib/actions/documents/audit";
import { prisma } from "@/lib/prisma";
import { SYSTEM_PERMISSIONS } from "@/lib/rbac/system-permissions";

export default async function DocumentsDashboardPage() {
  const user = await requireAnyPermission(SYSTEM_PERMISSIONS.documentsManage);

  // Fetch all venues for the venue selector
  const venues = await prisma.venue.findMany({
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  // Admins default to "all" venues view
  // Fetch initial data for "all venues" mode
  const [analyticsResult, auditStatsResult] = await Promise.all([
    getDocumentAnalytics("all"),
    getAuditStats("all"),
  ]);

  if (analyticsResult.error) {
    console.error("Error loading document analytics:", analyticsResult.error);
  }

  if (auditStatsResult.error) {
    console.error("Error loading audit stats:", auditStatsResult.error);
  }

  return (
    <DashboardLayout user={user}>
      <div className="container max-w-7xl py-6">
        <DocumentsDashboardClient
          initialVenueId="all"
          allVenues={venues}
          initialAnalytics={analyticsResult.data || null}
          initialAuditStats={auditStatsResult.data || null}
        />
      </div>
    </DashboardLayout>
  );
}
