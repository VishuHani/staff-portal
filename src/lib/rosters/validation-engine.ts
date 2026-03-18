/**
 * Roster Validation Engine
 * 
 * Multi-stage validation with:
 * - Schema validation (field types, required fields)
 * - Temporal validation (time order, date validity, overnight shifts)
 * - Business rule validation (max hours, break requirements, consecutive days)
 * - Conflict precheck (overlapping shifts, double-booking)
 * - Severity classification (blocking vs warning)
 */

import { addDays, differenceInMinutes, isBefore, isAfter, isSameDay, parseISO, isValid } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type ValidationSeverity = "blocking" | "warning" | "info";

export type ValidationStage = 
  | "schema"
  | "temporal"
  | "business_rule"
  | "conflict"
  | "staff_match";

export interface ValidationIssue {
  id: string;
  stage: ValidationStage;
  severity: ValidationSeverity;
  code: string;
  message: string;
  shiftIndex?: number;
  shiftId?: string;
  staffId?: string;
  staffName?: string;
  date?: string;
  field?: string;
  value?: unknown;
  suggestion?: string;
  metadata?: Record<string, unknown>;
}

export interface ShiftForValidation {
  id: string;
  rowIndex: number;
  staffName: string;
  staffId?: string | null;
  date: string;
  startTime: string;
  endTime: string;
  break?: boolean;
  position?: string | null;
  included: boolean;
}

export interface StaffForMember {
  id: string;
  name: string;
  email?: string;
  maxHoursPerWeek?: number;
  maxDaysPerWeek?: number;
  minHoursBetweenShifts?: number;
}

export interface ValidationContext {
  venueId: string;
  weekStart: string;
  weekEnd: string;
  shifts: ShiftForValidation[];
  staffMembers: Map<string, StaffForMember>;
  existingShifts?: ShiftForValidation[];
  config: ValidationConfig;
}

export interface ValidationConfig {
  /** Minimum shift duration in minutes (default: 60) */
  minShiftDuration: number;
  /** Maximum shift duration in minutes (default: 720 = 12 hours) */
  maxShiftDuration: number;
  /** Maximum hours per week per staff (default: 48) */
  maxHoursPerWeek: number;
  /** Maximum consecutive days (default: 6) */
  maxConsecutiveDays: number;
  /** Minimum hours between shifts (default: 8) */
  minHoursBetweenShifts: number;
  /** Require break for shifts longer than X minutes (default: 300 = 5 hours) */
  breakRequiredAfterMinutes: number;
  /** Allow overnight shifts (default: true) */
  allowOvernightShifts: boolean;
  /** Check for overlapping shifts (default: true) */
  checkOverlaps: boolean;
  /** Require staff match before confirmation (default: true) */
  requireStaffMatch: boolean;
  /** Maximum shifts per staff per day (default: 2) */
  maxShiftsPerDay: number;
}

export const DEFAULT_VALIDATION_CONFIG: ValidationConfig = {
  minShiftDuration: 60,
  maxShiftDuration: 720,
  maxHoursPerWeek: 48,
  maxConsecutiveDays: 6,
  minHoursBetweenShifts: 8,
  breakRequiredAfterMinutes: 300,
  allowOvernightShifts: true,
  checkOverlaps: true,
  requireStaffMatch: true,
  maxShiftsPerDay: 2,
};

export interface ValidationResult {
  valid: boolean;
  hasBlockingErrors: boolean;
  issues: ValidationIssue[];
  summary: {
    total: number;
    blocking: number;
    warnings: number;
    info: number;
    byStage: Record<ValidationStage, number>;
  };
}

// ============================================================================
// SCHEMA VALIDATION
// ============================================================================

