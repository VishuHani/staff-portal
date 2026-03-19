import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ReportsWorkbenchClient } from "./reports-workbench-client";

export const metadata = {
  title: "Reports | Emails",
  description: "Custom reports and scheduled analytics for email workflows",
};

export default async function EmailsReportsPage() {
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "reports"))) {
    redirect("/dashboard?error=access_denied");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Reports</h1>
          <p className="text-muted-foreground">
            Build custom reporting definitions and organize recurring report workflows.
          </p>
        </div>
        <ReportsWorkbenchClient />
      </div>
    </DashboardLayout>
  );
}
