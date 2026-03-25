import { redirect, notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import {
  getScopedEmailCreateVenueIds,
  hasGlobalEmailCreateScope,
} from "@/lib/rbac/email-create-scope";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EditEmailClient } from "./edit-email-client";

function normalizeJsonRecord(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as Record<string, unknown>;
}

export default async function EditEmailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const session = await auth();
  if (!session?.userId) {
    redirect("/login");
  }

  const { id } = await params;

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

  const [canAccessAllVenues, scopedVenueIds] = await Promise.all([
    hasGlobalEmailCreateScope(user.id),
    getScopedEmailCreateVenueIds(user.id, user.venueId),
  ]);

  // Get the email
  const email = await prisma.email.findUnique({
    where: { id },
    include: {
      venue: {
        select: { id: true, name: true, code: true },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!email) {
    notFound();
  }

  // Check access permissions
  if (
    !canAccessAllVenues &&
    email.venueId &&
    !scopedVenueIds.includes(email.venueId)
  ) {
    redirect("/system/emails/builder");
  }

  const emailForClient = {
    ...email,
    designJson: normalizeJsonRecord(email.designJson),
  };

  // Get templates for starting point
  const whereClause: Prisma.EmailWhereInput = { isTemplate: true };
  if (!canAccessAllVenues) {
    whereClause.OR = [
      { venueId: { in: scopedVenueIds } },
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

  // Get venues (global scope only)
  let venues: Array<{ id: string; name: string; code: string }> = [];
  if (canAccessAllVenues) {
    venues = await prisma.venue.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    });
  }

  return (
    <DashboardLayout user={user}>
      <EditEmailClient
        email={emailForClient}
        templates={templates}
        venues={venues}
        isAdmin={canAccessAllVenues}
        userVenueId={user.venueId}
      />
    </DashboardLayout>
  );
}
