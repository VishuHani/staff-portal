"use client";

/**
 * Conflict Resolution Dialog
 * AI-powered suggestions for resolving scheduling conflicts
 */

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Lightbulb,
  Loader2,
  ThumbsDown,
  ThumbsUp,
  User,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  generateConflictResolutions,
  applyConflictResolution,
  type Conflict,
  type ConflictResolution,
} from "@/lib/actions/ai/conflict-detection";

// ============================================================================
// TYPES
// ============================================================================

interface ConflictResolutionDialogProps {
  conflict: Conflict | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResolutionApplied?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ConflictResolutionDialog({
  conflict,
  open,
  onOpenChange,
  onResolutionApplied,
}: ConflictResolutionDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [resolutions, setResolutions] = useState<ConflictResolution[]>([]);
  const [selectedResolution, setSelectedResolution] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Generate resolutions when dialog opens with a conflict
  useEffect(() => {
    if (open && conflict && resolutions.length === 0) {
      generateResolutions();
    }
  }, [open, conflict]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setResolutions([]);
      setSelectedResolution(null);
      setError(null);
    }
  }, [open]);

  const generateResolutions = async () => {
    if (!conflict) return;

    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateConflictResolutions(conflict);
      if (result.success && result.resolutions) {
        setResolutions(result.resolutions);
      } else {
        setError(result.error || "Failed to generate resolutions");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyResolution = async (resolutionId: string) => {
    if (!conflict) return;

    startTransition(async () => {
      const result = await applyConflictResolution(resolutionId, conflict.id);
      if (result.success) {
        toast.success(result.message || "Resolution applied");
        onResolutionApplied?.();
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.error || "Failed to apply resolution");
      }
    });
  };

  if (!conflict) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-purple-500" />
            <DialogTitle>AI Resolution Suggestions</DialogTitle>
          </div>
          <DialogDescription>
            AI-generated strategies to resolve this scheduling conflict
          </DialogDescription>
        </DialogHeader>

        {/* Conflict Summary */}
        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className={cn(
              "p-2 rounded-lg",
              conflict.severity === "critical" && "bg-red-100 text-red-600",
              conflict.severity === "warning" && "bg-amber-100 text-amber-600",
              conflict.severity === "info" && "bg-blue-100 text-blue-600"
            )}>
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{conflict.title}</span>
                <Badge variant={
                  conflict.severity === "critical" ? "destructive" :
                  conflict.severity === "warning" ? "secondary" : "outline"
                }>
                  {conflict.severity}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {conflict.description}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {conflict.date}
                </span>
                {conflict.details.coveragePercentage !== undefined && (
                  <span>Coverage: {conflict.details.coveragePercentage}%</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isGenerating && (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-purple-500" />
            <div>
              <p className="font-medium">Analyzing conflict...</p>
              <p className="text-sm text-muted-foreground">
                Generating intelligent resolution strategies
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !isGenerating && (
          <div className="py-8 text-center space-y-4">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
            <div>
              <p className="font-medium text-destructive">Generation Failed</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={generateResolutions}>
              Try Again
            </Button>
          </div>
        )}

        {/* Resolutions List */}
        {!isGenerating && !error && resolutions.length > 0 && (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {resolutions.map((resolution, index) => (
                <ResolutionCard
                  key={resolution.id}
                  resolution={resolution}
                  index={index}
                  isSelected={selectedResolution === resolution.id}
                  onSelect={() => setSelectedResolution(resolution.id)}
                  onApply={() => handleApplyResolution(resolution.id)}
                  isApplying={isPending && selectedResolution === resolution.id}
                />
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Empty State */}
        {!isGenerating && !error && resolutions.length === 0 && (
          <div className="py-8 text-center space-y-4">
            <Lightbulb className="h-8 w-8 mx-auto text-muted-foreground" />
            <div>
              <p className="font-medium">No Resolutions Yet</p>
              <p className="text-sm text-muted-foreground">
                Click below to generate AI suggestions
              </p>
            </div>
            <Button onClick={generateResolutions} className="gap-2">
              <Wand2 className="h-4 w-4" />
              Generate Suggestions
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// RESOLUTION CARD COMPONENT
// ============================================================================

interface ResolutionCardProps {
  resolution: ConflictResolution;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onApply: () => void;
  isApplying: boolean;
}

function ResolutionCard({
  resolution,
  index,
  isSelected,
  onSelect,
  onApply,
  isApplying,
}: ResolutionCardProps) {
  const difficultyColors = {
    easy: "text-green-600 bg-green-50",
    medium: "text-amber-600 bg-amber-50",
    hard: "text-red-600 bg-red-50",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 cursor-pointer transition-all",
        isSelected
          ? "border-purple-500 bg-purple-50/50 dark:bg-purple-900/10"
          : "hover:border-muted-foreground/30"
      )}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-purple-100 text-purple-600 text-sm font-medium">
            {index + 1}
          </div>
          <div>
            <h4 className="font-medium">{resolution.strategy}</h4>
            <p className="text-sm text-muted-foreground mt-1">
              {resolution.description}
            </p>
          </div>
        </div>
        <div className="text-right">
          <Progress value={resolution.confidence} className="h-2 w-20" />
          <span className="text-xs text-muted-foreground">
            {resolution.confidence}% confidence
          </span>
        </div>
      </div>

      {/* Meta Info */}
      <div className="flex flex-wrap items-center gap-2 mt-3">
        <Badge variant="outline" className={difficultyColors[resolution.difficulty]}>
          {resolution.difficulty}
        </Badge>
        <span className="text-xs text-muted-foreground flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {resolution.estimatedTime}
        </span>
        {resolution.requiresApproval && (
          <Badge variant="secondary" className="text-xs">
            Requires Approval
          </Badge>
        )}
      </div>

      {/* Expanded Content */}
      {isSelected && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {/* Steps */}
          <div>
            <h5 className="text-sm font-medium mb-2">Steps</h5>
            <ol className="space-y-2">
              {resolution.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Affected Staff */}
          {resolution.affectedStaff.length > 0 && (
            <div>
              <h5 className="text-sm font-medium mb-2">Affected Staff</h5>
              <div className="space-y-1">
                {resolution.affectedStaff.map((staff, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{staff.name}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{staff.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pros & Cons */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                <ThumbsUp className="h-3 w-3 text-green-600" />
                Pros
              </h5>
              <ul className="space-y-1">
                {resolution.pros.map((pro, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <Check className="h-3 w-3 mt-0.5 text-green-600" />
                    {pro}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-sm font-medium mb-2 flex items-center gap-1">
                <ThumbsDown className="h-3 w-3 text-red-600" />
                Cons
              </h5>
              <ul className="space-y-1">
                {resolution.cons.map((con, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <AlertCircle className="h-3 w-3 mt-0.5 text-red-600" />
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Apply Button */}
          <Button
            onClick={(e) => {
              e.stopPropagation();
              onApply();
            }}
            disabled={isApplying}
            className="w-full gap-2"
          >
            {isApplying ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Apply This Strategy
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
