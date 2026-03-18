/**
 * Roster Validation Service Wrapper
 *
 * This service wraps the existing validation-engine.ts for use in server actions
 * and provides shift conflict detection, availability checks, and business rule validation.
 *
 * Note: This is NOT a server actions file - it's a service module that can be imported
 * by server actions. The validation functions are pure and can be used anywhere.
 */

import { prisma } from "@/lib/prisma";
import {
  validateRosterShifts,
  validateSchema,
  validateTemporal,
  validateBusinessRules,
  validateConflicts,
  validateStaffMatch,
  DEFAULT_VALIDATION_CONFIG,
  type ValidationConfig,
  type ValidationIssue,
  type ValidationSeverity,
  type ValidationStage,
  type ShiftForValidation,
  type StaffForMember,
  type ValidationContext,
  type ValidationResult,
} from "./validation-engine";

// Re-export types for consumers
export type {
  ValidationConfig,
  ValidationIssue,
  ValidationSeverity,
  ValidationStage,
  ShiftForValidation,
  StaffForMember,
  ValidationContext,
  ValidationResult,
} from "./validation-engine";
import { RosterStatus } from "@prisma/client";

// ============================================================================
// TYPES
// ============================================================================

export interface RosterValidationResult extends ValidationResult {
  // Inherits from ValidationResult
}

