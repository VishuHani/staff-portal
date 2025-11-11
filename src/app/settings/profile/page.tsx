import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getProfile } from "@/lib/actions/profile";
import { getUnreadCount } from "@/lib/actions/notifications";
import { ProfilePageClient } from "./profile-page-client";

export default async function ProfilePage() {
  const user = await requireAuth();
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  const unreadResult = await getUnreadCount({ userId: user.id });

  return (
    <DashboardLayout user={user} unreadCount={unreadResult.count || 0}>
      <ProfilePageClient profile={profile} />
    </DashboardLayout>
  );
}
