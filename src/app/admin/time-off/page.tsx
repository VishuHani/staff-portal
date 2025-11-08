import { requireManager } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getAllTimeOffRequests } from "@/lib/actions/time-off";
import { TimeOffReviewList } from "@/components/time-off/time-off-review-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar, Clock, CheckCircle, XCircle } from "lucide-react";

export default async function AdminTimeOffPage() {
  const user = await requireManager();

  const result = await getAllTimeOffRequests();

  if ("error" in result) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{result.error}</p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { requests } = result;

  // Calculate stats
  const pending = requests.filter((r) => r.status === "PENDING").length;
  const approved = requests.filter((r) => r.status === "APPROVED").length;
  const rejected = requests.filter((r) => r.status === "REJECTED").length;

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">
              Time-Off Requests
            </h2>
          </div>
          <p className="mt-2 text-muted-foreground">
            Review and manage staff time-off requests
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Requests
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{requests.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Pending Review
              </CardTitle>
              <Clock className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pending}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Awaiting decision
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{approved}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total approved
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{rejected}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Total rejected
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Requests List */}
        <Card>
          <CardHeader>
            <CardTitle>All Requests</CardTitle>
            <CardDescription>
              Review time-off requests from all staff members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimeOffReviewList requests={requests} />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
