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
  CheckCircle,
  XCircle,
  CalendarOff,
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

interface RosterParticipant {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage: string | null;
  role?: { name: string };
}

// Availability status for a staff member on a specific day
interface AvailabilityStatus {
  available: boolean;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

// Time-off entry for a staff member
interface TimeOffEntry {
  id: string;
  startDate: Date;
  endDate: Date;
  type: string;
  status: string;
}

interface VenuePayConfig {
  superRate: number | null;
  superEnabled: boolean;
  defaultWeekdayRate: number | null;
  defaultSaturdayRate: number | null;
  defaultSundayRate: number | null;
  defaultPublicHolidayRate: number | null;
}

interface RosterMatrixViewProps {
  shifts: Shift[];
  weekStart: Date;
  editable?: boolean;
  positionColors?: PositionColor[];
  staffPayRates?: Record<string, StaffPayRates>;
  rosterParticipants?: RosterParticipant[];
  // Phase 3B: Availability overlay
  staffAvailability?: Record<string, Record<string, AvailabilityStatus>>; // userId -> dateKey -> status
  // Phase 3C: Time-off integration
  staffTimeOff?: Record<string, TimeOffEntry[]>; // userId -> time-off entries
  // Phase 6: Permission-based pay display
  canViewPayRates?: boolean; // Only ADMIN/MANAGER can see pay rates
  // Phase 9: Superannuation support
  venuePayConfig?: VenuePayConfig | null;
  // Cost calculation enhancements
  dailyTotals?: Map<string, { hours: number; cost: number }>;
  staffTotals?: Map<string, { hours: number; cost: number }>;
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
  rosterParticipants = [],
  staffAvailability = {},
  staffTimeOff = {},
  canViewPayRates = false,
  venuePayConfig,
  dailyTotals: externalDailyTotals,
  staffTotals: externalStaffTotals,
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

  // Extract unique staff members from roster participants and shifts
  const staffList = useMemo(() => {
    const staffMap = new Map<string, StaffInfo>();
    const unassignedSet = new Set<string>();

    // First, add roster participants (staff explicitly added to roster)
    rosterParticipants.forEach((participant) => {
      staffMap.set(participant.id, {
        id: participant.id,
        name:
          `${participant.firstName || ""} ${participant.lastName || ""}`.trim() ||
          participant.email,
        email: participant.email,
        profileImage: participant.profileImage,
        firstName: participant.firstName,
        lastName: participant.lastName,
        isUnassigned: false,
        originalName: null,
        role: participant.role?.name || null,
      });
    });

    // Then, add/update from shifts (to capture position info and unmatched entries)
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
  }, [shifts, rosterParticipants]);

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

    // Only calculate pay if user has permission to view pay rates
    let totalPay: number | null = null;
    let totalSuper: number | null = null;
    
    if (canViewPayRates && staffPayRates[staffId]) {
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
      
      // Calculate super for this staff member
      // Default superEnabled to true if not explicitly set to false
      const isSuperEnabled = venuePayConfig?.superEnabled !== false;
      if (totalPay !== null && isSuperEnabled) {
        const staffSuperEnabled = (staffPayRates[staffId] as any).superEnabled !== false;
        if (staffSuperEnabled) {
          const effectiveSuperRate = (staffPayRates[staffId] as any).customSuperRate ?? venuePayConfig?.superRate ?? 0.115;
          totalSuper = totalPay * effectiveSuperRate;
        }
      }
    }

    return { hours: totalHours, pay: totalPay, super: totalSuper };
  };

  // Phase 3B: Check if staff is available on a specific date
  const getAvailabilityStatus = (staffId: string, dateKey: string): AvailabilityStatus | null => {
    if (!staffAvailability[staffId]) return null;
    return staffAvailability[staffId][dateKey] || null;
  };

  // Phase 3C: Check if staff has time-off on a specific date
  const getTimeOffStatus = (staffId: string, date: Date): TimeOffEntry | null => {
    if (!staffTimeOff[staffId]) return null;
    const entries = staffTimeOff[staffId];
    for (const entry of entries) {
      const start = new Date(entry.startDate);
      const end = new Date(entry.endDate);
      if (date >= start && date <= end && entry.status === "APPROVED") {
        return entry;
      }
    }
    return null;
  };

