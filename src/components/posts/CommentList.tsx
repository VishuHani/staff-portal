"use client";

import { CommentThread } from "./CommentThread";

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
    role: {
      name: string;
    } | null;
  };
  replies?: Comment[];
}

interface CommentListProps {
  comments: Comment[];
  postId: string;
  currentUserId: string;
  canManage: boolean;
  onUpdate: () => void;
}

export function CommentList({
  comments,
  postId,
  currentUserId,
  canManage,
  onUpdate,
}: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to comment!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {comments.map((comment) => (
        <CommentThread
          key={comment.id}
          comment={comment}
          postId={postId}
          currentUserId={currentUserId}
          canManage={canManage}
          onUpdate={onUpdate}
        />
      ))}
    </div>
  );
}
