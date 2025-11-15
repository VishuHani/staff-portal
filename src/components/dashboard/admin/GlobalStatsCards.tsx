"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Users, Building2, Activity, AlertCircle, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { KPICardSkeleton } from "@/components/charts/ChartSkeleton";

interface GlobalStats {
  totalActiveStaff: number;
  multiVenueCoverage: number;
  systemHealth: string;
  pendingActions: number;
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

  const healthColor = stats.systemHealth === "Good"
    ? "text-green-600"
    : stats.systemHealth === "Fair"
    ? "text-yellow-600"
    : "text-red-600";

  const healthBgColor = stats.systemHealth === "Good"
    ? "bg-green-50"
    : stats.systemHealth === "Fair"
    ? "bg-yellow-50"
    : "bg-red-50";

  const cards = [
    {
      title: "Total Active Staff",
      value: stats.totalActiveStaff,
      icon: Users,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      subtitle: "System-wide",
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
      subtitle: "Based on error rate",
    },
    {
      title: "Pending Actions",
      value: stats.pendingActions,
      icon: AlertCircle,
      color: stats.pendingActions > 0 ? "text-orange-600" : "text-gray-600",
      bgColor: stats.pendingActions > 0 ? "bg-orange-50" : "bg-gray-50",
      subtitle: "Needs attention",
      showBadge: stats.pendingActions > 0,
    },
    {
      title: "Active Users Today",
      value: stats.activeUsersToday,
      icon: UserCheck,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      subtitle: "Logged in today",
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
