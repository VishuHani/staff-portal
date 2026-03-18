"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

export interface ComplianceData {
  overallComplianceRate: number;
  totalUsers: number;
  compliantUsers: number;
  nonCompliantUsers: number;
  averageCompletionTime: number | null;
  trend: "up" | "down" | "stable";
  trendValue?: number;
}

interface ComplianceWidgetProps {
  venueId: string;
  onFetchCompliance: (venueId: string) => Promise<{
    success: boolean;
    data?: ComplianceData;
    error?: string;
  }>;
  onClick?: () => void;
}

// ============================================================================
// Component
// ============================================================================

export function ComplianceWidget({
  venueId,
  onFetchCompliance,
  onClick,
}: ComplianceWidgetProps) {
  const [compliance, setCompliance] = useState<ComplianceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCompliance = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await onFetchCompliance(venueId);
      if (result.success && result.data) {
        setCompliance(result.data);
      } else {
        setError(result.error || "Failed to fetch compliance");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, [venueId, onFetchCompliance]);

  useEffect(() => {
    fetchCompliance();
  }, [fetchCompliance]);

  // Get compliance level
  const getComplianceLevel = (rate: number): {
    label: string;
    color: string;
    bgColor: string;
    textColor: string;
  } => {
    if (rate >= 90) {
      return {
        label: "Excellent",
        color: "text-green-500",
        bgColor: "bg-green-500",
        textColor: "text-green-600 dark:text-green-400",
      };
    } else if (rate >= 75) {
      return {
        label: "Good",
        color: "text-blue-500",
        bgColor: "bg-blue-500",
        textColor: "text-blue-600 dark:text-blue-400",
      };
    } else if (rate >= 50) {
      return {
        label: "Fair",
        color: "text-amber-500",
        bgColor: "bg-amber-500",
        textColor: "text-amber-600 dark:text-amber-400",
      };
    } else {
      return {
        label: "Needs Improvement",
        color: "text-red-500",
        bgColor: "bg-red-500",
        textColor: "text-red-600 dark:text-red-400",
      };
    }
  };

  if (isLoading) {
    return (
      <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !compliance) {
    return (
      <Card className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Unable to load compliance</p>
        </CardContent>
      </Card>
    );
  }

  const level = getComplianceLevel(compliance.overallComplianceRate);

  return (
    <Card
      className={cn(onClick && "cursor-pointer hover:shadow-md transition-shadow")}
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Compliance Rate</CardTitle>
            <CardDescription>Overall document compliance</CardDescription>
          </div>
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gauge */}
        <div className="flex flex-col items-center">
          {/* Circular Progress */}
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90">
              {/* Background circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                className="text-muted"
              />
              {/* Progress circle */}
              <circle
                cx="64"
                cy="64"
                r="56"
                fill="none"
                stroke="currentColor"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(compliance.overallComplianceRate / 100) * 352} 352`}
                className={level.color}
              />
            </svg>
            {/* Center text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">
                {compliance.overallComplianceRate}%
              </span>
              <span className={cn("text-xs font-medium", level.textColor)}>
                {level.label}
              </span>
            </div>
          </div>

          {/* Trend */}
          {compliance.trend !== "stable" && compliance.trendValue !== undefined && (
            <div
              className={cn(
                "flex items-center gap-1 text-sm mt-2",
                compliance.trend === "up" ? "text-green-500" : "text-red-500"
              )}
            >
              {compliance.trend === "up" ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              <span>
                {compliance.trendValue}% {compliance.trend === "up" ? "up" : "down"} from last period
              </span>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <span className="text-lg font-semibold">{compliance.totalUsers}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Users</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <Target className="h-3 w-3 text-green-500" />
              <span className="text-lg font-semibold text-green-600">
                {compliance.compliantUsers}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Compliant</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-lg font-semibold text-red-600">
                {compliance.nonCompliantUsers}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Non-Compliant</p>
          </div>
        </div>

        {/* Average Completion Time */}
        {compliance.averageCompletionTime !== null && (
          <div className="pt-2 border-t text-xs text-muted-foreground text-center">
            Avg. completion time: {compliance.averageCompletionTime} days
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ComplianceWidget;