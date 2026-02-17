"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, Bell, Inbox } from "lucide-react";
import { NotificationCard } from "./NotificationCard";
import { NotificationStats } from "./NotificationStats";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllNotifications, markAllAsRead, deleteAllRead } from "@/lib/actions/notifications";
import { toast } from "sonner";
import type { NotificationType } from "@prisma/client";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
  userId: string;
}

interface NotificationListProps {
  userId: string;
  initialNotifications?: Notification[];
  initialCursor?: string | null;
}

export function NotificationList({
  userId,
  initialNotifications = [],
  initialCursor = null,
}: NotificationListProps) {
  const [notifications, setNotifications] = useState<Notification[]>(initialNotifications);
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);
  const [isDeletingRead, setIsDeletingRead] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [typeFilter, setTypeFilter] = useState<NotificationType | "ALL">("ALL");

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Load more notifications
  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;

    setIsLoading(true);
    try {
      const result = await getAllNotifications({
        userId,
        unreadOnly: filter === "unread",
        type: typeFilter === "ALL" ? undefined : typeFilter,
        cursor: cursor || undefined,
        limit: 20,
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.notifications) {
        setNotifications((prev) => [...prev, ...result.notifications!]);
        setCursor(result.nextCursor || null);
        setHasMore(result.hasMore || false);
      }
    } catch (error) {
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, [userId, filter, typeFilter, cursor, isLoading, hasMore]);

  // Setup intersection observer for infinite scroll
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, isLoading, loadMore]);

  // Reload notifications when filters change
  useEffect(() => {
    const reloadNotifications = async () => {
      setIsLoading(true);
      try {
        const result = await getAllNotifications({
          userId,
          unreadOnly: filter === "unread",
          type: typeFilter === "ALL" ? undefined : typeFilter,
          limit: 20,
        });

        if (result.error) {
          toast.error(result.error);
          return;
        }

        if (result.notifications) {
          setNotifications(result.notifications);
          setCursor(result.nextCursor || null);
          setHasMore(result.hasMore || false);
        }
      } catch (error) {
        toast.error("Failed to load notifications");
      } finally {
        setIsLoading(false);
      }
    };

    reloadNotifications();
  }, [userId, filter, typeFilter]);

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    setIsMarkingAllRead(true);
    try {
      const result = await markAllAsRead({ userId });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("All notifications marked as read");
        // Refresh list
        window.location.reload();
      }
    } catch (error) {
      toast.error("Failed to mark all as read");
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  // Delete all read notifications
  const handleDeleteAllRead = async () => {
    setIsDeletingRead(true);
    try {
      const result = await deleteAllRead({ userId });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("All read notifications deleted");
        // Refresh list
        window.location.reload();
      }
    } catch (error) {
      toast.error("Failed to delete notifications");
    } finally {
      setIsDeletingRead(false);
    }
  };

  // Refresh notification list after card actions
  const handleUpdate = () => {
    window.location.reload();
  };

  const unreadCount = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="space-y-4">
      {/* Statistics cards */}
      {notifications.length > 0 && (
        <NotificationStats
          notifications={notifications.map(n => ({
            type: n.type,
            readAt: n.readAt
          }))}
        />
      )}

      {/* Header with filters and actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {unreadCount} new
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Filter by read status */}
          <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "unread")}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread only</SelectItem>
            </SelectContent>
          </Select>

          {/* Filter by type */}
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as NotificationType | "ALL")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>

              {/* Message notifications */}
              <SelectItem value="NEW_MESSAGE">New Message</SelectItem>
              <SelectItem value="MESSAGE_REPLY">Message Reply</SelectItem>
              <SelectItem value="MESSAGE_MENTION">Message Mention</SelectItem>
              <SelectItem value="MESSAGE_REACTION">Message Reaction</SelectItem>

              {/* Post notifications */}
              <SelectItem value="POST_MENTION">Post Mention</SelectItem>
              <SelectItem value="POST_PINNED">Post Pinned</SelectItem>
              <SelectItem value="POST_DELETED">Post Deleted</SelectItem>

              {/* Time off notifications */}
              <SelectItem value="TIME_OFF_REQUEST">Time Off Request</SelectItem>
              <SelectItem value="TIME_OFF_APPROVED">Time Off Approved</SelectItem>
              <SelectItem value="TIME_OFF_REJECTED">Time Off Rejected</SelectItem>
              <SelectItem value="TIME_OFF_CANCELLED">Time Off Cancelled</SelectItem>

              {/* User/Admin notifications */}
              <SelectItem value="USER_CREATED">Welcome</SelectItem>
              <SelectItem value="USER_UPDATED">Account Updated</SelectItem>
              <SelectItem value="ROLE_CHANGED">Role Changed</SelectItem>

              {/* System notifications */}
              <SelectItem value="SYSTEM_ANNOUNCEMENT">System Announcement</SelectItem>
              <SelectItem value="GROUP_REMOVED">Group Removed</SelectItem>
            </SelectContent>
          </Select>

          {/* Actions */}
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={isMarkingAllRead}
            >
              {isMarkingAllRead && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark all read
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteAllRead}
            disabled={isDeletingRead}
          >
            {isDeletingRead && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Clear read
          </Button>
        </div>
      </div>

      {/* Notifications list */}
      {notifications.length === 0 && !isLoading ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No notifications</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {filter === "unread"
              ? "You're all caught up!"
              : "You don't have any notifications yet"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <NotificationCard
              key={notification.id}
              notification={notification}
              userId={userId}
              onUpdate={handleUpdate}
            />
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Intersection observer target */}
          {hasMore && !isLoading && (
            <div ref={loadMoreRef} className="h-4" />
          )}

          {/* End of list message */}
          {!hasMore && notifications.length > 0 && (
            <div className="text-center py-4 text-sm text-muted-foreground">
              You've reached the end
            </div>
          )}
        </div>
      )}
    </div>
  );
}
