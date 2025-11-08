"use client";

import { useState, useEffect } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MentionInput } from "./MentionInput";
import { createComment, updateComment, getPostParticipants } from "@/lib/actions/comments";
import { MAX_COMMENT_LENGTH } from "@/lib/schemas/posts";
import { toast } from "sonner";

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  comment?: {
    id: string;
    content: string;
  };
  onSuccess?: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

export function CommentForm({
  postId,
  parentId,
  comment,
  onSuccess,
  onCancel,
  autoFocus = false,
}: CommentFormProps) {
  const [content, setContent] = useState(comment?.content || "");
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState<{ id: string; email: string }[]>([]);

  const isEditing = !!comment;

  // Load participants for mentions
  useEffect(() => {
    async function loadParticipants() {
      const result = await getPostParticipants(postId);
      if (result.success && result.participants) {
        setParticipants(result.participants);
      }
    }
    if (postId) {
      loadParticipants();
    }
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      toast.error("Comment cannot be empty");
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        const result = await updateComment({
          id: comment.id,
          content: content.trim(),
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Comment updated");
          setContent("");
          if (onSuccess) onSuccess();
        }
      } else {
        const result = await createComment({
          postId,
          parentId: parentId || null,
          content: content.trim(),
        });

        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success(parentId ? "Reply added" : "Comment added");
          setContent("");
          if (onSuccess) onSuccess();
        }
      }
    } catch (err) {
      toast.error("Failed to save comment");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Cmd/Ctrl + Enter
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit(e as any);
    }

    // Cancel on Escape when editing
    if (e.key === "Escape" && isEditing && onCancel) {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <MentionInput
        value={content}
        onChange={setContent}
        onKeyDown={handleKeyDown}
        placeholder={
          isEditing
            ? "Edit your comment..."
            : parentId
            ? "Write a reply... (type @ to mention someone)"
            : "Write a comment... (type @ to mention someone)"
        }
        maxLength={MAX_COMMENT_LENGTH}
        rows={isEditing ? 3 : 2}
        disabled={loading}
        autoFocus={autoFocus}
        users={participants}
      />
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            content.length > MAX_COMMENT_LENGTH * 0.9
              ? "text-destructive"
              : "text-muted-foreground"
          }`}
        >
          {content.length}/{MAX_COMMENT_LENGTH}
        </span>
        <div className="flex gap-2">
          {isEditing && onCancel && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" size="sm" disabled={loading || !content.trim()}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {isEditing ? "Update" : "Comment"}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Press {typeof navigator !== "undefined" && navigator.platform.includes("Mac") ? "Cmd" : "Ctrl"} + Enter to submit
        {participants.length > 0 && (
          <span className="ml-2">• {participants.length} user{participants.length !== 1 ? 's' : ''} available to mention</span>
        )}
      </p>
    </form>
  );
}
