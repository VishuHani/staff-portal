"use client";

import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import {
  MessageCircle,
  Edit,
  Trash2,
  MoreVertical,
  Pin,
  PinOff,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getFullName } from "@/lib/utils/profile";
import { ReactionPicker } from "./ReactionPicker";
import { EmojiPicker } from "./EmojiPicker";
import { CommentList } from "./CommentList";
import { CommentForm } from "./CommentForm";
import { deletePost, pinPost, markPostAsRead } from "@/lib/actions/posts";
import { toggleReaction, getReactionsByPostId } from "@/lib/actions/reactions";
import { getCommentsByPostId } from "@/lib/actions/comments";
import { parseMediaUrls } from "@/lib/schemas/posts";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Post {
  id: string;
  content: string;
  mediaUrls: string | null;
  pinned: boolean;
  edited: boolean;
  editedAt: Date | null;
  createdAt: Date;
  author: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
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

interface PostCardProps {
  post: Post;
  currentUserId: string;
  canManage: boolean;
  onEdit?: () => void;
  onUpdate?: () => void;
}

export function PostCard({
  post,
  currentUserId,
  canManage,
  onEdit,
  onUpdate,
}: PostCardProps) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [loadingComments, setLoadingComments] = useState(false);
  const [loadingReactions, setLoadingReactions] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [hasBeenMarkedRead, setHasBeenMarkedRead] = useState(false);

  const isOwn = post.author.id === currentUserId;
  const canEdit = isOwn;
  const canDelete = isOwn || canManage;
  const mediaUrls = parseMediaUrls(post.mediaUrls);
  const authorName = getFullName(post.author);

  // Auto mark as read when post is visible
  useEffect(() => {
    if (!cardRef.current || hasBeenMarkedRead) return;

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries;
        // Mark as read when post is 50% visible for at least a moment
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          setHasBeenMarkedRead(true);
          await markPostAsRead(post.id);
        }
      },
      {
        threshold: 0.5, // Trigger when 50% of the post is visible
        rootMargin: "0px",
      }
    );

    observer.observe(cardRef.current);

    return () => {
      observer.disconnect();
    };
  }, [post.id, hasBeenMarkedRead]);

  const loadComments = async () => {
    setLoadingComments(true);
    const result = await getCommentsByPostId(post.id);
    if (result.success && result.comments) {
      setComments(result.comments);
    }
    setLoadingComments(false);
  };

  const loadReactions = async () => {
    setLoadingReactions(true);
    const result = await getReactionsByPostId(post.id);
    if (result.success && result.reactions) {
      setReactions(result.reactions);
    }
    setLoadingReactions(false);
  };

  const handleCommentsToggle = async () => {
    const newState = !commentsOpen;
    setCommentsOpen(newState);
    if (newState) {
      await loadComments();
      await loadReactions();
    }
  };

  const handleReaction = async (emoji: string) => {
    const result = await toggleReaction({ postId: post.id, emoji });
    if (result.error) {
      toast.error(result.error);
    } else {
      await loadReactions();
      if (onUpdate) onUpdate();
    }
  };

  const handleDelete = async () => {
    const result = await deletePost({ id: post.id });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Post deleted");
      setDeleteDialogOpen(false);
      router.refresh();
    }
  };

  const handlePin = async () => {
    const result = await pinPost({ id: post.id, pinned: !post.pinned });
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(post.pinned ? "Post unpinned" : "Post pinned");
      router.refresh();
    }
  };

  return (
    <Card ref={cardRef} className={cn(post.pinned && "border-primary")}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {/* User Avatar */}
            <UserAvatar
              imageUrl={post.author.profileImage}
              firstName={post.author.firstName}
              lastName={post.author.lastName}
              email={post.author.email}
              size="md"
            />

            {/* Post Header Info */}
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{authorName}</span>
                {post.author.role && (
                  <Badge variant="secondary" className="text-xs">
                    {post.author.role.name}
                  </Badge>
                )}
                {post.pinned && (
                  <Badge variant="default" className="gap-1 text-xs">
                    <Pin className="h-3 w-3" />
                    Pinned
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                  style={
                    post.channel.color
                      ? {
                          backgroundColor: `${post.channel.color}20`,
                          color: post.channel.color,
                        }
                      : {}
                  }
                >
                  {post.channel.icon && (
                    <span className="text-sm">{post.channel.icon}</span>
                  )}
                  {post.channel.name}
                </span>
                <span>•</span>
                <span>
                  {formatDistanceToNow(new Date(post.createdAt), {
                    addSuffix: true,
                  })}
                </span>
                {post.edited && <span>(edited)</span>}
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          {(canEdit || canDelete || canManage) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canManage && (
                  <>
                    <DropdownMenuItem onClick={handlePin}>
                      {post.pinned ? (
                        <>
                          <PinOff className="mr-2 h-4 w-4" />
                          Unpin Post
                        </>
                      ) : (
                        <>
                          <Pin className="mr-2 h-4 w-4" />
                          Pin Post
                        </>
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                {canEdit && (
                  <DropdownMenuItem onClick={onEdit}>
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Post Content */}
        <p className="whitespace-pre-wrap text-sm">{post.content}</p>

        {/* Media Attachments */}
        {mediaUrls.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {mediaUrls.map((url, index) => {
              const isImage = url.match(/\.(jpg|jpeg|png|gif|webp)$/i);
              const isVideo = url.match(/\.(mp4|webm)$/i);

              return (
                <div
                  key={index}
                  className="overflow-hidden rounded-lg border bg-muted"
                >
                  {isImage ? (
                    <img
                      src={url}
                      alt={`Media ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : isVideo ? (
                    <video src={url} controls className="h-full w-full" />
                  ) : (
                    <div className="flex items-center gap-2 p-4">
                      <FileText className="h-8 w-8 text-muted-foreground" />
                      <div className="flex-1 truncate">
                        <p className="text-sm font-medium">Attachment {index + 1}</p>
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline"
                        >
                          View file
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Reactions */}
        {loadingReactions ? (
          <div className="h-8 w-full animate-pulse rounded bg-muted" />
        ) : reactions.length > 0 ? (
          <ReactionPicker
            reactions={reactions}
            onReact={handleReaction}
          />
        ) : (
          <EmojiPicker onEmojiSelect={handleReaction} />
        )}

        {/* Comments Toggle */}
        <Collapsible open={commentsOpen} onOpenChange={handleCommentsToggle}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              <MessageCircle className="mr-2 h-4 w-4" />
              {post._count?.comments ?? 0} Comment
              {(post._count?.comments ?? 0) !== 1 ? "s" : ""}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-4 space-y-4">
            {/* Comments List */}
            {loadingComments ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : (
              <CommentList
                comments={comments}
                postId={post.id}
                currentUserId={currentUserId}
                canManage={canManage}
                onUpdate={async () => {
                  await loadComments();
                  router.refresh();
                }}
              />
            )}

            {/* Add Comment Form */}
            <CommentForm
              postId={post.id}
              onSuccess={async () => {
                await loadComments();
                router.refresh();
              }}
            />
          </CollapsibleContent>
        </Collapsible>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Post</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this post? This will also delete all
              comments and reactions. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
