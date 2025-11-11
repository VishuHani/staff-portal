import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SettingsClient } from "./settings-client";
import { getUnreadCount } from "@/lib/actions/notifications";

export default async function SettingsPage() {
  const user = await requireAuth();

  const unreadResult = await getUnreadCount({ userId: user.id });

  return (
    <DashboardLayout user={user} unreadCount={unreadResult.count || 0}>
      <div className="container max-w-6xl py-6">
        <SettingsClient />
      </div>
    </DashboardLayout>
  );
}
