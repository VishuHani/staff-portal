import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";

export default async function EmailsCreateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireAuth();

  if (!(await canAccessEmailModule(user.id, "create"))) {
    redirect("/dashboard?error=access_denied");
  }

  redirect(`/system/emails/builder/${id}`);
}
