import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasAnyPermission, isAdmin } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/prisma";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { SendDocumentsClient } from "./send-documents-client";

export default async function SendDocumentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!user.active) {
    redirect("/login?error=inactive");
  }

  // Check if user has document assign permission
  const canAssignDocuments = await hasAnyPermission(user.id, [
    { resource: "documents", action: "assign" },
  ]);

  const isUserAdmin = await isAdmin(user.id);

  if (!canAssignDocuments && !isUserAdmin) {
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

  // Get available templates
  const templates = await prisma.documentTemplate.findMany({
    where: {
      venueId: { in: userVenues.map(v => v.id) },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      category: true,
      documentType: true,
      description: true,
    },
    orderBy: { name: "asc" },
  });

  // Get available bundles
  const bundles = await prisma.documentBundle.findMany({
    where: {
      venueId: { in: userVenues.map(v => v.id) },
      isActive: true,
    },
    select: {
      id: true,
      name: true,
      description: true,
      _count: {
        select: { items: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <DashboardLayout user={user}>
      <SendDocumentsClient
        venues={userVenues}
        templates={templates}
        bundles={bundles}
        isAdmin={isUserAdmin}
      />
    </DashboardLayout>
  );
}