  // Calculate daily totals with super breakdown
  const getDailyTotalsWithSuper = (dateKey: string) => {
    const dayShifts = shifts.filter((s) => {
      const shiftDateKey = format(new Date(s.date), "yyyy-MM-dd");
      const hasValidTime = s.startTime && s.endTime &&
        s.startTime !== "-" && s.endTime !== "-" &&
        s.startTime.includes(":") && s.endTime.includes(":");
      return shiftDateKey === dateKey && hasValidTime;
    });

    const totalHours = dayShifts.reduce(
      (sum, s) => sum + calculateShiftHours(s.startTime, s.endTime, s.breakMinutes),
      0
    );

    let totalPay = 0;
    let totalSuper = 0;

    if (canViewPayRates) {
      dayShifts.forEach((shift) => {
        const staffId = shift.user?.id;
        if (staffId && staffPayRates[staffId]) {
          const result = calculateTotalPay(
            [{
              date: new Date(shift.date),
              startTime: shift.startTime,
              endTime: shift.endTime,
              breakMinutes: shift.breakMinutes,
            }],
            staffPayRates[staffId]
          );
          const shiftPay = result.total ?? 0;
          totalPay += shiftPay;

          // Calculate super for this shift
          // Default superEnabled to true if not explicitly set to false
          const isSuperEnabled = venuePayConfig?.superEnabled !== false;
          if (isSuperEnabled) {
            const staffSuperEnabled = (staffPayRates[staffId] as any).superEnabled !== false;
            if (staffSuperEnabled) {
              const effectiveSuperRate = (staffPayRates[staffId] as any).customSuperRate ?? venuePayConfig?.superRate ?? 0.115;
              totalSuper += shiftPay * effectiveSuperRate;
            }
          }
        }
      });
    }

    return { hours: totalHours, pay: totalPay, super: totalSuper };
  };

