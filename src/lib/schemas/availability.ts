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
 * Time format validation (HH:MM in 24-hour format)
 */
const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Schema for updating a single day's availability
 */
export const updateAvailabilitySchema = z.object({
  dayOfWeek: z.number().min(0).max(6),
  isAvailable: z.boolean(),
  startTime: z
    .string()
    .regex(timeRegex, "Invalid time format (use HH:MM)")
    .nullable()
    .optional(),
  endTime: z
    .string()
    .regex(timeRegex, "Invalid time format (use HH:MM)")
    .nullable()
    .optional(),
});

/**
 * Schema for bulk updating availability (multiple days)
 */
export const bulkUpdateAvailabilitySchema = z.object({
  availability: z.array(updateAvailabilitySchema),
});

/**
 * Validation to ensure end time is after start time
 */
export function validateTimeRange(startTime: string | null, endTime: string | null): boolean {
  if (!startTime || !endTime) return true;

  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return endMinutes > startMinutes;
}

export type UpdateAvailabilityInput = z.infer<typeof updateAvailabilitySchema>;
export type BulkUpdateAvailabilityInput = z.infer<typeof bulkUpdateAvailabilitySchema>;
