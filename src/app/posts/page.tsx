import { requireAuth, canAccess } from "@/lib/rbac/access";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { PostsPageClient } from "@/components/posts/PostsPageClient";

interface PostsPageProps {
  searchParams: Promise<{
    channelId?: string;
  }>;
}

export default async function PostsPage({ searchParams }: PostsPageProps) {
  const user = await requireAuth();
  const params = await searchParams;
  const channelId = params.channelId;
  const canManage = await canAccess("posts", "manage");

  return (
    <DashboardLayout user={user}>
      <PostsPageClient
        channelId={channelId}
        currentUserId={user.id}
        canManage={canManage}
      />
    </DashboardLayout>
  );
}
