import { redirect } from "next/navigation";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ManageVenuesClient } from "./manage-venues-client";

export default async function ManageVenuesPage() {
  const user = await requireAuth();

  const [
    canViewStores,
    canViewStoresAll,
    canViewVenues,
    canViewVenuesAll,
  ] = await Promise.all([
    canAccess("stores", "view"),
    canAccess("stores", "view_all"),
    canAccess("venues", "view"),
    canAccess("venues", "view_all"),
  ]);

  const canViewAnyVenue =
    canViewStores || canViewStoresAll || canViewVenues || canViewVenuesAll;
  const canViewAllVenues = canViewStoresAll || canViewVenuesAll;

  if (!canViewAnyVenue) {
    redirect("/unauthorized");
  }

  // Global-scoped users see all venues; team-scoped users see assigned venues only.
  const venues = await prisma.venue.findMany({
    where: canViewAllVenues
      ? {}
      : {
          userVenues: { some: { userId: user.id } },
        },
    include: {
      _count: {
        select: {
          userVenues: true,
        },
      },
      payConfig: true,
      shiftTemplates: { where: { isActive: true } },
      breakRules: { where: { isActive: true } },
    },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardLayout user={user}>
      <ManageVenuesClient venues={JSON.parse(JSON.stringify(venues))} />
    </DashboardLayout>
  );
}
