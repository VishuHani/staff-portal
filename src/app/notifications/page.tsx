import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { NotificationList } from "@/components/notifications/NotificationList";
import { getAllNotifications, getUnreadCount } from "@/lib/actions/notifications";

export default async function NotificationsPage() {
  const user = await requireAuth();

  // Fetch initial notifications and unread count on server
  const [result, unreadResult] = await Promise.all([
    getAllNotifications({
      userId: user.id,
      unreadOnly: false,
      limit: 20,
    }),
    getUnreadCount({ userId: user.id }),
  ]);

  const initialNotifications = result.notifications || [];
  const initialCursor = result.nextCursor || null;
  const unreadCount = unreadResult.count || 0;

  return (
    <DashboardLayout user={user} unreadCount={unreadCount}>
      <div className="container max-w-4xl py-6">
        <NotificationList
          userId={user.id}
          initialNotifications={initialNotifications}
          initialCursor={initialCursor}
        />
      </div>
    </DashboardLayout>
  );
}
