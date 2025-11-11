import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AuditLogsPageClient } from "./audit-logs-page-client";
import {
  getAuditLogStats,
  getAuditLogFilterOptions,
} from "@/lib/actions/admin/audit-logs";

export default async function AdminAuditPage() {
  const user = await requireAdmin();

  const [statsResult, optionsResult] = await Promise.all([
    getAuditLogStats(),
    getAuditLogFilterOptions(),
  ]);

  if (statsResult.error || optionsResult.error) {
    console.error("Error loading audit page data:", statsResult.error || optionsResult.error);
    redirect("/dashboard?error=forbidden");
  }

  return (
    <DashboardLayout user={user}>
      <div className="container max-w-7xl py-6">
        <AuditLogsPageClient
          stats={statsResult.stats!}
          filterOptions={optionsResult.options!}
        />
      </div>
    </DashboardLayout>
  );
}
