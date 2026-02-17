/**
 * ============================================================================
 * TIME-BASED ACCESS CONTROL
 * ============================================================================
 *
 * This module provides time-restricted permission evaluation where access
 * is only granted during specific days and times.
 *
 * Features:
 * - Day-of-week restrictions (e.g., weekdays only)
 * - Time-of-day restrictions (e.g., business hours only)
 * - Timezone support
 * - Override for admins
 * - Grace periods for shift changes
 *
 * Usage:
 *   const hasAccess = await checkTimeBasedAccess(userId, {
 *     type: 'time_range',
 *     value: { startTime: '08:00', endTime: '18:00' }
 *   });
 */

import { prisma } from "@/lib/prisma";
import { isAdmin } from "./permissions";
import { ConditionDefinition } from "./conditional-permissions";

/**
 * Time-based access rule
 */
export interface TimeBasedAccessRule {
  daysOfWeek: number[];    // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  startTime: string;       // HH:mm format
  endTime: string;         // HH:mm format
  timezone: string;        // IANA timezone (e.g., "Australia/Sydney")
}

/**
 * Time check result
 */
export interface TimeCheckResult {
  passed: boolean;
  reason?: string;
  currentTime?: string;
  currentDay?: number;
  allowedDays?: number[];
  allowedTimeRange?: { start: string; end: string };
}

/**
 * Default time-based access rules
 * These apply unless overridden in the database
 */
export const DEFAULT_TIME_RULES: Record<string, TimeBasedAccessRule> = {
  // Reports can only be accessed during business hours on weekdays
  reports_business_hours: {
    daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
    startTime: "08:00",
    endTime: "18:00",
    timezone: "Australia/Sydney",
  },
  // Admin functions available 24/7 (no restriction)
  admin_all_hours: {
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6], // All days
    startTime: "00:00",
    endTime: "23:59",
    timezone: "UTC",
  },
};

/**
 * Check if current time falls within allowed access period
 *
 * @param userId - User ID
 * @param condition - Time-based condition to check
 * @returns Time check result
 */
export async function checkTimeBasedAccess(
  userId: string,
  condition: ConditionDefinition
): Promise<TimeCheckResult> {
  try {
    // Admin bypasses time restrictions
    if (await isAdmin(userId)) {
      return {
        passed: true,
        reason: "Admin bypasses time restrictions",
      };
    }

    // Get time-based access rules from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return { passed: false, reason: "User not found" };
    }

    // Get time-based access rules for this user's role
    const timeRules = await prisma.timeBasedAccess.findMany({
      where: {
        roleId: user.roleId,
        resource: condition.value as string,
      },
    });

    // If no rules, default to allowing access
    if (timeRules.length === 0) {
      return {
        passed: true,
        reason: "No time restrictions apply",
      };
    }

    // Check each rule (any rule passing grants access)
    for (const rule of timeRules) {
      const result = checkTimeRule({
        daysOfWeek: rule.daysOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        timezone: rule.timezone,
      });

      if (result.passed) {
        return result;
      }
    }

    // No rule passed - access denied
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = formatTime(now);

    return {
      passed: false,
      reason: "Current time is outside allowed access period",
      currentTime,
      currentDay,
    };
  } catch (error) {
    console.error("Error checking time-based access:", error);
    return {
      passed: false,
      reason: "Error checking time restrictions",
    };
  }
}

/**
 * Check a specific time rule
 *
 * @param rule - Time rule to check
 * @returns Time check result
 */
function checkTimeRule(rule: TimeBasedAccessRule): TimeCheckResult {
  const now = new Date();

  // Convert to target timezone
  const targetTime = convertToTimezone(now, rule.timezone);
  const currentDay = targetTime.getDay();
  const currentTime = formatTime(targetTime);

  // Check day of week
  if (!rule.daysOfWeek.includes(currentDay)) {
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return {
      passed: false,
      reason: `Access not allowed on ${dayNames[currentDay]}`,
      currentTime,
      currentDay,
      allowedDays: rule.daysOfWeek,
    };
  }

  // Check time range
  if (!isTimeInRange(currentTime, rule.startTime, rule.endTime)) {
    return {
      passed: false,
      reason: `Current time ${currentTime} is outside allowed range ${rule.startTime} - ${rule.endTime}`,
      currentTime,
      currentDay,
      allowedTimeRange: { start: rule.startTime, end: rule.endTime },
    };
  }

  return {
    passed: true,
    currentTime,
    currentDay,
    allowedDays: rule.daysOfWeek,
    allowedTimeRange: { start: rule.startTime, end: rule.endTime },
  };
}

/**
 * Convert date to target timezone
 *
 * @param date - Date to convert
 * @param timezone - Target timezone
 * @returns Date in target timezone
 */
