"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, CheckCircle2, AlertCircle, Info, Calendar } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export interface Notification {
  id: string;
  type: string;
  message: string;
  readAt: Date | null;
  createdAt: Date;
}

interface RecentActivityFeedProps {
  notifications: Notification[];
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case "TIME_OFF_APPROVED":
    case "TIME_OFF_REJECTED":
      return Calendar;
    case "SYSTEM":
      return Info;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: string) => {
  switch (type) {
    case "TIME_OFF_APPROVED":
      return "text-green-600";
    case "TIME_OFF_REJECTED":
      return "text-red-600";
    case "SYSTEM":
      return "text-blue-600";
    default:
      return "text-gray-600";
  }
};

export function RecentActivityFeed({ notifications }: RecentActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Your latest notifications and updates</CardDescription>
          </div>
          <Link href="/notifications">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {notifications.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Bell className="mx-auto h-12 w-12 opacity-20" />
            <p className="mt-2">No recent activity</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notification) => {
              const Icon = getNotificationIcon(notification.type);
              const color = getNotificationColor(notification.type);

              return (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                    !notification.readAt && "bg-accent/50"
                  }`}
                >
                  <div className={`mt-0.5 rounded-full p-2 bg-accent`}>
                    <Icon className={`h-4 w-4 ${color}`} />
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm leading-relaxed">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  {!notification.readAt && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
