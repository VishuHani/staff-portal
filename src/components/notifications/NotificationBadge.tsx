"use client";

import { useEffect, useState, useRef } from "react";
import { getUnreadCount } from "@/lib/actions/notifications";
import { useOptionalNotificationContext } from "./notification-context";

const POLL_INTERVAL_MS = 60000;

interface NotificationBadgeProps {
  userId?: string;
  initialCount?: number;
  className?: string;
  animate?: boolean;
}

export function NotificationBadge({
  userId: userIdProp,
  initialCount,
  className = "",
  animate = true,
}: NotificationBadgeProps) {
  const notificationContext = useOptionalNotificationContext();
  const userId = userIdProp ?? notificationContext?.userId;
  const resolvedInitialCount = initialCount ?? notificationContext?.unreadCount ?? 0;

  const [count, setCount] = useState(resolvedInitialCount);
  const [isNew, setIsNew] = useState(false);
  const prevCount = useRef(resolvedInitialCount);

  useEffect(() => {
    setCount(resolvedInitialCount);
    prevCount.current = resolvedInitialCount;
  }, [resolvedInitialCount]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let isMounted = true;
    let interval: ReturnType<typeof setInterval> | null = null;

    const fetchCount = async () => {
      const result = await getUnreadCount({ userId });
      if (!isMounted) {
        return;
      }

      if (!result.error && result.count !== undefined) {
        // Check if count increased (new notification)
        if (result.count > prevCount.current) {
          setIsNew(true);
          // Reset animation after a delay
          setTimeout(() => setIsNew(false), 2000);
        }
        prevCount.current = result.count;
        setCount(result.count);
      }
    };

    const startPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }

      if (document.visibilityState !== "visible") {
        return;
      }

      interval = setInterval(() => {
        void fetchCount();
      }, POLL_INTERVAL_MS);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchCount();
      }

      startPolling();
    };

    void fetchCount();
    startPolling();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleVisibilityChange);

    return () => {
      isMounted = false;
      if (interval) {
        clearInterval(interval);
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleVisibilityChange);
    };
  }, [userId]);

  if (!userId) {
    return null;
  }

  if (count === 0) {
    return null;
  }

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <span
      className={`
        inline-flex items-center justify-center
        min-w-[18px] h-[18px] px-1
        text-[10px] font-bold leading-none
        text-white bg-red-500
        rounded-full
        shadow-sm
        transition-all duration-300 ease-out
        ${animate && isNew ? "animate-bounce scale-110" : ""}
        ${animate ? "hover:scale-110" : ""}
        ${className}
      `}
    >
      {displayCount}
    </span>
  );
}
