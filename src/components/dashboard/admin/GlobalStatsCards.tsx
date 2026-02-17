"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, Building2, Activity, AlertCircle, UserCheck, AlertTriangle, Clock, CalendarX, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KPICardSkeleton } from "@/components/charts/ChartSkeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface HealthMetrics {
  failedActions?: number;
  oldPendingRequests?: number;
  rosterConflicts?: number;
  missedRosters?: number;
  activeUsersLast24h?: number;
  engagementRate?: number;
}

interface GlobalStats {
  totalActiveStaff: number;
  totalInactiveStaff?: number;
  multiVenueCoverage: number;
  systemHealth: string;
  healthScore?: number;
  healthMetrics?: HealthMetrics;
  pendingActions: number;
  pendingTimeOff?: number;
  conflictsCount?: number;
  activeUsersToday: number;
}

interface GlobalStatsCardsProps {
  stats: GlobalStats | null;
}

export function GlobalStatsCards({ stats }: GlobalStatsCardsProps) {
  if (!stats) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const healthScore = stats.healthScore ?? 50;
  const healthColor = healthScore >= 80
    ? "text-green-600"
    : healthScore >= 50
    ? "text-yellow-600"
    : "text-red-600";

  const healthBgColor = healthScore >= 80
    ? "bg-green-50"
    : healthScore >= 50
    ? "bg-yellow-50"
    : "bg-red-50";

  const cards = [
    {
      title: "Total Active Staff",
      value: stats.totalActiveStaff,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      subtitle: stats.totalInactiveStaff ? `${stats.totalInactiveStaff} inactive` : "System-wide",
    },
    {
      title: "Multi-Venue Coverage",
      value: `${stats.multiVenueCoverage}%`,
      icon: Building2,
      color: stats.multiVenueCoverage >= 80 ? "text-green-600" : stats.multiVenueCoverage >= 60 ? "text-yellow-600" : "text-red-600",
      bgColor: stats.multiVenueCoverage >= 80 ? "bg-green-50" : stats.multiVenueCoverage >= 60 ? "bg-yellow-50" : "bg-red-50",
      subtitle: "Average across venues",
    },
    {
      title: "System Health",
      value: stats.systemHealth,
      icon: Activity,
      color: healthColor,
      bgColor: healthBgColor,
      subtitle: `Score: ${healthScore}/100`,
      showScore: true,
      healthScore: healthScore,
      healthMetrics: stats.healthMetrics,
    },
    {
      title: "Pending Actions",
      value: stats.pendingActions,
      icon: AlertCircle,
      color: stats.pendingActions > 0 ? "text-orange-600" : "text-gray-600",
      bgColor: stats.pendingActions > 0 ? "bg-orange-50" : "bg-gray-50",
      subtitle: stats.pendingTimeOff !== undefined && stats.conflictsCount !== undefined 
        ? `${stats.pendingTimeOff} time-off, ${stats.conflictsCount} conflicts`
        : "Needs attention",
      showBadge: stats.pendingActions > 0,
    },
    {
      title: "Active Users Today",
      value: stats.activeUsersToday,
      icon: UserCheck,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      subtitle: stats.healthMetrics?.engagementRate !== undefined 
        ? `${stats.healthMetrics.engagementRate}% engagement`
        : "Logged in today",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-2xl font-bold">{card.value}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {card.subtitle}
                  </p>
                  {card.showBadge && (
                    <Badge variant="destructive" className="mt-2 text-xs">
                      Action Required
                    </Badge>
                  )}
                  {card.showScore && card.healthMetrics && (
                    <TooltipProvider>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all", 
                              card.healthScore >= 80 ? "bg-green-500" : 
                              card.healthScore >= 50 ? "bg-yellow-500" : "bg-red-500"
                            )}
                            style={{ width: `${card.healthScore}%` }}
                          />
                        </div>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button className="text-xs text-muted-foreground hover:text-foreground">
                              <Activity className="h-3 w-3" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="max-w-xs">
                            <div className="space-y-1 text-xs">
                              {card.healthMetrics.failedActions !== undefined && (
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                  <span>Failed actions (24h): {card.healthMetrics.failedActions}</span>
                                </div>
                              )}
                              {card.healthMetrics.oldPendingRequests !== undefined && (
                                <div className="flex items-center gap-2">
                                  <Clock className="h-3 w-3 text-yellow-500" />
                                  <span>Old pending requests: {card.healthMetrics.oldPendingRequests}</span>
                                </div>
                              )}
                              {card.healthMetrics.rosterConflicts !== undefined && (
                                <div className="flex items-center gap-2">
                                  <AlertCircle className="h-3 w-3 text-orange-500" />
                                  <span>Roster conflicts: {card.healthMetrics.rosterConflicts}</span>
                                </div>
                              )}
                              {card.healthMetrics.missedRosters !== undefined && (
                                <div className="flex items-center gap-2">
                                  <CalendarX className="h-3 w-3 text-red-500" />
                                  <span>Missed rosters: {card.healthMetrics.missedRosters}</span>
                                </div>
                              )}
                              {card.healthMetrics.engagementRate !== undefined && (
                                <div className="flex items-center gap-2">
                                  <TrendingUp className="h-3 w-3 text-green-500" />
                                  <span>Engagement: {card.healthMetrics.engagementRate}%</span>
                                </div>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                  )}
                </div>
                <div className={cn("rounded-lg p-2 shrink-0", card.bgColor)}>
                  <Icon className={cn("h-5 w-5", card.color)} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
