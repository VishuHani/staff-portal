import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { getAllRoles } from "@/lib/actions/admin/roles";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AdvancedPermissionsClient } from "./advanced-permissions-client";

export default async function AdvancedPermissionsPage() {
  const user = await requireAdmin();

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
