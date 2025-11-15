"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Plane, Mail, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface QuickActionsProps {
  unreadMessageCount?: number;
}

export function QuickActions({ unreadMessageCount = 0 }: QuickActionsProps) {
  const actions = [
    {
      title: "Update Availability",
      description: "Set your weekly schedule",
      icon: Calendar,
      href: "/availability",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Request Time Off",
      description: "Submit a new request",
      icon: Plane,
      href: "/time-off",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "View Messages",
      description: "Check your inbox",
      icon: Mail,
      href: "/messages",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
      badge: unreadMessageCount > 0 ? unreadMessageCount : undefined,
    },
    {
      title: "View Schedule",
      description: "Coming soon",
      icon: CalendarCheck,
      href: "#",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
      disabled: true,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => {
        const Icon = action.icon;
        const content = (
          <Card
            className={`group relative overflow-hidden transition-all ${
              !action.disabled && "cursor-pointer hover:shadow-md hover:border-primary/50"
            } ${action.disabled && "opacity-60"}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <div className={`rounded-lg p-3 ${action.bgColor} transition-transform group-hover:scale-110`}>
                  <Icon className={`h-6 w-6 ${action.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{action.title}</h3>
                    {action.badge && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                        {action.badge}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {action.description}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        );

        if (action.disabled) {
          return <div key={action.title}>{content}</div>;
        }

        return (
          <Link key={action.title} href={action.href}>
            {content}
          </Link>
        );
      })}
    </div>
  );
}
