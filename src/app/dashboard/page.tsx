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

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const [unreadResult, messageCountResult] = await Promise.all([
    getUnreadCount({ userId: user.id }),
    getUnreadMessageCount(),
  ]);

  // Get role-specific dashboard data
  const userRole = user.role.name;

  // Staff Dashboard
  if (userRole === "STAFF") {
    const dashboardData = await getStaffDashboardData();

    return (
      <DashboardLayout
        user={user}
        unreadCount={unreadResult.count || 0}
        unreadMessageCount={messageCountResult.count || 0}
      >
        <StaffDashboardClient
          userId={user.id}
          kpis={dashboardData.success ? dashboardData.data.kpis : null}
          upcomingShifts={dashboardData.success ? dashboardData.data.upcomingShifts : []}
          weeklySummary={dashboardData.success ? dashboardData.data.weeklySummary : []}
          recentActivity={dashboardData.success ? dashboardData.data.recentActivity : []}
          trends={dashboardData.success ? dashboardData.data.trends : []}
          unreadMessageCount={messageCountResult.count || 0}
        />
      </DashboardLayout>
    );
  }

  // Manager Dashboard
  if (userRole === "MANAGER") {
    const dashboardData = await getManagerDashboardData();

    return (
      <DashboardLayout
        user={user}
        unreadCount={unreadResult.count || 0}
        unreadMessageCount={messageCountResult.count || 0}
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

  // Admin Dashboard
  if (userRole === "ADMIN") {
    const dashboardData = await getAdminDashboardData();

    return (
      <DashboardLayout
        user={user}
        unreadCount={unreadResult.count || 0}
        unreadMessageCount={messageCountResult.count || 0}
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

  // Fallback (should never reach here)
  return (
    <DashboardLayout
      user={user}
      unreadCount={unreadResult.count || 0}
      unreadMessageCount={messageCountResult.count || 0}
    >
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Welcome back, {user.firstName}!
          </h2>
          <p className="mt-2 text-muted-foreground">
            Dashboard loading...
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
