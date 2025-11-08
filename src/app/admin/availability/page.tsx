import { requireManager } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  getAllUsersAvailability,
  getAvailabilityStats,
} from "@/lib/actions/availability";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DAYS_OF_WEEK } from "@/lib/schemas/availability";
import { Calendar, Users, UserCheck, UserX, Clock } from "lucide-react";

export default async function AdminAvailabilityPage() {
  const user = await requireManager();

  const [usersResult, statsResult] = await Promise.all([
    getAllUsersAvailability(),
    getAvailabilityStats(),
  ]);

  if ("error" in usersResult || "error" in statsResult) {
    return (
      <DashboardLayout user={user}>
        <div className="flex min-h-[60vh] items-center justify-center">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Error</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                {usersResult.error || statsResult.error}
              </p>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  const { users } = usersResult;
  const { stats } = statsResult;

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h2 className="text-3xl font-bold tracking-tight">
              Staff Availability
            </h2>
          </div>
          <p className="mt-2 text-muted-foreground">
            View and manage all staff availability schedules (multiple slots per day)
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Staff
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                With Availability
              </CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usersConfigured}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.totalUsers > 0
                  ? Math.round((stats.usersConfigured / stats.totalUsers) * 100)
                  : 0}
                % configured
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Without Availability
              </CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.usersNotConfigured}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Not yet configured
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Slots
              </CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.reduce((sum, u) => sum + u.availability.length, 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all staff
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Availability by Day */}
        <Card>
          <CardHeader>
            <CardTitle>Availability by Day</CardTitle>
            <CardDescription>
              Number of staff with at least one slot on each day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.byDay.map((dayStat) => {
                const dayInfo = DAYS_OF_WEEK.find(
                  (d) => d.value === dayStat.dayOfWeek
                );
                if (!dayInfo) return null;

                return (
                  <div key={dayStat.dayOfWeek} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{dayInfo.label}</span>
                      <div className="flex gap-2">
                        <Badge variant="default" className="bg-green-600">
                          {dayStat.available} staff ({dayStat.percentage}%)
                        </Badge>
                        <Badge variant="secondary">
                          {dayStat.unavailable} unavailable
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-green-600"
                        style={{ width: `${dayStat.percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Staff Availability List */}
        <Card>
          <CardHeader>
            <CardTitle>Staff Schedules</CardTitle>
            <CardDescription>
              Detailed availability for each staff member (showing all time slots)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {users.map((staffUser) => {
                // Group slots by day
                const slotsByDay: Record<number, typeof staffUser.availability> =
                  {};
                DAYS_OF_WEEK.forEach((day) => {
                  slotsByDay[day.value] = staffUser.availability
                    .filter((a) => a.dayOfWeek === day.value)
                    .sort((a, b) => a.startTime.localeCompare(b.startTime));
                });

                const hasAnySlots = staffUser.availability.length > 0;

                return (
                  <div
                    key={staffUser.id}
                    className="rounded-lg border p-4 space-y-4"
                  >
                    {/* Staff Info */}
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{staffUser.email}</p>
                          <Badge variant="secondary">{staffUser.role.name}</Badge>
                        </div>
                        {staffUser.store && (
                          <p className="text-sm text-muted-foreground">
                            {staffUser.store.name}
                          </p>
                        )}
                      </div>
                      <div>
                        {hasAnySlots ? (
                          <Badge variant="default" className="bg-green-600">
                            {staffUser.availability.length} slot
                            {staffUser.availability.length !== 1 ? "s" : ""}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No availability set</Badge>
                        )}
                      </div>
                    </div>

                    {/* Weekly Schedule */}
                    {hasAnySlots && (
                      <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7">
                        {DAYS_OF_WEEK.map((dayInfo) => {
                          const daySlots = slotsByDay[dayInfo.value] || [];
                          const hasSlots = daySlots.length > 0;

                          return (
                            <div
                              key={dayInfo.value}
                              className={`rounded-md border p-3 text-center ${
                                hasSlots
                                  ? "border-green-200 bg-green-50"
                                  : "border-gray-200 bg-gray-50"
                              }`}
                            >
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {dayInfo.short}
                              </div>
                              {hasSlots ? (
                                <div className="space-y-2">
                                  {daySlots.map((slot) => (
                                    <div
                                      key={slot.id}
                                      className="bg-white rounded border border-green-300 p-1.5"
                                    >
                                      <div className="text-xs font-medium text-green-700">
                                        {slot.startTime}
                                      </div>
                                      <div className="text-xs text-green-600">to</div>
                                      <div className="text-xs font-medium text-green-700">
                                        {slot.endTime}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-xs text-muted-foreground">
                                  —
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {users.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  No staff members found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
