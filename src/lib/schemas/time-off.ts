import { z } from "zod";
import { startOfDay } from "date-fns";

/**
 * Time-off request types
 */
export const TIME_OFF_TYPES = [
  { value: "UNAVAILABLE", label: "Unavailable", color: "gray" },
] as const;

/**
 * Time-off request statuses
 */
export const TIME_OFF_STATUSES = [
  { value: "PENDING", label: "Pending", color: "yellow" },
  { value: "APPROVED", label: "Approved", color: "green" },
  { value: "REJECTED", label: "Rejected", color: "red" },
  { value: "CANCELLED", label: "Cancelled", color: "gray" },
] as const;

/**
 * Helper function to validate date range
 * Normalizes dates to start of day (UTC) for consistent comparison
 */
export function validateDateRange(startDate: Date, endDate: Date): boolean {
  const normalizedStart = startOfDay(startDate);
  const normalizedEnd = startOfDay(endDate);
  return normalizedEnd >= normalizedStart;
}

/**
 * Helper function to check if dates are in the future
 * Uses UTC midnight for timezone-consistent validation
 */
export function isDateInFuture(date: Date): boolean {
  const today = startOfDay(new Date());
  const normalizedDate = startOfDay(date);
  return normalizedDate >= today;
}

/**
 * Schema for creating a time-off request
 */
export const createTimeOffRequestSchema = z
  .object({
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    type: z.enum(["UNAVAILABLE"]),
    reason: z
      .string()
      .min(10, "Reason must be at least 10 characters")
      .max(500, "Reason must be less than 500 characters")
      .optional(),
  })
  .refine(
    (data) => {
      return validateDateRange(data.startDate, data.endDate);
    },
    {
      message: "End date must be on or after start date",
      path: ["endDate"],
    }
  )
  .refine(
    (data) => {
      return isDateInFuture(data.startDate);
    },
    {
      message: "Start date must be today or in the future",
      path: ["startDate"],
    }
  );

/**
 * Schema for updating a time-off request (staff can only cancel pending requests)
 */
export const updateTimeOffRequestSchema = z.object({
  id: z.string().cuid(),
  status: z.literal("CANCELLED"),
});

/**
 * Schema for reviewing a time-off request (manager/admin)
 */
export const reviewTimeOffRequestSchema = z.object({
  id: z.string().cuid(),
  status: z.enum(["APPROVED", "REJECTED"]),
  notes: z
    .string()
    .max(500, "Notes must be less than 500 characters")
    .optional(),
});

/**
 * Schema for filtering time-off requests
 */
export const filterTimeOffRequestsSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "CANCELLED"]).optional(),
  type: z.enum(["UNAVAILABLE"]).optional(),
  userId: z.string().cuid().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateTimeOffRequestInput = z.infer<typeof createTimeOffRequestSchema>;
export type UpdateTimeOffRequestInput = z.infer<typeof updateTimeOffRequestSchema>;
export type ReviewTimeOffRequestInput = z.infer<typeof reviewTimeOffRequestSchema>;
export type FilterTimeOffRequestsInput = z.infer<typeof filterTimeOffRequestsSchema>;
