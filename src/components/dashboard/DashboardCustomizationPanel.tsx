"use client";

import { useState, useEffect } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { GripVertical, Settings2, Eye, EyeOff, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DashboardWidget {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  order: number;
  required?: boolean;
}

interface SortableWidgetProps {
  widget: DashboardWidget;
  onToggle: (id: string, enabled: boolean) => void;
}

function SortableWidget({ widget, onToggle }: SortableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-3 rounded-lg border bg-card p-3 transition-all",
        isDragging && "opacity-50 shadow-lg scale-[1.02]",
        !widget.enabled && "opacity-60"
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab touch-none p-1 hover:bg-muted rounded"
        disabled={widget.required}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{widget.name}</span>
          {widget.required && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              Required
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {widget.description}
        </p>
      </div>

      <div className="flex items-center gap-2">
        {widget.enabled ? (
          <Eye className="h-4 w-4 text-green-500" />
        ) : (
          <EyeOff className="h-4 w-4 text-muted-foreground" />
        )}
        <Switch
          checked={widget.enabled}
          onCheckedChange={(checked) => onToggle(widget.id, checked)}
          disabled={widget.required}
          className="data-[state=checked]:bg-green-500"
        />
      </div>
    </div>
  );
}

// Default widgets for each role
export const DEFAULT_STAFF_WIDGETS: DashboardWidget[] = [
  { id: "kpis", name: "KPI Cards", description: "Hours, shifts, and messages summary", enabled: true, order: 0 },
  { id: "quick-actions", name: "Quick Actions", description: "Shortcuts to common tasks", enabled: true, order: 1 },
  { id: "upcoming-shifts", name: "Upcoming Shifts", description: "Your next scheduled shifts", enabled: true, order: 2 },
  { id: "week-at-glance", name: "Week at a Glance", description: "Weekly availability overview", enabled: true, order: 3 },
  { id: "recent-activity", name: "Recent Activity", description: "Latest notifications", enabled: true, order: 4 },
  { id: "personal-stats", name: "Personal Stats", description: "Scheduled hours trends", enabled: true, order: 5 },
];

export const DEFAULT_MANAGER_WIDGETS: DashboardWidget[] = [
  { id: "hero-stats", name: "Hero Stats", description: "Coverage and pending approvals", enabled: true, order: 0 },
  { id: "coverage-heatmap", name: "Coverage Heatmap", description: "Team availability by day/time", enabled: true, order: 1 },
  { id: "availability-pie", name: "Team Availability", description: "Distribution of team status", enabled: true, order: 2 },
  { id: "coverage-trend", name: "Coverage Trend", description: "Historical coverage data", enabled: true, order: 3 },
  { id: "ai-insights", name: "Smart Suggestions", description: "AI-powered scheduling insights", enabled: true, order: 4 },
  { id: "team-snapshot", name: "Team Snapshot", description: "Staff member overview", enabled: true, order: 5 },
];

export const DEFAULT_ADMIN_WIDGETS: DashboardWidget[] = [
  { id: "global-stats", name: "Global Stats", description: "System-wide metrics", enabled: true, order: 0, required: true },
  { id: "venue-comparison", name: "Venue Comparison", description: "Coverage by venue", enabled: true, order: 1 },
  { id: "activity-heatmap", name: "Activity Heatmap", description: "User activity by time", enabled: true, order: 2 },
  { id: "action-distribution", name: "Action Distribution", description: "Audit log breakdown", enabled: true, order: 3 },
  { id: "role-distribution", name: "Role Distribution", description: "Users by role", enabled: true, order: 4 },
  { id: "approval-metrics", name: "Approval Metrics", description: "Request turnaround time", enabled: true, order: 5 },
  { id: "audit-logs", name: "Audit Logs", description: "Recent system activity", enabled: true, order: 6 },
];

interface DashboardCustomizationPanelProps {
  widgets: DashboardWidget[];
  onChange: (widgets: DashboardWidget[]) => void;
  onReset: () => void;
  trigger?: React.ReactNode;
}

export function DashboardCustomizationPanel({
  widgets,
  onChange,
  onReset,
  trigger,
}: DashboardCustomizationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [localWidgets, setLocalWidgets] = useState<DashboardWidget[]>(widgets);

  useEffect(() => {
    setLocalWidgets(widgets);
  }, [widgets]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localWidgets.findIndex((w) => w.id === active.id);
      const newIndex = localWidgets.findIndex((w) => w.id === over.id);

      const newWidgets = arrayMove(localWidgets, oldIndex, newIndex).map(
        (w, i) => ({ ...w, order: i })
      );
      setLocalWidgets(newWidgets);
    }
  };

  const handleToggle = (id: string, enabled: boolean) => {
    const newWidgets = localWidgets.map((w) =>
      w.id === id ? { ...w, enabled } : w
    );
    setLocalWidgets(newWidgets);
  };

  const handleSave = () => {
    onChange(localWidgets);
    setIsOpen(false);
  };

  const handleReset = () => {
    onReset();
    setIsOpen(false);
  };

  const enabledCount = localWidgets.filter((w) => w.enabled).length;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="h-8">
            <Settings2 className="h-4 w-4 mr-2" />
            Customize
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Dashboard Customization
          </SheetTitle>
          <SheetDescription>
            Drag to reorder widgets. Toggle visibility to show/hide.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Stats */}
          <div className="flex items-center justify-between text-sm text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
            <span>{enabledCount} of {localWidgets.length} widgets visible</span>
          </div>

          {/* Widget list */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localWidgets.map((w) => w.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2">
                {localWidgets.map((widget) => (
                  <SortableWidget
                    key={widget.id}
                    widget={widget}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset to Default
            </Button>
            <Button size="sm" onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// Hook for managing widget state with localStorage persistence
export function useDashboardWidgets(
  role: "STAFF" | "MANAGER" | "ADMIN",
  storageKey: string
) {
  const defaults =
    role === "STAFF"
      ? DEFAULT_STAFF_WIDGETS
      : role === "MANAGER"
      ? DEFAULT_MANAGER_WIDGETS
      : DEFAULT_ADMIN_WIDGETS;

  const [widgets, setWidgets] = useState<DashboardWidget[]>(() => {
    if (typeof window === "undefined") return defaults;
    
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle new widgets
        return defaults.map((d) => {
          const found = parsed.find((p: DashboardWidget) => p.id === d.id);
          return found ? { ...d, enabled: found.enabled, order: found.order } : d;
        }).sort((a, b) => a.order - b.order);
      } catch {
        return defaults;
      }
    }
    return defaults;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(widgets));
  }, [widgets, storageKey]);

  const handleChange = (newWidgets: DashboardWidget[]) => {
    setWidgets(newWidgets);
  };

  const handleReset = () => {
    setWidgets(defaults);
  };

  const visibleWidgets = widgets.filter((w) => w.enabled).sort((a, b) => a.order - b.order);

  return {
    widgets,
    visibleWidgets,
    setWidgets: handleChange,
    resetWidgets: handleReset,
  };
}