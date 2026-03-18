"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Users,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  ValidationIssue,
  ValidationSeverity,
  ValidationStage,
} from "@/lib/rosters/validation-engine";

// ============================================================================
// TYPES
// ============================================================================

export interface DiagnosticsProps {
  issues: ValidationIssue[];
  matchingStats?: {
    total: number;
    matched: number;
    autoMatched: number;
    needsConfirmation: number;
    unmatched: number;
    byConfidenceBand: Record<string, number>;
  };
  extractionStats?: {
    confidence: number;
    processingTimeMs: number;
    attemptCount: number;
    totalShifts: number;
    validShifts: number;
  };
  onIssueClick?: (issue: ValidationIssue) => void;
  className?: string;
}

interface IssueGroup {
  stage: ValidationStage;
  label: string;
  description: string;
  icon: React.ReactNode;
  issues: ValidationIssue[];
  blocking: number;
  warnings: number;
}

// ============================================================================
// SEVERITY STYLING
// ============================================================================

const severityConfig: Record<ValidationSeverity, {
  color: string;
  bg: string;
  icon: React.ReactNode;
  label: string;
}> = {
  blocking: {
    color: "text-red-600",
    bg: "bg-red-100",
    icon: <XCircle className="h-4 w-4" />,
    label: "Blocking",
  },
  warning: {
    color: "text-amber-600",
    bg: "bg-amber-100",
    icon: <AlertTriangle className="h-4 w-4" />,
    label: "Warning",
  },
  info: {
    color: "text-blue-600",
    bg: "bg-blue-100",
    icon: <Info className="h-4 w-4" />,
    label: "Info",
  },
};

const stageConfig: Record<ValidationStage, {
  label: string;
  icon: React.ReactNode;
  description: string;
}> = {
  schema: {
    label: "Schema",
    icon: <Info className="h-4 w-4" />,
    description: "Field format and required value checks",
  },
  temporal: {
    label: "Time & Duration",
    icon: <Clock className="h-4 w-4" />,
    description: "Time order, shift duration, and overnight checks",
  },
  business_rule: {
    label: "Business Rules",
    icon: <AlertCircle className="h-4 w-4" />,
    description: "Hours limits, consecutive days, rest periods",
  },
  conflict: {
    label: "Conflicts",
    icon: <AlertTriangle className="h-4 w-4" />,
    description: "Overlapping shifts and double-booking",
  },
  staff_match: {
    label: "Staff Matching",
    icon: <Users className="h-4 w-4" />,
    description: "Unmatched staff and low-confidence matches",
  },
};

// ============================================================================
// CONFIDENCE SCORECARD
// ============================================================================

interface ConfidenceScorecardProps {
  confidence: number;
  label: string;
  showDetails?: boolean;
}

