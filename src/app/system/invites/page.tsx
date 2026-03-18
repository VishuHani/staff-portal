import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/rbac/access";
import { getInvitations, getInvitationStats, getInvitableVenues, getInviteRoles } from "@/lib/actions/invites";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EnhancedInvitesPageClient } from "./invites-page-enhanced";

export default async function AdminInvitesPage() {
  const user = await requireAdmin();

  const [invitationsResult, statsResult, venuesResult, rolesResult] = await Promise.all([
    getInvitations(),
    getInvitationStats(),
    getInvitableVenues(),
    getInviteRoles(),
  ]);

  if (!invitationsResult.success || !statsResult.success || !venuesResult.success || !rolesResult.success) {
    redirect("/dashboard?error=failed-to-load");
  }

  return (
    <DashboardLayout user={user}>
      <EnhancedInvitesPageClient
        invitations={invitationsResult.invitations || []}
        stats={statsResult.stats || { total: 0, pending: 0, accepted: 0, expired: 0, cancelled: 0 }}
        venues={venuesResult.venues || []}
        roles={rolesResult.roles || []}
        isAdmin={true}
      />
    </DashboardLayout>
  );
}
