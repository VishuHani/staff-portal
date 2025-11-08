import { useEffect } from "react";
import { createClient } from "@/lib/auth/supabase-client";

interface UseConversationListRealtimeProps {
  userId: string;
  onConversationChange: () => void;
}

/**
 * Hook for real-time conversation list updates
 * Subscribes to changes in conversations, messages, and conversation participants
 */
export function useConversationListRealtime({
  userId,
  onConversationChange,
}: UseConversationListRealtimeProps) {
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to conversation changes
    const conversationChannel = supabase
      .channel(`conversations:user:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // All events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          console.log("Conversation changed:", payload);
          onConversationChange();
        }
      )
      .subscribe();

    // Subscribe to new messages (to update last message and unread counts)
    const messageChannel = supabase
      .channel(`messages:all:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("New message in some conversation:", payload);
          onConversationChange();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          console.log("Message updated in some conversation:", payload);
          onConversationChange();
        }
      )
      .subscribe();

    // Subscribe to conversation participant changes (for new conversations)
    const participantChannel = supabase
      .channel(`conversation_participants:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log("Conversation participant changed:", payload);
          onConversationChange();
        }
      )
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(conversationChannel);
      supabase.removeChannel(messageChannel);
      supabase.removeChannel(participantChannel);
    };
  }, [userId, onConversationChange]);
}
