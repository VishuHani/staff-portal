import { z } from "zod";

/**
 * Day of week constants (0 = Sunday, 6 = Saturday)
 */
export const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
] as const;

/**
 * Constants for availability constraints
 */
export const MAX_SLOTS_PER_DAY = 3;
export const MIN_SLOT_DURATION_MINUTES = 60; // 1 hour

/**
 * Time format validation (HH:MM in 24-hour format)
 */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Time slot interface
 */
export interface TimeSlot {
  id?: string;
  startTime: string;
  endTime: string;
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hour, min] = time.split(":").map(Number);
  return hour * 60 + min;
}

/**
 * Validation to ensure end time is after start time
 */
export function validateTimeRange(startTime: string, endTime: string): boolean {
  return timeToMinutes(endTime) > timeToMinutes(startTime);
}

/**
 * Validation to ensure slot is at least minimum duration (1 hour)
 */
export function validateMinimumDuration(startTime: string, endTime: string): boolean {
  const durationMinutes = timeToMinutes(endTime) - timeToMinutes(startTime);
  return durationMinutes >= MIN_SLOT_DURATION_MINUTES;
}

/**
 * Check if two time slots overlap
 */
function slotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
  const start1 = timeToMinutes(slot1.startTime);
  const end1 = timeToMinutes(slot1.endTime);
  const start2 = timeToMinutes(slot2.startTime);
  const end2 = timeToMinutes(slot2.endTime);

  // Slots overlap if one starts before the other ends
  return start1 < end2 && start2 < end1;
}

/**
 * Validation to ensure no overlapping slots
 */
export function validateNoOverlaps(slots: TimeSlot[]): boolean {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Get overlap error message
 */
export function getOverlapError(slots: TimeSlot[]): string | null {
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      if (slotsOverlap(slots[i], slots[j])) {
        return `Time slots overlap: ${slots[i].startTime}-${slots[i].endTime} and ${slots[j].startTime}-${slots[j].endTime}`;
      }
    }
  }
  return null;
}

/**
 * Schema for a single time slot
 */
export const timeSlotSchema = z.object({
  id: z.string().optional(),
  startTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)"),
  endTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)"),
});

/**
 * Schema for adding a new availability slot
 */
export const addAvailabilitySlotSchema = z
  .object({
    dayOfWeek: z.number().min(0).max(6),
    startTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)"),
    endTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)"),
  })
  .refine((data) => validateTimeRange(data.startTime, data.endTime), {
    message: "End time must be after start time",
  })
  .refine((data) => validateMinimumDuration(data.startTime, data.endTime), {
    message: `Minimum slot duration is ${MIN_SLOT_DURATION_MINUTES} minutes (1 hour)`,
  });

/**
 * Schema for updating an existing slot
 */
export const updateAvailabilitySlotSchema = z
  .object({
    slotId: z.string(),
    startTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)"),
    endTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)"),
  })
  .refine((data) => validateTimeRange(data.startTime, data.endTime), {
    message: "End time must be after start time",
  })
  .refine((data) => validateMinimumDuration(data.startTime, data.endTime), {
    message: `Minimum slot duration is ${MIN_SLOT_DURATION_MINUTES} minutes (1 hour)`,
  });

/**
 * Schema for removing a slot
 */
export const removeAvailabilitySlotSchema = z.object({
  slotId: z.string(),
});

/**
 * Schema for bulk updating availability (multiple days with multiple slots each)
 */
export const bulkUpdateAvailabilitySchema = z.object({
  availability: z.record(
    z.string(), // dayOfWeek as string key
    z.array(timeSlotSchema).max(MAX_SLOTS_PER_DAY, `Maximum ${MAX_SLOTS_PER_DAY} slots per day`)
  ),
});

export type TimeSlotInput = z.infer<typeof timeSlotSchema>;
export type AddAvailabilitySlotInput = z.infer<typeof addAvailabilitySlotSchema>;
export type UpdateAvailabilitySlotInput = z.infer<typeof updateAvailabilitySlotSchema>;
export type RemoveAvailabilitySlotInput = z.infer<typeof removeAvailabilitySlotSchema>;
export type BulkUpdateAvailabilityInput = z.infer<typeof bulkUpdateAvailabilitySchema>;
