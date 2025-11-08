import { useEffect, useState, useCallback, useRef } from "react";
import { createClient } from "@/lib/auth/supabase-client";

interface TypingUser {
  userId: string;
  email: string;
}

interface UseTypingIndicatorProps {
  conversationId: string;
  currentUserId: string;
  currentUserEmail: string;
}

/**
 * Hook for managing typing indicators in a conversation
 * Uses Supabase Realtime Presence for ephemeral typing state
 */
export function useTypingIndicator({
  conversationId,
  currentUserId,
  currentUserEmail,
}: UseTypingIndicatorProps) {
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [channel, setChannel] = useState<any>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    const supabase = createClient();

    // Create a presence channel for this conversation
    const presenceChannel = supabase.channel(
      `typing:${conversationId}`,
      {
        config: {
          presence: {
            key: currentUserId,
          },
        },
      }
    );

    // Listen for presence sync events
    presenceChannel
      .on("presence", { event: "sync" }, () => {
        const state = presenceChannel.presenceState();

        // Extract typing users from presence state
        const users: TypingUser[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            // Don't include current user in typing list
            if (presence.userId !== currentUserId && presence.typing) {
              users.push({
                userId: presence.userId,
                email: presence.email,
              });
            }
          });
        });

        setTypingUsers(users);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          // Track initial presence as not typing
          await presenceChannel.track({
            userId: currentUserId,
            email: currentUserEmail,
            typing: false,
          });
        }
      });

    setChannel(presenceChannel);

    // Cleanup on unmount
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      supabase.removeChannel(presenceChannel);
    };
  }, [conversationId, currentUserId, currentUserEmail]);

  /**
   * Broadcast that the current user is typing
   */
  const startTyping = useCallback(() => {
    if (!channel) return;

    // Clear any existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update presence to typing
    channel.track({
      userId: currentUserId,
      email: currentUserEmail,
      typing: true,
    });

    // Auto-stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 3000);
  }, [channel, currentUserId, currentUserEmail]);

  /**
   * Broadcast that the current user stopped typing
   */
  const stopTyping = useCallback(() => {
    if (!channel) return;

    // Clear timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Update presence to not typing
    channel.track({
      userId: currentUserId,
      email: currentUserEmail,
      typing: false,
    });
  }, [channel, currentUserId, currentUserEmail]);

  return {
    typingUsers,
    startTyping,
    stopTyping,
  };
}
