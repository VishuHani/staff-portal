import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AccountSettingsClient } from "./account-settings-client";
import { getAccountInfo } from "@/lib/actions/account";
import { getUnreadCount } from "@/lib/actions/notifications";

export const metadata = {
  title: "Account Settings | Staff Portal",
  description: "Update your email, password, and account security",
};

export default async function MyAccountSettingsPage() {
  const user = await requireAuth();

  const [accountResult, unreadResult] = await Promise.all([
    getAccountInfo(),
    getUnreadCount({ userId: user.id }),
  ]);

  if (accountResult.error) {
    return (
      <DashboardLayout user={user} unreadCount={0}>
        <div className="container max-w-4xl py-6">
          <p className="text-destructive">Error loading account information</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout user={user} unreadCount={unreadResult.count || 0}>
      <div className="container max-w-4xl py-6">
        <AccountSettingsClient accountInfo={accountResult.accountInfo!} />
      </div>
    </DashboardLayout>
  );
}
