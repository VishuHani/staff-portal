import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { FolderManagerClient } from "@/components/email-workspace/folder-manager-client";

export const metadata = {
  title: "Create Email | Emails",
  description: "Build, draft, preview, and test emails",
};

export default async function EmailsCreatePage() {
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "create"))) {
    redirect("/dashboard?error=access_denied");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Create Email</h1>
          <p className="text-muted-foreground">
            Build, draft, preview, and test emails. Organize templates and drafts with folders.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/emails/create/new">Create New Email</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/system/emails/builder">Open Email Builder Library</Link>
          </Button>
        </div>

        <FolderManagerClient
          module="create"
          title="Email Folders"
          description="Organize templates and draft emails into nested folders."
          createPlaceholder="New email folder"
          emptyMessage="No email folders yet. Create your first email folder."
        />
      </div>
    </DashboardLayout>
  );
}
