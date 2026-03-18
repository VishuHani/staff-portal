import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { PaySettingsClient } from "./pay-settings-client";
import { DashboardLayout } from "@/components/layout/dashboard-layout";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VenuePaySettingsPage({ params }: PageProps) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: venueId } = await params;

  // Check access - must be admin or have venue pay config permission
  const userWithPermissions = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      venuePermissions: {
        where: { venueId },
        include: { permission: true },
      },
    },
  });

  if (!userWithPermissions) {
    redirect("/login");
  }

  const userIsAdmin = userWithPermissions.role?.name === "ADMIN";
  const userIsManager = userWithPermissions.role?.name === "MANAGER";
  const hasVenuePayPermission = userWithPermissions.venuePermissions.some(
    (p) => p.permission.action === "manage" && p.permission.resource === "venue_pay_config"
  );

  // Allow ADMIN, MANAGER, or users with explicit venue pay permission
  if (!userIsAdmin && !userIsManager && !hasVenuePayPermission) {
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
