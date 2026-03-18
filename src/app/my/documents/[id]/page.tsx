import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/actions/auth";
import { getDocumentAssignment } from "@/lib/actions/documents/assignments";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DocumentDetailClient } from "./document-detail-client";

interface DocumentDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function DocumentDetailPage({ params }: DocumentDetailPageProps) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  // Fetch the document assignment using the server action
  const result = await getDocumentAssignment(id);

  if (!result.success || !result.data) {
    redirect("/my/documents?error=not_found");
  }

  const assignment = result.data;

  // Serialize for client component
  const serializedAssignment = {
    id: assignment.id,
    status: assignment.status,
    dueDate: assignment.dueDate?.toISOString() || null,
    assignedAt: assignment.assignedAt.toISOString(),
    completedAt: assignment.completedAt?.toISOString() || null,
    notes: assignment.notes,
    template: assignment.template ? {
      id: assignment.template.id,
      name: assignment.template.name,
      description: null as string | null, // Not included in the select
      category: assignment.template.category,
      documentType: assignment.template.documentType,
      pdfUrl: null as string | null, // Not included in the select
      pdfFileName: null as string | null,
      formSchema: null as any,
      isPrintOnly: false,
      requireSignature: false,
      allowDownload: true,
      instructions: null as string | null,
      venue: null as { id: string; name: string } | null,
    } : null,
    bundle: assignment.bundle ? {
      id: assignment.bundle.id,
      name: assignment.bundle.name,
      description: null as string | null, // Not included in the select
    } : null,
    venue: assignment.venue,
    submissions: [] as any[], // Not included in the basic query
  };

  return (
    <DashboardLayout user={user}>
      <DocumentDetailClient 
        assignment={serializedAssignment}
        userId={user.id}
      />
    </DashboardLayout>
  );
}
