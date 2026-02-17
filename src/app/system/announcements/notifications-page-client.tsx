"use client";

import { useState } from "react";
import { NotificationType } from "@prisma/client";
import { NotificationStatsCards } from "@/components/admin/NotificationStatsCards";
import { SystemAnnouncementDialog } from "@/components/admin/SystemAnnouncementDialog";
import { NotificationHistoryTable } from "@/components/admin/NotificationHistoryTable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getNotificationHistory } from "@/lib/actions/admin/notifications";
import { format } from "date-fns";

interface NotificationsPageClientProps {
  stats: {
    total: number;
    totalToday: number;
    totalThisWeek: number;
    readCount: number;
    unreadCount: number;
    readPercentage: number;
    byType: Array<{ type: NotificationType; count: number }>;
    byCategory: {
      messages: number;
      posts: number;
      timeOff: number;
      system: number;
    };
  };
  initialNotifications: Array<{
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
  }>;
  announcements: Array<{
    title: string;
    message: string;
    link: string | null;
    createdAt: Date;
    totalRecipients: number;
    readCount: number;
    readPercentage: number;
  }>;
}

export function NotificationsPageClient({
  stats,
  initialNotifications,
  announcements,
}: NotificationsPageClientProps) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [isLoading, setIsLoading] = useState(false);

  const handleFilter = async (filters: {
    type?: NotificationType;
    readStatus?: "all" | "read" | "unread";
    search?: string;
  }) => {
    setIsLoading(true);
    try {
      const result = await getNotificationHistory({
        type: filters.type,
        readStatus: filters.readStatus,
        search: filters.search,
        limit: 50,
      });

      if (result.success && result.notifications) {
        setNotifications(result.notifications);
      }
    } catch (error) {
      console.error("Error filtering notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            Notification Center
          </h2>
          <p className="text-muted-foreground">
            Manage and monitor all system notifications
          </p>
        </div>
        <SystemAnnouncementDialog />
      </div>

      {/* Statistics Cards */}
      <NotificationStatsCards stats={stats} />

      {/* Category Breakdown */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.messages}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Posts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.posts}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Time Off</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.timeOff}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">System</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.byCategory.system}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">All Notifications</TabsTrigger>
          <TabsTrigger value="announcements">Announcements History</TabsTrigger>
          <TabsTrigger value="types">By Type</TabsTrigger>
        </TabsList>

        {/* All Notifications Tab */}
        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notification History</CardTitle>
              <CardDescription>
                View and filter all notifications across all users
              </CardDescription>
            </CardHeader>
            <CardContent>
              <NotificationHistoryTable
                initialNotifications={notifications}
                onFilter={handleFilter}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Announcements History Tab */}
        <TabsContent value="announcements" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Announcement History</CardTitle>
              <CardDescription>
                Past system announcements with read receipts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {announcements.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No announcements have been sent yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((announcement, index) => (
                    <Card key={index}>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <CardTitle className="text-lg">
                              {announcement.title}
                            </CardTitle>
                            <CardDescription>
                              {format(new Date(announcement.createdAt), "MMM d, yyyy 'at' h:mm a")}
                            </CardDescription>
                          </div>
                          <Badge variant="secondary">
                            {announcement.readPercentage}% read
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm mb-4">{announcement.message}</p>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>
                            Recipients: {announcement.totalRecipients}
                          </span>
                          <span>
                            Read: {announcement.readCount}
                          </span>
                          <span>
                            Unread: {announcement.totalRecipients - announcement.readCount}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Type Tab */}
        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Notifications by Type</CardTitle>
              <CardDescription>
                Breakdown of notification counts by type
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.byType.map((typeData) => (
                  <div
                    key={typeData.type}
                    className="flex items-center justify-between p-3 border rounded-md"
                  >
                    <span className="font-medium">{typeData.type.replace(/_/g, " ")}</span>
                    <Badge variant="secondary">{typeData.count}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
