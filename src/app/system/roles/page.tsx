import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { getAllRoles, getAllPermissions } from "@/lib/actions/admin/roles";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RolesPageClient } from "./roles-page-client";

export default async function AdminRolesPage() {
  const user = await requireAdmin();

  const [rolesResult, permissionsResult] = await Promise.all([
    getAllRoles(),
    getAllPermissions(),
  ]);

  if (rolesResult.error || permissionsResult.error) {
    redirect("/dashboard?error=forbidden");
  }

  const roles = rolesResult.roles ?? [];
  const permissions = permissionsResult.permissions ?? [];

  return (
    <DashboardLayout user={user}>
      <RolesPageClient roles={roles as any} permissions={permissions as any} />
    </DashboardLayout>
  );
}
