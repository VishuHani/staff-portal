"use client";

import * as React from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { ConfidenceBand, MatchStrategy } from "@/lib/rosters/staff-matching-engine";

// ============================================================================
// TYPES
// ============================================================================

export interface UnresolvedIdentity {
  id: string;
  staffName: string;
  confidence: number;
  confidenceBand: ConfidenceBand;
  strategy: MatchStrategy;
  matchReason: string | null;
  alternatives: Array<{
    userId: string;
    confidence: number;
    staffName: string;
  }>;
  shiftCount: number;
  shiftIds: string[];
}

export interface StaffOption {
  id: string;
  name: string;
  email: string;
  position?: string | null;
}

export interface UnresolvedIdentityPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  identities: UnresolvedIdentity[];
  staffOptions: StaffOption[];
  onResolve: (identityId: string, matchedUserId: string | null) => void;
  onResolveAll: (resolutions: Array<{ identityId: string; matchedUserId: string | null }>) => void;
  onCancel: () => void;
  config?: {
    allowSkipUnresolved?: boolean;
    requireAllResolved?: boolean;
    showConfidenceDetails?: boolean;
  };
}

// ============================================================================
// CONFIDENCE BAND STYLING
// ============================================================================

const confidenceBandStyles: Record<ConfidenceBand, { color: string; bg: string; label: string }> = {
  exact: { color: "text-green-600", bg: "bg-green-100", label: "Exact Match" },
  high: { color: "text-emerald-600", bg: "bg-emerald-100", label: "High Confidence" },
  medium: { color: "text-amber-600", bg: "bg-amber-100", label: "Medium Confidence" },
  low: { color: "text-orange-600", bg: "bg-orange-100", label: "Low Confidence" },
  none: { color: "text-red-600", bg: "bg-red-100", label: "No Match" },
};

const strategyLabels: Record<MatchStrategy, string> = {
  exact_email: "Exact Email",
  exact_full_name: "Exact Name",
  exact_first_name: "First Name Only",
  name_with_initial: "Name + Initial",
  alias_match: "Alias/Nickname",
  fuzzy_high: "Fuzzy (High)",
  fuzzy_medium: "Fuzzy (Medium)",
  fuzzy_low: "Fuzzy (Low)",
  no_match: "No Match",
};

// ============================================================================
// IDENTITY CARD COMPONENT
// ============================================================================

interface IdentityCardProps {
  identity: UnresolvedIdentity;
  staffOptions: StaffOption[];
  onResolve: (matchedUserId: string | null) => void;
  showConfidenceDetails: boolean;
}