export interface ShiftValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export interface BulkShiftValidationResult {
  valid: boolean;
  issuesByShift: Map<number, ValidationIssue[]>;
  allIssues: ValidationIssue[];
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get validation configuration for a venue
 * Falls back to default config if not found
 */
export async function getValidationConfig(venueId: string): Promise<ValidationConfig> {
  try {
    // For now, return default config
    // In the future, venues could have custom validation config stored
    return DEFAULT_VALIDATION_CONFIG;
  } catch (error) {
    console.error("Error fetching validation config:", error);
    return DEFAULT_VALIDATION_CONFIG;
  }
}

// ============================================================================
// SHIFT VALIDATION
// ============================================================================

/**
 * Validate a single shift before adding/updating
 */
export async function validateShiftBeforeAdd(
  rosterId: string,
  shiftData: {
    userId?: string | null;
    date: Date;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    position?: string;
  },
  excludeShiftId?: string
): Promise<ShiftValidationResult> {
  try {
    // Get roster with venue info
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        venue: { 
          select: { 
            id: true, 
            businessHoursStart: true, 
            businessHoursEnd: true 
          } 
        },
        shifts: {
          where: excludeShiftId ? { id: { not: excludeShiftId } } : undefined,
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!roster) {
      return {
        valid: false,
        issues: [{
          id: "roster-not-found",
          stage: "schema",
          severity: "blocking",
          code: "ROSTER_NOT_FOUND",
          message: "Roster not found",
        }],
      };
    }

    const config = await getValidationConfig(roster.venueId);

    // Create shift for validation
    const shiftForValidation: ShiftForValidation = {
      id: excludeShiftId || "new-shift",
      rowIndex: 0,
      staffName: "",
      staffId: shiftData.userId,
      date: shiftData.date.toISOString().split("T")[0],
      startTime: shiftData.startTime,
      endTime: shiftData.endTime,
      break: (shiftData.breakMinutes ?? 0) > 0,
      position: shiftData.position,
      included: true,
    };

    // Get staff name if userId provided
    if (shiftData.userId) {
      const user = await prisma.user.findUnique({
        where: { id: shiftData.userId },
        select: { firstName: true, lastName: true, email: true },
      });
      if (user) {
        shiftForValidation.staffName = `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown";
      }
    }

    // Schema validation
    const schemaIssues = validateSchema([shiftForValidation], config);
    const issues = [...schemaIssues];

    // Temporal validation
    if (!schemaIssues.some((i: ValidationIssue) => i.severity === "blocking")) {
      const temporalIssues = validateTemporal([shiftForValidation], config);
      issues.push(...temporalIssues);
    }

    // Check for conflicts if userId is assigned
    if (shiftData.userId) {
      const conflictIssues = await validateShiftConflicts(
        shiftData.userId,
        shiftData.date,
        shiftData.startTime,
        shiftData.endTime,
        rosterId,
        excludeShiftId,
        config
      );
      issues.push(...conflictIssues);
      
      // Also check for cross-venue conflicts
      const crossVenueIssues = await validateCrossVenueConflictForShift(
        shiftData.userId,
        shiftData.date,
        shiftData.startTime,
        shiftData.endTime,
        rosterId,
        roster.venueId
      );
      issues.push(...crossVenueIssues);
    }

    // Business rules validation
    if (shiftData.userId) {
      const businessIssues = await validateBusinessRulesForShift(
        rosterId,
        shiftData.userId,
        shiftData.date,
        shiftData.startTime,
        shiftData.endTime,
        config
      );
      issues.push(...businessIssues);
    }

    const blockingCount = issues.filter((i: ValidationIssue) => i.severity === "blocking").length;

    return {
      valid: blockingCount === 0,
      issues,
    };
  } catch (error) {
    console.error("Error validating shift:", error);
    return {
      valid: false,
      issues: [{
        id: "validation-error",
        stage: "schema",
        severity: "blocking",
        code: "VALIDATION_ERROR",
        message: "Failed to validate shift",
      }],
    };
  }
}

// ============================================================================
// BULK SHIFT VALIDATION
// ============================================================================

/**
 * Validate multiple shifts before bulk adding
 */
export async function validateBulkShifts(
  rosterId: string,
  shifts: Array<{
    userId?: string | null;
    date: Date;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    position?: string;
  }>
): Promise<BulkShiftValidationResult> {
  const issuesByShift = new Map<number, ValidationIssue[]>();
  const allIssues: ValidationIssue[] = [];

  try {
    if (shifts.length === 0) {
      return {
        valid: true,
        issuesByShift,
        allIssues,
      };
    }

    // Get roster with venue info
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        venue: { 
          select: { 
            id: true, 
            businessHoursStart: true, 
            businessHoursEnd: true 
          } 
        },
      },
    });

    if (!roster) {
      const issue: ValidationIssue = {
        id: "roster-not-found",
        stage: "schema",
        severity: "blocking",
        code: "ROSTER_NOT_FOUND",
        message: "Roster not found",
      };
      return {
        valid: false,
        issuesByShift: new Map([[0, [issue]]]),
        allIssues: [issue],
      };
    }

    // Process each shift
    for (let i = 0; i < shifts.length; i++) {
      const shift = shifts[i];
      const result = await validateShiftBeforeAdd(rosterId, shift, undefined);
      
      if (result.issues.length > 0) {
        issuesByShift.set(i, result.issues);
        allIssues.push(...result.issues);
      }
    }

    const blockingCount = allIssues.filter((i: ValidationIssue) => i.severity === "blocking").length;

    return {
      valid: blockingCount === 0,
      issuesByShift,
      allIssues,
    };
  } catch (error) {
    console.error("Error validating bulk shifts:", error);
    return {
      valid: false,
      issuesByShift,
      allIssues,
    };
  }
}

// ============================================================================
// ROSTER VALIDATION
// ============================================================================

/**
 * Validate an entire roster before finalizing/publishing
 */
export async function validateRosterForPublish(rosterId: string): Promise<RosterValidationResult> {
  try {
    // Get roster with all shifts and staff
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      include: {
        venue: { select: { id: true, name: true } },
        shifts: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!roster) {
      return {
        valid: false,
        hasBlockingErrors: true,
        issues: [{
          id: "roster-not-found",
          stage: "schema",
          severity: "blocking",
          code: "ROSTER_NOT_FOUND",
          message: "Roster not found",
        }],
        summary: {
          total: 1,
          blocking: 1,
          warnings: 0,
          info: 0,
          byStage: { schema: 1, temporal: 0, business_rule: 0, conflict: 0, staff_match: 0 },
        },
      };
    }

    const config = await getValidationConfig(roster.venueId);

    // Convert shifts to validation format
    const shiftsForValidation: ShiftForValidation[] = roster.shifts.map((shift, index) => ({
      id: shift.id,
      rowIndex: index,
      staffName: shift.user
        ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email
        : "Unassigned",
      staffId: shift.userId,
      date: shift.date.toISOString().split("T")[0],
      startTime: shift.startTime,
      endTime: shift.endTime,
      break: (shift.breakMinutes ?? 0) > 0,
      position: shift.position,
      included: true,
    }));

    // Get staff members with their limits
    const staffIds = [...new Set(roster.shifts.map(s => s.userId).filter(Boolean))] as string[];
    const staffMembers = await getStaffMembersForValidation(staffIds);

    // Get existing shifts for conflict checking (shifts in other rosters)
    const existingShifts = await getExistingShiftsForValidation(
      staffIds,
      roster.startDate,
      roster.endDate,
      rosterId
    );

    // Build validation context
    const context: ValidationContext = {
      venueId: roster.venueId,
      weekStart: roster.startDate.toISOString().split("T")[0],
      weekEnd: roster.endDate.toISOString().split("T")[0],
      shifts: shiftsForValidation,
      staffMembers,
      existingShifts,
      config,
    };

    // Run full validation
    const result = validateRosterShifts(context);

    // Add additional cross-venue conflict checks
    const crossVenueIssues = await validateCrossVenueConflicts(rosterId, shiftsForValidation);
    result.issues.push(...crossVenueIssues);
    result.summary.total += crossVenueIssues.length;
    result.summary.blocking += crossVenueIssues.filter((i: ValidationIssue) => i.severity === "blocking").length;

    return {
      valid: result.valid && crossVenueIssues.filter((i: ValidationIssue) => i.severity === "blocking").length === 0,
      hasBlockingErrors: result.hasBlockingErrors || crossVenueIssues.some((i: ValidationIssue) => i.severity === "blocking"),
      issues: result.issues,
      summary: result.summary,
    };
  } catch (error) {
    console.error("Error validating roster:", error);
    return {
      valid: false,
      hasBlockingErrors: true,
      issues: [{
        id: "validation-error",
        stage: "schema",
        severity: "blocking",
        code: "VALIDATION_ERROR",
        message: "Failed to validate roster",
      }],
      summary: {
        total: 1,
        blocking: 1,
        warnings: 0,
        info: 0,
        byStage: { schema: 1, temporal: 0, business_rule: 0, conflict: 0, staff_match: 0 },
      },
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate shift conflicts (time-off, availability, double-booking)
 */
async function validateShiftConflicts(
  userId: string,
  date: Date,
  startTime: string,
  endTime: string,
  rosterId: string,
  excludeShiftId: string | undefined,
  config: ValidationConfig
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Check for approved time-off
  const timeOffRequests = await prisma.timeOffRequest.findMany({
    where: {
      userId,
      status: "APPROVED",
      startDate: { lte: dayEnd },
      endDate: { gte: dayStart },
    },
  });

  if (timeOffRequests.length > 0) {
    issues.push({
      id: `conflict-timeoff-${userId}`,
      stage: "conflict",
      severity: "blocking",
      code: "TIME_OFF_CONFLICT",
      message: `Staff member has approved time off on this date`,
      staffId: userId,
      date: date.toISOString().split("T")[0],
      suggestion: "Choose a different date or staff member",
    });
  }

  // Check for existing shifts (double-booking)
  const existingShiftsQuery: {
    where: {
      userId: string;
      date: { gte: Date; lte: Date };
      id?: { not: string };
      roster: { status: { in: RosterStatus[] } };
    };
  } = {
    where: {
      userId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
      roster: {
        status: { in: ["DRAFT", "APPROVED", "PUBLISHED"] },
      },
    },
  };

  if (excludeShiftId) {
    existingShiftsQuery.where.id = { not: excludeShiftId };
  }

  const existingShifts = await prisma.rosterShift.findMany(existingShiftsQuery);

  // Check for time overlap
  const newStart = parseInt(startTime.replace(":", ""));
  const newEnd = parseInt(endTime.replace(":", ""));

  for (const existing of existingShifts) {
    const existingStart = parseInt(existing.startTime.replace(":", ""));
    const existingEnd = parseInt(existing.endTime.replace(":", ""));

    if (newStart < existingEnd && newEnd > existingStart) {
      issues.push({
        id: `conflict-double-${existing.id}`,
        stage: "conflict",
        severity: "blocking",
        code: "DOUBLE_BOOKED",
        message: `Staff member has an overlapping shift (${existing.startTime} - ${existing.endTime})`,
        staffId: userId,
        date: date.toISOString().split("T")[0],
        suggestion: "Adjust shift times or choose different staff",
      });
    }
  }

  // Check availability
  const dayOfWeek = date.getDay();
  const availability = await prisma.availability.findFirst({
    where: { userId, dayOfWeek },
  });

  if (availability && !availability.isAvailable) {
    issues.push({
      id: `conflict-availability-${userId}`,
      stage: "conflict",
      severity: "warning",
      code: "AVAILABILITY_CONFLICT",
      message: "Staff member is marked as unavailable on this day",
      staffId: userId,
      date: date.toISOString().split("T")[0],
      suggestion: "Confirm with staff member before assigning",
    });
  } else if (availability && availability.isAvailable && !availability.isAllDay) {
    const shiftStart = parseInt(startTime.replace(":", ""));
    const shiftEnd = parseInt(endTime.replace(":", ""));
    const availStart = availability.startTime
      ? parseInt(availability.startTime.replace(":", ""))
      : 0;
    const availEnd = availability.endTime
      ? parseInt(availability.endTime.replace(":", ""))
      : 2359;

    if (shiftStart < availStart || shiftEnd > availEnd) {
      issues.push({
        id: `conflict-availability-hours-${userId}`,
        stage: "conflict",
        severity: "warning",
        code: "AVAILABILITY_HOURS_CONFLICT",
        message: `Shift time is outside staff availability (${availability.startTime || "00:00"} - ${availability.endTime || "23:59"})`,
        staffId: userId,
        date: date.toISOString().split("T")[0],
        suggestion: "Confirm with staff member or adjust shift times",
      });
    }
  }

  return issues;
}

/**
 * Validate business rules for a shift (hours, consecutive days, etc.)
 */
async function validateBusinessRulesForShift(
  rosterId: string,
  userId: string,
  newShiftDate: Date,
  newShiftStart: string,
  newShiftEnd: string,
  config: ValidationConfig
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Get user's name
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, lastName: true, email: true },
  });
  const staffName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown";

  // Get all shifts for this user in the roster
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { startDate: true, endDate: true },
  });

  if (!roster) return issues;

  const existingShifts = await prisma.rosterShift.findMany({
    where: {
      userId,
      date: {
        gte: roster.startDate,
        lte: roster.endDate,
      },
    },
  });

  // Calculate total hours including new shift
  let totalMinutes = 0;
  const dates = new Set<string>();

  for (const shift of existingShifts) {
    const start = parseTimeToMinutes(shift.startTime);
    const end = parseTimeToMinutes(shift.endTime);
    totalMinutes += end > start ? end - start : (24 * 60 - start) + end;
    dates.add(shift.date.toISOString().split("T")[0]);
  }

  // Add new shift
  const newStart = parseTimeToMinutes(newShiftStart);
  const newEnd = parseTimeToMinutes(newShiftEnd);
  totalMinutes += newEnd > newStart ? newEnd - newStart : (24 * 60 - newStart) + newEnd;
  dates.add(newShiftDate.toISOString().split("T")[0]);

  const totalHours = totalMinutes / 60;

  // Check max hours per week
  if (totalHours > config.maxHoursPerWeek) {
    issues.push({
      id: `business-max-hours-${userId}`,
      stage: "business_rule",
      severity: "warning",
      code: "MAX_HOURS_EXCEEDED",
      message: `${staffName}: ${Math.round(totalHours)} hours this week (max: ${config.maxHoursPerWeek})`,
      staffId: userId,
      staffName,
      metadata: { totalHours, maxHours: config.maxHoursPerWeek },
      suggestion: "Review shift assignments to reduce hours",
    });
  }

  // Check consecutive days
  const sortedDates = Array.from(dates).sort();
  let maxConsecutive = 1;
  let currentConsecutive = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currDate = new Date(sortedDates[i]);
    const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      currentConsecutive++;
      maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
    } else {
      currentConsecutive = 1;
    }
  }

  if (maxConsecutive > config.maxConsecutiveDays) {
    issues.push({
      id: `business-consecutive-${userId}`,
      stage: "business_rule",
      severity: "warning",
      code: "MAX_CONSECUTIVE_DAYS",
      message: `${staffName}: ${maxConsecutive} consecutive days (max: ${config.maxConsecutiveDays})`,
      staffId: userId,
      staffName,
      metadata: { maxConsecutive, maxDays: config.maxConsecutiveDays },
      suggestion: "Consider adding a rest day",
    });
  }

  return issues;
}

/**
 * Get staff members with their validation settings
 */
async function getStaffMembersForValidation(staffIds: string[]): Promise<Map<string, StaffForMember>> {
  const staffMap = new Map<string, StaffForMember>();

  if (staffIds.length === 0) return staffMap;

  const users = await prisma.user.findMany({
    where: { id: { in: staffIds } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  for (const user of users) {
    staffMap.set(user.id, {
      id: user.id,
      name: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Unknown",
      email: user.email || undefined,
    });
  }

  return staffMap;
}

/**
 * Get existing shifts for conflict validation
 */
async function getExistingShiftsForValidation(
  staffIds: string[],
  startDate: Date,
  endDate: Date,
  excludeRosterId: string
): Promise<ShiftForValidation[]> {
  if (staffIds.length === 0) return [];

  const shifts = await prisma.rosterShift.findMany({
    where: {
      userId: { in: staffIds },
      date: { gte: startDate, lte: endDate },
      rosterId: { not: excludeRosterId },
      roster: {
        status: { in: ["DRAFT", "APPROVED", "PUBLISHED"] },
      },
    },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  return shifts.map((shift, index) => ({
    id: shift.id,
    rowIndex: index,
    staffName: shift.user
      ? `${shift.user.firstName || ""} ${shift.user.lastName || ""}`.trim() || shift.user.email
      : "Unknown",
    staffId: shift.userId,
    date: shift.date.toISOString().split("T")[0],
    startTime: shift.startTime,
    endTime: shift.endTime,
    break: (shift.breakMinutes ?? 0) > 0,
    position: shift.position,
    included: true,
  }));
}

/**
 * Validate cross-venue conflicts
 */
async function validateCrossVenueConflicts(
  rosterId: string,
  shifts: ShiftForValidation[]
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  // Get the roster's venue
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    select: { venueId: true },
  });

  if (!roster) return issues;

  // Group shifts by user
  const shiftsByUser = new Map<string, ShiftForValidation[]>();
  for (const shift of shifts) {
    if (!shift.staffId) continue;
    const list = shiftsByUser.get(shift.staffId) || [];
    list.push(shift);
    shiftsByUser.set(shift.staffId, list);
  }

  // For each user, check for conflicts with shifts from OTHER rosters
  for (const [userId, userShifts] of shiftsByUser) {
    // Get all shifts for this user in the same date range from OTHER venues
    const dates = [...new Set(userShifts.map(s => s.date))];
    
    const otherShifts = await prisma.rosterShift.findMany({
      where: {
        userId,
        date: { in: dates.map(d => new Date(d)) },
        rosterId: { not: rosterId },
        roster: {
          venueId: { not: roster.venueId },
          status: { in: ["DRAFT", "APPROVED", "PUBLISHED"] },
        },
      },
      include: {
        roster: {
          select: { venueId: true, venue: { select: { name: true } } },
        },
      },
    });

    // Check for overlaps
    for (const userShift of userShifts) {
      const shiftStart = parseTimeToMinutes(userShift.startTime);
      const shiftEnd = parseTimeToMinutes(userShift.endTime);
      const isOvernight = shiftEnd <= shiftStart;

      for (const other of otherShifts) {
        if (other.date.toISOString().split("T")[0] !== userShift.date) continue;

        const otherStart = parseTimeToMinutes(other.startTime);
        const otherEnd = parseTimeToMinutes(other.endTime);
        const otherOvernight = otherEnd <= otherStart;

        // Skip if either is overnight (complex comparison)
        if (isOvernight || otherOvernight) continue;

        // Check overlap
        const overlaps = shiftStart < otherEnd && otherStart < shiftEnd;

        if (overlaps) {
          const venueName = other.roster.venue?.name || "another venue";
          issues.push({
            id: `cross-venue-${userShift.id}-${other.id}`,
            stage: "conflict",
            severity: "blocking",
            code: "CROSS_VENUE_CONFLICT",
            message: `Cross-venue conflict at ${venueName} (${other.startTime} - ${other.endTime})`,
            staffId: userId,
            staffName: userShift.staffName,
            date: userShift.date,
            shiftId: userShift.id,
            suggestion: "Staff member has overlapping shift at another venue",
            metadata: {
              conflictingShiftId: other.id,
              conflictingRosterId: other.rosterId,
              venueName,
            },
          });
        }
      }
    }
  }

  return issues;
}

/**
 * Validate cross-venue conflicts for a single shift
 */
async function validateCrossVenueConflictForShift(
  userId: string,
  date: Date,
  startTime: string,
  endTime: string,
  rosterId: string,
  currentVenueId: string
): Promise<ValidationIssue[]> {
  const issues: ValidationIssue[] = [];

  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  // Find shifts at OTHER venues that overlap
  const otherVenueShifts = await prisma.rosterShift.findMany({
    where: {
      userId,
      date: {
        gte: dayStart,
        lte: dayEnd,
      },
      rosterId: { not: rosterId },
      roster: {
        venueId: { not: currentVenueId },
        status: { in: ["DRAFT", "APPROVED", "PUBLISHED"] },
      },
    },
    include: {
      roster: {
        select: {
          venueId: true,
          venue: { select: { name: true } }
        },
      },
    },
  });

  const newStart = parseTimeToMinutes(startTime);
  const newEnd = parseTimeToMinutes(endTime);
  const isOvernight = newEnd <= newStart;

  for (const other of otherVenueShifts) {
    const otherStart = parseTimeToMinutes(other.startTime);
    const otherEnd = parseTimeToMinutes(other.endTime);
    const otherOvernight = otherEnd <= otherStart;

    // Skip if either is overnight (complex comparison)
    if (isOvernight || otherOvernight) continue;

    // Check overlap
    const overlaps = newStart < otherEnd && otherStart < newEnd;

    if (overlaps) {
      const venueName = other.roster.venue?.name || "another venue";
      issues.push({
        id: `cross-venue-shift-${other.id}`,
        stage: "conflict",
        severity: "blocking",
        code: "CROSS_VENUE_CONFLICT",
        message: `Cross-venue conflict at ${venueName} (${other.startTime} - ${other.endTime})`,
        staffId: userId,
        date: date.toISOString().split("T")[0],
        suggestion: "Staff member has overlapping shift at another venue",
        metadata: {
          conflictingShiftId: other.id,
          conflictingRosterId: other.rosterId,
          venueName,
        },
      });
    }
  }

  return issues;
}

/**
 * Parse time string to minutes since midnight
 */
function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// ============================================================================
// RE-EXPORTS
// ============================================================================

export {
  getBlockingIssues,
  getWarnings,
  getIssuesByStage,
  getIssuesByStaff,
  getIssuesByDate,
  formatIssueForDisplay,
} from "./validation-engine";
