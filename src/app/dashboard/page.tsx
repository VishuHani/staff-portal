import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardLayout user={user}>
      <div className="space-y-8">
        {/* Welcome Section */}
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Welcome back!</h2>
          <p className="mt-2 text-muted-foreground">
            Here's an overview of your account
          </p>
        </div>

        {/* Dashboard Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {/* Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Email
                </p>
                <p className="text-sm">{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Role
                </p>
                <Badge variant="secondary">{user.role.name}</Badge>
              </div>
              {user.store && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Store
                  </p>
                  <p className="text-sm">{user.store.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Status
                </p>
                {user.active ? (
                  <Badge variant="default" className="bg-green-600">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="destructive">Inactive</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Permissions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Permissions</CardTitle>
              <CardDescription>Your access level</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {user.role.rolePermissions.map((rp) => (
                  <div
                    key={rp.permission.id}
                    className="text-sm text-muted-foreground"
                  >
                    • {rp.permission.resource}:{rp.permission.action}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button className="w-full" variant="outline" disabled>
                View Availability
              </Button>
              <Button className="w-full" variant="outline" disabled>
                Request Time Off
              </Button>
              <Button className="w-full" variant="outline" disabled>
                View Messages
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Card */}
        <Card>
          <CardHeader>
            <CardTitle>Coming Soon</CardTitle>
            <CardDescription>Features in development</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Availability Management
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Time-Off Requests
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Team Communication
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Direct Messaging
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Schedule Viewing
              </li>
              <li className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Notifications
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
