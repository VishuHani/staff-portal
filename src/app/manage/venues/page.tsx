import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ManageVenuesClient } from "./manage-venues-client";

export default async function ManageVenuesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Check access - must be admin or manager
  const userWithRole = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      role: true,
    },
  });

  if (!userWithRole) {
    redirect("/login");
  }

  const userIsAdmin = userWithRole.role?.name === "ADMIN";
  const userIsManager = userWithRole.role?.name === "MANAGER";

  if (!userIsAdmin && !userIsManager) {
    redirect("/unauthorized");
  }

  // Get venues - admins see all, managers see only their assigned venues
  const venues = await prisma.venue.findMany({
    where: userIsAdmin
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
