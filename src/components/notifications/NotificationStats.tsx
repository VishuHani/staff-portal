"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Bell, MessageSquare, FileText, Calendar, Settings } from "lucide-react";
import type { NotificationType } from "@prisma/client";

interface NotificationStatsProps {
  notifications: Array<{
    type: NotificationType;
    readAt: Date | null;
  }>;
}

export function NotificationStats({ notifications }: NotificationStatsProps) {
  // Category mappings
  const categories = {
    messages: {
      types: ["NEW_MESSAGE", "MESSAGE_REPLY", "MESSAGE_MENTION", "MESSAGE_REACTION"] as NotificationType[],
      icon: MessageSquare,
      label: "Messages",
      color: "text-blue-500",
    },
    posts: {
      types: ["POST_MENTION", "POST_PINNED", "POST_DELETED"] as NotificationType[],
      icon: FileText,
      label: "Posts",
      color: "text-green-500",
    },
    timeOff: {
      types: ["TIME_OFF_REQUEST", "TIME_OFF_APPROVED", "TIME_OFF_REJECTED", "TIME_OFF_CANCELLED"] as NotificationType[],
      icon: Calendar,
      label: "Time Off",
      color: "text-orange-500",
    },
    system: {
      types: ["USER_CREATED", "USER_UPDATED", "ROLE_CHANGED", "SYSTEM_ANNOUNCEMENT", "GROUP_REMOVED"] as NotificationType[],
      icon: Settings,
      label: "System",
      color: "text-purple-500",
    },
  };

  // Calculate stats
  const stats = Object.entries(categories).map(([key, category]) => {
    const categoryNotifications = notifications.filter((n) =>
      category.types.includes(n.type)
    );
    const total = categoryNotifications.length;
    const unread = categoryNotifications.filter((n) => !n.readAt).length;

    return {
      key,
      ...category,
      total,
      unread,
    };
  });

  const totalUnread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.key}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`rounded-lg bg-muted p-2 ${stat.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.total}</p>
                  </div>
                </div>
                {stat.unread > 0 && (
                  <div className="rounded-full bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
                    {stat.unread}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
