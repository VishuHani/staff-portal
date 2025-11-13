"use client";

import { Users, MessageSquare, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RoleBadge } from "./RoleBadge";
import { ChannelTrends } from "./ChannelTrends";
import { getFullName } from "@/lib/utils/profile";

interface ChannelAnalyticsData {
  channel: {
    id: string;
    name: string;
    type: string;
    memberCount: number;
    postCount: number;
    createdAt: Date;
  };
  memberStats: {
    total: number;
    byRole: Array<{
      role: string;
      count: number;
    }>;
    byAddedVia: Array<{
      addedVia: string;
      count: number;
    }>;
  };
  recentActivity: {
    postsLast30Days: number;
    membersAddedLast30Days: number;
  };
  topContributors: Array<{
    user: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email: string;
      profileImage?: string | null;
    } | null;
    postCount: number;
  }>;
  trends?: {
    weeklyData: Array<{
      week: string;
      posts: number;
      members: number;
      cumulativeMembers: number;
    }>;
    metrics: {
      avgPostsPerMember: number;
      avgPostsPerWeek: number;
      avgMembersPerWeek: number;
    };
  };
}

interface ChannelAnalyticsProps {
  data: ChannelAnalyticsData;
}

export function ChannelAnalytics({ data }: ChannelAnalyticsProps) {
  const { channel, memberStats, recentActivity, topContributors, trends } = data;

  // Calculate percentages for role distribution
  const rolePercentages = memberStats.byRole.map((r) => ({
    ...r,
    percentage: (r.count / memberStats.total) * 100,
  }));

  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="trends">Trends</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberStats.total}</div>
            <p className="text-xs text-muted-foreground">
              +{recentActivity.membersAddedLast30Days} in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{channel.postCount}</div>
            <p className="text-xs text-muted-foreground">
              +{recentActivity.postsLast30Days} in last 30 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Activity Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {memberStats.total > 0
                ? (recentActivity.postsLast30Days / memberStats.total).toFixed(1)
                : 0}
            </div>
            <p className="text-xs text-muted-foreground">posts per member / 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Channel Age</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(
                (new Date().getTime() - new Date(channel.createdAt).getTime()) /
                  (1000 * 60 * 60 * 24)
              )}
            </div>
            <p className="text-xs text-muted-foreground">days</p>
          </CardContent>
        </Card>
      </div>

      {/* Role Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Role Distribution</CardTitle>
          <CardDescription>
            Breakdown of members by role in this channel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {rolePercentages.map((roleData) => (
            <div key={roleData.role} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RoleBadge
                    role={roleData.role as "CREATOR" | "MODERATOR" | "MEMBER"}
                  />
                  <span className="text-sm text-muted-foreground">
                    {roleData.count} {roleData.count === 1 ? "member" : "members"}
                  </span>
                </div>
                <span className="text-sm font-medium">
                  {roleData.percentage.toFixed(0)}%
                </span>
              </div>
              <Progress value={roleData.percentage} className="h-2" />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Contributors */}
      {topContributors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Contributors</CardTitle>
            <CardDescription>
              Most active members in this channel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topContributors.map((contributor, index) => {
                if (!contributor.user) return null;

                return (
                  <div
                    key={contributor.user.id}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {index + 1}
                    </div>
                    <UserAvatar
                      imageUrl={contributor.user.profileImage}
                      firstName={contributor.user.firstName}
                      lastName={contributor.user.lastName}
                      email={contributor.user.email}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {getFullName(contributor.user)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contributor.postCount}{" "}
                        {contributor.postCount === 1 ? "post" : "posts"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Member Source Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Member Sources</CardTitle>
          <CardDescription>
            How members were added to this channel
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {memberStats.byAddedVia.map((sourceData) => {
            const percentage = (sourceData.count / memberStats.total) * 100;
            const sourceLabel = sourceData.addedVia
              .split("_")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ");

            return (
              <div key={sourceData.addedVia} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{sourceLabel}</span>
                  <span className="text-sm text-muted-foreground">
                    {sourceData.count} ({percentage.toFixed(0)}%)
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </CardContent>
      </Card>
      </TabsContent>

      <TabsContent value="trends" className="space-y-6">
        {trends ? (
          <ChannelTrends
            channelName={channel.name}
            weeklyData={trends.weeklyData}
            metrics={trends.metrics}
          />
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                No trend data available yet
              </p>
            </CardContent>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}

/**
 * Compact analytics summary for cards
 */
export function ChannelAnalyticsSummary({
  memberCount,
  postCount,
  recentActivity,
}: {
  memberCount: number;
  postCount: number;
  recentActivity: number;
}) {
  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      <div className="flex items-center gap-1">
        <Users className="h-4 w-4" />
        <span>{memberCount}</span>
      </div>
      <div className="flex items-center gap-1">
        <MessageSquare className="h-4 w-4" />
        <span>{postCount}</span>
      </div>
      {recentActivity > 0 && (
        <div className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4 text-green-600" />
          <span>+{recentActivity}</span>
        </div>
      )}
    </div>
  );
}
