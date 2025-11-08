"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChannelSelector } from "./ChannelSelector";
import { MediaUploader } from "./MediaUploader";
import { createPost, updatePost } from "@/lib/actions/posts";
import { MAX_POST_LENGTH } from "@/lib/schemas/posts";
import { toast } from "sonner";

interface PostFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  post?: {
    id: string;
    content: string;
    channelId: string;
    mediaUrls?: string | null;
  };
  defaultChannelId?: string;
  onSuccess?: () => void;
}

export function PostForm({
  open,
  onOpenChange,
  post,
  defaultChannelId,
  onSuccess,
}: PostFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [content, setContent] = useState(post?.content || "");
  const [channelId, setChannelId] = useState(
    post?.channelId || defaultChannelId || ""
  );
  const [mediaUrls, setMediaUrls] = useState<string[]>(() => {
    if (post?.mediaUrls) {
      try {
        const parsed = JSON.parse(post.mediaUrls);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const isEditing = !!post;

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open && !isEditing) {
      setContent("");
      setChannelId(defaultChannelId || "");
      setMediaUrls([]);
      setError(null);
    }
  }, [open, isEditing, defaultChannelId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!channelId) {
      setError("Please select a channel");
      return;
    }

    if (!content.trim()) {
      setError("Post content cannot be empty");
      return;
    }

    setLoading(true);

    try {
      if (isEditing) {
        // Update existing post (content only)
        const result = await updatePost({
          id: post.id,
          content: content.trim(),
        });

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
        } else {
          toast.success("Post updated successfully");
          onOpenChange(false);
          if (onSuccess) onSuccess();
          router.refresh();
        }
      } else {
        // Create new post
        const result = await createPost({
          channelId,
          content: content.trim(),
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        });

        if (result.error) {
          setError(result.error);
          toast.error(result.error);
        } else {
          toast.success("Post created successfully");
          onOpenChange(false);
          if (onSuccess) onSuccess();
          router.refresh();

          // Reset form
          setContent("");
          setChannelId(defaultChannelId || "");
          setMediaUrls([]);
        }
      }
    } catch (err) {
      const message = "An unexpected error occurred";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Post" : "Create Post"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update your post content."
                : "Share an announcement or update with your team."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {/* Channel Selector (only for new posts) */}
            {!isEditing && (
              <div className="grid gap-2">
                <Label htmlFor="channel">
                  Channel <span className="text-destructive">*</span>
                </Label>
                <ChannelSelector
                  value={channelId}
                  onChange={setChannelId}
                  className="w-full"
                />
                <p className="text-xs text-muted-foreground">
                  Choose which channel to post in
                </p>
              </div>
            )}

            {/* Post Content */}
            <div className="grid gap-2">
              <Label htmlFor="content">
                Content <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="What would you like to share?"
                maxLength={MAX_POST_LENGTH}
                rows={6}
                className="resize-none"
                required
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Supports plain text and line breaks</span>
                <span
                  className={
                    content.length > MAX_POST_LENGTH * 0.9
                      ? "text-destructive"
                      : ""
                  }
                >
                  {content.length}/{MAX_POST_LENGTH}
                </span>
              </div>
            </div>

            {/* Media Upload (only for new posts) */}
            {!isEditing && (
              <div className="grid gap-2">
                <Label>Media (Optional)</Label>
                <MediaUploader
                  value={mediaUrls}
                  onChange={setMediaUrls}
                  maxFiles={4}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Add images, videos, or PDFs to your post
                </p>
              </div>
            )}

            {/* Show existing media for editing */}
            {isEditing && mediaUrls.length > 0 && (
              <div className="grid gap-2">
                <Label>Attached Media</Label>
                <div className="rounded-lg border bg-muted/30 p-4">
                  <p className="text-sm text-muted-foreground">
                    {mediaUrls.length} file{mediaUrls.length !== 1 ? "s" : ""}{" "}
                    attached
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Media cannot be edited after posting
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !content.trim() || (!isEditing && !channelId)}
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Post" : "Create Post"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
