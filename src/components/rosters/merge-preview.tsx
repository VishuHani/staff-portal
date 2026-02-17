"use client";

/**
 * Merge Preview Component
 * Shows preview of what will happen when merging uploaded roster
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Minus,
  RefreshCw,
  Equal,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  User,
  Calendar,
  Clock,
  Briefcase,
} from "lucide-react";
import type { MergePreview, ShiftSnapshot } from "@/lib/actions/rosters";
import { cn } from "@/lib/utils";

interface MergePreviewViewProps {
  preview: MergePreview;
}

export function MergePreviewView({ preview }: MergePreviewViewProps) {
  const [activeTab, setActiveTab] = useState<string>("summary");

  const hasChanges =
    preview.summary.addCount > 0 ||
    preview.summary.removeCount > 0 ||
    preview.summary.updateCount > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Merge Preview</CardTitle>
        <CardDescription>
          {hasChanges
            ? "Review the changes before applying"
            : "No changes detected"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Summary Stats */}
        <div className="grid grid-cols-5 gap-2 mb-4">
          <StatCard
            icon={Plus}
            value={preview.summary.addCount}
            label="To Add"
            color="green"
          />
          <StatCard
            icon={Minus}
            value={preview.summary.removeCount}
            label="To Remove"
            color="red"
          />
          <StatCard
            icon={RefreshCw}
            value={preview.summary.updateCount}
            label="To Update"
            color="amber"
          />
          <StatCard
            icon={Equal}
            value={preview.summary.unchangedCount}
            label="Unchanged"
            color="gray"
          />
          <StatCard
            icon={AlertTriangle}
            value={preview.summary.conflictCount}
            label="Conflicts"
            color="orange"
          />
        </div>

        {hasChanges && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="add" disabled={preview.summary.addCount === 0}>
                Add ({preview.summary.addCount})
              </TabsTrigger>
              <TabsTrigger value="remove" disabled={preview.summary.removeCount === 0}>
                Remove ({preview.summary.removeCount})
              </TabsTrigger>
              <TabsTrigger value="update" disabled={preview.summary.updateCount === 0}>
                Update ({preview.summary.updateCount})
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="h-[250px] mt-4">
              <TabsContent value="summary" className="mt-0 space-y-3">
                {preview.toAdd.length > 0 && (
                  <ShiftGroup
                    title="Shifts to Add"
                    shifts={preview.toAdd}
                    type="add"
                    defaultOpen={preview.toAdd.length <= 5}
                  />
                )}
                {preview.toRemove.length > 0 && (
                  <ShiftGroup
                    title="Shifts to Remove"
                    shifts={preview.toRemove}
                    type="remove"
                    defaultOpen={preview.toRemove.length <= 5}
                  />
                )}
                {preview.toUpdate.length > 0 && (
                  <UpdateGroup
                    updates={preview.toUpdate}
                    defaultOpen={preview.toUpdate.length <= 5}
                  />
                )}
                {preview.conflicts.length > 0 && (
                  <ConflictGroup conflicts={preview.conflicts} />
                )}
              </TabsContent>

              <TabsContent value="add" className="mt-0 space-y-2">
                {preview.toAdd.map((shift, i) => (
                  <ShiftCard key={i} shift={shift} type="add" />
                ))}
              </TabsContent>

              <TabsContent value="remove" className="mt-0 space-y-2">
                {preview.toRemove.map((shift, i) => (
                  <ShiftCard key={i} shift={shift} type="remove" />
                ))}
              </TabsContent>

              <TabsContent value="update" className="mt-0 space-y-2">
                {preview.toUpdate.map((update, i) => (
                  <UpdateCard key={i} update={update} />
                ))}
              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        {!hasChanges && (
          <div className="text-center py-8 text-muted-foreground">
            <Equal className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>The uploaded roster matches the current roster.</p>
            <p className="text-sm">No changes will be made.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Stat Card Component
interface StatCardProps {
  icon: typeof Plus;
  value: number;
  label: string;
  color: "green" | "red" | "amber" | "gray" | "orange";
}

function StatCard({ icon: Icon, value, label, color }: StatCardProps) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    red: "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    gray: "bg-gray-50 text-gray-700 border-gray-200",
    orange: "bg-orange-50 text-orange-700 border-orange-200",
  };

  return (
    <div className={cn("text-center p-2 rounded-lg border", colors[color])}>
      <Icon className="h-4 w-4 mx-auto mb-1" />
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}

// Shift Card Component
interface ShiftCardProps {
  shift: ShiftSnapshot;
  type: "add" | "remove";
}

function ShiftCard({ shift, type }: ShiftCardProps) {
  const styles = {
    add: "bg-green-50 border-green-200",
    remove: "bg-red-50 border-red-200",
  };

  return (
    <div className={cn("p-2 rounded border text-sm", styles[type])}>
      <div className="flex items-center gap-2">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">
          {shift.userName || "Unassigned"}
        </span>
        {shift.position && (
          <>
            <span className="text-muted-foreground">|</span>
            <Briefcase className="h-3 w-3 text-muted-foreground" />
            <span>{shift.position}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {shift.date}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {shift.startTime} - {shift.endTime}
        </span>
      </div>
    </div>
  );
}

// Update Card Component
interface UpdateCardProps {
  update: {
    existing: ShiftSnapshot;
    incoming: ShiftSnapshot;
    changes: string[];
  };
}

function UpdateCard({ update }: UpdateCardProps) {
  return (
    <div className="p-2 rounded border bg-amber-50 border-amber-200 text-sm">
      <div className="flex items-center gap-2">
        <User className="h-3 w-3 text-muted-foreground" />
        <span className="font-medium">
          {update.incoming.userName || "Unassigned"}
        </span>
        <span className="text-muted-foreground">|</span>
        <span className="text-xs">{update.incoming.date}</span>
      </div>
      <div className="mt-1 text-xs">
        {update.changes.map((change, i) => (
          <div key={i} className="text-amber-700">
            <ChevronRight className="h-3 w-3 inline" /> {change}
          </div>
        ))}
      </div>
    </div>
  );
}

// Collapsible Shift Group
interface ShiftGroupProps {
  title: string;
  shifts: ShiftSnapshot[];
  type: "add" | "remove";
  defaultOpen?: boolean;
}

function ShiftGroup({ title, shifts, type, defaultOpen = false }: ShiftGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted rounded-lg hover:bg-muted/80">
        <span className="font-medium text-sm">
          {title} ({shifts.length})
        </span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {shifts.map((shift, i) => (
          <ShiftCard key={i} shift={shift} type={type} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Update Group
interface UpdateGroupProps {
  updates: Array<{
    existing: ShiftSnapshot;
    incoming: ShiftSnapshot;
    changes: string[];
  }>;
  defaultOpen?: boolean;
}

function UpdateGroup({ updates, defaultOpen = false }: UpdateGroupProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-muted rounded-lg hover:bg-muted/80">
        <span className="font-medium text-sm">
          Shifts to Update ({updates.length})
        </span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {updates.map((update, i) => (
          <UpdateCard key={i} update={update} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

// Conflict Group
interface ConflictGroupProps {
  conflicts: Array<{
    existing: ShiftSnapshot;
    incoming: ShiftSnapshot;
    reason: string;
  }>;
}

function ConflictGroup({ conflicts }: ConflictGroupProps) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full p-2 bg-orange-100 rounded-lg hover:bg-orange-100/80">
        <span className="font-medium text-sm text-orange-700">
          <AlertTriangle className="h-4 w-4 inline mr-1" />
          Conflicts ({conflicts.length})
        </span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {conflicts.map((conflict, i) => (
          <div
            key={i}
            className="p-2 rounded border bg-orange-50 border-orange-200 text-sm"
          >
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-3 w-3 text-orange-600" />
              <span className="font-medium text-orange-700">
                {conflict.reason}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
              <div className="p-1 bg-white rounded">
                <div className="text-muted-foreground mb-1">Existing:</div>
                <div>{conflict.existing.userName || "Unassigned"}</div>
                <div>
                  {conflict.existing.startTime} - {conflict.existing.endTime}
                </div>
              </div>
              <div className="p-1 bg-white rounded">
                <div className="text-muted-foreground mb-1">Incoming:</div>
                <div>{conflict.incoming.userName || "Unassigned"}</div>
                <div>
                  {conflict.incoming.startTime} - {conflict.incoming.endTime}
                </div>
              </div>
            </div>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
