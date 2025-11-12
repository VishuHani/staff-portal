import { Suspense } from "react";
import { requireAuth } from "@/lib/rbac/access";
import { SuggestionsPageClient } from "./suggestions-client";
import { Skeleton } from "@/components/ui/skeleton";

export default async function SuggestionsPage() {
  await requireAuth();

  return (
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
  );
}

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
