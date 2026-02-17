"use client";

import { useEffect, useState, useRef } from "react";
import { getUnreadCount } from "@/lib/actions/notifications";

interface NotificationBadgeProps {
  userId: string;
  initialCount?: number;
  className?: string;
  animate?: boolean;
}

export function NotificationBadge({
  userId,
  initialCount = 0,
  className = "",
  animate = true,
}: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);
  const [isNew, setIsNew] = useState(false);
  const prevCount = useRef(initialCount);

  useEffect(() => {
    // Fetch unread count on mount
    const fetchCount = async () => {
      const result = await getUnreadCount({ userId });
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

    fetchCount();

    // Poll for updates every 30 seconds (will be replaced with real-time later)
    const interval = setInterval(fetchCount, 30000);

    return () => clearInterval(interval);
  }, [userId]);

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
