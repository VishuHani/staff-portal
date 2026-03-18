import { useEffect, useRef } from "react";
import { createClient } from "@/lib/auth/supabase-client";

interface UseMessageRealtimeProps {
  conversationId: string;
  onNewMessage: () => void;
  onMessageUpdate: () => void;
  onMessageDelete: () => void;
}

/**
 * Hook for real-time message updates in a conversation
 * Subscribes to Supabase Realtime for INSERT, UPDATE, and DELETE events
 */
export function useMessageRealtime({
  conversationId,
  onNewMessage,
  onMessageUpdate,
  onMessageDelete,
}: UseMessageRealtimeProps) {
  const onNewMessageRef = useRef(onNewMessage);
  const onMessageUpdateRef = useRef(onMessageUpdate);
  const onMessageDeleteRef = useRef(onMessageDelete);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    onNewMessageRef.current = onNewMessage;
    onMessageUpdateRef.current = onMessageUpdate;
    onMessageDeleteRef.current = onMessageDelete;
  }, [onNewMessage, onMessageUpdate, onMessageDelete]);

  useEffect(() => {
    const supabase = createClient();

    const schedule = (callback: () => void) => {
      if (refreshTimeoutRef.current) return;
      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        callback();
      }, 150);
    };

    // Subscribe to message changes for this conversation
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("New message received:", payload);
          schedule(() => onNewMessageRef.current());
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("Message updated:", payload);
          const oldRow = (payload as any).old ?? {};
          const newRow = (payload as any).new ?? {};

          // Ignore noisy updates (read receipts / delivery flags) that can cause refresh loops.
          // Refresh only when user-visible message content changes.
          const contentChanged = oldRow.content !== newRow.content;
          const mediaChanged = oldRow.media_urls !== newRow.media_urls;
          const reactionsChanged = oldRow.reactions !== newRow.reactions;
          const deletedChanged = oldRow.deleted_at !== newRow.deleted_at;
          const replyChanged = oldRow.reply_to_id !== newRow.reply_to_id;

          if (contentChanged || mediaChanged || reactionsChanged || deletedChanged || replyChanged) {
            schedule(() => onMessageUpdateRef.current());
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          console.log("Message deleted:", payload);
          schedule(() => onMessageDeleteRef.current());
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
      supabase.removeChannel(channel);
    };
  }, [conversationId]);
}
