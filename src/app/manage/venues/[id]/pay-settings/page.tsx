import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { PaySettingsClient } from "./pay-settings-client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getUserVenueIds } from "@/lib/utils/venue";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VenuePaySettingsPage({ params }: PageProps) {
  const user = await requireAuth();

  const { id: venueId } = await params;

  const [canManageStores, canManageVenues, canViewStoresAll, canViewVenuesAll] =
    await Promise.all([
      hasPermission(user.id, "stores", "update", venueId),
      hasPermission(user.id, "venues", "manage", venueId),
      canAccess("stores", "view_all"),
      canAccess("venues", "view_all"),
    ]);

  const venuePayPermissions = await prisma.userVenuePermission.findMany({
    where: { userId: user.id, venueId },
    select: {
      permission: {
        select: {
          resource: true,
          action: true,
        },
      },
    },
  });

  const hasVenuePayPermission = venuePayPermissions.some(
    (entry) =>
      entry.permission.resource === "venue_pay_config" &&
      entry.permission.action === "manage"
  );
  const hasGlobalVenueScope = canViewStoresAll || canViewVenuesAll;

  if (!hasGlobalVenueScope) {
    const userVenueIds = await getUserVenueIds(user.id);
    if (!userVenueIds.includes(venueId)) {
      redirect("/unauthorized");
    }
  }

  if (!canManageStores && !canManageVenues && !hasVenuePayPermission) {
    redirect("/unauthorized");
  }

  // Get venue details
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    include: {
      payConfig: true,
      shiftTemplates: {
        where: { isActive: true },
        orderBy: { displayOrder: "asc" },
      },
      breakRules: {
        where: { isActive: true },
        orderBy: [{ priority: "desc" }, { name: "asc" }],
      },
      customRates: {
        orderBy: [{ startDate: "asc" }, { name: "asc" }],
      },
    },
  });

  if (!venue) {
    redirect("/manage/venues");
  }

  // Get staff with pay rates
  const staff = await prisma.user.findMany({
    where: {
      OR: [
        { venueId },
        { venues: { some: { venueId } } },
      ],
      active: true,
      deletedAt: null,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      role: { select: { name: true } },
      weekdayRate: true,
      saturdayRate: true,
      sundayRate: true,
      publicHolidayRate: true,
      overtimeRate: true,
      lateRate: true,
      // Superannuation fields
      superEnabled: true,
      customSuperRate: true,
    },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });

  return (
    <DashboardLayout user={user}>
      <PaySettingsClient
        venue={JSON.parse(JSON.stringify(venue))}
        staff={JSON.parse(JSON.stringify(staff))}
      />
    </DashboardLayout>
  );
}
