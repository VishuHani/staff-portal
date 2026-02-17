"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { format } from "date-fns";
import { CalendarIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { addShift, updateShift, ShiftInput } from "@/lib/actions/rosters";
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

interface ShiftFormProps {
  rosterId: string;
  rosterStartDate: Date;
  rosterEndDate: Date;
  staff: StaffMember[];
  positions?: Position[];
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

  const [formData, setFormData] = useState({
    userId: shift?.userId || null,
    date: shift?.date || rosterStartDate,
    startTime: shift?.startTime || "09:00",
    endTime: shift?.endTime || "17:00",
    breakMinutes: shift?.breakMinutes || 0,
    position: shift?.position || "",
    notes: shift?.notes || "",
  });

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
    }
  }, [shift, open, rosterStartDate, defaultDate, defaultUserId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const shiftData: ShiftInput = {
        userId: formData.userId,
        date: formData.date,
        startTime: formData.startTime,
        endTime: formData.endTime,
        breakMinutes: formData.breakMinutes,
        position: formData.position || undefined,
        notes: formData.notes || undefined,
      };

      let result;
      if (isEditing && shift) {
        result = await updateShift(shift.id, shiftData);
      } else {
        result = await addShift(rosterId, shiftData);
      }

      if (result.success) {
        toast.success(isEditing ? "Shift updated" : "Shift added");
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast.error(result.error || "Failed to save shift");
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

            {/* Date */}
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
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? "Update Shift" : "Add Shift"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
