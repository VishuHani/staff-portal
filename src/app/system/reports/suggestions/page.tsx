import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SuggestionsPageClient } from "./suggestions-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Smart Suggestions | Team Reports",
  description: "AI-powered scheduling recommendations for your team",
};

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export default async function ManagerSuggestionsPage() {
  const user = await requireAuth();

  // Only allow managers with view_all permission
  const hasAccess = await canAccess("reports", "view_all");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect managers to their version
  if (user.role.name !== "ADMIN") {
    redirect("/manage/reports/suggestions");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Smart Scheduling Suggestions</h1>
          <p className="text-muted-foreground mt-2">
            AI-powered recommendations to optimize your team's schedule
          </p>
        </div>

        <Suspense fallback={<LoadingSkeleton />}>
          <SuggestionsPageClient />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
