import { useEffect } from "react";
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
  useEffect(() => {
    const supabase = createClient();

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
          onNewMessage();
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
          onMessageUpdate();
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
          onMessageDelete();
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, onNewMessage, onMessageUpdate, onMessageDelete]);
}
