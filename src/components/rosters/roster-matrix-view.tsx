"use client";

/**
 * Roster Matrix View - Polished Design
 * Staff × Days matrix grid with shift cards, pay calculation, and position colors
 * Supports drag-and-drop to move shifts between days and staff members
 */

import { useState, useMemo, useEffect } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ConflictBadge } from "./conflict-badge";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import {
  User,
  Plus,
  Clock,
  AlertTriangle,
  Coffee,
  MessageSquare,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import { deleteShift } from "@/lib/actions/rosters";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  calculateShiftHours,
  calculateTotalPay,
  formatCurrency,
  formatHours,
  formatTimeRange,
} from "@/lib/utils/pay-calculator";
import { Decimal } from "@prisma/client/runtime/library";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Types
interface Shift {
  id: string;
  userId: string | null;
  date: Date;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  position: string | null;
  notes: string | null;
  originalName: string | null;
  hasConflict: boolean;
  conflictType: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    profileImage: string | null;
  } | null;
}

interface StaffPayRates {
  weekdayRate: Decimal | number | null | unknown;
  saturdayRate: Decimal | number | null | unknown;
  sundayRate: Decimal | number | null | unknown;
}

interface PositionColor {
  name: string;
  color: string;
}

interface RosterMatrixViewProps {
  shifts: Shift[];
  weekStart: Date;
  editable?: boolean;
  positionColors?: PositionColor[];
  staffPayRates?: Record<string, StaffPayRates>;
  onEditShift?: (shift: Shift) => void;
  onAddShift?: (date: Date, userId?: string) => void;
  onMoveShift?: (shiftId: string, newDate: Date, newUserId: string | null) => void;
  onRefresh?: () => void;
}

interface StaffInfo {
  id: string;
  name: string;
  email: string;
  profileImage: string | null;
  firstName: string | null;
  lastName: string | null;
  isUnassigned: boolean;
  originalName: string | null;
  role: string | null;
}

// Color palette for hash-based position colors
const POSITION_COLOR_PALETTE = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#84CC16", // lime
  "#F97316", // orange
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#EF4444", // red
  "#22C55E", // green
];

// Default colors for common positions (kept for backwards compatibility)
const DEFAULT_POSITION_COLORS: Record<string, string> = {
  barista: "#3B82F6",
  chef: "#F97316",
  server: "#8B5CF6",
  manager: "#22C55E",
  bartender: "#EC4899",
  host: "#14B8A6",
  kitchen: "#EAB308",
  default: "#6B7280",
};

/**
 * Generate a consistent color from a string using a hash function
 */
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return POSITION_COLOR_PALETTE[Math.abs(hash) % POSITION_COLOR_PALETTE.length];
}

function getPositionColor(
  position: string | null,
  positionColors: PositionColor[]
): string {
  if (!position) return DEFAULT_POSITION_COLORS.default;

  // Check configured colors first (from database)
  const configured = positionColors.find(
    (p) => p.name.toLowerCase() === position.toLowerCase()
  );
  if (configured) return configured.color;

  // Check default colors for common positions
  const key = position.toLowerCase();
  if (DEFAULT_POSITION_COLORS[key]) {
    return DEFAULT_POSITION_COLORS[key];
  }

  // Generate consistent color from position string for any other positions
  return stringToColor(position);
}

// Droppable cell wrapper component
function DroppableCell({
  id,
  children,
  className,
  onClick,
  enabled = true,
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  enabled?: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: !enabled });

  return (
    <div
      ref={enabled ? setNodeRef : undefined}
      className={cn(className, enabled && isOver && "ring-2 ring-blue-500 ring-inset bg-blue-100/50")}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Draggable shift wrapper component
function DraggableShift({
  id,
  disabled,
  children,
  enabled = true,
}: {
  id: string;
  disabled: boolean;
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
    disabled: disabled || !enabled,
  });

  const style = enabled && transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={enabled ? setNodeRef : undefined}
      style={style}
      {...(enabled ? listeners : {})}
      {...(enabled ? attributes : {})}
      className={cn(enabled && isDragging && "opacity-50")}
    >
      {children}
    </div>
  );
}

