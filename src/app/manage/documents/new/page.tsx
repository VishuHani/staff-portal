import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasAnyPermission, isAdmin } from "@/lib/rbac/permissions";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { FormCreationWizard } from "@/components/documents/form-creation/FormCreationWizard";

export default async function NewDocumentTemplatePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.active) {
    redirect("/login?error=inactive");
  }

  // Check if user has document create permission
  const canCreateDocuments = await hasAnyPermission(user.id, [
    { resource: "documents", action: "create" },
  ]);

  const isUserAdmin = await isAdmin(user.id);

  if (!canCreateDocuments && !isUserAdmin) {
    redirect("/dashboard?error=forbidden");
  }

  // Get user's venues
  let userVenues;
  if (isUserAdmin) {
    userVenues = await prisma.venue.findMany({
      where: { active: true },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  } else {
    userVenues = await prisma.venue.findMany({
      where: {
        active: true,
        OR: [
          { userVenues: { some: { userId: user.id } } },
          { venuePermissions: { some: { userId: user.id } } },
          { users: { some: { id: user.id } } },
        ],
      },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  if (userVenues.length === 0) {
    redirect("/dashboard?error=no_venues");
  }

  // Use the first venue (or user's primary venue if available)
  const defaultVenueId = user.venueId || userVenues[0]?.id;

  return (
    <DashboardLayout user={user}>
      <FormCreationWizard
        venues={userVenues}
        defaultVenueId={defaultVenueId}
      />
    </DashboardLayout>
  );
}
