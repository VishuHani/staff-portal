"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  AlertTriangle,
  Info,
  TrendingUp,
  Calendar,
  Users,
  ChevronRight,
  RefreshCw,
  CheckCircle2
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

interface Insight {
  id: string;
  type: string;
  message: string;
  priority: "high" | "medium" | "low";
  actionUrl: string;
  staffName?: string;
  date?: string;
  impact?: {
    coverageImprovement: number;
    fairnessImprovement: number;
    conflictsResolved: number;
  };
  confidence?: number;
}

interface AIInsightsPanelProps {
  insights: Insight[];
}

const getPriorityConfig = (priority: string) => {
  switch (priority) {
    case "high":
      return {
        icon: AlertTriangle,
        color: "text-red-500",
        bgColor: "bg-red-500/10 dark:bg-red-500/20",
        borderColor: "border-red-500/20 dark:border-red-500/30",
        badgeClass: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
        label: "Urgent",
      };
    case "medium":
      return {
        icon: Info,
        color: "text-amber-500",
        bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
        borderColor: "border-amber-500/20 dark:border-amber-500/30",
        badgeClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
        label: "Medium",
      };
    default:
      return {
        icon: TrendingUp,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10 dark:bg-blue-500/20",
        borderColor: "border-blue-500/20 dark:border-blue-500/30",
        badgeClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
        label: "Info",
      };
  }
};

const getTypeIcon = (type: string) => {
  switch (type) {
    case "coverage_gap":
      return Users;
    case "fair_distribution":
      return TrendingUp;
    case "availability_match":
      return Calendar;
    default:
      return Sparkles;
  }
};

export function AIInsightsPanel({ insights }: AIInsightsPanelProps) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const isRefreshing = isPending;

  return (
    <Card className="overflow-hidden border-purple-500/20 dark:border-purple-500/30 bg-gradient-to-br from-purple-500/5 via-background to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-lg">
              <div className="relative">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
              </div>
              Smart Suggestions
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              AI-powered insights for your team
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
            <Link href="/manage/reports">
              <Button variant="outline" size="sm" className="h-8">
                View All
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {insights.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
              <CheckCircle2 className="h-6 w-6 text-green-500" />
            </div>
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground mt-1">
              No scheduling issues detected. Your team coverage looks good.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {insights.slice(0, 5).map((insight, index) => {
              const config = getPriorityConfig(insight.priority);
              const PriorityIcon = config.icon;
              const TypeIcon = getTypeIcon(insight.type);

              return (
                <div
                  key={insight.id}
                  className={`
                    group relative rounded-lg border p-3
                    transition-all duration-200 ease-in-out
                    hover:shadow-md hover:scale-[1.01]
                    ${config.borderColor}
                    bg-card/50 hover:bg-card
                  `}
                  style={{
                    animationDelay: `${index * 100}ms`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    {/* Priority Icon */}
                    <div className={`shrink-0 rounded-lg p-2 ${config.bgColor}`}>
                      <PriorityIcon className={`h-4 w-4 ${config.color}`} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Header with type and priority */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <TypeIcon className="h-3.5 w-3.5" />
                          <span className="capitalize">{insight.type.replace(/_/g, " ")}</span>
                          {insight.date && (
                            <>
                              <span className="text-muted-foreground/50">•</span>
                              <span>{format(parseISO(insight.date), "MMM d")}</span>
                            </>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-5 ${config.badgeClass}`}
                        >
                          {config.label}
                        </Badge>
                      </div>

                      {/* Message */}
                      <p className="text-sm text-foreground leading-relaxed line-clamp-2">
                        {insight.message}
                      </p>

                      {/* Impact metrics */}
                      {insight.impact && (
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {insight.impact.coverageImprovement > 0 && (
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3 text-green-500" />
                              +{insight.impact.coverageImprovement}% coverage
                            </span>
                          )}
                          {insight.confidence && (
                            <span className="flex items-center gap-1">
                              <Sparkles className="h-3 w-3 text-purple-500" />
                              {insight.confidence}% confidence
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action button */}
                      <Link href={insight.actionUrl}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground group-hover:bg-muted/50"
                        >
                          Take action
                          <ChevronRight className="h-3 w-3 ml-1 transition-transform group-hover:translate-x-0.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Summary footer */}
            {insights.length > 0 && (
              <div className="pt-2 mt-2 border-t border-border/50">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {insights.filter(i => i.priority === "high").length} urgent, {" "}
                    {insights.filter(i => i.priority === "medium").length} medium priority
                  </span>
                  <Link
                    href="/manage/reports"
                    className="text-purple-500 hover:text-purple-400 hover:underline"
                  >
                    See all insights →
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
