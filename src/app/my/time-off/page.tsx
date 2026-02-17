import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getMyTimeOffRequests, getTimeOffStats } from "@/lib/actions/time-off";
import { TimeOffRequestForm } from "@/components/time-off/time-off-request-form";
import { TimeOffRequestList } from "@/components/time-off/time-off-request-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, CheckCircle, XCircle, Clock, TrendingUp } from "lucide-react";

export const metadata = {
  title: "My Time Off | Staff Portal",
  description: "Request and manage your time-off",
};

export default async function MyTimeOffPage() {
  const user = await requireAuth();

  const [requestsResult, statsResult] = await Promise.all([
    getMyTimeOffRequests(),
    getTimeOffStats(),
  ]);

  if ("error" in requestsResult || "error" in statsResult) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {requestsResult.error || statsResult.error}
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { requests } = requestsResult;
  const { stats } = statsResult;

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">My Time Off</h2>
          </div>
          <p className="mt-2 text-muted-foreground">
            Request and manage your time-off
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Requests
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting approval
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.approved}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Approved requests
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.rejected}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Rejected requests
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Request Form */}
        <TimeOffRequestForm />

        {/* Requests List */}
        <div>
          <div className="mb-4">
            <h3 className="text-xl font-semibold">Your Requests</h3>
            <p className="text-sm text-muted-foreground mt-1">
              View and manage all your time-off requests
            </p>
          </div>
          <TimeOffRequestList requests={requests} />
        </div>
      </div>
    </DashboardLayout>
  );
}
