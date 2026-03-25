import { redirect } from "next/navigation";
import { requireAnyPermission } from "@/lib/rbac/access";
import { getAllRoles } from "@/lib/actions/admin/roles";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AdvancedPermissionsClient } from "./advanced-permissions-client";
import { SYSTEM_PERMISSIONS } from "@/lib/rbac/system-permissions";

export default async function AdvancedPermissionsPage() {
  const user = await requireAnyPermission(SYSTEM_PERMISSIONS.permissionsManage);

  const rolesResult = await getAllRoles();

  if (rolesResult.error) {
    redirect("/dashboard?error=forbidden");
  }

  const roles = rolesResult.roles ?? [];

  return (
    <DashboardLayout user={user}>
      <AdvancedPermissionsClient roles={roles} />
    </DashboardLayout>
  );
}
