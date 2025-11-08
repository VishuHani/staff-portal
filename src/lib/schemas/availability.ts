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
 * Constants for all-day availability
 */
export const ALL_DAY_START = "00:00";
export const ALL_DAY_END = "23:59";

/**
 * Time format validation (HH:MM in 24-hour format)
 */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

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
 * Schema for a single day's availability
 */
export const availabilityDaySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isAvailable: z.boolean(),
  isAllDay: z.boolean(),
  startTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)").nullable(),
  endTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)").nullable(),
});

/**
 * Schema for updating a single day's availability
 */
export const updateAvailabilitySchema = z
  .object({
    dayOfWeek: z.number().min(0).max(6),
    isAvailable: z.boolean(),
    isAllDay: z.boolean(),
    startTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)").nullable(),
    endTime: z.string().regex(timeRegex, "Invalid time format (use HH:MM)").nullable(),
  })
  .refine(
    (data) => {
      // If not available, no need to validate times
      if (!data.isAvailable) {
        return true;
      }

      // If all day, times should be set to all-day values (will be set automatically)
      if (data.isAllDay) {
        return true;
      }

      // If available and not all day, times are required
      if (!data.startTime || !data.endTime) {
        return false;
      }

      // Validate time range
      return validateTimeRange(data.startTime, data.endTime);
    },
    {
      message: "When available (and not all day), valid start and end times are required",
    }
  );

/**
 * Schema for bulk updating availability (multiple days)
 */
export const bulkUpdateAvailabilitySchema = z.object({
  availability: z.array(availabilityDaySchema),
});

export type AvailabilityDayInput = z.infer<typeof availabilityDaySchema>;
export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type BulkUpdateAvailabilityInput = z.infer<typeof bulkUpdateAvailabilitySchema>;
