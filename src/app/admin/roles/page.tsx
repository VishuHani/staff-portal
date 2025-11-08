import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { getAllRoles } from "@/lib/actions/admin/roles";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, Users, Lock } from "lucide-react";

export default async function AdminRolesPage() {
  const user = await requireAdmin();

  const rolesResult = await getAllRoles();

  if ("error" in rolesResult) {
    redirect("/dashboard?error=forbidden");
  }

  const { roles } = rolesResult;

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Role Management
          </h2>
          <p className="mt-2 text-muted-foreground">
            Manage roles and their permissions
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {roles.reduce((sum, role) => sum + role._count.users, 0)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Permissions
              </CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {roles.reduce(
                  (sum, role) => sum + role.rolePermissions.length,
                  0
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Roles List */}
        <div className="space-y-4">
          {roles.map((role) => (
            <Card key={role.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5" />
                      {role.name}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {role.description || "No description"}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {role._count.users} users
                    </Badge>
                    <Badge variant="outline">
                      {role.rolePermissions.length} permissions
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div>
                  <p className="mb-2 text-sm font-medium">Permissions:</p>
                  <div className="flex flex-wrap gap-2">
                    {role.rolePermissions.map((rp) => (
                      <Badge key={rp.id} variant="secondary">
                        {rp.permission.resource}:{rp.permission.action}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
