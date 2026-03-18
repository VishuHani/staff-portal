import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { getInviteSettingsAction } from "@/lib/actions/invites";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { InviteSettingsClient } from "./settings-client";

export default async function InviteSettingsPage() {
  const user = await requireAdmin();

  const result = await getInviteSettingsAction();

  if (!result.success || !result.settings) {
    redirect("/system/invites?error=failed-to-load-settings");
  }

  return (
    <DashboardLayout user={user}>
      <InviteSettingsClient settings={result.settings} />
    </DashboardLayout>
  );
}
