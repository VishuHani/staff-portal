import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getProfile } from "@/lib/actions/profile";
import { getUnreadCount } from "@/lib/actions/notifications";
import { getUnreadMessageCount } from "@/lib/actions/messages";
import { ProfilePageClient } from "./profile-page-client";

export const metadata = {
  title: "My Profile | Staff Portal",
  description: "Manage your personal information and profile details",
};

export default async function MyProfilePage() {
  const user = await requireAuth();
  const profile = await getProfile();

  if (!profile) {
    redirect("/login");
  }

  const [unreadResult, messageCountResult] = await Promise.all([
    getUnreadCount({ userId: user.id }),
    getUnreadMessageCount(),
  ]);

  return (
    <DashboardLayout
      user={user}
      unreadCount={unreadResult.count || 0}
      unreadMessageCount={messageCountResult.count || 0}
    >
      <ProfilePageClient profile={profile} />
    </DashboardLayout>
  );
}
