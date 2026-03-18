import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MyDocumentsClient } from "./my-documents-client";

export default async function MyDocumentsPage() {
  const user = await requireAuth();
  
  if (!user) {
    redirect("/login");
  }

  return (
    <DashboardLayout user={user}>
      <MyDocumentsClient userId={user.id} />
    </DashboardLayout>
  );
}
