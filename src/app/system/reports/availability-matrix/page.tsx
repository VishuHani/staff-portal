import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AvailabilityMatrixClient } from "./availability-matrix-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Availability Matrix | Team Reports",
  description: "View your team's availability in a grid format",
};

function MatrixSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export default async function ManagerAvailabilityMatrixPage() {
  const user = await requireAuth();

  // Only allow managers with view_all permission
  const hasAccess = await canAccess("reports", "view_all");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect managers to their version
  if (user.role.name !== "ADMIN") {
    redirect("/manage/reports/availability-matrix");
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
          <h1 className="text-3xl font-bold">Availability Matrix</h1>
          <p className="text-muted-foreground mt-1">
            View your team's availability across dates in a grid format
          </p>
        </div>

        {/* Matrix Content */}
        <Suspense fallback={<MatrixSkeleton />}>
          <AvailabilityMatrixClient venues={venues} roles={roles} />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
