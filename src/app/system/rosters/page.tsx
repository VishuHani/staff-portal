import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RostersListClient } from "../../manage/rosters/rosters-list-client";
import { PendingApprovals } from "@/components/rosters";
import { getRosters, getRosterStats, getPendingApprovalsCount } from "@/lib/actions/rosters";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Rosters | System Administration",
  description: "Manage all staff rosters across venues",
};

function RostersSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function AdminRostersPage() {
  const user = await requireAuth();

  // Only admins can access this page
  const hasAccess = await canAccess("rosters", "view_all");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect non-admins to manager version
  if (user.role.name !== "ADMIN") {
    redirect("/manage/rosters");
  }

  // Fetch all data
  const [rostersResult, statsResult, venues, pendingCountResult] = await Promise.all([
    getRosters(),
    getRosterStats(),
    prisma.venue.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    getPendingApprovalsCount(),
  ]);

  const rosters = rostersResult.success ? rostersResult.rosters : [];
  const stats = statsResult.success && statsResult.stats ? statsResult.stats : null;
  const pendingCount = pendingCountResult.success ? pendingCountResult.count : 0;

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Rosters</h1>
          <p className="text-muted-foreground mt-1">
            Manage all staff rosters across all venues
          </p>
        </div>

        {/* Pending Approvals Section (Admin Only) */}
        {pendingCount !== undefined && pendingCount > 0 && (
          <Suspense fallback={<Skeleton className="h-48 w-full" />}>
            <PendingApprovals />
          </Suspense>
        )}

        {/* Content - Reuse the manager client component */}
        <Suspense fallback={<RostersSkeleton />}>
          <RostersListClient
            initialRosters={rosters}
            stats={stats}
            venues={venues}
          />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
