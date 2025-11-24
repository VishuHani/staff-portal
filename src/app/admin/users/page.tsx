import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/rbac/access";
import {
  getAllUsers,
  getUserStats,
  getAllRoles,
  getAllStores,
} from "@/lib/actions/admin/users";
import { getActiveVenues } from "@/lib/actions/admin/venues";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, UserX, Shield } from "lucide-react";
import { UsersTable } from "@/components/admin/UsersTable";

export default async function AdminUsersPage() {
  // Allow managers and admins with appropriate permissions
  const user = await requireAnyPermission([
    { resource: "users", action: "view_team" },
    { resource: "users", action: "view_all" },
  ]);

  const [usersResult, statsResult, rolesResult, storesResult, venuesResult] =
    await Promise.all([
      getAllUsers(),
      getUserStats(),
      getAllRoles(),
      getAllStores(),
      getActiveVenues(),
    ]);

  if (
    "error" in usersResult ||
    "error" in statsResult ||
    "error" in rolesResult ||
    "error" in storesResult ||
    "error" in venuesResult
  ) {
    redirect("/dashboard?error=forbidden");
  }

  const { users } = usersResult;
  const { stats } = statsResult;
  const { roles } = rolesResult;
  const { stores } = storesResult;
  const { venues } = venuesResult;

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">User Management</h2>
          <p className="mt-2 text-muted-foreground">
            Manage all users and their permissions
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Active Users
              </CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.active}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Inactive Users
              </CardTitle>
              <UserX className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.inactive}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byRole.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Users</CardTitle>
            <CardDescription>
              Manage users, assign roles, and control access
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UsersTable
              users={users as any}
              roles={roles as any}
              stores={stores as any}
              venues={venues as any}
              currentUser={{
                id: user.id,
                role: { name: user.role.name },
              }}
            />
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
            <CardDescription>
              Number of users assigned to each role
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats.byRole.map((roleStat) => (
                <div
                  key={roleStat.role}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{roleStat.role}</span>
                  </div>
                  <Badge variant="secondary">{roleStat.count} users</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
