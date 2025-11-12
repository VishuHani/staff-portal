"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  Clock,
  TrendingUp,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  Info,
} from "lucide-react";
import { SchedulingSuggestion } from "@/lib/actions/ai/suggestions";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SchedulingSuggestionsProps {
  suggestions: SchedulingSuggestion[];
  onAccept?: (suggestion: SchedulingSuggestion) => Promise<void>;
  onReject?: (suggestion: SchedulingSuggestion) => void;
  loading?: boolean;
}

export function SchedulingSuggestions({
  suggestions,
  onAccept,
  onReject,
  loading = false,
}: SchedulingSuggestionsProps) {
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());

  const handleAccept = async (suggestion: SchedulingSuggestion) => {
    setProcessingIds((prev) => new Set([...prev, suggestion.id]));

    try {
      if (onAccept) {
        await onAccept(suggestion);
        toast.success(`Scheduled ${suggestion.staffMember.name} for ${format(parseISO(suggestion.suggestion.date), "MMM dd")}`);
      }
    } catch (error) {
      toast.error("Failed to apply suggestion");
      console.error(error);
    } finally {
      setProcessingIds((prev) => {
        const next = new Set(prev);
        next.delete(suggestion.id);
        return next;
      });
    }
  };

  const handleReject = (suggestion: SchedulingSuggestion) => {
    setRejectedIds((prev) => new Set([...prev, suggestion.id]));
    if (onReject) {
      onReject(suggestion);
    }
    toast.info("Suggestion dismissed");
  };

  // Filter out rejected suggestions
  const visibleSuggestions = suggestions.filter((s) => !rejectedIds.has(s.id));

  // Group by priority
  const highPriority = visibleSuggestions.filter((s) => s.priority === "high");
  const mediumPriority = visibleSuggestions.filter((s) => s.priority === "medium");
  const lowPriority = visibleSuggestions.filter((s) => s.priority === "low");

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (visibleSuggestions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            No scheduling suggestions at this time. Your schedule looks well-optimized!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Suggestions</p>
                <p className="text-2xl font-bold">{visibleSuggestions.length}</p>
              </div>
              <Sparkles className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold">{highPriority.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold">
                  {Math.round(visibleSuggestions.reduce((sum, s) => sum + s.confidence, 0) / visibleSuggestions.length)}%
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* High Priority Suggestions */}
      {highPriority.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            High Priority
          </h3>
          {highPriority.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isProcessing={processingIds.has(suggestion.id)}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {/* Medium Priority Suggestions */}
      {mediumPriority.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Info className="h-5 w-5 text-yellow-600" />
            Medium Priority
          </h3>
          {mediumPriority.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isProcessing={processingIds.has(suggestion.id)}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
        </div>
      )}

      {/* Low Priority Suggestions */}
      {lowPriority.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Optimization Opportunities
          </h3>
          {lowPriority.slice(0, 5).map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              isProcessing={processingIds.has(suggestion.id)}
              onAccept={handleAccept}
              onReject={handleReject}
            />
          ))}
          {lowPriority.length > 5 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              +{lowPriority.length - 5} more suggestions available
            </p>
          )}
        </div>
      )}
    </div>
  );
}

interface SuggestionCardProps {
  suggestion: SchedulingSuggestion;
  isProcessing: boolean;
  onAccept: (suggestion: SchedulingSuggestion) => void;
  onReject: (suggestion: SchedulingSuggestion) => void;
}

function SuggestionCard({ suggestion, isProcessing, onAccept, onReject }: SuggestionCardProps) {
  const date = parseISO(suggestion.suggestion.date);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <Card className={cn(
      "transition-all",
      suggestion.priority === "high" && "border-red-200 bg-red-50/50",
      suggestion.priority === "medium" && "border-yellow-200 bg-yellow-50/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">
                {suggestion.staffMember.name}
              </CardTitle>
              <Badge variant={
                suggestion.type === "coverage_gap" ? "destructive" :
                suggestion.type === "fair_distribution" ? "default" :
                "secondary"
              }>
                {suggestion.type.replace(/_/g, " ")}
              </Badge>
              <Badge variant="outline" className="font-mono">
                {suggestion.confidence}% confidence
              </Badge>
            </div>
            <CardDescription className="text-xs">
              {suggestion.staffMember.email}
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Suggestion Details */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{format(date, "MMM dd, yyyy")}</p>
              <p className="text-xs text-muted-foreground">{dayNames[suggestion.suggestion.dayOfWeek]}</p>
            </div>
          </div>

          {suggestion.suggestion.shift && (
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {suggestion.suggestion.shift.startTime} - {suggestion.suggestion.shift.endTime}
                </p>
                <p className="text-xs text-muted-foreground">
                  {suggestion.suggestion.hours} hours
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Reasoning */}
        <div className="bg-white p-3 rounded-md border">
          <p className="text-sm text-gray-700">{suggestion.reasoning}</p>
        </div>

        {/* Constraints */}
        <div className="flex flex-wrap gap-2">
          <ConstraintBadge
            icon={<CheckCircle2 className="h-3 w-3" />}
            label="Has Availability"
            met={suggestion.constraints.hasAvailability}
          />
          <ConstraintBadge
            icon={<CheckCircle2 className="h-3 w-3" />}
            label="No Time Off"
            met={suggestion.constraints.hasNoTimeOff}
          />
          <ConstraintBadge
            icon={<CheckCircle2 className="h-3 w-3" />}
            label="Within Hour Limit"
            met={suggestion.constraints.withinHourLimit}
          />
        </div>

        {/* Impact */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-2 bg-blue-50 rounded">
            <p className="font-medium text-blue-700">+{suggestion.impact.coverageImprovement}%</p>
            <p className="text-muted-foreground">Coverage</p>
          </div>
          <div className="text-center p-2 bg-green-50 rounded">
            <p className="font-medium text-green-700">+{suggestion.impact.fairnessImprovement}%</p>
            <p className="text-muted-foreground">Fairness</p>
          </div>
          <div className="text-center p-2 bg-purple-50 rounded">
            <p className="font-medium text-purple-700">{suggestion.impact.conflictsResolved}</p>
            <p className="text-muted-foreground">Conflicts</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={() => onAccept(suggestion)}
            disabled={isProcessing}
            className="flex-1"
            size="sm"
          >
            {isProcessing ? "Applying..." : "Accept & Schedule"}
          </Button>
          <Button
            onClick={() => onReject(suggestion)}
            disabled={isProcessing}
            variant="outline"
            size="sm"
          >
            Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface ConstraintBadgeProps {
  icon: React.ReactNode;
  label: string;
  met: boolean;
}

function ConstraintBadge({ icon, label, met }: ConstraintBadgeProps) {
  return (
    <Badge
      variant={met ? "default" : "destructive"}
      className="text-xs flex items-center gap-1"
    >
      {icon}
      {label}
    </Badge>
  );
}
