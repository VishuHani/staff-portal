"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, AlertTriangle, Info, TrendingUp } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface Insight {
  id: string;
  type: string;
  message: string;
  priority: "high" | "medium" | "low";
  actionUrl: string;
}

interface AIInsightsPanelProps {
  insights: Insight[];
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case "high":
      return {
        icon: AlertTriangle,
        color: "text-red-600",
        bgColor: "bg-red-50",
        badge: "destructive" as const,
      };
    case "medium":
      return {
        icon: Info,
        color: "text-yellow-600",
        bgColor: "bg-yellow-50",
        badge: "secondary" as const,
      };
    default:
      return {
        icon: TrendingUp,
        color: "text-blue-600",
        bgColor: "bg-blue-50",
        badge: "outline" as const,
      };
  }
};

export function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  return (
    <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              AI-Powered Insights
            </CardTitle>
            <CardDescription>Smart suggestions for your team</CardDescription>
          </div>
          <Link href="/admin/reports/suggestions">
            <Button variant="outline" size="sm">
              View All
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Sparkles className="mx-auto h-12 w-12 opacity-20 text-purple-600" />
            <p className="mt-2">No insights available at the moment</p>
            <p className="text-xs mt-1">Check back later for AI-generated recommendations</p>
          </div>
        ) : (
          <div className="space-y-3">
            {insights.slice(0, 5).map((insight) => {
              const config = getPriorityConfig(insight.priority);
              const Icon = config.icon;

              return (
                <div
                  key={insight.id}
                  className="flex items-start gap-3 rounded-lg border bg-white p-3 transition-all hover:shadow-sm"
                >
                  <div className={`mt-0.5 rounded-lg p-2 ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm leading-relaxed flex-1">{insight.message}</p>
                      <Badge variant={config.badge} className="text-xs shrink-0">
                        {insight.priority}
                      </Badge>
                    </div>
                    <Link href={insight.actionUrl}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        View Details →
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
