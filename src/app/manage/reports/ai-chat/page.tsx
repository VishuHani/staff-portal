import { Suspense } from "react";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { redirect } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AIChatClient } from "./ai-chat-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "AI Chat Assistant | Team Reports",
  description: "Ask natural language questions about your team's availability",
};

function ChatSkeleton() {
  return (
    <Card className="h-[600px]">
      <CardContent className="p-6 h-full flex flex-col">
        <div className="space-y-4 flex-1">
          <Skeleton className="h-20 w-3/4" />
          <Skeleton className="h-20 w-2/3 ml-auto" />
          <Skeleton className="h-20 w-3/4" />
        </div>
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

export default async function ManagerAIChatPage() {
  const user = await requireAuth();

  // Only allow managers with view_ai permission
  const hasAccess = await canAccess("reports", "view_ai");
  if (!hasAccess) {
    redirect("/dashboard");
  }

  // Redirect admins to their version
  if (user.role.name === "ADMIN") {
    redirect("/system/reports/ai-chat");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">AI Chat Assistant</h1>
          <p className="text-muted-foreground mt-1">
            Ask natural language questions about your team's availability and scheduling
          </p>
        </div>

        {/* Chat Interface */}
        <Suspense fallback={<ChatSkeleton />}>
          <AIChatClient />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
