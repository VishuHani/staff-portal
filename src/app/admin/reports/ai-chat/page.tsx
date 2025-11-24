import { Suspense } from "react";
import { requireAnyPermission } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AIChatClient } from "./ai-chat-client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "AI Chat Assistant | Reports",
  description: "Ask natural language questions about staff availability",
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

export default async function AIChatPage() {
  // Allow managers and admins with AI report permissions
  const user = await requireAnyPermission([
    { resource: "reports", action: "view_ai" },
  ]);

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">AI Chat Assistant</h1>
          <p className="text-muted-foreground mt-1">
            Ask natural language questions about staff availability and scheduling
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
