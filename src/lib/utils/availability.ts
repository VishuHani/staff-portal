import {
  eachDayOfInterval,
  getDay,
  isWithinInterval,
} from "date-fns";

/**
 * Availability computation utilities
 * Shared logic for calculating staff availability across date ranges
 */

export interface AvailabilityStatus {
  available: boolean;
  isAllDay?: boolean;
  startTime?: string;
  endTime?: string;
  reason?: string;
  timeOffId?: string;
}

/**
 * Convert time string (HH:mm) to minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Check if two time slots overlap
 */
function checkTimeSlotOverlap(
  availStart: string,
  availEnd: string,
  filterStart: string,
  filterEnd: string
): boolean {
  const as = timeToMinutes(availStart);
  const ae = timeToMinutes(availEnd);
  const fs = timeToMinutes(filterStart);
  const fe = timeToMinutes(filterEnd);

  // Check overlap: start before filter end AND end after filter start
  return as < fe && ae > fs;
}

/**
 * Compute effective availability for a user across a date range
 * Combines recurring availability with time-off overrides
 */
export function computeEffectiveAvailability(
  user: any,
  startDate: Date,
  endDate: Date,
  timeSlotFilter?: { start: string; end: string }
): Record<string, AvailabilityStatus> {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  const result: Record<string, AvailabilityStatus> = {};

  for (const date of dates) {
    const dateStr = date.toISOString();
    const dayOfWeek = getDay(date); // 0 (Sunday) - 6 (Saturday)

    // Get recurring availability for this day of week
    const recurring = user.availability.find(
      (a: any) => a.dayOfWeek === dayOfWeek
    );

    // Check if user has approved time-off on this date
    const timeOff = user.timeOffRequests.find(
      (to: any) =>
        to.status === "APPROVED" &&
        isWithinInterval(date, { start: to.startDate, end: to.endDate })
    );

    // Time-off overrides recurring availability
    if (timeOff) {
      result[dateStr] = {
        available: false,
        reason: "Time Off",
        timeOffId: timeOff.id,
      };
      continue;
    }

    // Not available if no recurring schedule or marked unavailable
    if (!recurring || !recurring.isAvailable) {
      result[dateStr] = {
        available: false,
        reason: "Not Available",
      };
      continue;
    }

    // Check time slot filter if provided
    if (timeSlotFilter && !recurring.isAllDay) {
      const overlaps = checkTimeSlotOverlap(
        recurring.startTime,
        recurring.endTime,
        timeSlotFilter.start,
        timeSlotFilter.end
      );

      if (!overlaps) {
        result[dateStr] = {
          available: false,
          reason: "Not Available During Time Slot",
        };
        continue;
      }
    }

    // Available!
    result[dateStr] = {
      available: true,
      isAllDay: recurring.isAllDay,
      startTime: recurring.startTime || undefined,
      endTime: recurring.endTime || undefined,
    };
  }

  return result;
}