export function validateSchema(
  shifts: ShiftForValidation[],
  config: ValidationConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    
    // Required field: staff_name
    if (!shift.staffName || shift.staffName.trim() === "") {
      issues.push({
        id: `schema-staff-name-${i}`,
        stage: "schema",
        severity: "blocking",
        code: "MISSING_STAFF_NAME",
        message: `Shift ${i + 1}: Missing staff name`,
        shiftIndex: i,
        shiftId: shift.id,
        field: "staffName",
        suggestion: "Enter a staff member name",
      });
    }

    // Required field: date
    if (!shift.date || shift.date.trim() === "") {
      issues.push({
        id: `schema-date-${i}`,
        stage: "schema",
        severity: "blocking",
        code: "MISSING_DATE",
        message: `Shift ${i + 1}: Missing date`,
        shiftIndex: i,
        shiftId: shift.id,
        field: "date",
        suggestion: "Enter a valid date",
      });
    } else {
      // Validate date format
      const parsedDate = parseISO(shift.date);
      if (!isValid(parsedDate)) {
        issues.push({
          id: `schema-date-format-${i}`,
          stage: "schema",
          severity: "blocking",
          code: "INVALID_DATE_FORMAT",
          message: `Shift ${i + 1}: Invalid date format "${shift.date}"`,
          shiftIndex: i,
          shiftId: shift.id,
          field: "date",
          value: shift.date,
          suggestion: "Use YYYY-MM-DD format",
        });
      }
    }

    // Required field: start_time
    if (!shift.startTime || shift.startTime.trim() === "") {
      issues.push({
        id: `schema-start-time-${i}`,
        stage: "schema",
        severity: "blocking",
        code: "MISSING_START_TIME",
        message: `Shift ${i + 1}: Missing start time`,
        shiftIndex: i,
        shiftId: shift.id,
        field: "startTime",
        suggestion: "Enter a start time (HH:MM)",
      });
    } else {
      // Validate time format
      if (!isValidTimeFormat(shift.startTime)) {
        issues.push({
          id: `schema-start-time-format-${i}`,
          stage: "schema",
          severity: "blocking",
          code: "INVALID_TIME_FORMAT",
          message: `Shift ${i + 1}: Invalid start time format "${shift.startTime}"`,
          shiftIndex: i,
          shiftId: shift.id,
          field: "startTime",
          value: shift.startTime,
          suggestion: "Use HH:MM format (24-hour)",
        });
      }
    }

    // Required field: end_time
    if (!shift.endTime || shift.endTime.trim() === "") {
      issues.push({
        id: `schema-end-time-${i}`,
        stage: "schema",
        severity: "blocking",
        code: "MISSING_END_TIME",
        message: `Shift ${i + 1}: Missing end time`,
        shiftIndex: i,
        shiftId: shift.id,
        field: "endTime",
        suggestion: "Enter an end time (HH:MM)",
      });
    } else {
      // Validate time format
      if (!isValidTimeFormat(shift.endTime)) {
        issues.push({
          id: `schema-end-time-format-${i}`,
          stage: "schema",
          severity: "blocking",
          code: "INVALID_TIME_FORMAT",
          message: `Shift ${i + 1}: Invalid end time format "${shift.endTime}"`,
          shiftIndex: i,
          shiftId: shift.id,
          field: "endTime",
          value: shift.endTime,
          suggestion: "Use HH:MM format (24-hour)",
        });
      }
    }
  }

  return issues;
}

// ============================================================================
// TEMPORAL VALIDATION
// ============================================================================

