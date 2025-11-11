import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";
import {
  getNotificationStatistics,
  getNotificationHistory,
  getAnnouncementHistory,
} from "@/lib/actions/admin/notifications";
import { NotificationsPageClient } from "./notifications-page-client";

export default async function AdminNotificationsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch initial data in parallel
  const [
    unreadResult,
    messageCountResult,
    statsResult,
    historyResult,
    announcementsResult,
  ] = await Promise.all([
    getUnreadCount({ userId: user.id }),
    getUnreadMessageCount(),
    getNotificationStatistics(),
    getNotificationHistory({ limit: 50 }),
    getAnnouncementHistory(),
  ]);

  // Handle errors
  if (statsResult.error) {
    return (
      <DashboardLayout
        user={user}
        unreadCount={unreadResult.count || 0}
        unreadMessageCount={messageCountResult.count || 0}
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Notification Center
            </h2>
            <p className="text-muted-foreground">
              Manage and monitor all system notifications
            </p>
          </div>
          <div className="text-destructive">{statsResult.error}</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      user={user}
      unreadCount={unreadResult.count || 0}
      unreadMessageCount={messageCountResult.count || 0}
    >
      <NotificationsPageClient
        stats={statsResult.stats!}
        initialNotifications={historyResult.success ? historyResult.notifications! : []}
        announcements={announcementsResult.success ? announcementsResult.announcements! : []}
      />
    </DashboardLayout>
  );
}
