import { requireAuth } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { MessagesPageClient } from "@/components/messages/MessagesPageClient";
import { getUsers } from "@/lib/actions/users";

interface MessagesPageProps {
  searchParams: {
    conversationId?: string;
  };
}

export default async function MessagesPage({
  searchParams,
}: MessagesPageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const conversationId = params.conversationId;

  // Messages are available to all authenticated users
  // Future: Add permission check if needed: canAccess("messages", "read")

  // Get all users for conversation creation
  const usersResult = await getUsers();
  const users = usersResult.success ? usersResult.users || [] : [];

  return (
    <DashboardLayout user={user}>
      <MessagesPageClient
        conversationId={conversationId}
        currentUserId={user.id}
        currentUserEmail={user.email}
        users={users}
      />
    </DashboardLayout>
  );
}