export function validateTemporal(
  shifts: ShiftForValidation[],
  config: ValidationConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    
    // Skip if missing required fields
    if (!shift.date || !shift.startTime || !shift.endTime) continue;
    if (!isValidTimeFormat(shift.startTime) || !isValidTimeFormat(shift.endTime)) continue;

    const startTime = parseTimeToMinutes(shift.startTime);
    const endTime = parseTimeToMinutes(shift.endTime);
    
    // Check for overnight shifts (end <= start means overnight)
    const isOvernight = endTime <= startTime;
    
    if (isOvernight && !config.allowOvernightShifts) {
      issues.push({
        id: `temporal-overnight-${i}`,
        stage: "temporal",
        severity: "blocking",
        code: "OVERNIGHT_SHIFT_NOT_ALLOWED",
        message: `Shift ${i + 1}: Overnight shifts are not allowed (${shift.startTime} - ${shift.endTime})`,
        shiftIndex: i,
        shiftId: shift.id,
        date: shift.date,
        suggestion: "Adjust times to be within the same day",
      });
      continue; // Skip duration check for overnight
    }

    // Calculate duration
    let durationMinutes: number;
    if (isOvernight) {
      // Overnight: from start to midnight + midnight to end
      durationMinutes = (24 * 60 - startTime) + endTime;
    } else {
      durationMinutes = endTime - startTime;
    }

    // Check minimum duration
    if (durationMinutes < config.minShiftDuration) {
      issues.push({
        id: `temporal-min-duration-${i}`,
        stage: "temporal",
        severity: "warning",
        code: "SHIFT_TOO_SHORT",
        message: `Shift ${i + 1}: Shift is only ${durationMinutes} minutes (minimum: ${config.minShiftDuration})`,
        shiftIndex: i,
        shiftId: shift.id,
        date: shift.date,
        metadata: { durationMinutes },
        suggestion: "Verify this short shift is correct",
      });
    }

    // Check maximum duration
    if (durationMinutes > config.maxShiftDuration) {
      issues.push({
        id: `temporal-max-duration-${i}`,
        stage: "temporal",
        severity: "blocking",
        code: "SHIFT_TOO_LONG",
        message: `Shift ${i + 1}: Shift is ${Math.round(durationMinutes / 60)} hours (maximum: ${config.maxShiftDuration / 60})`,
        shiftIndex: i,
        shiftId: shift.id,
        date: shift.date,
        metadata: { durationMinutes },
        suggestion: "Split into multiple shifts or reduce hours",
      });
    }

    // Check break requirement
    if (durationMinutes > config.breakRequiredAfterMinutes && !shift.break) {
      issues.push({
        id: `temporal-break-required-${i}`,
        stage: "temporal",
        severity: "warning",
        code: "BREAK_RECOMMENDED",
        message: `Shift ${i + 1}: Break recommended for ${Math.round(durationMinutes / 60)} hour shift`,
        shiftIndex: i,
        shiftId: shift.id,
        date: shift.date,
        suggestion: "Add a break for shifts longer than 5 hours",
      });
    }

    // Check for invalid time order (same day, end before start)
    if (!isOvernight && endTime <= startTime) {
      issues.push({
        id: `temporal-time-order-${i}`,
        stage: "temporal",
        severity: "blocking",
        code: "INVALID_TIME_ORDER",
        message: `Shift ${i + 1}: End time (${shift.endTime}) must be after start time (${shift.startTime})`,
        shiftIndex: i,
        shiftId: shift.id,
        date: shift.date,
        suggestion: "Correct the time order or mark as overnight",
      });
    }
  }

  return issues;
}

// ============================================================================
// BUSINESS RULE VALIDATION
// ============================================================================

