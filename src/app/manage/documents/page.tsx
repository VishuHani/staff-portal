import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasAnyPermission, isAdmin } from "@/lib/rbac/permissions";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DocumentsManageClient } from "./documents-manage-client";

export default async function ManageDocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.active) {
    redirect("/login?error=inactive");
  }

  // Check if user has document permissions (read or assign)
  const canReadDocuments = await hasAnyPermission(user.id, [
    { resource: "documents", action: "read" },
    { resource: "documents", action: "assign" },
  ]);

  // Also allow managers and admins
  const isUserAdmin = await isAdmin(user.id);

  if (!canReadDocuments && !isUserAdmin) {
    redirect("/dashboard?error=forbidden");
  }

  // Get user's accessible venues based on permissions
  // Admin has access to all venues
  let userVenues;
  if (isUserAdmin) {
    // Admin can see all active venues
    userVenues = await prisma.venue.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    // Non-admin: only venues they're assigned to
    userVenues = await prisma.venue.findMany({
      where: {
        active: true,
        OR: [
          // User has explicit venue assignment via UserVenue
          { userVenues: { some: { userId: user.id } } },
          // User has venue permissions for this venue
          { venuePermissions: { some: { userId: user.id } } },
          // User's primary venue
          { users: { some: { id: user.id } } },
        ],
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  }

  // If user has no venues, they can't manage documents
  if (userVenues.length === 0) {
    redirect("/dashboard?error=no_venues");
  }

  // For admins, default to "all" venues view
  // For other users, default to their primary venue or first available
  const initialVenueId = isUserAdmin ? "all" : (user.venueId || userVenues[0]?.id || null);

  return (
    <DashboardLayout user={user}>
      <DocumentsManageClient
        venues={userVenues}
        initialVenueId={initialVenueId}
        canAssignDocuments={canReadDocuments || isUserAdmin}
        isAdmin={isUserAdmin}
      />
    </DashboardLayout>
  );
}
