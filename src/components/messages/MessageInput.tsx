"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { sendMessage } from "@/lib/actions/messages";
import { MediaUploader } from "./MediaUploader";

interface MessageInputProps {
  conversationId: string;
  onMessageSent?: () => void;
  placeholder?: string;
  onStartTyping?: () => void;
  onStopTyping?: () => void;
}

export function MessageInput({
  conversationId,
  onMessageSent,
  placeholder = "Type a message...",
  onStartTyping,
  onStopTyping,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<string[]>([]);
  const [showMediaUploader, setShowMediaUploader] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
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
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      setContent("");
      setAttachments([]);
      setShowMediaUploader(false);
      if (onMessageSent) onMessageSent();

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

  return (
    <div className="border-t bg-background p-4">
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Media Uploader */}
        {showMediaUploader && (
          <MediaUploader
            onUploadComplete={handleUploadComplete}
            maxFiles={4}
          />
        )}

        {/* Input area */}
        <div className="flex items-end gap-2">
          {/* Attachment button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleAttachmentClick}
            disabled={sending}
            className="flex-shrink-0"
          >
            <Paperclip className="h-5 w-5" />
          </Button>

          {/* Text input */}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={sending}
            className="max-h-32 min-h-[2.5rem] resize-none"
            rows={1}
          />

          {/* Send button */}
          <Button
            type="submit"
            size="icon"
            disabled={sending || (!content.trim() && attachments.length === 0)}
            className="flex-shrink-0"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>

        {/* Helper text */}
        <p className="text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </form>
    </div>
  );
}
