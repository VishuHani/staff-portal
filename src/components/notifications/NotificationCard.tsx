"use client";

import { useState, useEffect } from "react";
import { formatDistanceToNow, format } from "date-fns";
import {
  Bell,
  MessageSquare,
  AtSign,
  Heart,
  Calendar,
  CheckCircle,
  XCircle,
  UserPlus,
  UserCog,
  Shield,
  Megaphone,
  Users,
  Pin,
  Trash2,
  Loader2,
  ExternalLink,
  X,
  Check,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAsRead, deleteNotification } from "@/lib/actions/notifications";
import { toast } from "sonner";
import type { NotificationType } from "@prisma/client";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string | null;
  link?: string | null;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationCardProps {
  notification: Notification;
  userId: string;
  onUpdate?: () => void;
}

// Get icon based on notification type
function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "NEW_MESSAGE":
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case "MESSAGE_REPLY":
      return <MessageSquare className="h-5 w-5 text-blue-500" />;
    case "MESSAGE_MENTION":
      return <AtSign className="h-5 w-5 text-purple-500" />;
    case "MESSAGE_REACTION":
      return <Heart className="h-5 w-5 text-pink-500" />;
    case "POST_MENTION":
      return <AtSign className="h-5 w-5 text-purple-500" />;
    case "POST_PINNED":
      return <Pin className="h-5 w-5 text-yellow-500" />;
    case "POST_DELETED":
      return <Trash2 className="h-5 w-5 text-red-500" />;
    case "TIME_OFF_REQUEST":
      return <Calendar className="h-5 w-5 text-orange-500" />;
    case "TIME_OFF_APPROVED":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "TIME_OFF_REJECTED":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "TIME_OFF_CANCELLED":
      return <Calendar className="h-5 w-5 text-gray-500" />;
    case "USER_CREATED":
      return <UserPlus className="h-5 w-5 text-green-500" />;
    case "USER_UPDATED":
      return <UserCog className="h-5 w-5 text-blue-500" />;
    case "ROLE_CHANGED":
      return <Shield className="h-5 w-5 text-indigo-500" />;
    case "SYSTEM_ANNOUNCEMENT":
      return <Megaphone className="h-5 w-5 text-red-500" />;
    case "GROUP_REMOVED":
      return <Users className="h-5 w-5 text-gray-500" />;
    default:
      return <Bell className="h-5 w-5 text-gray-500" />;
  }
}

// Get color based on notification type
function getNotificationColor(type: NotificationType) {
  switch (type) {
    case "TIME_OFF_APPROVED":
    case "USER_CREATED":
      return "border-l-4 border-l-green-500";
    case "TIME_OFF_REJECTED":
    case "POST_DELETED":
      return "border-l-4 border-l-red-500";
    case "TIME_OFF_REQUEST":
      return "border-l-4 border-l-orange-500";
    case "SYSTEM_ANNOUNCEMENT":
      return "border-l-4 border-l-red-600";
    case "MESSAGE_MENTION":
    case "POST_MENTION":
      return "border-l-4 border-l-purple-500";
    default:
      return "border-l-4 border-l-blue-500";
  }
}

export function NotificationCard({ notification, userId, onUpdate }: NotificationCardProps) {
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [timeAgo, setTimeAgo] = useState<string>("");

  const handleMarkAsRead = async () => {
    setIsMarkingRead(true);
    try {
      const result = await markAsRead({
        notificationId: notification.id,
        userId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Marked as read");
        onUpdate?.();
      }
    } catch (error) {
      toast.error("Failed to mark as read");
    } finally {
      setIsMarkingRead(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const result = await deleteNotification({
        notificationId: notification.id,
        userId,
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Notification deleted");
        onUpdate?.();
      }
    } catch (error) {
      toast.error("Failed to delete notification");
    } finally {
      setIsDeleting(false);
    }
  };

  // Calculate relative time on client-side only to avoid hydration mismatch
  useEffect(() => {
    const updateTime = () => {
      setTimeAgo(formatDistanceToNow(new Date(notification.createdAt), {
        addSuffix: true,
      }));
    };

    // Set initial time
    updateTime();

    // Update every minute
    const interval = setInterval(updateTime, 60000);

    return () => clearInterval(interval);
  }, [notification.createdAt]);

  const handleActionClick = () => {
    if (notification.link) {
      // Mark as read when action is clicked
      if (!notification.readAt) {
        markAsRead({ notificationId: notification.id, userId });
      }
      window.location.href = notification.link;
    }
  };

  // Fallback for SSR: show absolute time
  const formattedDate = format(new Date(notification.createdAt), "MMM d, yyyy 'at' h:mm a");

  return (
    <Card
      className={`p-4 ${getNotificationColor(notification.type)} ${
        notification.readAt ? "bg-background" : "bg-muted/50"
      } hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="flex-shrink-0 mt-1">
          {getNotificationIcon(notification.type)}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <h4 className="font-medium text-sm">{notification.title}</h4>
              {notification.message && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {notification.message}
                </p>
              )}
            </div>

            {/* Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <span className="sr-only">Open menu</span>
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M3.625 7.5C3.625 8.12132 3.12132 8.625 2.5 8.625C1.87868 8.625 1.375 8.12132 1.375 7.5C1.375 6.87868 1.87868 6.375 2.5 6.375C3.12132 6.375 3.625 6.87868 3.625 7.5ZM8.625 7.5C8.625 8.12132 8.12132 8.625 7.5 8.625C6.87868 8.625 6.375 8.12132 6.375 7.5C6.375 6.87868 6.87868 6.375 7.5 6.375C8.12132 6.375 8.625 6.87868 8.625 7.5ZM12.5 8.625C13.1213 8.625 13.625 8.12132 13.625 7.5C13.625 6.87868 13.1213 6.375 12.5 6.375C11.8787 6.375 11.375 6.87868 11.375 7.5C11.375 8.12132 11.8787 8.625 12.5 8.625Z"
                      fill="currentColor"
                    />
                  </svg>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!notification.readAt && (
                  <DropdownMenuItem
                    onClick={handleMarkAsRead}
                    disabled={isMarkingRead}
                  >
                    {isMarkingRead ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="mr-2 h-4 w-4" />
                    )}
                    Mark as read
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600"
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <X className="mr-2 h-4 w-4" />
                  )}
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span suppressHydrationWarning>
                {timeAgo || formattedDate}
              </span>
              {!notification.readAt && (
                <Badge variant="default" className="h-5 px-1.5 text-xs">
                  New
                </Badge>
              )}
            </div>

            {/* Action Button */}
            {notification.link && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleActionClick}
                className="h-7 text-xs"
              >
                View
                <ExternalLink className="ml-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
