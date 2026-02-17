"use client";

/**
 * Version Diff Component
 * Standalone component showing detailed diff between two versions
 */

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus,
  Minus,
  RefreshCw,
  User,
  Calendar,
  Clock,
  Briefcase,
} from "lucide-react";
import type { VersionDiff, ShiftSnapshot } from "@/lib/actions/rosters";
import { cn } from "@/lib/utils";

interface VersionDiffViewProps {
  diff: VersionDiff;
  fromVersion: number;
  toVersion: number;
}

export function VersionDiffView({ diff, fromVersion, toVersion }: VersionDiffViewProps) {
  const [activeTab, setActiveTab] = useState<string>("all");

  const hasChanges = diff.summary.totalChanges > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          Changes from v{fromVersion} to v{toVersion}
        </CardTitle>
        <CardDescription>
          {hasChanges
            ? `${diff.summary.totalChanges} total changes`
            : "No changes between these versions"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <Plus className="h-5 w-5 text-green-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-green-700">
              {diff.summary.addedCount}
            </div>
            <div className="text-xs text-green-600">Added</div>
          </div>
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <Minus className="h-5 w-5 text-red-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-red-700">
              {diff.summary.removedCount}
            </div>
            <div className="text-xs text-red-600">Removed</div>
          </div>
          <div className="text-center p-3 bg-amber-50 rounded-lg border border-amber-200">
            <RefreshCw className="h-5 w-5 text-amber-600 mx-auto mb-1" />
            <div className="text-2xl font-bold text-amber-700">
              {diff.summary.modifiedCount}
            </div>
            <div className="text-xs text-amber-600">Modified</div>
          </div>
        </div>

        {hasChanges && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="all">
                All ({diff.summary.totalChanges})
              </TabsTrigger>
              <TabsTrigger value="added" disabled={diff.summary.addedCount === 0}>
                Added ({diff.summary.addedCount})
              </TabsTrigger>
              <TabsTrigger value="removed" disabled={diff.summary.removedCount === 0}>
                Removed ({diff.summary.removedCount})
              </TabsTrigger>
              <TabsTrigger value="modified" disabled={diff.summary.modifiedCount === 0}>
                Modified ({diff.summary.modifiedCount})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[300px] mt-4">
              <TabsContent value="all" className="space-y-3 mt-0">
                {diff.added.map((shift, i) => (
                  <ShiftDiffCard key={`added-${i}`} type="added" shift={shift} />
                ))}
                {diff.removed.map((shift, i) => (
                  <ShiftDiffCard key={`removed-${i}`} type="removed" shift={shift} />
                ))}
                {diff.modified.map((mod, i) => (
                  <ShiftDiffCard
                    key={`modified-${i}`}
                    type="modified"
                    shift={mod.after}
                    changes={mod.changes}
                    before={mod.before}
                  />
                ))}
              </TabsContent>

              <TabsContent value="added" className="space-y-3 mt-0">
                {diff.added.map((shift, i) => (
                  <ShiftDiffCard key={i} type="added" shift={shift} />
                ))}
              </TabsContent>

              <TabsContent value="removed" className="space-y-3 mt-0">
                {diff.removed.map((shift, i) => (
                  <ShiftDiffCard key={i} type="removed" shift={shift} />
                ))}
              </TabsContent>

              <TabsContent value="modified" className="space-y-3 mt-0">
                {diff.modified.map((mod, i) => (
                  <ShiftDiffCard
                    key={i}
                    type="modified"
                    shift={mod.after}
                    changes={mod.changes}
                    before={mod.before}
                  />
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}

interface ShiftDiffCardProps {
  type: "added" | "removed" | "modified";
  shift: ShiftSnapshot;
  changes?: string[];
  before?: ShiftSnapshot;
}

function ShiftDiffCard({ type, shift, changes, before }: ShiftDiffCardProps) {
  const styles = {
    added: {
      bg: "bg-green-50",
      border: "border-green-200",
      badge: "bg-green-100 text-green-800",
      icon: Plus,
    },
    removed: {
      bg: "bg-red-50",
      border: "border-red-200",
      badge: "bg-red-100 text-red-800",
      icon: Minus,
    },
    modified: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      badge: "bg-amber-100 text-amber-800",
      icon: RefreshCw,
    },
  };

  const style = styles[type];
  const Icon = style.icon;

  return (
    <div className={cn("p-3 rounded-lg border", style.bg, style.border)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge className={style.badge}>
              <Icon className="h-3 w-3 mr-1" />
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </Badge>
          </div>

          <div className="space-y-1 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">
                {shift.userName || "Unassigned"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{shift.date}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span>
                {shift.startTime} - {shift.endTime}
              </span>
            </div>
            {shift.position && (
              <div className="flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{shift.position}</span>
              </div>
            )}
          </div>

          {/* Show changes for modified shifts */}
          {type === "modified" && changes && changes.length > 0 && (
            <div className="mt-2 pt-2 border-t border-amber-200">
              <p className="text-xs font-medium text-amber-700 mb-1">Changes:</p>
              <ul className="text-xs text-amber-600 space-y-0.5">
                {changes.map((change, i) => (
                  <li key={i}>• {change}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ShiftDiffCard };