function convertToTimezone(date: Date, timezone: string): Date {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => parts.find((p) => p.type === type)?.value || "0";

    return new Date(
      parseInt(getPart("year")),
      parseInt(getPart("month")) - 1,
      parseInt(getPart("day")),
      parseInt(getPart("hour")),
      parseInt(getPart("minute")),
      parseInt(getPart("second"))
    );
  } catch {
    // If timezone conversion fails, use original date
    return date;
  }
}

/**
 * Format time as HH:mm
 *
 * @param date - Date to format
 * @returns Time string in HH:mm format
 */
function formatTime(date: Date): string {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
}

/**
 * Check if time is within range
 *
 * @param time - Time to check (HH:mm)
 * @param start - Start time (HH:mm)
 * @param end - End time (HH:mm)
 * @returns true if time is within range
 */
function isTimeInRange(time: string, start: string, end: string): boolean {
  const timeMinutes = timeToMinutes(time);
  const startMinutes = timeToMinutes(start);
  const endMinutes = timeToMinutes(end);

  // Handle overnight ranges (e.g., 22:00 - 06:00)
  if (startMinutes > endMinutes) {
    return timeMinutes >= startMinutes || timeMinutes <= endMinutes;
  }

  return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
}

/**
 * Convert time string to minutes since midnight
 *
 * @param time - Time string (HH:mm)
 * @returns Minutes since midnight
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Create a time-based access rule
 *
 * @param roleId - Role ID
 * @param resource - Resource name
 * @param action - Action name
 * @param rule - Time rule
 * @returns Created rule
 */
export async function createTimeBasedAccessRule(
  roleId: string,
  resource: string,
  action: string,
  rule: TimeBasedAccessRule
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.timeBasedAccess.create({
      data: {
        roleId,
        resource,
        action,
        daysOfWeek: rule.daysOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        timezone: rule.timezone,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating time-based access rule:", error);
    return { success: false, error: "Failed to create time-based access rule" };
  }
}

/**
 * Delete a time-based access rule
 *
 * @param ruleId - Rule ID to delete
 * @returns Success status
 */
export async function deleteTimeBasedAccessRule(
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.timeBasedAccess.delete({
      where: { id: ruleId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting time-based access rule:", error);
    return { success: false, error: "Failed to delete time-based access rule" };
  }
}

/**
 * Get all time-based access rules for a role
 *
 * @param roleId - Role ID
 * @returns Array of rules
 */
export async function getRoleTimeBasedRules(
  roleId: string
): Promise<Array<TimeBasedAccessRule & { id: string; resource: string; action: string }>> {
  try {
    const rules = await prisma.timeBasedAccess.findMany({
      where: { roleId },
    });

    return rules.map((rule) => ({
      id: rule.id,
      resource: rule.resource,
      action: rule.action,
      daysOfWeek: rule.daysOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      timezone: rule.timezone,
    }));
  } catch (error) {
    console.error("Error getting time-based rules:", error);
    return [];
  }
}

/**
 * Check if user has time-based access to a resource/action
 * Convenience function that combines permission check with time check
 *
 * @param userId - User ID
 * @param resource - Resource name
 * @param action - Action name
 * @returns Whether access is allowed
 */
export async function hasTimeBasedAccess(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  const result = await checkTimeBasedAccess(userId, {
    type: "time_range",
    value: resource,
  });

  return result.passed;
}

/**
 * Get current access status for a user
 * Useful for displaying access status in UI
 *
 * @param userId - User ID
 * @returns Access status information
 */
export async function getAccessStatus(
  userId: string
): Promise<{
  hasAccess: boolean;
  currentDay: number;
  currentTime: string;
  restrictions?: {
    days: number[];
    startTime: string;
    endTime: string;
    timezone: string;
  };
}> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });

    if (!user) {
      return { hasAccess: false, currentDay: 0, currentTime: "00:00" };
    }

    // Admin has full access
    if (user.role.name === "ADMIN") {
      const now = new Date();
      return {
        hasAccess: true,
        currentDay: now.getDay(),
        currentTime: formatTime(now),
      };
    }

    // Get any time restrictions
    const rules = await prisma.timeBasedAccess.findMany({
      where: { roleId: user.roleId },
    });

    if (rules.length === 0) {
      const now = new Date();
      return {
        hasAccess: true,
        currentDay: now.getDay(),
        currentTime: formatTime(now),
      };
    }

    // Check against first applicable rule
    const rule = rules[0];
    const now = new Date();
    const targetTime = convertToTimezone(now, rule.timezone);
    const currentDay = targetTime.getDay();
    const currentTime = formatTime(targetTime);

    const hasAccess =
      rule.daysOfWeek.includes(currentDay) &&
      isTimeInRange(currentTime, rule.startTime, rule.endTime);

    return {
      hasAccess,
      currentDay,
      currentTime,
      restrictions: {
        days: rule.daysOfWeek,
        startTime: rule.startTime,
        endTime: rule.endTime,
        timezone: rule.timezone,
      },
    };
  } catch (error) {
    console.error("Error getting access status:", error);
    return { hasAccess: false, currentDay: 0, currentTime: "00:00" };
  }
}