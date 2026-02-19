"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/auth/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface RealtimeConfig {
  userId?: string;
  role?: "STAFF" | "MANAGER" | "ADMIN";
  enabled?: boolean;
  onNotification?: (payload: unknown) => void;
  onShiftUpdate?: (payload: unknown) => void;
  onTimeOffUpdate?: (payload: unknown) => void;
  onMessageUpdate?: (payload: unknown) => void;
}

export function useDashboardRealtime({
  userId,
  role,
  enabled = true,
  onNotification,
  onShiftUpdate,
  onTimeOffUpdate,
  onMessageUpdate,
}: RealtimeConfig) {
  const router = useRouter();
  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Initialize Supabase client once
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }

  const refreshDashboard = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!enabled || !userId) return;

    const supabase = supabaseRef.current!;
    const channelName = `dashboard-${userId}-${Date.now()}`;
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });

    // Subscribe to notifications for this user
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "Notification",
        filter: `userId=eq.${userId}`,
      },
      (payload) => {
        onNotification?.(payload);
        refreshDashboard();
      }
    );

    // Subscribe to shift changes (for upcoming shifts widget)
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "RosterShift",
        filter: `userId=eq.${userId}`,
      },
      (payload) => {
        onShiftUpdate?.(payload);
        refreshDashboard();
      }
    );

    // Subscribe to time-off request changes
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "TimeOffRequest",
        filter: `userId=eq.${userId}`,
      },
      (payload) => {
        onTimeOffUpdate?.(payload);
        refreshDashboard();
      }
    );

    // Subscribe to new messages (for unread count)
    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "Message",
      },
      (payload) => {
        const messageData = payload.new as { senderId?: string } | undefined;
        // Only refresh if message is not from current user
        if (messageData?.senderId !== userId) {
          onMessageUpdate?.(payload);
          refreshDashboard();
        }
      }
    );

    // For managers/admins, also watch for team updates
    if (role === "MANAGER" || role === "ADMIN") {
      // Watch for new time-off requests from team
      channel.on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "TimeOffRequest",
        },
        () => {
          refreshDashboard();
        }
      );

      // Watch for roster conflicts
      channel.on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "RosterShift",
          filter: "hasConflict=eq.true",
        },
        () => {
          refreshDashboard();
        }
      );
    }

    // Subscribe to the channel
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Dashboard Realtime] Connected to channel:", channelName);
      } else if (status === "CLOSED") {
        console.log("[Dashboard Realtime] Channel closed:", channelName);
      } else if (status === "CHANNEL_ERROR") {
        console.error("[Dashboard Realtime] Channel error:", channelName);
      }
    });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [enabled, userId, role, onNotification, onShiftUpdate, onTimeOffUpdate, onMessageUpdate, refreshDashboard]);

  return {
    refreshDashboard,
  };
}

// Simpler hook for just refresh triggers
export function useDashboardRefresh(intervalMs?: number) {
  const router = useRouter();
  const refreshCountRef = useRef(0);

  const refresh = useCallback(() => {
    router.refresh();
    refreshCountRef.current += 1;
  }, [router]);

  // Optional interval-based refresh
  useEffect(() => {
    if (!intervalMs || intervalMs < 10000) return; // Minimum 10 seconds

    const interval = setInterval(() => {
      refresh();
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs, refresh]);

  return {
    refresh,
    refreshCount: refreshCountRef.current,
  };
}