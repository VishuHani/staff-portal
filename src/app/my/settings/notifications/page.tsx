import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { NotificationPreferencesClient } from "./notification-preferences-client";
import { getUserNotificationPreferences } from "@/lib/actions/notification-preferences";
import { getUnreadCount } from "@/lib/actions/notifications";

export const metadata = {
  title: "Notification Settings | Staff Portal",
  description: "Manage notification preferences and channels",
};

export default async function MyNotificationSettingsPage() {
  const user = await requireAuth();

  // Fetch user's current preferences and unread count
  const [preferencesResult, unreadResult] = await Promise.all([
    getUserNotificationPreferences(user.id),
    getUnreadCount({ userId: user.id }),
  ]);

  const preferences = preferencesResult.preferences || [];
  const unreadCount = unreadResult.count || 0;

  return (
    <DashboardLayout user={user} unreadCount={unreadCount}>
      <div className="container max-w-4xl py-6">
        <NotificationPreferencesClient
          userId={user.id}
          initialPreferences={preferences}
        />
      </div>
    </DashboardLayout>
  );
}
