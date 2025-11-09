"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PostCard } from "./PostCard";
import { PostForm } from "./PostForm";
import { getPosts } from "@/lib/actions/posts";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Post {
  id: string;
  content: string;
  channelId: string;
  mediaUrls: string | null;
  pinned: boolean;
  edited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    email: string;
    role: {
      name: string;
    } | null;
  };
  channel: {
    id: string;
    name: string;
    color: string | null;
    icon: string | null;
  };
  _count?: {
    comments: number;
    reactions: number;
  };
  reactions?: Array<{
    userId: string;
    emoji: string;
  }>;
}

interface PostFeedProps {
  channelId?: string;
  currentUserId: string;
  canManage: boolean;
}

export function PostFeed({ channelId, currentUserId, canManage }: PostFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  const fetchPosts = async (showRefresh = false) => {
    try {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await getPosts({
        channelId,
        limit: 50,
      });

      if (result.error) {
        setError(result.error);
      } else if (result.posts) {
        setPosts(result.posts);
      }
    } catch (err) {
      setError("Failed to load posts");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [channelId]);

  const handleRefresh = () => {
    fetchPosts(true);
  };

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium">No posts yet</p>
        <p className="text-sm text-muted-foreground">
          {channelId
            ? "Be the first to post in this channel!"
            : "Create a post to get started"}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </p>
        <Button
          onClick={handleRefresh}
          variant="ghost"
          size="sm"
          disabled={refreshing}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      <ScrollArea className="h-[calc(100vh-16rem)]">
        <div className="space-y-4 pr-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              canManage={canManage}
              onEdit={() => setEditingPost(post)}
              onUpdate={handleRefresh}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Edit Post Dialog */}
      {editingPost && (
        <PostForm
          open={!!editingPost}
          onOpenChange={(open) => !open && setEditingPost(null)}
          post={editingPost}
          onSuccess={() => {
            setEditingPost(null);
            handleRefresh();
          }}
        />
      )}
    </>
  );
}
