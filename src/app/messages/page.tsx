import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail } from "lucide-react";

export default async function MessagesPage() {
  const user = await requireAuth();

  return (
    <DashboardLayout user={user}>
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Mail className="h-6 w-6 text-primary" />
              <CardTitle>Direct Messages</CardTitle>
            </div>
            <CardDescription>Coming Soon</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This feature is currently under development. You will be able to
              send and receive direct messages here.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
