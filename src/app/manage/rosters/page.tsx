import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RostersListClient } from "./rosters-list-client";
import { getRosters, getRosterStats } from "@/lib/actions/rosters";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Rosters | Team Management",
  description: "Manage staff rosters and schedules",
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
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ManagerRostersPage() {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("rosters", "view_team");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect admins to their version
  if (user.role.name === "ADMIN") {
    redirect("/system/rosters");
  }

  // Fetch initial data
  const [rostersResult, statsResult, venues] = await Promise.all([
    getRosters(),
    getRosterStats(),
    prisma.venue.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rosters = rostersResult.success ? rostersResult.rosters : [];
  const stats = statsResult.success && statsResult.stats ? statsResult.stats : null;

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Rosters</h1>
          <p className="text-muted-foreground mt-1">
            Create and manage staff rosters for your venues
          </p>
        </div>

        {/* Content */}
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
