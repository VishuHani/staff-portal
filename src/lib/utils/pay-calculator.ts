/**
 * Pay Calculator Utilities
 * Calculate shift pay based on hourly rates and day type
 */

import { Decimal } from "@prisma/client/runtime/library";

export interface ShiftPayInput {
  date: Date;
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  breakMinutes: number;
}

export interface StaffPayRates {
  weekdayRate: Decimal | number | null | unknown;
  saturdayRate: Decimal | number | null | unknown;
  sundayRate: Decimal | number | null | unknown;
}

/**
 * Convert Decimal to number safely
 */
function toNumber(value: Decimal | number | null | unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as Decimal).toNumber();
  }
  return null;
}

/**
 * Check if a time string is valid (HH:mm format)
 */
function isValidTime(time: string): boolean {
  if (!time || typeof time !== "string") return false;
  if (time === "-" || time === "") return false;
  const parts = time.split(":");
  if (parts.length !== 2) return false;
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  return !isNaN(hour) && !isNaN(minute) && hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

/**
 * Calculate shift duration in hours
 */
export function calculateShiftHours(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): number {
  // Return 0 for invalid times
  if (!isValidTime(startTime) || !isValidTime(endTime)) {
    return 0;
  }

  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);

  let totalMinutes = endH * 60 + endM - (startH * 60 + startM);

  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }

  const workMinutes = totalMinutes - breakMinutes;
  return Math.max(0, workMinutes / 60);
}

/**
 * Get the applicable pay rate for a given date
 * Sunday = 0, Saturday = 6, Weekday = 1-5
 */
export function getApplicableRate(
  date: Date,
  rates: StaffPayRates
): number | null {
  const dayOfWeek = new Date(date).getDay();

  if (dayOfWeek === 0) {
    return toNumber(rates.sundayRate);
  }
  if (dayOfWeek === 6) {
    return toNumber(rates.saturdayRate);
  }
  return toNumber(rates.weekdayRate);
}

/**
 * Calculate pay for a single shift
 */
export function calculateShiftPay(
  shift: ShiftPayInput,
  rates: StaffPayRates
): number | null {
  const rate = getApplicableRate(shift.date, rates);

  if (rate === null) return null;

  const hours = calculateShiftHours(
    shift.startTime,
    shift.endTime,
    shift.breakMinutes
  );

  return Math.round(hours * rate * 100) / 100; // Round to 2 decimal places
}

/**
 * Calculate total pay for multiple shifts
 */
export function calculateTotalPay(
  shifts: ShiftPayInput[],
  rates: StaffPayRates
): { total: number | null; breakdown: { hours: number; pay: number | null }[] } {
  const breakdown = shifts.map((shift) => ({
    hours: calculateShiftHours(
      shift.startTime,
      shift.endTime,
      shift.breakMinutes
    ),
    pay: calculateShiftPay(shift, rates),
  }));

  // If any shift has null pay (no rate), return null for total
  if (breakdown.some((b) => b.pay === null)) {
    const totalHours = breakdown.reduce((sum, b) => sum + b.hours, 0);
    return { total: null, breakdown };
  }

  const total = breakdown.reduce((sum, b) => sum + (b.pay || 0), 0);
  return { total: Math.round(total * 100) / 100, breakdown };
}

/**
 * Calculate total hours for multiple shifts
 */
export function calculateTotalHours(shifts: ShiftPayInput[]): number {
  return shifts.reduce(
    (sum, shift) =>
      sum +
      calculateShiftHours(shift.startTime, shift.endTime, shift.breakMinutes),
    0
  );
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number | null): string {
  if (amount === null) return "N/A";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format hours for display (e.g., "22.5h")
 */
export function formatHours(hours: number): string {
  if (isNaN(hours) || hours === 0) return "0h";
  if (hours % 1 === 0) return `${hours}h`;
  return `${hours.toFixed(1)}h`;
}

/**
 * Convert 24-hour time to 12-hour format (e.g., "07:00" -> "7am")
 */
export function formatTime12Hour(time: string): string {
  if (!time || typeof time !== "string") return time || "";

  const parts = time.split(":");
  const hour = Number(parts[0]) || 0;
  const minute = Number(parts[1]) || 0;

  const period = hour >= 12 ? "pm" : "am";
  const displayHour = hour % 12 || 12;

  if (minute === 0) {
    return `${displayHour}${period}`;
  }
  return `${displayHour}:${minute.toString().padStart(2, "0")}${period}`;
}

/**
 * Format time range (e.g., "7am - 3pm")
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTime12Hour(startTime)} - ${formatTime12Hour(endTime)}`;
}
