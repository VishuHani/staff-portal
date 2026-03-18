import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission, isAdmin } from "@/lib/rbac/permissions";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EditDocumentTemplateClient } from "./edit-template-client";

interface EditDocumentTemplatePageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditDocumentTemplatePage({ params }: EditDocumentTemplatePageProps) {
  const { id } = await params;
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  if (!user.active) {
    redirect("/login?error=inactive");
  }

  // Get the template first
  const template = await prisma.documentTemplate.findUnique({
    where: { id },
    include: {
      _count: {
        select: { assignments: true }
      }
    }
  });

  if (!template) {
    redirect("/manage/documents");
  }

  const isUserAdmin = await isAdmin(user.id);

  // Check if user has permission to edit this template
  const canEdit = await hasPermission(user.id, "documents", "update", template.venueId);
  if (!canEdit && !isUserAdmin) {
    redirect("/manage/documents");
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

  return (
    <DashboardLayout user={user}>
      <EditDocumentTemplateClient
        template={template}
        venues={userVenues}
      />
    </DashboardLayout>
  );
}
