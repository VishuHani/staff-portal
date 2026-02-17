import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ConflictsReportClient } from "./conflicts-report-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Conflicts Report | Team Reports",
  description: "Identify scheduling conflicts and staffing gaps in your team",
};

function ConflictsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function ManagerConflictsReportPage() {
  const user = await requireAuth();

  // Only allow managers with view_team permission
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect admins to their version
  if (user.role.name === "ADMIN") {
    redirect("/system/reports/conflicts");
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
          <h1 className="text-3xl font-bold">Conflicts Report</h1>
          <p className="text-muted-foreground mt-1">
            Identify scheduling conflicts, understaffing, and coverage gaps in your team
          </p>
        </div>

        {/* Conflicts Content */}
        <Suspense fallback={<ConflictsSkeleton />}>
          <ConflictsReportClient venues={venues} roles={roles} />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
