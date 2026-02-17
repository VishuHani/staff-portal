"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock, CalendarOff, AlertCircle, Mail, CalendarDays } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StaffKPIs {
  hoursThisWeek: number;
  upcomingTimeOff: number;
  pendingRequests: number;
  unreadMessages: number;
  shiftsThisWeek?: number;
}

interface StaffKPICardsProps {
  kpis: StaffKPIs | null;
}

export function StaffKPICards({ kpis }: StaffKPICardsProps) {
  if (!kpis) {
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

  const cards = [
    {
      title: "Scheduled Hours",
      value: kpis.hoursThisWeek,
      unit: "hrs this week",
      icon: Clock,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      subtitle: kpis.shiftsThisWeek ? `${kpis.shiftsThisWeek} shifts` : undefined,
    },
    {
      title: "Upcoming Time Off",
      value: kpis.upcomingTimeOff,
      unit: "days",
      icon: CalendarOff,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Pending Requests",
      value: kpis.pendingRequests,
      unit: kpis.pendingRequests === 1 ? "request" : "requests",
      icon: AlertCircle,
      color: kpis.pendingRequests > 0 ? "text-yellow-600" : "text-gray-600",
      bgColor: kpis.pendingRequests > 0 ? "bg-yellow-50" : "bg-gray-50",
      showBadge: kpis.pendingRequests > 0,
    },
    {
      title: "Unread Messages",
      value: kpis.unreadMessages,
      unit: kpis.unreadMessages === 1 ? "message" : "messages",
      icon: Mail,
      color: kpis.unreadMessages > 0 ? "text-purple-600" : "text-gray-600",
      bgColor: kpis.unreadMessages > 0 ? "bg-purple-50" : "bg-gray-50",
      showBadge: kpis.unreadMessages > 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className="relative overflow-hidden">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    {card.title}
                  </p>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-bold">{card.value}</span>
                    <span className="text-sm text-muted-foreground">{card.unit}</span>
                  </div>
                  {card.subtitle && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {card.subtitle}
                    </p>
                  )}
                </div>
                <div className={`rounded-lg p-2 ${card.bgColor}`}>
                  <Icon className={`h-5 w-5 ${card.color}`} />
                </div>
              </div>
              {card.showBadge && (
                <div className="mt-3">
                  <Badge variant="secondary" className="text-xs">
                    Needs Attention
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
