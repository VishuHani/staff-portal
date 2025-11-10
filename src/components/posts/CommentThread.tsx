"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow } from "date-fns";
import { Edit, Trash2, MoreVertical, Reply } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { getFullName } from "@/lib/utils/profile";
import { CommentForm } from "./CommentForm";
import { CommentContent } from "./CommentContent";
import { ReactionPicker } from "./ReactionPicker";
import { EmojiPicker } from "./EmojiPicker";
import { deleteComment } from "@/lib/actions/comments";
import {
  toggleCommentReaction,
  getReactionsByCommentId,
} from "@/lib/actions/reactions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Comment {
  id: string;
  content: string;
  createdAt: Date;
  edited: boolean;
  editedAt: Date | null;
  parentId: string | null;
  user: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
    profileImage?: string | null;
    role: {
      name: string;
    } | null;
  };
  replies?: Comment[];
}

interface CommentThreadProps {
  comment: Comment;
  postId: string;
  currentUserId: string;
  canManage: boolean;
  depth?: number;
  maxDepth?: number;
  onUpdate: () => void;
}

export function CommentThread({
  comment,
  postId,
  currentUserId,
  canManage,
  depth = 0,
  maxDepth = 5,
  onUpdate,
}: CommentThreadProps) {
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [commentReactions, setCommentReactions] = useState<any[]>([]);
  const [loadingReactions, setLoadingReactions] = useState(true);

  const isOwn = comment.user.id === currentUserId;
  const canEdit = isOwn;
  const canDelete = isOwn || canManage;
  const userName = getFullName(comment.user);
  const isEditing = editingCommentId === comment.id;
  const isReplying = replyingToId === comment.id;
  const canReply = depth < maxDepth;

  // Load reactions for this comment
  useEffect(() => {
    async function loadReactions() {
      setLoadingReactions(true);
      const result = await getReactionsByCommentId(comment.id);
      if (result.success && result.reactions) {
        setCommentReactions(result.reactions);
      }
      setLoadingReactions(false);
    }
    loadReactions();
  }, [comment.id]);

  const loadReactionsForComment = async () => {
    setLoadingReactions(true);
    const result = await getReactionsByCommentId(comment.id);
    if (result.success && result.reactions) {
      setCommentReactions(result.reactions);
    }
    setLoadingReactions(false);
  };

  const handleCommentReaction = async (emoji: string) => {
    const result = await toggleCommentReaction({ commentId: comment.id, emoji });
    if (result.error) {
      toast.error(result.error);
    } else {
      await loadReactionsForComment();
    }
  };

  const handleDelete = async () => {
    const result = await deleteComment({ id: comment.id });

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Comment deleted");
      setDeleteDialogOpen(false);
      onUpdate();
    }
  };

  const handleReplySuccess = () => {
    setReplyingToId(null);
    onUpdate();
  };

  return (
    <div className={cn("relative", depth > 0 && "ml-8 mt-4")}>
      <div className="group relative">
        {/* Connection line for nested replies */}
        {depth > 0 && (
          <div className="absolute -left-4 top-0 h-full w-px bg-border" />
        )}

        <div className="flex gap-3">
          {/* User Avatar */}
          <UserAvatar
            imageUrl={comment.user.profileImage}
            firstName={comment.user.firstName}
            lastName={comment.user.lastName}
            email={comment.user.email}
            size="sm"
          />

          {/* Comment Content */}
          <div className="flex-1 space-y-1">
            {/* User Info & Timestamp */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {userName}
              </span>
              {comment.user.role && (
                <Badge variant="secondary" className="text-xs">
                  {comment.user.role.name}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                })}
              </span>
              {comment.edited && (
                <span className="text-xs text-muted-foreground">(edited)</span>
              )}
            </div>

            {/* Comment Body */}
            {isEditing ? (
              <CommentForm
                postId={postId}
                comment={{ id: comment.id, content: comment.content }}
                onSuccess={() => {
                  setEditingCommentId(null);
                  onUpdate();
                }}
                onCancel={() => setEditingCommentId(null)}
                autoFocus
              />
            ) : (
              <>
                <CommentContent content={comment.content} />

                {/* Action Buttons (Reactions & Reply) */}
                <div className="flex items-center gap-2 mt-2">
                  {/* Reactions */}
                  {loadingReactions ? (
                    <div className="h-6 w-24 animate-pulse rounded bg-muted" />
                  ) : commentReactions.length > 0 ? (
                    <ReactionPicker
                      reactions={commentReactions}
                      onReact={handleCommentReaction}
                    />
                  ) : (
                    <EmojiPicker onEmojiSelect={handleCommentReaction} />
                  )}

                  {/* Reply Button */}
                  {canReply && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      onClick={() => setReplyingToId(comment.id)}
                    >
                      <Reply className="mr-1 h-3 w-3" />
                      Reply
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Actions Menu */}
          {(canEdit || canDelete) && !isEditing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem
                    onClick={() => setEditingCommentId(comment.id)}
                  >
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
      </div>

      {/* Reply Form */}
      {isReplying && (
        <div className="ml-11 mt-3">
          <div className="rounded-lg border bg-muted/50 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Replying to <strong>{comment.user.email}</strong>
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs"
                onClick={() => setReplyingToId(null)}
              >
                Cancel
              </Button>
            </div>
            <CommentForm
              postId={postId}
              parentId={comment.id}
              onSuccess={handleReplySuccess}
              onCancel={() => setReplyingToId(null)}
              autoFocus
            />
          </div>
        </div>
      )}

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="space-y-1">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              postId={postId}
              currentUserId={currentUserId}
              canManage={canManage}
              depth={depth + 1}
              maxDepth={maxDepth}
              onUpdate={onUpdate}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Comment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this comment?
              {comment.replies && comment.replies.length > 0 && (
                <span className="block mt-2 font-semibold text-destructive">
                  This will also delete {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}.
                </span>
              )}
              This action cannot be undone.
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
    </div>
  );
}