  // Show empty state if there are no shifts AND no roster participants
  if (shifts.length === 0 && rosterParticipants.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <User className="h-16 w-16 mx-auto mb-6 opacity-50" />
        <p className="text-lg font-medium mb-2">No shifts added yet</p>
        {editable && (
          <>
            <p className="text-sm mb-8 max-w-md mx-auto">
              Create your first shift to get started with this roster. You can add shifts manually or use templates.
            </p>
            <Button
              size="lg"
              className="bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => onAddShift?.(weekDays[0])}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Shift
            </Button>
          </>
        )}
        {!editable && (
          <p className="text-sm mt-4">This roster is currently empty</p>
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
            <div className="grid grid-cols-[220px_repeat(7,1fr)] border-b bg-gradient-to-r from-slate-50 to-slate-100">
              <div className="p-4 font-semibold text-xs text-slate-600 uppercase tracking-wider border-r bg-slate-100">
                Employee
              </div>
              {weekDays.map((day) => {
                const isToday = isSameDay(day, new Date());
                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "p-4 text-center border-r last:border-r-0",
                      isToday && "bg-blue-100"
                    )}
                  >
                    <div className="font-medium text-xs text-slate-500 uppercase tracking-wide">
                      {format(day, "EEE")}
                    </div>
                    <div
                      className={cn(
                        "text-xl font-bold mt-1",
                        isToday
                          ? "bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center mx-auto"
                          : "text-slate-700"
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
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-medium text-gray-600 bg-gray-100 rounded px-1.5 py-0.5">
                          {formatHours(totals.hours)}
                        </span>
                        {totals.pay !== null && (
                          <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 rounded px-1.5 py-0.5">
                            {formatCurrency(totals.pay)}
                            {totals.super !== null && (
                              <span className="text-blue-500 ml-1">
                                +{formatCurrency(totals.super)}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
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

                    // Phase 3B & 3C: Check availability and time-off
                    const availabilityStatus = !staff.isUnassigned ? getAvailabilityStatus(staff.id, dateKey) : null;
                    const timeOffStatus = !staff.isUnassigned ? getTimeOffStatus(staff.id, day) : null;
                    const hasAvailabilityInfo = availabilityStatus !== null;
                    const isAvailable = availabilityStatus?.available ?? true; // Default to available if no data
                    const hasTimeOff = timeOffStatus !== null;

                    return (
                      <DroppableCell
                        key={dateKey}
                        id={cellId}
                        enabled={mounted}
                        className={cn(
                          "bg-slate-50/50 p-2 border-r last:border-r-0 min-h-[120px] relative",
                          isToday && "bg-blue-50/70",
                          editable &&
                            validShifts.length === 0 &&
                            "cursor-pointer hover:bg-slate-100",
                          hasConflicts && "bg-red-50/70",
                          // Phase 3B: Availability coloring
                          hasAvailabilityInfo && !isAvailable && validShifts.length === 0 && "bg-red-50/50",
                          // Phase 3C: Time-off coloring
                          hasTimeOff && "bg-orange-50/70"
                        )}
                        onClick={() =>
                          validShifts.length === 0 && handleCellClick(day, staff)
                        }
                      >
                        {/* Phase 3B & 3C: Availability/Time-off indicator */}
                        {(hasAvailabilityInfo || hasTimeOff) && validShifts.length === 0 && (
                          <div className="absolute top-1 right-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className={cn(
                                  "w-5 h-5 rounded-full flex items-center justify-center",
                                  hasTimeOff ? "bg-orange-200" : isAvailable ? "bg-green-200" : "bg-red-200"
                                )}>
                                  {hasTimeOff ? (
                                    <CalendarOff className="h-3 w-3 text-orange-700" />
                                  ) : isAvailable ? (
                                    <CheckCircle className="h-3 w-3 text-green-700" />
                                  ) : (
                                    <XCircle className="h-3 w-3 text-red-700" />
                                  )}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                {hasTimeOff ? (
                                  <div>
                                    <p className="font-medium">Time-Off: {timeOffStatus?.type}</p>
                                    <p className="text-xs text-muted-foreground">
                                      {format(new Date(timeOffStatus!.startDate), "MMM d")} - {format(new Date(timeOffStatus!.endDate), "MMM d")}
                                    </p>
                                  </div>
                                ) : availabilityStatus ? (
                                  <div>
                                    <p className="font-medium">{isAvailable ? "Available" : "Not Available"}</p>
                                    {availabilityStatus.startTime && availabilityStatus.endTime && (
                                      <p className="text-xs text-muted-foreground">
                                        {availabilityStatus.startTime} - {availabilityStatus.endTime}
                                      </p>
                                    )}
                                    {availabilityStatus.notes && (
                                      <p className="text-xs text-muted-foreground">{availabilityStatus.notes}</p>
                                    )}
                                  </div>
                                ) : null}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        )}

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
                                    showPay={canViewPayRates}
                                    staffPayRates={shift.user?.id ? staffPayRates[shift.user.id] : undefined}
                                    venuePayConfig={venuePayConfig}
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

            {/* Footer row - Daily Totals */}
            {canViewPayRates && (
              <div className="grid grid-cols-[220px_repeat(7,1fr)] border-t-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100">
                <div className="p-4 font-semibold text-xs text-slate-700 uppercase tracking-wider border-r bg-slate-100 flex items-center">
                  <span>Daily Totals</span>
                </div>
                {weekDays.map((day, index) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const dayTotal = getDailyTotalsWithSuper(dateKey);
                  return (
                    <div
                      key={dateKey}
                      className={cn(
                        "p-4 text-center border-r last:border-r-0",
                        "bg-gradient-to-b from-white to-slate-50"
                      )}
                    >
                      <div className="text-base font-bold text-slate-800 mb-1">
                        {formatHours(dayTotal.hours)}
                      </div>
                      <div className="text-sm font-semibold text-emerald-600 bg-emerald-50 rounded-md py-0.5 px-2 inline-block">
                        {formatCurrency(dayTotal.pay)}
                        {dayTotal.super > 0 && (
                          <span className="text-blue-500 ml-1 text-xs">
                            +{formatCurrency(dayTotal.super)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                  showPay={canViewPayRates}
                  staffPayRates={activeShift.user?.id ? staffPayRates[activeShift.user.id] : undefined}
                  venuePayConfig={venuePayConfig}
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
  showPay?: boolean;
  staffPayRates?: StaffPayRates;
  venuePayConfig?: VenuePayConfig | null;
}

function ShiftCard({
  shift,
  positionColor,
  editable,
  onEdit,
  onDelete,
  showPay = false,
  staffPayRates,
  venuePayConfig,
}: ShiftCardProps) {
  const hours = calculateShiftHours(
    shift.startTime,
    shift.endTime,
    shift.breakMinutes
  );

  // Calculate shift pay if rates are available
  const shiftPay = useMemo(() => {
    if (!showPay || !staffPayRates) return null;
    const result = calculateTotalPay(
      [{
        date: new Date(shift.date),
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
      }],
      staffPayRates
    );
    return result.total;
  }, [showPay, staffPayRates, shift.date, shift.startTime, shift.endTime, shift.breakMinutes]);

  // Calculate super amount for this shift
  const shiftSuper = useMemo(() => {
    // Default superEnabled to true if not explicitly set to false
    const isSuperEnabled = venuePayConfig?.superEnabled !== false;
    if (!showPay || !staffPayRates || shiftPay === null || !isSuperEnabled) return null;
    // Get staff-specific super settings from staffPayRates if available
    const staffSuperEnabled = (staffPayRates as any).superEnabled !== false;
    if (!staffSuperEnabled) return null;
    
    // Use staff custom rate or venue default rate
    const effectiveSuperRate = (staffPayRates as any).customSuperRate ?? venuePayConfig?.superRate ?? 0.115;
    
    return shiftPay * effectiveSuperRate;
  }, [showPay, staffPayRates, shiftPay, venuePayConfig]);

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
        "rounded-lg p-3 mb-2 cursor-pointer hover:shadow-md transition-all border-l-4 shadow-sm",
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

      {/* Row 3: Hours + Break + Pay */}
      <div className="flex flex-wrap gap-2 text-xs text-gray-600 mt-2">
        <span className="flex items-center gap-1 bg-white/60 rounded px-1.5 py-0.5">
          <Clock className="h-3 w-3" />
          {formatHours(hours)}
        </span>
        {shift.breakMinutes > 0 && (
          <span className="flex items-center gap-1 bg-white/60 rounded px-1.5 py-0.5">
            <Coffee className="h-3 w-3" />
            {shift.breakMinutes}m
          </span>
        )}
        {shiftPay !== null && (
          <span className="flex items-center gap-1 font-semibold text-emerald-600 bg-emerald-100/80 rounded px-1.5 py-0.5 ml-auto">
            {formatCurrency(shiftPay)}
            {shiftSuper !== null && (
              <span className="text-blue-500 text-[10px] font-normal">
                +{formatCurrency(shiftSuper)} super
              </span>
            )}
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
