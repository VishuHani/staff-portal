"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronUp, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { format } from "date-fns";
import { ConflictResolutions } from "./ConflictResolutions";
import { generateConflictResolutions } from "@/lib/actions/ai/conflict-detection";
import type { ConflictResolution } from "@/lib/actions/ai/conflict-detection";
import { toast } from "sonner";

interface Conflict {
  id: string;
  type: string;
  severity: "critical" | "warning" | "info";
  date: string;
  dayOfWeek: string;
  title: string;
  description: string;
  venues?: string[];
  details: any;
  resolutions?: ConflictResolution[];
}

interface ConflictsListProps {
  conflicts: Conflict[];
  title: string;
  description: string;
}

function getSeverityIcon(severity: string) {
  switch (severity) {
    case "critical":
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    case "warning":
      return <AlertCircle className="h-5 w-5 text-orange-600" />;
    case "info":
      return <Info className="h-5 w-5 text-blue-600" />;
    default:
      return <Info className="h-5 w-5 text-gray-600" />;
  }
}

function getSeverityColor(severity: string) {
  switch (severity) {
    case "critical":
      return "border-red-200 bg-red-50";
    case "warning":
      return "border-orange-200 bg-orange-50";
    case "info":
      return "border-blue-200 bg-blue-50";
    default:
      return "border-gray-200 bg-gray-50";
  }
}

function getSeverityBadge(severity: string) {
  switch (severity) {
    case "critical":
      return <Badge className="bg-red-600 hover:bg-red-700">Critical</Badge>;
    case "warning":
      return <Badge className="bg-orange-600 hover:bg-orange-700">Warning</Badge>;
    case "info":
      return <Badge className="bg-blue-600 hover:bg-blue-700">Info</Badge>;
    default:
      return <Badge>Unknown</Badge>;
  }
}

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const [expanded, setExpanded] = useState(false);
  const [resolutions, setResolutions] = useState<ConflictResolution[]>(conflict.resolutions || []);
  const [loadingResolutions, setLoadingResolutions] = useState(false);
  const [showResolutions, setShowResolutions] = useState(!!conflict.resolutions);

  const handleGetResolutions = async () => {
    setLoadingResolutions(true);
    try {
      const result = await generateConflictResolutions(conflict);

      if (result.success && result.resolutions) {
        setResolutions(result.resolutions);
        setShowResolutions(true);
        toast.success(`Generated ${result.resolutions.length} resolution strategies`);
      } else {
        toast.error(result.error || "Failed to generate resolutions");
      }
    } catch (error) {
      console.error("Error generating resolutions:", error);
      toast.error("An error occurred while generating resolutions");
    } finally {
      setLoadingResolutions(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border-2 p-4 transition-all",
        getSeverityColor(conflict.severity)
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className="mt-0.5">{getSeverityIcon(conflict.severity)}</div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-base">{conflict.title}</h3>
              {getSeverityBadge(conflict.severity)}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              {conflict.description}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="font-medium">
                {format(new Date(conflict.date), "EEEE, MMMM d, yyyy")}
              </span>
              <span className="text-gray-400">•</span>
              <span className="capitalize">{conflict.type.replace(/([A-Z])/g, " $1").trim()}</span>
            </div>
            {/* Venue Indicators */}
            {conflict.venues && conflict.venues.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {conflict.venues.map((venue, index) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="text-xs bg-purple-50 text-purple-700 border-purple-300 hover:bg-purple-100"
                  >
                    {venue}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Expand/Collapse Button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
        >
          {expanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* AI Resolutions Button */}
      {!showResolutions && !loadingResolutions && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <Button
            onClick={handleGetResolutions}
            variant="outline"
            size="sm"
            className="w-full bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-300"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Get AI Resolutions
          </Button>
        </div>
      )}

      {/* Loading Resolutions */}
      {loadingResolutions && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Analyzing conflict and generating resolutions...
          </div>
        </div>
      )}

      {/* AI Resolutions Display */}
      {showResolutions && resolutions.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <ConflictResolutions
            conflictId={conflict.id}
            resolutions={resolutions}
            onResolutionApplied={() => {
              toast.success("Resolution applied! Refresh the report to see updates.");
            }}
          />
        </div>
      )}

      {/* Expanded Details */}
      {expanded && conflict.details && (
        <div className="mt-4 pt-4 border-t border-gray-300 space-y-3">
          {/* Staffing Details */}
          {conflict.details.totalStaff !== undefined && (
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Total Staff:</span>
                <span className="ml-2 font-medium">{conflict.details.totalStaff}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Available:</span>
                <span className="ml-2 font-medium">{conflict.details.availableStaff}</span>
              </div>
              {conflict.details.coveragePercentage !== undefined && (
                <div>
                  <span className="text-muted-foreground">Coverage:</span>
                  <span className="ml-2 font-medium">{conflict.details.coveragePercentage}%</span>
                </div>
              )}
            </div>
          )}

          {/* Unavailable Staff */}
          {conflict.details.unavailableStaff && conflict.details.unavailableStaff.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">Unavailable Staff:</h4>
              <div className="space-y-2">
                {conflict.details.unavailableStaff.map((staff: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm bg-white rounded px-3 py-2 border"
                  >
                    <span className="font-medium">{staff.name}</span>
                    {staff.reason && (
                      <span className="text-muted-foreground text-xs">{staff.reason}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Time-Off Staff */}
          {conflict.details.staff && conflict.details.staff.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2">
                Staff on Time-Off ({conflict.details.timeOffCount}):
              </h4>
              <div className="space-y-2">
                {conflict.details.staff.map((staff: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between text-sm bg-white rounded px-3 py-2 border"
                  >
                    <span className="font-medium">{staff.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {staff.startDate} - {staff.endDate}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function ConflictsList({ conflicts, title, description }: ConflictsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {conflicts.length === 0 ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
              <Info className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-1">No Conflicts Detected</h3>
            <p className="text-muted-foreground">
              No scheduling conflicts found for the selected period
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {conflicts.map((conflict) => (
              <ConflictCard key={conflict.id} conflict={conflict} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
