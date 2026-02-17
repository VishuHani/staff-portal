"use client";

import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, Users, Clock, CalendarOff } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ManagerHeroStats {
  coverageToday: number;
  availableStaff: number;
  totalStaff: number;
  pendingApprovals: number;
  upcomingAbsences: number;
}

interface HeroStatsBarProps {
  stats: ManagerHeroStats | null;
}

export function HeroStatsBar({ stats }: HeroStatsBarProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const coverageColor =
    stats.coverageToday >= 80
      ? "text-green-600"
      : stats.coverageToday >= 60
      ? "text-yellow-600"
      : "text-red-600";

  const coverageBgColor =
    stats.coverageToday >= 80
      ? "bg-green-50"
      : stats.coverageToday >= 60
      ? "bg-yellow-50"
      : "bg-red-50";

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Coverage Today */}
      <Card className="relative overflow-hidden">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Team Coverage Today
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={cn("text-3xl font-bold", coverageColor)}>
                  {stats.coverageToday}%
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {stats.coverageToday >= 80 ? "Good" : stats.coverageToday >= 60 ? "Adequate" : "Low"} coverage
              </p>
            </div>
            <div className={cn("rounded-lg p-2", coverageBgColor)}>
              <TrendingUp className={cn("h-5 w-5", coverageColor)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Available Staff */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Available Staff Now
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stats.availableStaff}</span>
                <span className="text-sm text-muted-foreground">/ {stats.totalStaff}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Active team members
              </p>
            </div>
            <div className="rounded-lg p-2 bg-blue-50">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pending Approvals */}
      <Link href="/manage/time-off?status=PENDING">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Pending Approvals
                </p>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{stats.pendingApprovals}</span>
                  <span className="text-sm text-muted-foreground">
                    {stats.pendingApprovals === 1 ? "request" : "requests"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {stats.pendingApprovals > 0 ? "Needs review →" : "All caught up"}
                </p>
              </div>
              <div className={cn("rounded-lg p-2", stats.pendingApprovals > 0 ? "bg-orange-50" : "bg-gray-50")}>
                <Clock className={cn("h-5 w-5", stats.pendingApprovals > 0 ? "text-orange-600" : "text-gray-600")} />
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>

      {/* Upcoming Absences */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Upcoming Absences
              </p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stats.upcomingAbsences}</span>
                <span className="text-sm text-muted-foreground">next 7 days</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Approved time-off
              </p>
            </div>
            <div className="rounded-lg p-2 bg-purple-50">
              <CalendarOff className="h-5 w-5 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
