import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/rbac/access";
import { getAllRoles, getAllPermissions } from "@/lib/actions/admin/roles";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { RolesPageClient } from "./roles-page-client";
import { SYSTEM_PERMISSIONS } from "@/lib/rbac/system-permissions";

export default async function AdminRolesPage() {
  const user = await requireAnyPermission(SYSTEM_PERMISSIONS.rolesRead);

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
