import { requireAdmin } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText } from "lucide-react";

export default async function AdminAuditPage() {
  const user = await requireAdmin();

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Audit Logs</h2>
          <p className="mt-2 text-muted-foreground">
            View system activity and changes
          </p>
        </div>

        <div className="flex min-h-[40vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" />
                <CardTitle>Audit Logs</CardTitle>
              </div>
              <CardDescription>Coming Soon</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                This feature is currently under development. You will be able to
                view and search audit logs for all system activities here.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
