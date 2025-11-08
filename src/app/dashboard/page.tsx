import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { logout } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <h1 className="text-xl font-semibold">Staff Portal</h1>
          <form action={logout}>
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold">Welcome back!</h2>
          <p className="mt-2 text-gray-600">
            You're logged in as {user.email}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Your Profile</CardTitle>
              <CardDescription>Account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <p className="text-sm font-medium text-gray-500">Email</p>
                <p className="text-sm">{user.email}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Role</p>
                <p className="text-sm capitalize">{user.role.name}</p>
              </div>
              {user.store && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Store</p>
                  <p className="text-sm">{user.store.name}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <p className="text-sm">
                  {user.active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-600">Inactive</span>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

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
                    className="text-sm text-gray-600"
                  >
                    • {rp.permission.resource}:{rp.permission.action}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

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
                View Schedule
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Coming Soon</CardTitle>
              <CardDescription>
                Features in development
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Availability Management</li>
                <li>• Time-Off Requests & Approvals</li>
                <li>• Team Communication & Posts</li>
                <li>• Direct Messaging</li>
                <li>• Schedule Viewing</li>
                <li>• Notifications</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