export function RosterMatrixView({
  shifts,
  weekStart,
  editable = false,
  positionColors = [],
  staffPayRates = {},
  onEditShift,
  onAddShift,
  onMoveShift,
  onRefresh,
}: RosterMatrixViewProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [mounted, setMounted] = useState(false);

  // Fix hydration mismatch - only render DnD on client
  useEffect(() => {
    setMounted(true);
  }, []);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px of movement before starting drag
      },
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const shift = shifts.find((s) => s.id === active.id);
    if (shift) {
      setActiveShift(shift);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveShift(null);

    if (!over || !onMoveShift) return;

    const shiftId = active.id as string;
    const dropTarget = over.id as string; // Format: "cell-{staffId}-{dateKey}"

    if (!dropTarget.startsWith("cell-")) return;

    const parts = dropTarget.split("-");
    // Format: cell-{staffId}-{dateKey} where dateKey is yyyy-MM-dd
    const staffId = parts.slice(1, -3).join("-"); // Handle UUIDs with dashes
    const dateKey = parts.slice(-3).join("-"); // yyyy-MM-dd

    // Parse the date from dateKey
    const newDate = new Date(dateKey);
    if (isNaN(newDate.getTime())) return;

    // Determine new userId
    const newUserId = staffId.startsWith("unmatched:") ? null : staffId;

    // Call the move handler
    onMoveShift(shiftId, newDate, newUserId);
  };

  // Generate days of the week
  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(weekStart), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [weekStart]);

  // Extract unique staff members
  const staffList = useMemo(() => {
    const staffMap = new Map<string, StaffInfo>();
    const unassignedSet = new Set<string>();

    shifts.forEach((shift) => {
      if (shift.user) {
        const key = shift.user.id;
        if (!staffMap.has(key)) {
          staffMap.set(key, {
            id: shift.user.id,
            name:
              `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() ||
              shift.user.email,
            email: shift.user.email,
            profileImage: shift.user.profileImage,
            firstName: shift.user.firstName,
            lastName: shift.user.lastName,
            isUnassigned: false,
            originalName: null,
            role: shift.position,
          });
        }
      } else if (shift.originalName) {
        const key = `unmatched:${shift.originalName}`;
        if (!unassignedSet.has(key)) {
          unassignedSet.add(key);
          staffMap.set(key, {
            id: key,
            name: shift.originalName,
            email: "",
            profileImage: null,
            firstName: null,
            lastName: null,
            isUnassigned: true,
            originalName: shift.originalName,
            role: shift.position,
          });
        }
      }
    });

    return Array.from(staffMap.values()).sort((a, b) => {
      if (a.isUnassigned !== b.isUnassigned) {
        return a.isUnassigned ? 1 : -1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [shifts]);

  // Group shifts by staff and date
  const shiftGrid = useMemo(() => {
    const grid = new Map<string, Map<string, Shift[]>>();

    shifts.forEach((shift) => {
      const staffKey = shift.user?.id || `unmatched:${shift.originalName}`;
      const dateKey = format(new Date(shift.date), "yyyy-MM-dd");

      if (!grid.has(staffKey)) {
        grid.set(staffKey, new Map());
      }
      const staffGrid = grid.get(staffKey)!;
      if (!staffGrid.has(dateKey)) {
        staffGrid.set(dateKey, []);
      }
      staffGrid.get(dateKey)!.push(shift);
    });

    grid.forEach((staffGrid) => {
      staffGrid.forEach((dayShifts) => {
        dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime));
      });
    });

    return grid;
  }, [shifts]);

  const getInitials = (firstName: string | null, lastName: string | null) => {
    const first = firstName?.charAt(0) || "";
    const last = lastName?.charAt(0) || "";
    return (first + last).toUpperCase() || "?";
  };

  const handleDelete = async () => {
    if (!shiftToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteShift(shiftToDelete);
      if (result.success) {
        toast.success("Shift deleted");
        onRefresh?.();
      } else {
        toast.error(result.error || "Failed to delete shift");
      }
    } catch (error) {
      console.error("Error deleting shift:", error);
      toast.error("An error occurred");
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setShiftToDelete(null);
    }
  };

  // Helper to check if a shift has valid timing
  const isValidShift = (shift: Shift) => {
    return shift.startTime && shift.endTime &&
      shift.startTime !== "-" && shift.endTime !== "-" &&
      shift.startTime.includes(":") && shift.endTime.includes(":");
  };

  const handleCellClick = (day: Date, staff: StaffInfo) => {
    if (!editable) return;

    const dateKey = format(day, "yyyy-MM-dd");
    const staffGrid = shiftGrid.get(staff.id);
    const dayShifts = staffGrid?.get(dateKey) || [];
    // Only consider shifts with valid times
    const validShifts = dayShifts.filter(isValidShift);

    if (validShifts.length === 0 && onAddShift) {
      onAddShift(day, staff.isUnassigned ? undefined : staff.id);
    } else if (validShifts.length === 1 && onEditShift) {
      onEditShift(validShifts[0]);
    }
  };

  // Calculate staff totals (only for valid shifts)
  const getStaffTotals = (staffId: string) => {
    const staffShifts = shifts.filter((s) => {
      const isStaffMatch = s.user?.id === staffId ||
        (s.originalName && `unmatched:${s.originalName}` === staffId);
      // Only include shifts with valid timing
      const hasValidTime = s.startTime && s.endTime &&
        s.startTime !== "-" && s.endTime !== "-" &&
        s.startTime.includes(":") && s.endTime.includes(":");
      return isStaffMatch && hasValidTime;
    });

    const totalHours = staffShifts.reduce(
      (sum, s) =>
        sum + calculateShiftHours(s.startTime, s.endTime, s.breakMinutes),
      0
    );

    let totalPay: number | null = null;
    if (staffPayRates[staffId]) {
      const result = calculateTotalPay(
        staffShifts.map((s) => ({
          date: new Date(s.date),
          startTime: s.startTime,
          endTime: s.endTime,
          breakMinutes: s.breakMinutes,
        })),
        staffPayRates[staffId]
      );
      totalPay = result.total;
    }

    return { hours: totalHours, pay: totalPay };
  };

  if (shifts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No shifts added yet</p>
        {editable && (
          <p className="text-sm mt-1">Click &quot;Add Shift&quot; to get started</p>
        )}
      </div>
    );
  }

  // Wrapper to conditionally render DnD elements
  const DndWrapper = mounted ? DndContext : ({ children }: { children: React.ReactNode }) => <>{children}</>;

  return (
    <TooltipProvider>
      <DndWrapper
        {...(mounted ? {
          id: "roster-dnd-context",
          sensors: sensors,
          onDragStart: handleDragStart,
          onDragEnd: handleDragEnd,
        } : {})}
      >
      <div className="space-y-4">
        {/* Matrix Grid */}
        <div className="overflow-x-auto border rounded-lg bg-background">
          <div className="min-w-[900px]">
            {/* Header row */}
            <div className="grid grid-cols-[220px_repeat(7,1fr)] border-b bg-white">
              <div className="p-3 font-medium text-xs text-blue-600 uppercase tracking-wide border-r">
                Employee
              </div>
              {weekDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "p-3 text-center border-r last:border-r-0",
                      isToday && "bg-blue-50"
                    )}
                  >
                    <div className="font-medium text-xs text-muted-foreground">
                      {format(day, "EEE").toUpperCase()}
                    </div>
                    <div
                      className={cn(
                        "text-lg font-semibold mt-0.5",
                        isToday &&
                          "bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center mx-auto"
                      )}
                    >
                      {format(day, "d")}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Staff rows */}
            {staffList.map((staff) => {
              const staffShifts = shiftGrid.get(staff.id);
              const totals = getStaffTotals(staff.id);

              return (
                <div
                  key={staff.id}
                  className="grid grid-cols-[220px_repeat(7,1fr)] border-b last:border-b-0 hover:bg-muted/20 transition-colors"
                >
                  {/* Staff info column */}
                  <div className="flex items-start gap-3 p-3 bg-white border-r">
                    {!staff.isUnassigned ? (
                      <div className="relative flex-shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={staff.profileImage || undefined} />
                          <AvatarFallback className="text-sm bg-primary/10 text-primary">
                            {getInitials(staff.firstName, staff.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          "font-medium text-sm text-gray-900 truncate",
                          staff.isUnassigned && "text-amber-700"
                        )}
                      >
                        {staff.name}
                      </p>
                      {staff.role && (
                        <p className="text-xs text-gray-500 truncate">
                          {staff.role}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {formatHours(totals.hours)}  {totals.pay !== null && formatCurrency(totals.pay)}
                      </p>
                    </div>
                  </div>

                  {/* Day cells */}
                  {weekDays.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const dayShifts = staffShifts?.get(dateKey) || [];
                    const isToday = isSameDay(day, new Date());
                    const hasConflicts = dayShifts.some((s) => s.hasConflict);
                    const cellId = `cell-${staff.id}-${dateKey}`;

                    // Filter out shifts without valid timing for display
                    const validShifts = dayShifts.filter(isValidShift);

                    return (
                      <DroppableCell
                        key={dateKey}
                        id={cellId}
                        enabled={mounted}
                        className={cn(
                          "bg-gray-50 p-2 border-r last:border-r-0 min-h-[120px]",
                          isToday && "bg-blue-50",
                          editable &&
                            validShifts.length === 0 &&
                            "cursor-pointer hover:bg-gray-100",
                          hasConflicts && "bg-red-50"
                        )}
                        onClick={() =>
                          validShifts.length === 0 && handleCellClick(day, staff)
                        }
                      >
                        {(() => {

                          if (validShifts.length === 0 && editable) {
                            return (
                              <div className="h-full flex items-center justify-center text-muted-foreground opacity-0 hover:opacity-100 transition-opacity">
                                <Plus className="h-5 w-5" />
                              </div>
                            );
                          }

                          if (validShifts.length === 0) {
                            return null; // Empty cell for non-editable with no valid shifts
                          }

                          return (
                            <div className="space-y-2">
                              {validShifts.map((shift) => (
                                <DraggableShift
                                  key={shift.id}
                                  id={shift.id}
                                  disabled={!editable || !onMoveShift}
                                  enabled={mounted}
                                >
                                  <ShiftCard
                                    shift={shift}
                                    positionColor={getPositionColor(
                                      shift.position,
                                      positionColors
                                    )}
                                    editable={editable}
                                    onEdit={() => onEditShift?.(shift)}
                                    onDelete={() => {
                                      setShiftToDelete(shift.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                  />
                                </DraggableShift>
                              ))}
                            </div>
                          );
                        })()}
                      </DroppableCell>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Floating Add Button */}
        {editable && (
          <div className="fixed bottom-6 right-6">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="lg"
                  className="h-14 w-14 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700"
                  onClick={() => onAddShift?.(weekDays[0])}
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Add shift</TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Shift</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this shift? This action cannot be
                undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Drag overlay - shows the shift being dragged */}
        {mounted && (
          <DragOverlay>
            {activeShift && (
              <div className="opacity-80 shadow-lg">
                <ShiftCard
                  shift={activeShift}
                  positionColor={getPositionColor(activeShift.position, positionColors)}
                  editable={false}
                  onEdit={() => {}}
                  onDelete={() => {}}
                />
              </div>
            )}
          </DragOverlay>
        )}
      </div>
      </DndWrapper>
    </TooltipProvider>
  );
}

// Shift Card Component
interface ShiftCardProps {
  shift: Shift;
  positionColor: string;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

function ShiftCard({
  shift,
  positionColor,
  editable,
  onEdit,
  onDelete,
}: ShiftCardProps) {
  const hours = calculateShiftHours(
    shift.startTime,
    shift.endTime,
    shift.breakMinutes
  );

  // Generate a lighter tint of the position color for the background
  const getBgColor = (color: string) => {
    // Convert hex to rgba with low opacity for a subtle tint
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, 0.1)`;
    }
    return color;
  };

  return (
    <div
      className={cn(
        "rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-all border-l-4",
        shift.hasConflict ? "border-l-red-500 bg-red-50" : ""
      )}
      style={{
        borderLeftColor: shift.hasConflict ? undefined : positionColor,
        backgroundColor: shift.hasConflict ? undefined : getBgColor(positionColor),
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (editable) onEdit();
      }}
    >
      {/* Row 1: Time + Menu */}
      <div className="flex justify-between items-start">
        <span className="font-semibold text-sm text-gray-800">
          {formatTimeRange(shift.startTime, shift.endTime)}
        </span>
        <div className="flex items-center gap-1">
          {shift.notes && (
            <Tooltip>
              <TooltipTrigger asChild>
                <MessageSquare className="h-3.5 w-3.5 text-gray-500" />
              </TooltipTrigger>
              <TooltipContent>
                <p className="max-w-xs">{shift.notes}</p>
              </TooltipContent>
            </Tooltip>
          )}
          {editable && (
            <DropdownMenu>
              <DropdownMenuTrigger
                asChild
                onClick={(e) => e.stopPropagation()}
              >
                <Button
                  variant="ghost"
                  className="h-6 w-6 p-0 hover:bg-white/50"
                >
                  <MoreVertical className="h-4 w-4 text-gray-500" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit();
                  }}
                >
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Row 2: Position as styled span */}
      {shift.position && (
        <span
          className="text-[11px] font-semibold uppercase tracking-wide mt-1 inline-block"
          style={{ color: positionColor }}
        >
          {shift.position}
        </span>
      )}

      {/* Row 3: Hours + Break */}
      <div className="flex gap-3 text-xs text-gray-600 mt-2">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {formatHours(hours)}
        </span>
        {shift.breakMinutes > 0 && (
          <span className="flex items-center gap-1">
            <Coffee className="h-3 w-3" />
            {shift.breakMinutes}m
          </span>
        )}
      </div>

      {/* Conflict indicator */}
      {shift.hasConflict && (
        <div className="mt-2">
          <ConflictBadge conflictType={shift.conflictType} showLabel={false} />
        </div>
      )}
    </div>
  );
}
