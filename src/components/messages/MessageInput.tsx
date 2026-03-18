"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X, Smile, CornerDownRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendMessage } from "@/lib/actions/messages";
import { MediaUploader } from "./MediaUploader";
import { EmojiPicker } from "./EmojiPicker";
import { cn } from "@/lib/utils";

interface MessageInputProps {
  conversationId: string;
  onMessageSent?: () => void;
  placeholder?: string;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
  replyingTo?: {
    id: string;
    content: string;
    senderName: string;
  } | null;
  onCancelReply?: () => void;
}

export function MessageInput({
  conversationId,
  onMessageSent,
  placeholder = "Type a message...",
  onStartTyping,
  onStopTyping,
  replyingTo,
  onCancelReply,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const handleEmojiSelect = (emoji: string) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [content]);

  // Cleanup typing timeout on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim() && attachments.length === 0) {
      return;
    }

    setSending(true);

    // Stop typing indicator when sending
    if (onStopTyping) onStopTyping();
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    const result = await sendMessage({
      conversationId,
      content: content.trim(),
      mediaUrls: attachments.length > 0 ? attachments : undefined,
      replyToId: replyingTo?.id,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      setContent("");
      setAttachments([]);
      setShowMediaUploader(false);
      if (onMessageSent) onMessageSent();
      if (onCancelReply) onCancelReply();

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }

    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleAttachmentClick = () => {
    setShowMediaUploader(!showMediaUploader);
  };

  const handleUploadComplete = (urls: string[]) => {
    setAttachments(urls);
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleContentChange = (value: string) => {
    setContent(value);

    // Trigger typing indicator
    if (value.trim() && onStartTyping) {
      onStartTyping();

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Auto-stop typing after 3 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (onStopTyping) onStopTyping();
      }, 3000);
    } else if (!value.trim() && onStopTyping) {
      // Stop typing if content is cleared
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      onStopTyping();
    }
  };

  const hasContent = content.trim().length > 0 || attachments.length > 0;

  return (
    <div className="border-t bg-background">
      <form onSubmit={handleSubmit} className="p-3">
        {/* Reply context indicator */}
        {replyingTo && (
          <div className="mb-3 flex items-center justify-between rounded-xl bg-muted/70 px-4 py-3">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <CornerDownRight className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-primary">
                  Replying to {replyingTo.senderName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {replyingTo.content}
                </p>
              </div>
            </div>
            {onCancelReply && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onCancelReply}
                className="h-8 w-8 flex-shrink-0 rounded-lg hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        {/* Attachment preview chips */}
        {attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((url, index) => {
              const extension = url.split(".").pop()?.toLowerCase();
              const isImage = ["jpg", "jpeg", "png", "gif", "webp", "avif"].includes(extension || "");
              
              return (
                <div
                  key={index}
                  className="group relative flex items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 pr-8"
                >
                  {isImage ? (
                    <img
                      src={url}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  ) : (
                    <Paperclip className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="max-w-[120px] truncate text-xs">
                    {url.split("/").pop() || `File ${index + 1}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveAttachment(index)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Media Uploader */}
        {showMediaUploader && (
          <div className="mb-3">
            <MediaUploader
              onUploadComplete={handleUploadComplete}
              maxFiles={4}
            />
          </div>
        )}

        {/* Main input area */}
        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-muted/30 p-2 transition-all",
            hasContent && "bg-background ring-1 ring-primary/20"
          )}
        >
          {/* Attachment button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAttachmentClick}
            disabled={sending}
            className={cn(
              "h-10 w-10 flex-shrink-0 rounded-xl transition-colors",
              showMediaUploader && "bg-primary/10 text-primary"
            )}
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Emoji picker button */}
          <div className="relative">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              disabled={sending}
              className={cn(
                "h-10 w-10 flex-shrink-0 rounded-xl transition-colors",
                showEmojiPicker && "bg-primary/10 text-primary"
              )}
            >
              <Smile className="h-5 w-5" />
            </Button>
            {showEmojiPicker && (
              <div className="fixed inset-x-2 bottom-24 z-[2000] sm:absolute sm:inset-x-auto sm:bottom-full sm:left-0 sm:right-auto sm:mb-2 sm:z-[2000]">
                <EmojiPicker
                  onEmojiSelect={handleEmojiSelect}
                  onClose={() => setShowEmojiPicker(false)}
                  showTrigger={false}
                  open={true}
                  align="start"
                />
              </div>
            )}
          </div>

          {/* Text input */}
          <div className="flex-1 min-w-0">
            <Textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={sending}
              className="min-h-[44px] resize-none border-0 bg-transparent px-2 py-2.5 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"
              rows={1}
            />
          </div>

          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            disabled={sending || (!content.trim() && attachments.length === 0)}
            className={cn(
              "h-10 w-10 flex-shrink-0 rounded-xl transition-all",
              hasContent
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
          >
            {sending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>

        {/* Helper text */}
        <p className="mt-2 px-2 text-[11px] text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}
