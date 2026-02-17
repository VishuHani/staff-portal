import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { CoverageAnalysisClient } from "./coverage-analysis-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Coverage Analysis | Team Reports",
  description: "Analyze your team's staffing levels and coverage patterns",
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

export default async function ManagerCoverageAnalysisPage() {
  const user = await requireAuth();

  // Only allow managers with view_team permission
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect admins to their version
  if (user.role.name === "ADMIN") {
    redirect("/system/reports/coverage");
  }

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
            Analyze your team's staffing levels, patterns, and coverage gaps
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
