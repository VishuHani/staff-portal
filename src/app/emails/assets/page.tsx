import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AssetsLibraryClient } from "./assets-library-client";

export const metadata = {
  title: "Assets | Emails",
  description: "Manage email assets and folder organization",
};

export default async function EmailsAssetsPage() {
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "assets"))) {
    redirect("/dashboard?error=access_denied");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Assets</h1>
          <p className="text-muted-foreground">
            Organize images, GIFs, videos, and files with searchable indexing and nested folders.
          </p>
        </div>
        <AssetsLibraryClient />
      </div>
    </DashboardLayout>
  );
}
