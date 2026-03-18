"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StaffSelector } from "./staff-selector";
import { format, addDays, startOfWeek, eachDayOfInterval, isSameDay } from "date-fns";
import { CalendarIcon, Loader2, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { addShift, updateShift, bulkAddShifts, ShiftInput } from "@/lib/actions/rosters";
import { calculateShiftHours, calculateBreakMinutes, type BreakRule } from "@/lib/utils/pay-calculator";
import { toast } from "sonner";

interface StaffMember {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  profileImage: string | null;
  role?: { name: string };
}

interface Position {
  id: string;
  name: string;
  color: string;
  active: boolean;
}

interface ShiftTemplate {
  id: string;
  name: string;
  description: string | null;
  color: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  autoCalculateBreak: boolean;
  position: string | null;
  daysOfWeek: number[];
  displayOrder: number;
}

interface ShiftFormProps {
  rosterId: string;
  rosterStartDate: Date;
  rosterEndDate: Date;
  staff: StaffMember[];
  positions?: Position[];
  shiftTemplates?: ShiftTemplate[];
  breakRules?: BreakRule[];
  autoCalculateBreaks?: boolean;
  defaultBreakMinutes?: number;
  shift?: {
    id: string;
    userId: string | null;
    date: Date;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    position: string | null;
    notes: string | null;
  };
  // Default values for new shifts (when clicking + on a specific cell)
  defaultDate?: Date;
  defaultUserId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ShiftForm({
  rosterId,
  rosterStartDate,
  rosterEndDate,
  staff,
  positions = [],
  shiftTemplates = [],
  breakRules = [],
  autoCalculateBreaks = false,
  defaultBreakMinutes = 30,
  shift,
  defaultDate,
  defaultUserId,
  open,
  onOpenChange,
  onSuccess,
}: ShiftFormProps) {
  // Filter to only active positions
  const activePositions = positions.filter((p) => p.active);
  const isEditing = !!shift;
  const [isLoading, setIsLoading] = useState(false);
  const [applyToMultipleDays, setApplyToMultipleDays] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]); // 0=Sun, 1=Mon, ..., 6=Sat
  const [autoBreakEnabled, setAutoBreakEnabled] = useState(autoCalculateBreaks);

  const [formData, setFormData] = useState({
    userId: shift?.userId || null,
    date: shift?.date || rosterStartDate,
    startTime: shift?.startTime || "09:00",
    endTime: shift?.endTime || "17:00",
    breakMinutes: shift?.breakMinutes || 0,
    position: shift?.position || "",
    notes: shift?.notes || "",
  });

  // Get all days in the roster period for multi-day selection
  const rosterDays = eachDayOfInterval({ start: rosterStartDate, end: rosterEndDate });
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const toggleDay = (dayIndex: number) => {
    setSelectedDays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  // Default shift templates (used if no venue templates provided)
  const defaultShiftTemplates = [
    { name: "Morning Shift", startTime: "06:00", endTime: "14:00", breakMinutes: 30 },
    { name: "Day Shift", startTime: "09:00", endTime: "17:00", breakMinutes: 30 },
    { name: "Afternoon Shift", startTime: "12:00", endTime: "20:00", breakMinutes: 30 },
    { name: "Evening Shift", startTime: "16:00", endTime: "23:00", breakMinutes: 30 },
    { name: "Night Shift", startTime: "22:00", endTime: "06:00", breakMinutes: 30 },
  ];

  // Use venue templates if provided, otherwise use defaults
  const templates = shiftTemplates.length > 0 ? shiftTemplates : defaultShiftTemplates;

  // Auto-calculate break when times change
  useEffect(() => {
    if (autoBreakEnabled && formData.startTime && formData.endTime) {
      const hours = calculateShiftHours(formData.startTime, formData.endTime, 0);
      const calculatedBreak = calculateBreakMinutes(hours, breakRules, defaultBreakMinutes);
      setFormData(prev => ({ ...prev, breakMinutes: calculatedBreak }));
    }
  }, [formData.startTime, formData.endTime, autoBreakEnabled, breakRules, defaultBreakMinutes]);

  const applyTemplate = (template: typeof templates[0]) => {
    const newFormData = {
      ...formData,
      startTime: template.startTime,
      endTime: template.endTime,
      breakMinutes: template.breakMinutes,
    };
    
    // If auto-break is enabled, recalculate based on shift duration
    if (autoBreakEnabled) {
      const hours = calculateShiftHours(template.startTime, template.endTime, 0);
      const calculatedBreak = calculateBreakMinutes(hours, breakRules, defaultBreakMinutes);
      newFormData.breakMinutes = calculatedBreak;
    }
    
    setFormData(newFormData);
  };

  // Reset form data when shift prop changes or dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        userId: shift?.userId || defaultUserId || null,
        date: shift?.date || defaultDate || rosterStartDate,
        startTime: shift?.startTime || "09:00",
        endTime: shift?.endTime || "17:00",
        breakMinutes: shift?.breakMinutes || 0,
        position: shift?.position || "",
        notes: shift?.notes || "",
      });
      setApplyToMultipleDays(false);
      setSelectedDays([]);
    }
  }, [shift, open, rosterStartDate, defaultDate, defaultUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isEditing && shift) {
        // Update existing shift
        const shiftData: ShiftInput = {
          userId: formData.userId,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          breakMinutes: formData.breakMinutes,
          position: formData.position || undefined,
          notes: formData.notes || undefined,
        };
        const result = await updateShift(shift.id, shiftData);
        if (result.success) {
          toast.success("Shift updated");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(result.error || "Failed to save shift");
        }
      } else if (applyToMultipleDays && selectedDays.length > 0) {
        // Bulk create shifts for multiple days
        const datesToCreate = rosterDays.filter((day) =>
          selectedDays.includes(day.getDay())
        );

        if (datesToCreate.length === 0) {
          toast.error("No matching days found in the roster period");
          setIsLoading(false);
          return;
        }

        const shifts: ShiftInput[] = datesToCreate.map((date) => ({
          userId: formData.userId,
          date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          breakMinutes: formData.breakMinutes,
          position: formData.position || undefined,
          notes: formData.notes || undefined,
        }));

        const result = await bulkAddShifts(rosterId, shifts);
        if (result.success) {
          toast.success(`${result.count} shifts added across ${datesToCreate.length} days`);
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(result.error || "Failed to add shifts");
        }
      } else {
        // Single shift creation
        const shiftData: ShiftInput = {
          userId: formData.userId,
          date: formData.date,
          startTime: formData.startTime,
          endTime: formData.endTime,
          breakMinutes: formData.breakMinutes,
          position: formData.position || undefined,
          notes: formData.notes || undefined,
        };
        const result = await addShift(rosterId, shiftData);
        if (result.success) {
          toast.success("Shift added");
          onOpenChange(false);
          onSuccess?.();
        } else {
          toast.error(result.error || "Failed to save shift");
        }
      }
    } catch (error) {
      console.error("Error saving shift:", error);
      toast.error("An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit Shift" : "Add Shift"}</DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update the shift details below."
                : "Add a new shift to this roster."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Staff Selection */}
            <div className="space-y-2">
              <Label htmlFor="staff">Staff Member</Label>
              <StaffSelector
                staff={staff}
                value={formData.userId}
                onValueChange={(value) =>
                  setFormData({ ...formData, userId: value })
                }
                placeholder="Select staff member"
              />
            </div>

            {/* Date / Multi-day selection */}
            {!isEditing && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="multiDay"
                  checked={applyToMultipleDays}
                  onCheckedChange={(checked) => setApplyToMultipleDays(checked === true)}
                />
                <Label htmlFor="multiDay" className="text-sm font-normal cursor-pointer">
                  <Copy className="h-3.5 w-3.5 inline mr-1" />
                  Apply to multiple days
                </Label>
              </div>
            )}

            {applyToMultipleDays && !isEditing ? (
              <div className="space-y-2">
                <Label>Select Days</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => (
                    <Button
                      key={dayIndex}
                      type="button"
                      variant={selectedDays.includes(dayIndex) ? "default" : "outline"}
                      size="sm"
                      className="h-9 w-11 p-0 text-xs"
                      onClick={() => toggleDay(dayIndex)}
                    >
                      {dayNames[dayIndex]}
                    </Button>
                  ))}
                </div>
                {selectedDays.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Will create {rosterDays.filter((d) => selectedDays.includes(d.getDay())).length} shifts
                    ({selectedDays.map((d) => dayNames[d]).join(", ")})
                  </p>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedDays([1, 2, 3, 4, 5])}
                  >
                    Weekdays
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedDays([0, 6])}
                  >
                    Weekends
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => setSelectedDays([0, 1, 2, 3, 4, 5, 6])}
                  >
                    All Days
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !formData.date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.date ? format(formData.date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={formData.date}
                      onSelect={(date) =>
                        date && setFormData({ ...formData, date })
                      }
                      disabled={(date) =>
                        date < rosterStartDate || date > rosterEndDate
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            {/* Time Templates */}
            {!isEditing && (
              <div className="space-y-2">
                <Label>Quick Templates</Label>
                <div className="grid grid-cols-2 gap-2">
                  {templates.map((template) => (
                    <Button
                      key={template.name}
                      variant="outline"
                      size="sm"
                      onClick={() => applyTemplate(template)}
                      className="text-xs h-8"
                    >
                      {template.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Time */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={formData.startTime}
                  onChange={(e) =>
                    setFormData({ ...formData, startTime: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={formData.endTime}
                  onChange={(e) =>
                    setFormData({ ...formData, endTime: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Break */}
            <div className="space-y-2">
              <Label htmlFor="break">Break (minutes)</Label>
              <Input
                id="break"
                type="number"
                min={0}
                max={120}
                value={formData.breakMinutes}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    breakMinutes: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>

            {/* Position */}
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              {activePositions.length > 0 ? (
                <Select
                  value={formData.position || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      position: value === "none" ? "" : value,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position">
                      {formData.position ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{
                              backgroundColor: activePositions.find(
                                (p) => p.name === formData.position
                              )?.color,
                            }}
                          />
                          {formData.position}
                        </div>
                      ) : (
                        "Select position"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No position</SelectItem>
                    {activePositions.map((position) => (
                      <SelectItem key={position.id} value={position.name}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: position.color }}
                          />
                          {position.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="position"
                  placeholder="e.g., Bar, Floor, Kitchen"
                  value={formData.position}
                  onChange={(e) =>
                    setFormData({ ...formData, position: e.target.value })
                  }
                />
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any additional notes..."
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || (applyToMultipleDays && !isEditing && selectedDays.length === 0)}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing
                ? "Update Shift"
                : applyToMultipleDays && selectedDays.length > 0
                  ? `Add ${rosterDays.filter((d) => selectedDays.includes(d.getDay())).length} Shifts`
                  : "Add Shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