export function validateBusinessRules(
  shifts: ShiftForValidation[],
  staffMembers: Map<string, StaffForMember>,
  config: ValidationConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Group shifts by staff
  const shiftsByStaff = new Map<string, ShiftForValidation[]>();
  for (const shift of shifts) {
    if (!shift.staffId) continue;
    const list = shiftsByStaff.get(shift.staffId) || [];
    list.push(shift);
    shiftsByStaff.set(shift.staffId, list);
  }

  for (const [staffId, staffShifts] of shiftsByStaff.entries()) {
    const staff = staffMembers.get(staffId);
    const staffName = staff?.name || staffShifts[0]?.staffName || "Unknown";

    // Calculate weekly hours
    let totalMinutes = 0;
    for (const shift of staffShifts) {
      if (!isValidTimeFormat(shift.startTime) || !isValidTimeFormat(shift.endTime)) continue;
      
      const startTime = parseTimeToMinutes(shift.startTime);
      const endTime = parseTimeToMinutes(shift.endTime);
      
      if (endTime <= startTime) {
        // Overnight shift
        totalMinutes += (24 * 60 - startTime) + endTime;
      } else {
        totalMinutes += endTime - startTime;
      }
    }

    const totalHours = totalMinutes / 60;
    const maxHours = staff?.maxHoursPerWeek || config.maxHoursPerWeek;

    // Check max hours per week
    if (totalHours > maxHours) {
      issues.push({
        id: `business-max-hours-${staffId}`,
        stage: "business_rule",
        severity: "warning",
        code: "MAX_HOURS_EXCEEDED",
        message: `${staffName}: ${Math.round(totalHours)} hours this week (max: ${maxHours})`,
        staffId,
        staffName,
        metadata: { totalHours, maxHours },
        suggestion: "Review shift assignments to reduce hours",
      });
    }

    // Check consecutive days
    const dates = [...new Set(staffShifts.map(s => s.date))].sort();
    let maxConsecutive = 1;
    let currentConsecutive = 1;
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = parseISO(dates[i - 1]);
      const currDate = parseISO(dates[i]);
      const diffDays = differenceInMinutes(currDate, prevDate) / (24 * 60);
      
      if (diffDays === 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else {
        currentConsecutive = 1;
      }
    }

    const maxDays = staff?.maxDaysPerWeek || config.maxConsecutiveDays;
    if (maxConsecutive > maxDays) {
      issues.push({
        id: `business-consecutive-days-${staffId}`,
        stage: "business_rule",
        severity: "warning",
        code: "MAX_CONSECUTIVE_DAYS",
        message: `${staffName}: ${maxConsecutive} consecutive days (max: ${maxDays})`,
        staffId,
        staffName,
        metadata: { maxConsecutive, maxDays },
        suggestion: "Consider adding a rest day",
      });
    }

    // Check shifts per day
    const shiftsByDate = new Map<string, number>();
    for (const shift of staffShifts) {
      const count = shiftsByDate.get(shift.date) || 0;
      shiftsByDate.set(shift.date, count + 1);
    }

    for (const [date, count] of shiftsByDate.entries()) {
      if (count > config.maxShiftsPerDay) {
        issues.push({
          id: `business-shifts-per-day-${staffId}-${date}`,
          stage: "business_rule",
          severity: "warning",
          code: "MAX_SHIFTS_PER_DAY",
          message: `${staffName}: ${count} shifts on ${date} (max: ${config.maxShiftsPerDay})`,
          staffId,
          staffName,
          date,
          metadata: { shiftCount: count, maxShifts: config.maxShiftsPerDay },
          suggestion: "Verify multiple shifts on same day are intentional",
        });
      }
    }

    // Check minimum hours between shifts
    const sortedShifts = staffShifts.sort((a, b) => {
      const dateA = `${a.date}T${a.startTime}`;
      const dateB = `${b.date}T${b.startTime}`;
      return dateA.localeCompare(dateB);
    });

    for (let i = 1; i < sortedShifts.length; i++) {
      const prev = sortedShifts[i - 1];
      const curr = sortedShifts[i];

      // Calculate gap between shifts
      const prevEnd = parseTimeToMinutes(prev.endTime);
      const currStart = parseTimeToMinutes(curr.startTime);
      
      // Simple case: same date
      if (prev.date === curr.date) {
        const gapMinutes = currStart - prevEnd;
        const minGap = (staff?.minHoursBetweenShifts || config.minHoursBetweenShifts) * 60;
        
        if (gapMinutes > 0 && gapMinutes < minGap) {
          issues.push({
            id: `business-gap-${staffId}-${prev.id}-${curr.id}`,
            stage: "business_rule",
            severity: "warning",
            code: "INSUFFICIENT_REST",
            message: `${staffName}: Only ${Math.round(gapMinutes / 60)} hours between shifts on ${prev.date}`,
            staffId,
            staffName,
            date: prev.date,
            metadata: { gapMinutes, minGap },
            suggestion: `Minimum ${config.minHoursBetweenShifts} hours recommended between shifts`,
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// CONFLICT VALIDATION
// ============================================================================

export function validateConflicts(
  shifts: ShiftForValidation[],
  existingShifts: ShiftForValidation[] | undefined,
  config: ValidationConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!config.checkOverlaps) return issues;

  // Group shifts by staff
  const shiftsByStaff = new Map<string, ShiftForValidation[]>();
  
  for (const shift of shifts) {
    if (!shift.staffId) continue;
    const list = shiftsByStaff.get(shift.staffId) || [];
    list.push(shift);
    shiftsByStaff.set(shift.staffId, list);
  }

  // Add existing shifts
  if (existingShifts) {
    for (const shift of existingShifts) {
      if (!shift.staffId) continue;
      const list = shiftsByStaff.get(shift.staffId) || [];
      list.push(shift);
      shiftsByStaff.set(shift.staffId, list);
    }
  }

  // Check for overlaps within each staff's shifts
  for (const [staffId, staffShifts] of shiftsByStaff.entries()) {
    for (let i = 0; i < staffShifts.length; i++) {
      for (let j = i + 1; j < staffShifts.length; j++) {
        const shiftA = staffShifts[i];
        const shiftB = staffShifts[j];

        // Only check same-date overlaps for simplicity
        if (shiftA.date !== shiftB.date) continue;

        const startA = parseTimeToMinutes(shiftA.startTime);
        const endA = parseTimeToMinutes(shiftA.endTime);
        const startB = parseTimeToMinutes(shiftB.startTime);
        const endB = parseTimeToMinutes(shiftB.endTime);

        // Handle overnight shifts
        const aOvernight = endA <= startA;
        const bOvernight = endB <= startB;

        // Skip overnight comparisons for now (complex)
        if (aOvernight || bOvernight) continue;

        // Check overlap
        const overlaps = startA < endB && startB < endA;

        if (overlaps) {
          issues.push({
            id: `conflict-overlap-${shiftA.id}-${shiftB.id}`,
            stage: "conflict",
            severity: "blocking",
            code: "OVERLAPPING_SHIFTS",
            message: `Overlapping shifts for ${shiftA.staffName} on ${shiftA.date}: ${shiftA.startTime}-${shiftA.endTime} and ${shiftB.startTime}-${shiftB.endTime}`,
            staffId,
            staffName: shiftA.staffName,
            date: shiftA.date,
            shiftId: shiftA.id,
            metadata: {
              shiftA: { start: shiftA.startTime, end: shiftA.endTime },
              shiftB: { start: shiftB.startTime, end: shiftB.endTime },
            },
            suggestion: "Adjust shift times to avoid overlap",
          });
        }
      }
    }
  }

  return issues;
}

// ============================================================================
// STAFF MATCH VALIDATION
// ============================================================================

export function validateStaffMatch(
  shifts: ShiftForValidation[],
  config: ValidationConfig
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!config.requireStaffMatch) return issues;

  for (let i = 0; i < shifts.length; i++) {
    const shift = shifts[i];
    
    if (!shift.included) continue; // Skip excluded shifts
    
    if (!shift.staffId) {
      issues.push({
        id: `match-missing-${i}`,
        stage: "staff_match",
        severity: "blocking",
        code: "UNMATCHED_STAFF",
        message: `Shift ${i + 1}: "${shift.staffName}" is not matched to a staff member`,
        shiftIndex: i,
        shiftId: shift.id,
        staffName: shift.staffName,
        suggestion: "Match this staff member or exclude the shift",
      });
    }
  }

  return issues;
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

export function validateRosterShifts(
  context: ValidationContext
): ValidationResult {
  const { shifts, staffMembers, existingShifts, config } = context;
  
  const allIssues: ValidationIssue[] = [];

  // Stage 1: Schema validation
  const schemaIssues = validateSchema(shifts, config);
  allIssues.push(...schemaIssues);

  // Stage 2: Temporal validation (skip if schema errors)
  if (!schemaIssues.some(i => i.severity === "blocking")) {
    const temporalIssues = validateTemporal(shifts, config);
    allIssues.push(...temporalIssues);
  }

  // Stage 3: Business rule validation
  const businessIssues = validateBusinessRules(shifts, staffMembers, config);
  allIssues.push(...businessIssues);

  // Stage 4: Conflict validation
  const conflictIssues = validateConflicts(shifts, existingShifts, config);
  allIssues.push(...conflictIssues);

  // Stage 5: Staff match validation
  const matchIssues = validateStaffMatch(shifts, config);
  allIssues.push(...matchIssues);

  // Calculate summary
  const blocking = allIssues.filter(i => i.severity === "blocking").length;
  const warnings = allIssues.filter(i => i.severity === "warning").length;
  const info = allIssues.filter(i => i.severity === "info").length;

  const byStage: Record<ValidationStage, number> = {
    schema: allIssues.filter(i => i.stage === "schema").length,
    temporal: allIssues.filter(i => i.stage === "temporal").length,
    business_rule: allIssues.filter(i => i.stage === "business_rule").length,
    conflict: allIssues.filter(i => i.stage === "conflict").length,
    staff_match: allIssues.filter(i => i.stage === "staff_match").length,
  };

  return {
    valid: blocking === 0,
    hasBlockingErrors: blocking > 0,
    issues: allIssues,
    summary: {
      total: allIssues.length,
      blocking,
      warnings,
      info,
      byStage,
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function isValidTimeFormat(time: string): boolean {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

function parseTimeToMinutes(time: string): number {
  const match = time.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return 0;
  
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  
  return hours * 60 + minutes;
}

// ============================================================================
// UTILITY EXPORTS
// ============================================================================

export function getBlockingIssues(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter(i => i.severity === "blocking");
}

export function getWarnings(issues: ValidationIssue[]): ValidationIssue[] {
  return issues.filter(i => i.severity === "warning");
}

export function getIssuesByStage(issues: ValidationIssue[], stage: ValidationStage): ValidationIssue[] {
  return issues.filter(i => i.stage === stage);
}

export function getIssuesByStaff(issues: ValidationIssue[], staffId: string): ValidationIssue[] {
  return issues.filter(i => i.staffId === staffId);
}

export function getIssuesByDate(issues: ValidationIssue[], date: string): ValidationIssue[] {
  return issues.filter(i => i.date === date);
}

export function formatIssueForDisplay(issue: ValidationIssue): string {
  const prefix = issue.severity === "blocking" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️";
  return `${prefix} ${issue.message}`;
}
