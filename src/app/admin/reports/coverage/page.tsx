import { Suspense } from "react";
import { requireAnyPermission } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CoverageAnalysisClient } from "./coverage-analysis-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Coverage Analysis | Reports",
  description: "Analyze staffing levels and coverage patterns",
};

function CoverageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

export default async function CoverageAnalysisPage() {
  // Allow managers and admins with appropriate permissions
  const user = await requireAnyPermission([
    { resource: "reports", action: "view_team" },
    { resource: "reports", action: "view_all" },
  ]);

  // Fetch venues and roles in parallel
  const [venues, roles] = await Promise.all([
    prisma.venue.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.role.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Coverage Analysis</h1>
          <p className="text-muted-foreground mt-1">
            Analyze staffing levels, patterns, and coverage gaps across time periods
          </p>
        </div>

        {/* Coverage Content */}
        <Suspense fallback={<CoverageSkeleton />}>
          <CoverageAnalysisClient venues={venues} roles={roles} />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
