"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Lightbulb,
  AlertCircle,
  AlertTriangle,
  Info,
  ChevronRight,
  TrendingUp,
  Users,
  Calendar,
  Clock,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import type { Suggestion, SuggestionPriority } from "@/lib/services/suggestions-service";

interface SmartSuggestionsProps {
  suggestions?: Suggestion[];
  loading?: boolean;
  compact?: boolean;
  showDismiss?: boolean;
  onDismiss?: (id: string) => void;
}

export function SmartSuggestions({
  suggestions = [],
  loading = false,
  compact = false,
  showDismiss = false,
  onDismiss,
}: SmartSuggestionsProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set(prev).add(id));
    onDismiss?.(id);
  };

  const visibleSuggestions = suggestions.filter(
    (s) => !dismissedIds.has(s.id)
  );

  const getPriorityIcon = (priority: SuggestionPriority) => {
    switch (priority) {
      case "high":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "medium":
        return <AlertTriangle className="h-5 w-5 text-orange-600" />;
      case "low":
        return <Info className="h-5 w-5 text-blue-600" />;
    }
  };

  const getPriorityColor = (priority: SuggestionPriority) => {
    switch (priority) {
      case "high":
        return "border-red-200 bg-red-50";
      case "medium":
        return "border-orange-200 bg-orange-50";
      case "low":
        return "border-blue-200 bg-blue-50";
    }
  };

  const getPriorityBadge = (priority: SuggestionPriority) => {
    const variants = {
      high: "bg-red-100 text-red-800 border-red-300",
      medium: "bg-orange-100 text-orange-800 border-orange-300",
      low: "bg-blue-100 text-blue-800 border-blue-300",
    };

    return (
      <Badge variant="outline" className={cn("text-xs", variants[priority])}>
        {priority.toUpperCase()}
      </Badge>
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "low_coverage":
      case "staffing_gap":
        return <Users className="h-4 w-4" />;
      case "time_off_cluster":
        return <Calendar className="h-4 w-4" />;
      case "weekend_coverage":
        return <Clock className="h-4 w-4" />;
      case "optimize_schedule":
      case "availability_pattern":
      case "recurring_issue":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return <Lightbulb className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-lg">Smart Suggestions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-2">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Analyzing patterns...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (visibleSuggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-lg">Smart Suggestions</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-sm text-muted-foreground">
              No suggestions at the moment. Everything looks good!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-yellow-600" />
              <CardTitle className="text-lg">Suggestions</CardTitle>
            </div>
            <Badge variant="secondary">{visibleSuggestions.length}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {visibleSuggestions.slice(0, 3).map((suggestion) => (
              <div
                key={suggestion.id}
                className={cn(
                  "p-3 rounded-lg border-2 flex items-start gap-3",
                  getPriorityColor(suggestion.priority)
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {getPriorityIcon(suggestion.priority)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium mb-1">
                    {suggestion.title}
                  </div>
                  {suggestion.actionable && suggestion.action && (
                    <Link
                      href={suggestion.action.link || "#"}
                      className="text-xs text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      {suggestion.action.label} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {visibleSuggestions.length > 3 && (
              <div className="text-center pt-2">
                <Link
                  href="/manage/reports"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  View all {visibleSuggestions.length} suggestions →
                </Link>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-yellow-600" />
            <CardTitle className="text-lg">Smart Suggestions</CardTitle>
          </div>
          <Badge variant="secondary">{visibleSuggestions.length}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          AI-powered insights to optimize your staffing
        </p>
      </CardHeader>

      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-3">
            {visibleSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={cn(
                  "p-4 rounded-lg border-2 transition-all hover:shadow-md",
                  getPriorityColor(suggestion.priority)
                )}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getPriorityIcon(suggestion.priority)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm">
                          {suggestion.title}
                        </h4>
                        {getPriorityBadge(suggestion.priority)}
                      </div>
                      {showDismiss && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => handleDismiss(suggestion.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-700 mb-3">
                      {suggestion.description}
                    </p>

                    {/* Metadata */}
                    {suggestion.metadata && (
                      <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
                        {suggestion.metadata.date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{suggestion.metadata.date}</span>
                          </div>
                        )}
                        {suggestion.metadata.affectedStaff !== undefined && (
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>
                              {suggestion.metadata.affectedStaff} staff affected
                            </span>
                          </div>
                        )}
                        {suggestion.metadata.coveragePercentage !== undefined && (
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            <span>
                              {Math.round(suggestion.metadata.coveragePercentage)}%
                              coverage
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Action */}
                    {suggestion.actionable && suggestion.action && (
                      <Link href={suggestion.action.link || "#"}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-8"
                        >
                          <span>{suggestion.action.label}</span>
                          <ChevronRight className="h-3 w-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
