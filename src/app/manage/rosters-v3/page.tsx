import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RostersV3Client } from "./rosters-v3-client";
import { getRosters, getRosterStats } from "@/lib/actions/rosters";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Rosters V3 | Team Management",
  description: "AI-powered roster extraction with GPT-4o Vision",
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

export default async function RostersV3Page() {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("rosters", "view_team");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect admins to their version
  if (user.role.name === "ADMIN") {
    // Admins can use this page too, no redirect
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
      <Suspense fallback={<RostersSkeleton />}>
        <RostersV3Client
          initialRosters={rosters}
          stats={stats}
          venues={venues}
        />
      </Suspense>
    </DashboardLayout>
  );
}