function ConfidenceScorecard({ confidence, label, showDetails = false }: ConfidenceScorecardProps) {
  const getColor = (conf: number) => {
    if (conf >= 90) return "text-green-600";
    if (conf >= 75) return "text-emerald-600";
    if (conf >= 60) return "text-amber-600";
    return "text-red-600";
  };

  const getBgColor = (conf: number) => {
    if (conf >= 90) return "bg-green-100";
    if (conf >= 75) return "bg-emerald-100";
    if (conf >= 60) return "bg-amber-100";
    return "bg-red-100";
  };

  return (
    <div className={cn("rounded-lg p-3", getBgColor(confidence))}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className={cn("text-lg font-bold", getColor(confidence))}>
          {confidence}%
        </span>
      </div>
      {showDetails && (
        <div className="mt-2 h-2 rounded-full bg-white/50 overflow-hidden">
          <div
            className={cn("h-full transition-all", getColor(confidence).replace("text-", "bg-"))}
            style={{ width: `${confidence}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ISSUE ITEM
// ============================================================================

interface IssueItemProps {
  issue: ValidationIssue;
  onClick?: () => void;
}

function IssueItem({ issue, onClick }: IssueItemProps) {
  const config = severityConfig[issue.severity];

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-2 rounded-md border transition-colors",
        "hover:bg-accent focus:outline-none focus:ring-2 focus:ring-ring"
      )}
    >
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5", config.color)}>{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm">{issue.message}</p>
          {issue.suggestion && (
            <p className="text-xs text-muted-foreground mt-1">
              💡 {issue.suggestion}
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-xs shrink-0">
          {issue.code}
        </Badge>
      </div>
    </button>
  );
}

// ============================================================================
// ISSUE GROUP COMPONENT
// ============================================================================

interface IssueGroupPanelProps {
  group: IssueGroup;
  onIssueClick?: (issue: ValidationIssue) => void;
  defaultExpanded?: boolean;
}

function IssueGroupPanel({ group, onIssueClick, defaultExpanded = false }: IssueGroupPanelProps) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground">{group.icon}</span>
          <div className="text-left">
            <p className="font-medium">{group.label}</p>
            <p className="text-xs text-muted-foreground">{group.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {group.blocking > 0 && (
            <Badge variant="destructive" className="text-xs">
              {group.blocking} blocking
            </Badge>
          )}
          {group.warnings > 0 && (
            <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
              {group.warnings} warnings
            </Badge>
          )}
          {group.blocking === 0 && group.warnings === 0 && (
            <Badge variant="outline" className="text-xs border-green-500 text-green-600">
              ✓ OK
            </Badge>
          )}
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && group.issues.length > 0 && (
        <>
          <Separator />
          <ScrollArea className="max-h-48">
            <div className="p-2 space-y-2">
              {group.issues.map((issue) => (
                <IssueItem
                  key={issue.id}
                  issue={issue}
                  onClick={() => onIssueClick?.(issue)}
                />
              ))}
            </div>
          </ScrollArea>
        </>
      )}
    </div>
  );
}

// ============================================================================
// MAIN DIAGNOSTICS PANEL
// ============================================================================

export function ExtractionDiagnosticsPanel({
  issues,
  matchingStats,
  extractionStats,
  onIssueClick,
  className,
}: DiagnosticsProps) {
  // Group issues by stage
  const groups: IssueGroup[] = React.useMemo(() => {
    const stageOrder: ValidationStage[] = ["schema", "temporal", "business_rule", "conflict", "staff_match"];
    
    return stageOrder.map((stage) => {
      const stageIssues = issues.filter((i) => i.stage === stage);
      const config = stageConfig[stage];
      
      return {
        stage,
        label: config.label,
        description: config.description,
        icon: config.icon,
        issues: stageIssues,
        blocking: stageIssues.filter((i) => i.severity === "blocking").length,
        warnings: stageIssues.filter((i) => i.severity === "warning").length,
      };
    });
  }, [issues]);

  // Calculate summary
  const summary = React.useMemo(() => ({
    total: issues.length,
    blocking: issues.filter((i) => i.severity === "blocking").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  }), [issues]);

  const hasBlocking = summary.blocking > 0;
  const hasIssues = summary.total > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header with overall status */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Diagnostics</h3>
        <div className="flex items-center gap-2">
          {hasBlocking ? (
            <Badge variant="destructive">
              <XCircle className="h-3 w-3 mr-1" />
              {summary.blocking} blocking
            </Badge>
          ) : hasIssues ? (
            <Badge variant="outline" className="border-amber-500 text-amber-600">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {summary.warnings} warnings
            </Badge>
          ) : (
            <Badge variant="outline" className="border-green-500 text-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              All checks passed
            </Badge>
          )}
        </div>
      </div>

      {/* Confidence Scorecards */}
      <div className="grid grid-cols-2 gap-3">
        {extractionStats && (
          <ConfidenceScorecard
            confidence={extractionStats.confidence}
            label="Extraction"
            showDetails
          />
        )}
        {matchingStats && (
          <ConfidenceScorecard
            confidence={matchingStats.total > 0 
              ? Math.round((matchingStats.matched / matchingStats.total) * 100)
              : 0
            }
            label="Matching"
            showDetails
          />
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        <div className="rounded-lg bg-muted p-2">
          <p className="text-lg font-bold">{summary.total}</p>
          <p className="text-xs text-muted-foreground">Total Issues</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <p className="text-lg font-bold text-red-600">{summary.blocking}</p>
          <p className="text-xs text-muted-foreground">Blocking</p>
        </div>
        <div className="rounded-lg bg-muted p-2">
          <p className="text-lg font-bold text-amber-600">{summary.warnings}</p>
          <p className="text-xs text-muted-foreground">Warnings</p>
        </div>
      </div>

      <Separator />

      {/* Issue Groups by Stage */}
      <div className="space-y-3">
        {groups.map((group) => (
          <IssueGroupPanel
            key={group.stage}
            group={group}
            onIssueClick={onIssueClick}
            defaultExpanded={group.blocking > 0}
          />
        ))}
      </div>

      {/* Matching Details */}
      {matchingStats && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Matching Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Staff:</span>
                <span className="font-medium">{matchingStats.total}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Auto-matched:</span>
                <span className="font-medium text-green-600">{matchingStats.autoMatched}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Needs Review:</span>
                <span className="font-medium text-amber-600">{matchingStats.needsConfirmation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Unmatched:</span>
                <span className="font-medium text-red-600">{matchingStats.unmatched}</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Extraction Details */}
      {extractionStats && (
        <>
          <Separator />
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Extraction Details</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Shifts:</span>
                <span className="font-medium">{extractionStats.totalShifts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Valid Shifts:</span>
                <span className="font-medium">{extractionStats.validShifts}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Processing Time:</span>
                <span className="font-medium">{Math.round(extractionStats.processingTimeMs / 1000)}s</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attempts:</span>
                <span className="font-medium">{extractionStats.attemptCount}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// COMPACT DIAGNOSTICS BADGE
// ============================================================================

export function DiagnosticsBadge({ issues }: { issues: ValidationIssue[] }) {
  const blocking = issues.filter((i) => i.severity === "blocking").length;
  const warnings = issues.filter((i) => i.severity === "warning").length;

  if (blocking > 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        <XCircle className="h-3 w-3" />
        {blocking} blocking
      </Badge>
    );
  }

  if (warnings > 0) {
    return (
      <Badge variant="outline" className="border-amber-500 text-amber-600 gap-1">
        <AlertTriangle className="h-3 w-3" />
        {warnings} warnings
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-green-500 text-green-600 gap-1">
      <CheckCircle className="h-3 w-3" />
      OK
    </Badge>
  );
}
