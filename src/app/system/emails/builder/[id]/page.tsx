import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EditEmailClient } from "./edit-email-client";

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
  if (user.role.name !== "ADMIN" && email.venueId && email.venueId !== user.venueId) {
    redirect("/system/emails/builder");
  }

  // Get templates for starting point
  const whereClause: any = { isTemplate: true };
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
    <EditEmailClient
      email={email}
      templates={templates}
      venues={venues}
      isAdmin={user.role.name === "ADMIN"}
      userVenueId={user.venueId}
    />
  );
}
