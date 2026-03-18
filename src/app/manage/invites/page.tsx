import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { getInvitations, getInvitationStats, getInvitableVenues, getInviteRoles } from "@/lib/actions/invites";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EnhancedInvitesPageClient } from "@/app/system/invites/invites-page-enhanced";

export default async function ManageInvitesPage() {
  const user = await requireAuth();

  // Check if user has permission to invite
  const canInvite = await hasPermission(user.id, "invites", "create");
  if (!canInvite) {
    redirect("/dashboard?error=forbidden");
  }

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
        isAdmin={false}
      />
    </DashboardLayout>
  );
}
