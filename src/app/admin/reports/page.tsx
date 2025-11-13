import { requireAdmin } from "@/lib/rbac/access";
import { getReportsDashboardData } from "@/lib/actions/reports/availability-reports";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Calendar, Clock, TrendingUp, BarChart3, Activity, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ReportsDashboardClient } from "./reports-dashboard-client";
import { Suspense } from "react";

export const metadata = {
  title: "Reports & Analytics",
  description: "Staff availability reports and analytics dashboard",
};

export default async function ReportsPage() {
  const user = await requireAdmin();
  const result = await getReportsDashboardData();

  const stats = result.success ? result.stats : {
    totalStaff: 0,
    activeStaff: 0,
    pendingTimeOff: 0,
    upcomingTimeOff: 0,
  };

  const quickActions = [
    {
      title: "Availability Matrix",
      description: "View staff availability in a grid format",
      icon: Calendar,
      href: "/admin/reports/availability-matrix",
      color: "text-blue-600",
    },
    {
      title: "Coverage Analysis",
      description: "Analyze staffing levels and coverage patterns",
      icon: BarChart3,
      href: "/admin/reports/coverage",
      color: "text-green-600",
    },
    {
      title: "Conflicts Report",
      description: "Identify scheduling conflicts and gaps",
      icon: Activity,
      href: "/admin/reports/conflicts",
      color: "text-orange-600",
    },
    {
      title: "Calendar View",
      description: "Monthly calendar of availability",
      icon: Calendar,
      href: "/admin/reports/calendar",
      color: "text-purple-600",
    },
  ];

  return (
    <DashboardLayout user={user}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Reports & Analytics</h1>
          <p className="text-muted-foreground mt-1">
            View staff availability, analyze coverage, and generate reports
          </p>
        </div>

      {/* Smart Suggestions */}
      <Suspense fallback={<div>Loading suggestions...</div>}>
        <ReportsDashboardClient />
      </Suspense>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStaff}</div>
            <p className="text-xs text-muted-foreground">
              {stats.activeStaff} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeStaff}</div>
            <p className="text-xs text-muted-foreground">
              Available for scheduling
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Time Off</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingTimeOff}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting approval
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming Time Off</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.upcomingTimeOff}</div>
            <p className="text-xs text-muted-foreground">
              Approved requests
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader>
                    <div className="flex items-center space-x-2">
                      <Icon className={`h-5 w-5 ${action.color}`} />
                      <CardTitle className="text-base">{action.title}</CardTitle>
                    </div>
                    <CardDescription className="mt-2">
                      {action.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full">
                      View Report →
                    </Button>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Additional Features Coming Soon */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Features</CardTitle>
          <CardDescription>
            Additional reporting features available in this system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-600" />
                <h3 className="font-medium">AI Chat Assistant</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Ask natural language questions about availability and get instant answers
              </p>
              <Link href="/admin/reports/ai-chat">
                <Button variant="default" size="sm">Try Now →</Button>
              </Link>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Predictive Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Forecast availability trends and predict staffing needs
              </p>
              <Link href="/admin/reports/predictive">
                <Button variant="outline" size="sm">Coming in Phase 3</Button>
              </Link>
            </div>
            <div className="space-y-2">
              <h3 className="font-medium">Export Reports</h3>
              <p className="text-sm text-muted-foreground">
                Download reports in CSV, Excel, PDF, or iCal formats - available in all report views
              </p>
              <Button variant="default" size="sm" disabled>✓ Available in All Reports</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
