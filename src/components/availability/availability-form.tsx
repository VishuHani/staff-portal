"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DAYS_OF_WEEK,
  MAX_SLOTS_PER_DAY,
  MIN_SLOT_DURATION_MINUTES,
  validateNoOverlaps,
  getOverlapError,
  type TimeSlot,
} from "@/lib/schemas/availability";
import {
  addAvailabilitySlot,
  removeAvailabilitySlot,
  updateAvailabilitySlot,
} from "@/lib/actions/availability";
import { Loader2, Plus, Trash2, Clock } from "lucide-react";

interface AvailabilityFormProps {
  initialAvailability: Record<number, TimeSlot[]>;
}

export function AvailabilityForm({ initialAvailability }: AvailabilityFormProps) {
  const router = useRouter();
  const [availability, setAvailability] = useState(initialAvailability);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleAddSlot = async (dayOfWeek: number) => {
    setError(null);
    setSuccessMessage(null);

    const existingSlots = availability[dayOfWeek] || [];

    // Check max slots
    if (existingSlots.length >= MAX_SLOTS_PER_DAY) {
      setError(`Maximum ${MAX_SLOTS_PER_DAY} slots allowed per day`);
      return;
    }

    // Add slot with default times (9:00-10:00)
    const startTime = "09:00";
    const endTime = "10:00";

    setIsSubmitting(true);

    const result = await addAvailabilitySlot({
      dayOfWeek,
      startTime,
      endTime,
    });

    setIsSubmitting(false);

    if ("error" in result) {
      setError(result.error || "Failed to add slot");
    } else {
      setSuccessMessage("Slot added successfully!");
      router.refresh();

      // Update local state
      const newSlots = [...existingSlots, result.slot].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );
      setAvailability((prev) => ({
        ...prev,
        [dayOfWeek]: newSlots,
      }));
    }
  };

  const handleRemoveSlot = async (dayOfWeek: number, slotId: string) => {
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    const result = await removeAvailabilitySlot({ slotId });

    setIsSubmitting(false);

    if ("error" in result) {
      setError(result.error || "Failed to remove slot");
    } else {
      setSuccessMessage("Slot removed successfully!");
      router.refresh();

      // Update local state
      const updatedSlots = (availability[dayOfWeek] || []).filter(
        (slot) => slot.id !== slotId
      );
      setAvailability((prev) => ({
        ...prev,
        [dayOfWeek]: updatedSlots,
      }));
    }
  };

  const handleTimeChange = async (
    dayOfWeek: number,
    slotId: string,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setError(null);
    setSuccessMessage(null);

    // Update local state immediately
    const updatedSlots = (availability[dayOfWeek] || []).map((slot) =>
      slot.id === slotId ? { ...slot, [field]: value } : slot
    );

    setAvailability((prev) => ({
      ...prev,
      [dayOfWeek]: updatedSlots,
    }));

    // Find the updated slot
    const updatedSlot = updatedSlots.find((s) => s.id === slotId);
    if (!updatedSlot) return;

    // Debounce the API call
    // For now, we'll validate on blur, not on every keystroke
  };

  const handleSlotBlur = async (dayOfWeek: number, slotId: string) => {
    const slots = availability[dayOfWeek] || [];
    const slot = slots.find((s) => s.id === slotId);

    if (!slot || !slot.startTime || !slot.endTime) return;

    setIsSubmitting(true);

    const result = await updateAvailabilitySlot({
      slotId,
      startTime: slot.startTime,
      endTime: slot.endTime,
    });

    setIsSubmitting(false);

    if ("error" in result) {
      setError(result.error || "Failed to update slot");
      // Refresh to revert changes
      router.refresh();
    } else {
      setSuccessMessage("Slot updated successfully!");

      // Sort slots chronologically
      const sortedSlots = [...slots].sort((a, b) =>
        a.startTime.localeCompare(b.startTime)
      );

      setAvailability((prev) => ({
        ...prev,
        [dayOfWeek]: sortedSlots,
      }));
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-600">
          {successMessage}
        </div>
      )}

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
        <div className="flex items-start gap-2">
          <Clock className="h-5 w-5 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium">Multiple Slots Per Day</p>
            <p className="text-xs mt-1 text-blue-600">
              • Add up to {MAX_SLOTS_PER_DAY} time slots per day<br />
              • Each slot must be at least {MIN_SLOT_DURATION_MINUTES} minutes long<br />
              • Slots cannot overlap<br />
              • Slots are automatically sorted chronologically
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {DAYS_OF_WEEK.map((dayInfo) => {
          const slots = availability[dayInfo.value] || [];
          const hasSlots = slots.length > 0;
          const canAddMore = slots.length < MAX_SLOTS_PER_DAY;

          return (
            <Card key={dayInfo.value}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{dayInfo.label}</CardTitle>
                    {hasSlots ? (
                      <Badge variant="default" className="bg-green-600">
                        {slots.length} slot{slots.length !== 1 ? "s" : ""}
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Unavailable</Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleAddSlot(dayInfo.value)}
                    disabled={!canAddMore || isSubmitting}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Slot
                  </Button>
                </div>
                {!hasSlots && (
                  <CardDescription>
                    Click "Add Slot" to set your availability for this day
                  </CardDescription>
                )}
              </CardHeader>

              {hasSlots && (
                <CardContent>
                  <div className="space-y-3">
                    {slots.map((slot, index) => (
                      <div
                        key={slot.id}
                        className="flex items-end gap-3 p-3 rounded-lg border bg-muted/50"
                      >
                        <div className="flex-1 grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor={`start-${slot.id}`} className="text-xs">
                              Start Time
                            </Label>
                            <Input
                              id={`start-${slot.id}`}
                              type="time"
                              value={slot.startTime}
                              onChange={(e) =>
                                handleTimeChange(
                                  dayInfo.value,
                                  slot.id!,
                                  "startTime",
                                  e.target.value
                                )
                              }
                              onBlur={() => handleSlotBlur(dayInfo.value, slot.id!)}
                              disabled={isSubmitting}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`end-${slot.id}`} className="text-xs">
                              End Time
                            </Label>
                            <Input
                              id={`end-${slot.id}`}
                              type="time"
                              value={slot.endTime}
                              onChange={(e) =>
                                handleTimeChange(
                                  dayInfo.value,
                                  slot.id!,
                                  "endTime",
                                  e.target.value
                                )
                              }
                              onBlur={() => handleSlotBlur(dayInfo.value, slot.id!)}
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          onClick={() => handleRemoveSlot(dayInfo.value, slot.id!)}
                          disabled={isSubmitting}
                          className="flex-shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  {canAddMore && (
                    <div className="mt-3 text-xs text-muted-foreground text-center">
                      You can add {MAX_SLOTS_PER_DAY - slots.length} more slot
                      {MAX_SLOTS_PER_DAY - slots.length !== 1 ? "s" : ""} to this day
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {isSubmitting && (
        <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Processing...
        </div>
      )}
    </div>
  );
}