function IdentityCard({ identity, staffOptions, onResolve, showConfidenceDetails }: IdentityCardProps) {
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(
    identity.alternatives[0]?.userId || null
  );
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const bandStyle = confidenceBandStyles[identity.confidenceBand];
  
  const filteredStaff = React.useMemo(() => {
    if (!searchQuery) return staffOptions.slice(0, 20);
    const query = searchQuery.toLowerCase();
    return staffOptions
      .filter(s => 
        s.name.toLowerCase().includes(query) || 
        s.email.toLowerCase().includes(query)
      )
      .slice(0, 20);
  }, [staffOptions, searchQuery]);

  const handleConfirm = () => {
    if (selectedUserId) {
      onResolve(selectedUserId);
    }
  };

  const handleSkip = () => {
    onResolve(null);
  };

  return (
    <div className="rounded-lg border bg-card p-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-muted">
              {identity.staffName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-medium">{identity.staffName}</h4>
            <p className="text-sm text-muted-foreground">
              {identity.shiftCount} shift{identity.shiftCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={cn(bandStyle.color, bandStyle.bg)}>
            {identity.confidence}%
          </Badge>
          <Badge variant="secondary">
            {bandStyle.label}
          </Badge>
        </div>
      </div>

      {/* Match Reason */}
      {identity.matchReason && showConfidenceDetails && (
        <p className="mt-2 text-sm text-muted-foreground">
          {identity.matchReason}
        </p>
      )}

      {/* Alternatives or Search */}
      <div className="mt-4">
        {identity.alternatives.length > 0 && !isExpanded ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Suggested Matches:</p>
            <div className="flex flex-wrap gap-2">
              {identity.alternatives.map((alt) => (
                <button
                  key={alt.userId}
                  onClick={() => setSelectedUserId(alt.userId)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selectedUserId === alt.userId
                      ? "border-primary bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  )}
                >
                  <span>{alt.staffName}</span>
                  <span className={cn(
                    "text-xs",
                    selectedUserId === alt.userId 
                      ? "text-primary-foreground/70" 
                      : "text-muted-foreground"
                  )}>
                    ({alt.confidence}%)
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* Search for other staff */}
        <div className="mt-3">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-primary hover:underline"
          >
            {isExpanded ? "Hide search" : "Search for a different staff member"}
          </button>
          
          {isExpanded && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                placeholder="Search by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              />
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-2 space-y-1">
                  {filteredStaff.map((staff) => (
                    <button
                      key={staff.id}
                      onClick={() => {
                        setSelectedUserId(staff.id);
                        setIsExpanded(false);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                        selectedUserId === staff.id
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-accent"
                      )}
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="text-xs">
                          {staff.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium">{staff.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{staff.email}</p>
                      </div>
                    </button>
                  ))}
                  {filteredStaff.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      No staff found
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={handleSkip}>
          Skip for now
        </Button>
        <Button 
          size="sm" 
          onClick={handleConfirm}
          disabled={!selectedUserId}
        >
          Confirm Match
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PANEL COMPONENT
// ============================================================================

export function UnresolvedIdentityPanel({
  open,
  onOpenChange,
  identities,
  staffOptions,
  onResolve,
  onResolveAll,
  onCancel,
  config = {},
}: UnresolvedIdentityPanelProps) {
  const {
    allowSkipUnresolved = true,
    requireAllResolved = false,
    showConfidenceDetails = true,
  } = config;

  const [resolutions, setResolutions] = React.useState<Map<string, string | null>>(new Map());
  const [currentIndex, setCurrentIndex] = React.useState(0);

  // Reset state when identities change
  React.useEffect(() => {
    setResolutions(new Map());
    setCurrentIndex(0);
  }, [identities]);

  const resolvedCount = resolutions.size;
  const remainingCount = identities.length - resolvedCount;
  const currentIdentity = identities[currentIndex];

  const handleResolve = (identityId: string, matchedUserId: string | null) => {
    setResolutions(prev => new Map(prev).set(identityId, matchedUserId));
    
    // Move to next unresolved
    const nextIndex = identities.findIndex(
      (id, idx) => idx > currentIndex && !resolutions.has(id.id)
    );
    if (nextIndex !== -1) {
      setCurrentIndex(nextIndex);
    }
  };

  const handleFinish = () => {
    const resolutionArray = Array.from(resolutions.entries()).map(
      ([identityId, matchedUserId]) => ({ identityId, matchedUserId })
    );
    onResolveAll(resolutionArray);
  };

  const canFinish = allowSkipUnresolved || remainingCount === 0;
  const mustResolveAll = requireAllResolved && remainingCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Resolve Staff Identities</DialogTitle>
          <DialogDescription>
            {remainingCount > 0
              ? `${remainingCount} staff member${remainingCount !== 1 ? "s" : ""} need to be identified before creating the roster.`
              : "All staff members have been identified."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${(resolvedCount / identities.length) * 100}%` }}
                />
              </div>
            </div>
            <span className="text-sm text-muted-foreground">
              {resolvedCount} / {identities.length}
            </span>
          </div>

          {/* Identity List */}
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-4">
              {identities.map((identity) => {
                const isResolved = resolutions.has(identity.id);
                const isCurrent = identity.id === currentIdentity?.id;
                
                if (isResolved) {
                  const resolvedUserId = resolutions.get(identity.id);
                  const resolvedStaff = staffOptions.find(s => s.id === resolvedUserId);
                  
                  return (
                    <div
                      key={identity.id}
                      className="rounded-lg border bg-muted/50 p-4 flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                          <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <div>
                          <p className="font-medium">{identity.staffName}</p>
                          <p className="text-sm text-muted-foreground">
                            → {resolvedStaff?.name || "Skipped"}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setResolutions(prev => {
                            const next = new Map(prev);
                            next.delete(identity.id);
                            return next;
                          });
                          setCurrentIndex(identities.findIndex(id => id.id === identity.id));
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  );
                }

                return (
                  <IdentityCard
                    key={identity.id}
                    identity={identity}
                    staffOptions={staffOptions}
                    onResolve={(matchedUserId) => handleResolve(identity.id, matchedUserId)}
                    showConfidenceDetails={showConfidenceDetails}
                  />
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {mustResolveAll && (
              <p className="text-sm text-destructive">
                Please resolve all identities to continue
              </p>
            )}
            <Button
              onClick={handleFinish}
              disabled={!canFinish || mustResolveAll}
            >
              {remainingCount > 0 ? `Continue with ${resolvedCount} resolved` : "Finish"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// SUMMARY STATS COMPONENT
// ============================================================================

export interface MatchingSummaryProps {
  stats: {
    total: number;
    matched: number;
    autoMatched: number;
    needsConfirmation: number;
    unmatched: number;
    byConfidenceBand: Record<ConfidenceBand, number>;
  };
  onStartReview: () => void;
}

export function MatchingSummary({ stats, onStartReview }: MatchingSummaryProps) {
  const hasIssues = stats.needsConfirmation > 0 || stats.unmatched > 0;
  const matchRate = stats.total > 0 ? Math.round((stats.matched / stats.total) * 100) : 0;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Staff Matching</h3>
        {hasIssues && (
          <Badge variant="destructive">
            {stats.needsConfirmation + stats.unmatched} need review
          </Badge>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-2xl font-bold">{matchRate}%</p>
          <p className="text-sm text-muted-foreground">Match Rate</p>
        </div>
        <div>
          <p className="text-2xl font-bold">{stats.autoMatched}</p>
          <p className="text-sm text-muted-foreground">Auto-matched</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Exact matches</span>
          <span className="font-medium">{stats.byConfidenceBand.exact}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">High confidence</span>
          <span className="font-medium">{stats.byConfidenceBand.high}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Needs confirmation</span>
          <span className="font-medium text-amber-600">{stats.needsConfirmation}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Unmatched</span>
          <span className="font-medium text-destructive">{stats.unmatched}</span>
        </div>
      </div>

      {hasIssues && (
        <Button className="w-full mt-4" onClick={onStartReview}>
          Review {stats.needsConfirmation + stats.unmatched} Issues
        </Button>
      )}
    </div>
  );
}
