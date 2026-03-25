import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";
import { getStaffDashboardData } from "@/lib/actions/dashboard/staff-dashboard";
import { getManagerDashboardData } from "@/lib/actions/dashboard/manager-dashboard";
import { getAdminDashboardData } from "@/lib/actions/dashboard/admin-dashboard";
import { StaffDashboardClient } from "@/components/dashboard/staff/StaffDashboardClient";
import { ManagerDashboardClient } from "@/components/dashboard/manager/ManagerDashboardClient";
import { AdminDashboardClient } from "@/components/dashboard/admin/AdminDashboardClient";
import { hasAnyPermission } from "@/lib/rbac/permissions";
import { SYSTEM_PERMISSIONS } from "@/lib/rbac/system-permissions";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  let unreadCount = 0;
  let unreadMessageCount = 0;

  try {
    const [unreadResult, messageCountResult] = await Promise.all([
      getUnreadCount({ userId: user.id }),
      getUnreadMessageCount(),
    ]);
    unreadCount = unreadResult.count || 0;
    unreadMessageCount = messageCountResult.success
      ? (messageCountResult.count ?? 0)
      : 0;
  } catch (error) {
    console.error("Error loading dashboard unread counters:", error);
  }

  // Get role-specific dashboard data
  const safeRoleName = user.role?.name ?? "STAFF";
  const safeUser = {
    ...user,
    role: {
      name: safeRoleName,
    },
  };
  const [canViewAdminDashboard, canViewManagerDashboard] = await Promise.all([
    hasAnyPermission(user.id, SYSTEM_PERMISSIONS.dashboardAdmin),
    hasAnyPermission(user.id, [
      { resource: "reports", action: "view_team" },
      { resource: "dashboard", action: "view_team" },
    ]),
  ]);

  // Admin-capability dashboard
  if (canViewAdminDashboard) {
    const dashboardData = await getAdminDashboardData();

    return (
      <DashboardLayout
        user={safeUser}
        unreadCount={unreadCount}
        unreadMessageCount={unreadMessageCount}
      >
        <AdminDashboardClient
          userId={user.id}
          globalStats={dashboardData.success ? dashboardData.data.globalStats : null}
          venueComparison={dashboardData.success ? dashboardData.data.venueComparison : []}
          activityHeatmap={dashboardData.success ? dashboardData.data.activityHeatmap : null}
          actionDistribution={dashboardData.success ? dashboardData.data.actionDistribution : []}
          roleDistribution={dashboardData.success ? dashboardData.data.roleDistribution : []}
          approvalMetrics={dashboardData.success ? dashboardData.data.approvalMetrics : []}
          auditLogs={dashboardData.success ? dashboardData.data.auditLogs : []}
        />
      </DashboardLayout>
    );
  }

  // Team-capability dashboard
  if (canViewManagerDashboard) {
    const dashboardData = await getManagerDashboardData();

    return (
      <DashboardLayout
        user={safeUser}
        unreadCount={unreadCount}
        unreadMessageCount={unreadMessageCount}
      >
        <ManagerDashboardClient
          userId={user.id}
          heroStats={dashboardData.success ? dashboardData.data.heroStats : null}
          heatmap={dashboardData.success ? dashboardData.data.heatmap : null}
          distribution={dashboardData.success ? dashboardData.data.distribution : []}
          trend={dashboardData.success ? dashboardData.data.trend : []}
          insights={dashboardData.success ? dashboardData.data.insights : []}
          snapshot={dashboardData.success ? dashboardData.data.snapshot : []}
        />
      </DashboardLayout>
    );
  }

  // Personal dashboard
  {
    const dashboardData = await getStaffDashboardData();

    return (
      <DashboardLayout
        user={safeUser}
        unreadCount={unreadCount}
        unreadMessageCount={unreadMessageCount}
      >
        <StaffDashboardClient
          userId={user.id}
          kpis={dashboardData.success ? dashboardData.data.kpis : null}
          upcomingShifts={dashboardData.success ? dashboardData.data.upcomingShifts : []}
          weeklySummary={dashboardData.success ? dashboardData.data.weeklySummary : []}
          recentActivity={dashboardData.success ? dashboardData.data.recentActivity : []}
          trends={dashboardData.success ? dashboardData.data.trends : []}
          unreadMessageCount={unreadMessageCount}
        />
      </DashboardLayout>
    );
  }
}
