"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { getUnreadCount } from "@/lib/actions/notifications";

interface NotificationBadgeProps {
  userId: string;
  initialCount?: number;
  className?: string;
}

export function NotificationBadge({
  userId,
  initialCount = 0,
  className = "",
}: NotificationBadgeProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    // Fetch unread count on mount
    const fetchCount = async () => {
      const result = await getUnreadCount({ userId });
      if (!result.error && result.count !== undefined) {
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
    <Badge
      variant="destructive"
      className={`h-5 min-w-[20px] px-1.5 text-xs font-medium ${className}`}
    >
      {displayCount}
    </Badge>
  );
}
