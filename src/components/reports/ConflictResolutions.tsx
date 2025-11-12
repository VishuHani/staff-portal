"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  TrendingUp,
  Users,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { applyConflictResolution } from "@/lib/actions/ai/conflict-detection";
import type { ConflictResolution } from "@/lib/actions/ai/conflict-detection";

interface ConflictResolutionsProps {
  conflictId: string;
  resolutions: ConflictResolution[];
  onResolutionApplied?: () => void;
}

function getDifficultyColor(difficulty: string) {
  switch (difficulty) {
    case "easy":
      return "bg-green-100 text-green-700 border-green-300";
    case "medium":
      return "bg-yellow-100 text-yellow-700 border-yellow-300";
    case "hard":
      return "bg-red-100 text-red-700 border-red-300";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300";
  }
}

function getConfidenceColor(confidence: number) {
  if (confidence >= 80) return "bg-green-500";
  if (confidence >= 60) return "bg-yellow-500";
  return "bg-orange-500";
}

function ResolutionCard({
  resolution,
  onApply,
  onDismiss,
}: {
  resolution: ConflictResolution;
  onApply: () => Promise<void>;
  onDismiss: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply();
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="border-2 rounded-lg p-4 hover:shadow-md transition-all bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-base mb-1">{resolution.strategy}</h4>
          <p className="text-sm text-muted-foreground">{resolution.description}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
      </div>

      {/* Metadata Badges */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Difficulty */}
        <Badge variant="outline" className={cn("text-xs font-medium", getDifficultyColor(resolution.difficulty))}>
          {resolution.difficulty.charAt(0).toUpperCase() + resolution.difficulty.slice(1)}
        </Badge>

        {/* Estimated Time */}
        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-300">
          <Clock className="h-3 w-3 mr-1" />
          {resolution.estimatedTime}
        </Badge>

        {/* Requires Approval */}
        {resolution.requiresApproval && (
          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-300">
            <AlertCircle className="h-3 w-3 mr-1" />
            Approval Required
          </Badge>
        )}
      </div>

      {/* Confidence Score */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
          <span className="font-medium">Confidence Score</span>
          <span className="font-semibold">{resolution.confidence}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div
            className={cn("h-full transition-all rounded-full", getConfidenceColor(resolution.confidence))}
            style={{ width: `${resolution.confidence}%` }}
          />
        </div>
      </div>

      {/* Affected Staff Count */}
      {resolution.affectedStaff.length > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
          <Users className="h-4 w-4" />
          <span>{resolution.affectedStaff.length} staff member(s) affected</span>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Steps */}
          <div>
            <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Action Steps
            </h5>
            <ol className="space-y-2">
              {resolution.steps.map((step, index) => (
                <li key={index} className="text-sm flex gap-2">
                  <span className="font-semibold text-muted-foreground min-w-[20px]">{index + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Affected Staff */}
          {resolution.affectedStaff.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Affected Staff
              </h5>
              <div className="space-y-2">
                {resolution.affectedStaff.map((staff, index) => (
                  <div key={index} className="text-sm bg-white rounded-md border p-2 flex justify-between items-center">
                    <span className="font-medium">{staff.name}</span>
                    <span className="text-xs text-muted-foreground">{staff.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pros */}
          {resolution.pros.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold mb-2 flex items-center gap-2 text-green-700">
                <CheckCircle2 className="h-4 w-4" />
                Advantages
              </h5>
              <ul className="space-y-1">
                {resolution.pros.map((pro, index) => (
                  <li key={index} className="text-sm flex gap-2">
                    <span className="text-green-600">•</span>
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Cons */}
          {resolution.cons.length > 0 && (
            <div>
              <h5 className="text-sm font-semibold mb-2 flex items-center gap-2 text-red-700">
                <XCircle className="h-4 w-4" />
                Considerations
              </h5>
              <ul className="space-y-1">
                {resolution.cons.map((con, index) => (
                  <li key={index} className="text-sm flex gap-2">
                    <span className="text-red-600">•</span>
                    <span>{con}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Button
          onClick={handleApply}
          disabled={applying}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
          size="sm"
        >
          {applying ? "Applying..." : "Apply Resolution"}
        </Button>
        <Button onClick={onDismiss} variant="outline" size="sm">
          Dismiss
        </Button>
      </div>
    </div>
  );
}

export function ConflictResolutions({
  conflictId,
  resolutions,
  onResolutionApplied,
}: ConflictResolutionsProps) {
  const [dismissedResolutions, setDismissedResolutions] = useState<Set<string>>(new Set());

  const handleApply = async (resolution: ConflictResolution) => {
    try {
      const result = await applyConflictResolution(resolution.id, conflictId);

      if (result.success) {
        toast.success(result.message || "Resolution applied successfully!");
        if (onResolutionApplied) {
          onResolutionApplied();
        }
      } else {
        toast.error(result.error || "Failed to apply resolution");
      }
    } catch (error) {
      console.error("Error applying resolution:", error);
      toast.error("An error occurred while applying the resolution");
    }
  };

  const handleDismiss = (resolutionId: string) => {
    setDismissedResolutions((prev) => new Set([...prev, resolutionId]));
    toast.info("Resolution dismissed");
  };

  const visibleResolutions = resolutions.filter((r) => !dismissedResolutions.has(r.id));

  if (visibleResolutions.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        {dismissedResolutions.size > 0 ? "All resolutions dismissed" : "No resolutions available"}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
          <span className="text-white text-sm font-bold">AI</span>
        </div>
        <div>
          <h4 className="font-semibold text-sm">AI-Generated Resolutions</h4>
          <p className="text-xs text-muted-foreground">
            {visibleResolutions.length} {visibleResolutions.length === 1 ? "strategy" : "strategies"} suggested
          </p>
        </div>
      </div>

      {visibleResolutions.map((resolution, index) => (
        <div key={resolution.id}>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-muted-foreground">Option {index + 1}</span>
          </div>
          <ResolutionCard
            resolution={resolution}
            onApply={() => handleApply(resolution)}
            onDismiss={() => handleDismiss(resolution.id)}
          />
        </div>
      ))}
    </div>
  );
}
