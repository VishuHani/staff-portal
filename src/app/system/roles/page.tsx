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

  if ("error" in rolesResult || "error" in permissionsResult) {
    redirect("/dashboard?error=forbidden");
  }

  const { roles } = rolesResult;
  const { permissions } = permissionsResult;

  return (
    <DashboardLayout user={user}>
      <RolesPageClient roles={roles} permissions={permissions} />
    </DashboardLayout>
  );
}
