import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SettingsClient } from "./settings-client";
import { getUnreadCount } from "@/lib/actions/notifications";

export const metadata = {
  title: "Settings | Staff Portal",
  description: "Manage your account settings and preferences",
};

export default async function MySettingsPage() {
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
