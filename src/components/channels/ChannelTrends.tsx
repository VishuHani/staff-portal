"use client";

import { Download } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { toast } from "sonner";

interface TrendData {
  week: string;
  posts: number;
  members: number;
  cumulativeMembers: number;
}

interface TrendMetrics {
  avgPostsPerMember: number;
  avgPostsPerWeek: number;
  avgMembersPerWeek: number;
}

interface ChannelTrendsProps {
  channelName: string;
  weeklyData: TrendData[];
  metrics: TrendMetrics;
}

export function ChannelTrends({
  channelName,
  weeklyData,
  metrics,
}: ChannelTrendsProps) {
  const handleExportCSV = () => {
    // Prepare CSV data
    const headers = ["Week", "Posts", "New Members", "Total Members"];
    const rows = weeklyData.map((week) => [
      week.week,
      week.posts,
      week.members,
      week.cumulativeMembers,
    ]);

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    // Create download link
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${channelName}-analytics-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Analytics data exported");
  };

  const handleExportJSON = () => {
    const data = {
      channel: channelName,
      exportDate: new Date().toISOString(),
      metrics,
      weeklyData,
    };

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${channelName}-analytics-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    toast.success("Analytics data exported");
  };

  return (
    <div className="space-y-6">
      {/* Engagement Metrics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Engagement Metrics</CardTitle>
            <CardDescription>
              Average activity rates and trends
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
            >
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
            >
              <Download className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Avg Posts per Member
              </p>
              <p className="text-2xl font-bold">
                {metrics.avgPostsPerMember.toFixed(2)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Avg Posts per Week
              </p>
              <p className="text-2xl font-bold">
                {metrics.avgPostsPerWeek.toFixed(1)}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                Avg New Members per Week
              </p>
              <p className="text-2xl font-bold">
                {metrics.avgMembersPerWeek.toFixed(1)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Member Growth Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Member Growth</CardTitle>
          <CardDescription>
            Total members over the last 12 weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <Area
                type="monotone"
                dataKey="cumulativeMembers"
                name="Total Members"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.2}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Post Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Post Activity</CardTitle>
          <CardDescription>
            Posts created per week over the last 12 weeks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <Bar
                dataKey="posts"
                name="Posts"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Combined Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Combined Activity</CardTitle>
          <CardDescription>
            New members and posts per week
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="week"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                fontSize={12}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.5rem",
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="posts"
                name="Posts"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="members"
                name="New Members"
                stroke="#10b981"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
