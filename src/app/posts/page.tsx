import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default async function PostsPage() {
  const user = await requireAuth();

  return (
    <DashboardLayout user={user}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-6 w-6 text-primary" />
              <CardTitle>Team Posts</CardTitle>
            </div>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This feature is currently under development. You will be able to
              view and create team posts here.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
