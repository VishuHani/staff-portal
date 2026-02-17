import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MyShiftsClient } from "./my-shifts-client";
import { getMyShifts } from "@/lib/actions/rosters";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { startOfMonth, endOfMonth, addMonths } from "date-fns";

export const metadata = {
  title: "My Shifts | Staff Portal",
  description: "View your upcoming shifts and schedule",
};

function ShiftsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default async function MyShiftsPage() {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("rosters", "view_own");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Fetch shifts for current month and next month
  const now = new Date();
  const dateRange = {
    start: startOfMonth(now),
    end: endOfMonth(addMonths(now, 1)),
  };

  const result = await getMyShifts(dateRange);
  const shifts = result.success ? result.shifts : [];

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">My Shifts</h1>
          <p className="text-muted-foreground mt-1">
            View your upcoming shifts and schedule
          </p>
        </div>

        {/* Content */}
        <Suspense fallback={<ShiftsSkeleton />}>
          <MyShiftsClient initialShifts={shifts} />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
