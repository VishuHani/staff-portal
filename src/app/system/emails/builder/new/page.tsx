import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { NewEmailClient } from "./new-email-client";

export default async function NewEmailPage() {
  const session = await auth();
  if (!session?.userId) {
    redirect("/login");
  }

  // Get user with role for permission checks
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: true, venue: true },
  });

  if (!user) {
    redirect("/login");
  }

  if (!(await canAccessEmailModule(user.id, "create"))) {
    redirect("/dashboard?error=access_denied");
  }

  // Get templates for starting point
  const whereClause: Prisma.EmailWhereInput = { isTemplate: true };
  if (user.role.name !== "ADMIN") {
    whereClause.OR = [
      { venueId: user.venueId },
      { venueId: null, isSystem: true },
    ];
  }

  const templates = await prisma.email.findMany({
    where: whereClause,
    select: {
      id: true,
      name: true,
      subject: true,
      category: true,
      htmlContent: true,
      designJson: true,
    },
    orderBy: { name: "asc" },
  });

  // Get venues (admin only)
  let venues: Array<{ id: string; name: string; code: string }> = [];
  if (user.role.name === "ADMIN") {
    venues = await prisma.venue.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <DashboardLayout user={user}>
      <NewEmailClient
        templates={templates}
        venues={venues}
        isAdmin={user.role.name === "ADMIN"}
        userVenueId={user.venueId}
      />
    </DashboardLayout>
  );
}
