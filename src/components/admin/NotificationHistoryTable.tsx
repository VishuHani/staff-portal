"use client";

import { useState } from "react";
import { NotificationType } from "@prisma/client";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, Search } from "lucide-react";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  readAt: Date | null;
  createdAt: Date;
  link: string | null;
  user: {
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

interface NotificationHistoryTableProps {
  initialNotifications: Notification[];
  onFilter: (filters: {
    type?: NotificationType;
    readStatus?: "all" | "read" | "unread";
    search?: string;
  }) => void;
}

const NOTIFICATION_TYPES = [
  "NEW_MESSAGE",
  "MESSAGE_REPLY",
  "MESSAGE_MENTION",
  "MESSAGE_REACTION",
  "POST_MENTION",
  "POST_PINNED",
  "POST_DELETED",
  "TIME_OFF_REQUEST",
  "TIME_OFF_APPROVED",
  "TIME_OFF_REJECTED",
  "TIME_OFF_CANCELLED",
  "USER_CREATED",
  "USER_UPDATED",
  "ROLE_CHANGED",
  "SYSTEM_ANNOUNCEMENT",
  "GROUP_REMOVED",
] as const;

const TYPE_LABELS: Record<NotificationType, string> = {
  NEW_MESSAGE: "New Message",
  MESSAGE_REPLY: "Message Reply",
  MESSAGE_MENTION: "Mention",
  MESSAGE_REACTION: "Reaction",
  POST_MENTION: "Post Mention",
  POST_PINNED: "Post Pinned",
  POST_DELETED: "Post Deleted",
  TIME_OFF_REQUEST: "Time Off Request",
  TIME_OFF_APPROVED: "Time Off Approved",
  TIME_OFF_REJECTED: "Time Off Rejected",
  TIME_OFF_CANCELLED: "Time Off Cancelled",
  USER_CREATED: "User Created",
  USER_UPDATED: "User Updated",
  ROLE_CHANGED: "Role Changed",
  SYSTEM_ANNOUNCEMENT: "System Announcement",
  GROUP_REMOVED: "Group Removed",
};

const TYPE_COLORS: Record<NotificationType, string> = {
  NEW_MESSAGE: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  MESSAGE_REPLY: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  MESSAGE_MENTION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  MESSAGE_REACTION: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  POST_MENTION: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  POST_PINNED: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300",
  POST_DELETED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  TIME_OFF_REQUEST: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  TIME_OFF_APPROVED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  TIME_OFF_REJECTED: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  TIME_OFF_CANCELLED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
  USER_CREATED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  USER_UPDATED: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  ROLE_CHANGED: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  SYSTEM_ANNOUNCEMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  GROUP_REMOVED: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
};

export function NotificationHistoryTable({
  initialNotifications,
  onFilter,
}: NotificationHistoryTableProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<NotificationType | "all">("all");
  const [readStatusFilter, setReadStatusFilter] = useState<"all" | "read" | "unread">("all");

  const handleFilter = () => {
    onFilter({
      type: typeFilter === "all" ? undefined : typeFilter,
      readStatus: readStatusFilter,
      search: search || undefined,
    });
  };

  const getUserName = (notification: Notification) => {
    if (notification.user.firstName || notification.user.lastName) {
      return `${notification.user.firstName || ""} ${notification.user.lastName || ""}`.trim();
    }
    return notification.user.email;
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleFilter();
              }
            }}
            className="pl-10"
          />
        </div>

        {/* Type Filter */}
        <Select
          value={typeFilter}
          onValueChange={(value) => setTypeFilter(value as NotificationType | "all")}
        >
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {NOTIFICATION_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {TYPE_LABELS[type]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Read Status Filter */}
        <Select value={readStatusFilter} onValueChange={(value: "all" | "read" | "unread") => setReadStatusFilter(value)}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="read">Read</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
          </SelectContent>
        </Select>

        {/* Apply Filter Button */}
        <Button onClick={handleFilter}>
          Apply Filters
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableCaption>
            {initialNotifications.length === 0
              ? "No notifications found"
              : `Showing ${initialNotifications.length} notification(s)`}
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">Status</TableHead>
              <TableHead className="w-[180px]">Type</TableHead>
              <TableHead>Recipient</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[150px]">Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialNotifications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No notifications found. Try adjusting your filters.
                </TableCell>
              </TableRow>
            ) : (
              initialNotifications.map((notification) => (
                <TableRow key={notification.id}>
                  {/* Read Status */}
                  <TableCell>
                    {notification.readAt ? (
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                    ) : (
                      <Circle className="h-4 w-4 text-gray-400" />
                    )}
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={TYPE_COLORS[notification.type]}
                    >
                      {TYPE_LABELS[notification.type]}
                    </Badge>
                  </TableCell>

                  {/* Recipient */}
                  <TableCell className="font-medium">
                    {getUserName(notification)}
                  </TableCell>

                  {/* Title & Message */}
                  <TableCell>
                    <div className="space-y-1">
                      <p className="font-medium">{notification.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {notification.message}
                      </p>
                    </div>
                  </TableCell>

                  {/* Created At */}
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(notification.createdAt), "MMM d, yyyy")}
                    <br />
                    <span className="text-xs">
                      {format(new Date(notification.createdAt), "h:mm a")}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
