import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AudienceWorkbenchClient } from "./audience-workbench-client";

export const metadata = {
  title: "Audience | Emails",
  description: "Build reusable audience segments for email campaigns",
};

export default async function EmailsAudiencePage() {
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "audience"))) {
    redirect("/dashboard?error=access_denied");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audience</h1>
          <p className="text-muted-foreground">
            Build reusable audience segments with validated SQL, AI-assisted generation, and filter-driven workflows.
          </p>
        </div>
        <AudienceWorkbenchClient />
      </div>
    </DashboardLayout>
  );
}
