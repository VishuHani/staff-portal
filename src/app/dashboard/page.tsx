import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";
import { getStaffDashboardData } from "@/lib/actions/dashboard/staff-dashboard";
import { getManagerDashboardData } from "@/lib/actions/dashboard/manager-dashboard";
import { getAdminDashboardData } from "@/lib/actions/dashboard/admin-dashboard";
import { WeekAtGlance } from "@/components/dashboard/staff/WeekAtGlance";
import { StaffKPICards } from "@/components/dashboard/staff/StaffKPICards";
import { QuickActions } from "@/components/dashboard/staff/QuickActions";
import { RecentActivityFeed } from "@/components/dashboard/staff/RecentActivityFeed";
import { PersonalStatsChart } from "@/components/dashboard/staff/PersonalStatsChart";
import { UpcomingShiftsWidget } from "@/components/dashboard/staff/UpcomingShiftsWidget";
import { HeroStatsBar } from "@/components/dashboard/manager/HeroStatsBar";
import { CoverageHeatmap } from "@/components/dashboard/manager/CoverageHeatmap";
import { TeamAvailabilityPie } from "@/components/dashboard/manager/TeamAvailabilityPie";
import { CoverageTrendChart } from "@/components/dashboard/manager/CoverageTrendChart";
import { AIInsightsPanel } from "@/components/dashboard/manager/AIInsightsPanel";
import { TeamSnapshotTable } from "@/components/dashboard/manager/TeamSnapshotTable";
import { GlobalStatsCards } from "@/components/dashboard/admin/GlobalStatsCards";
import { VenueComparisonChart } from "@/components/dashboard/admin/VenueComparisonChart";
import { UserActivityHeatmap } from "@/components/dashboard/admin/UserActivityHeatmap";
import { ActionDistributionPie } from "@/components/dashboard/admin/ActionDistributionPie";
import { RoleDistributionDonut } from "@/components/dashboard/admin/RoleDistributionDonut";
import { ApprovalTurnaroundChart } from "@/components/dashboard/admin/ApprovalTurnaroundChart";
import { AuditLogFeed } from "@/components/dashboard/admin/AuditLogFeed";

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
        <div className="space-y-6">
          {/* Welcome Section */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Welcome back, {user.firstName}!
            </h2>
            <p className="mt-2 text-muted-foreground">
              Here's your dashboard overview
            </p>
          </div>

          {/* KPI Cards */}
          {dashboardData.success && (
            <StaffKPICards kpis={dashboardData.data.kpis} />
          )}

          {/* Quick Actions */}
          <QuickActions unreadMessageCount={messageCountResult.count || 0} />

          {/* Two Column Layout */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Upcoming Shifts */}
            {dashboardData.success && (
              <UpcomingShiftsWidget shifts={dashboardData.data.upcomingShifts} />
            )}

            {/* Week at a Glance */}
            {dashboardData.success && (
              <WeekAtGlance summary={dashboardData.data.weeklySummary} />
            )}

            {/* Recent Activity */}
            {dashboardData.success && (
              <RecentActivityFeed notifications={dashboardData.data.recentActivity} />
            )}

            {/* Personal Stats Chart */}
            {dashboardData.success && (
              <PersonalStatsChart trends={dashboardData.data.trends} />
            )}
          </div>
        </div>
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
        <div className="space-y-6">
          {/* Welcome Section */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Welcome back, {user.firstName}!
            </h2>
            <p className="mt-2 text-muted-foreground">
              Here's your team management dashboard
            </p>
          </div>

          {/* Hero Stats Bar */}
          {dashboardData.success && (
            <HeroStatsBar stats={dashboardData.data.heroStats} />
          )}

          {/* Main Visualizations Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Coverage Heatmap */}
            {dashboardData.success && (
              <CoverageHeatmap heatmap={dashboardData.data.heatmap} />
            )}

            {/* Team Availability Pie */}
            {dashboardData.success && (
              <TeamAvailabilityPie distribution={dashboardData.data.distribution} />
            )}

            {/* Coverage Trend Chart */}
            {dashboardData.success && (
              <CoverageTrendChart trends={dashboardData.data.trend} />
            )}

            {/* AI Insights Panel */}
            {dashboardData.success && (
              <AIInsightsPanel insights={dashboardData.data.insights} />
            )}
          </div>

          {/* Team Snapshot Table */}
          {dashboardData.success && (
            <TeamSnapshotTable snapshot={dashboardData.data.snapshot} />
          )}
        </div>
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
        <div className="space-y-6">
          {/* Welcome Section */}
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              Welcome back, {user.firstName}!
            </h2>
            <p className="mt-2 text-muted-foreground">
              System-wide administration dashboard
            </p>
          </div>

          {/* Global Stats Cards */}
          {dashboardData.success && (
            <GlobalStatsCards stats={dashboardData.data.globalStats} />
          )}

          {/* Venue Comparison Chart */}
          {dashboardData.success && (
            <VenueComparisonChart comparison={dashboardData.data.venueComparison} />
          )}

          {/* System Activity Grid (2x2) */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* User Activity Heatmap */}
            {dashboardData.success && (
              <UserActivityHeatmap heatmap={dashboardData.data.activityHeatmap} />
            )}

            {/* Action Distribution Pie */}
            {dashboardData.success && (
              <ActionDistributionPie distribution={dashboardData.data.actionDistribution} />
            )}

            {/* Role Distribution Donut */}
            {dashboardData.success && (
              <RoleDistributionDonut distribution={dashboardData.data.roleDistribution} />
            )}

            {/* Approval Turnaround Chart */}
            {dashboardData.success && (
              <ApprovalTurnaroundChart metrics={dashboardData.data.approvalMetrics} />
            )}
          </div>

          {/* Audit Log Feed */}
          {dashboardData.success && (
            <AuditLogFeed logs={dashboardData.data.auditLogs} />
          )}
        </div>
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
