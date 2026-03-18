"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/auth/supabase-client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { toast } from "sonner";

// Connection states for better UX
export type ConnectionState = "connecting" | "connected" | "disconnected" | "error" | "reconnecting";

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
  
  // Connection state tracking
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const retryCountRef = useRef(0);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Retry configuration
  const MAX_RETRIES = 3;
  const INITIAL_DELAY = 1000; // 1 second
  const MAX_DELAY = 30000; // 30 seconds
  
  // Calculate delay with exponential backoff
  const getRetryDelay = (attempt: number) => {
    const delay = Math.min(
      INITIAL_DELAY * Math.pow(2, attempt),
      MAX_DELAY
    );
    // Add jitter (±25%)
    const jitter = delay * 0.25 * (Math.random() * 2 - 1);
    return Math.floor(delay + jitter);
  };
  
  const refreshDashboard = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!enabled || !userId) return;

    // Initialize Supabase client if not already done
    if (!supabaseRef.current) {
      supabaseRef.current = createClient();
    }
    const supabase = supabaseRef.current;
    const channelName = `dashboard-${userId}-${Date.now()}`;
    
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
        presence: { key: userId },
      },
    });
    
    // Handle channel errors with retry logic
    const handleChannelError = () => {
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = getRetryDelay(retryCountRef.current);
        console.log(`[Dashboard Realtime] Retrying in ${delay}ms (attempt ${retryCountRef.current + 1})`);
        
        retryTimeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          // Re-subscribe logic here
        }, delay);
      } else {
        console.error("[Dashboard Realtime] Max retries exceeded");
        // Transition to permanent error state
        setConnectionState("error");
      }
    };
    
    // Subscribe to notifications for this user
    // NOTE: Supabase Realtime requires actual PostgreSQL table names, not Prisma model names
    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "notifications", // Prisma: Notification → PostgreSQL: notifications
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
        table: "roster_shifts", // Prisma: RosterShift → PostgreSQL: roster_shifts
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
        table: "time_off_requests", // Prisma: TimeOffRequest → PostgreSQL: time_off_requests
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
        table: "messages", // Prisma: Message → PostgreSQL: messages
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
          table: "time_off_requests", // Prisma: TimeOffRequest → PostgreSQL: time_off_requests
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
          table: "roster_shifts", // Prisma: RosterShift → PostgreSQL: roster_shifts
          filter: "hasConflict=eq.true",
        },
        () => {
          refreshDashboard();
        }
      );
    }
    
    // Subscribe to channel with error handling
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        console.log("[Dashboard Realtime] Connected to channel:", channelName);
        setConnectionState("connected");
      } else if (status === "CLOSED") {
        console.log("[Dashboard Realtime] Channel closed:", channelName);
        setConnectionState("disconnected");
      } else if (status === "CHANNEL_ERROR") {
        console.error("[Dashboard Realtime] Channel error:", channelName);
        handleChannelError();
      } else if (status === "REATTACHING") {
        console.log("[Dashboard Realtime] Reconnecting to channel...");
        setConnectionState("reconnecting");
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
    connectionState,
    isConnected: connectionState === "connected",
  };
};

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
