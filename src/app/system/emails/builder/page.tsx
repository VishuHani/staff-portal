import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmailBuilderClient } from "./email-builder-client";

export default async function EmailBuilderPage() {
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

  // Get emails (templates and regular emails)
  const whereClause: any = {};

  // Non-admins can only see emails for their venue or system emails
  if (user.role.name !== "ADMIN") {
    whereClause.OR = [
      { venueId: user.venueId },
      { venueId: null, isSystem: true },
    ];
  }

  const emails = await prisma.email.findMany({
    where: whereClause,
    include: {
      venue: {
        select: { id: true, name: true, code: true },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: [
      { isTemplate: "desc" },
      { updatedAt: "desc" },
    ],
  });

  // Get venues for filtering (admin only)
  let venues: Array<{ id: string; name: string; code: string }> = [];
  if (user.role.name === "ADMIN") {
    venues = await prisma.venue.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <EmailBuilderClient
      emails={emails}
      venues={venues}
      isAdmin={user.role.name === "ADMIN"}
      userVenueId={user.venueId}
    />
  );
}
