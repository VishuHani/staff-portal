"use client";

import { useState } from "react";
import { Plus, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ChannelList } from "./ChannelList";
import { PostFeed } from "./PostFeed";
import { PostForm } from "./PostForm";

interface PostsPageClientProps {
  channelId?: string;
  currentUserId: string;
  canManage: boolean;
}

export function PostsPageClient({
  channelId,
  currentUserId,
  canManage,
}: PostsPageClientProps) {
  const [createPostOpen, setCreatePostOpen] = useState(false);

  return (
    <>
      <div className="flex h-[calc(100vh-4rem)] gap-4">
        {/* Sidebar - Channel List */}
        <aside className="w-64 flex-shrink-0">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Channels</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ChannelList />
            </CardContent>
          </Card>
        </aside>

        {/* Main Content - Posts Feed */}
        <main className="flex-1 overflow-hidden">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-6 w-6 text-primary" />
                  <div>
                    <CardTitle>
                      {channelId ? "Channel Posts" : "All Posts"}
                    </CardTitle>
                    <CardDescription>
                      {channelId
                        ? "Posts in this channel"
                        : "View all team posts and announcements"}
                    </CardDescription>
                  </div>
                </div>
                <Button onClick={() => setCreatePostOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Post
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <PostFeed
                channelId={channelId}
                currentUserId={currentUserId}
                canManage={canManage}
              />
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Create Post Dialog */}
      <PostForm
        open={createPostOpen}
        onOpenChange={setCreatePostOpen}
        defaultChannelId={channelId}
        onSuccess={() => {
          setCreatePostOpen(false);
          // PostFeed will auto-refresh
        }}
      />
    </>
  );
}
