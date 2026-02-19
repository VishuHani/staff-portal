/**
 * Extraction Validator
 * 
 * Code-based validation for roster extraction results.
 * No AI - pure deterministic validation rules.
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractedShift {
  date: string;
  day: string;
  role: string | null;
  staff_name: string;
  start_time: string;
  end_time: string;
  break: boolean;
  raw_cell?: string;
}

export interface ExtractionData {
  week_start: string;
  venue_name: string | null;
  confidence_score: number;
  shifts: ExtractedShift[];
  uncertain_fields?: Array<{
    field: string;
    value: string;
    reason: string;
  }>;
}

export interface ValidationError {
  type: "time_format" | "date_format" | "time_order" | "duplicate" | "missing_field" | "invalid_value";
  shiftIndex: number;
  field: string;
  value: string;
  message: string;
}

export interface ValidationWarning {
  type: "low_confidence" | "missing_role" | "unusual_time" | "potential_duplicate";
  shiftIndex: number;
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  confidence: number;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  stats: {
    totalShifts: number;
    validShifts: number;
    invalidShifts: number;
    uniqueStaff: number;
    uniqueDates: number;
    dateRange: { start: string; end: string } | null;
  };
}

// ============================================================================
// VALIDATION PATTERNS
// ============================================================================

// Time format: HH:MM (24-hour)
const TIME_PATTERN = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;

// Date format: YYYY-MM-DD
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/;

// Day names
const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate time format (HH:MM)
 */
function validateTimeFormat(time: string): boolean {
  return TIME_PATTERN.test(time);
}

/**
 * Validate date format (YYYY-MM-DD)
 */
function validateDateFormat(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;
  
  // Check if it's a valid date
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Check if end_time > start_time
 */
function validateTimeOrder(startTime: string, endTime: string): boolean {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  
  // Handle overnight shifts (end time is next day)
  // If end time is earlier than start time, assume it's overnight
  // This is valid, so we return true
  if (endMinutes < startMinutes) {
    // Overnight shift - this is valid
    return true;
  }
  
  return endMinutes > startMinutes;
}

/**
 * Create a unique key for a shift to detect duplicates
 */
function createShiftKey(shift: ExtractedShift): string {
  const normalizedName = (shift.staff_name || "").toLowerCase().trim();
  const normalizedDate = shift.date;
  const normalizedStart = shift.start_time;
  return `${normalizedName}|${normalizedDate}|${normalizedStart}`;
}

/**
 * Validate a single shift
 */
function validateShift(shift: ExtractedShift, index: number): {
  errors: ValidationError[];
  warnings: ValidationWarning[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields
  if (!shift.staff_name || shift.staff_name.trim() === "") {
    errors.push({
      type: "missing_field",
      shiftIndex: index,
      field: "staff_name",
      value: "",
      message: "Staff name is required",
    });
  }

  if (!shift.date || shift.date.trim() === "") {
    errors.push({
      type: "missing_field",
      shiftIndex: index,
      field: "date",
      value: "",
      message: "Date is required",
    });
  }

  if (!shift.start_time || shift.start_time.trim() === "") {
    errors.push({
      type: "missing_field",
      shiftIndex: index,
      field: "start_time",
      value: "",
      message: "Start time is required",
    });
  }

  if (!shift.end_time || shift.end_time.trim() === "") {
    errors.push({
      type: "missing_field",
      shiftIndex: index,
      field: "end_time",
      value: "",
      message: "End time is required",
    });
  }

  // Skip further validation if required fields are missing
  if (errors.length > 0) {
    return { errors, warnings };
  }

  // Time format validation
  if (!validateTimeFormat(shift.start_time)) {
    errors.push({
      type: "time_format",
      shiftIndex: index,
      field: "start_time",
      value: shift.start_time,
      message: `Invalid start time format: ${shift.start_time}. Expected HH:MM`,
    });
  }

  if (!validateTimeFormat(shift.end_time)) {
    errors.push({
      type: "time_format",
      shiftIndex: index,
      field: "end_time",
      value: shift.end_time,
      message: `Invalid end time format: ${shift.end_time}. Expected HH:MM`,
    });
  }

  // Date format validation
  if (!validateDateFormat(shift.date)) {
    errors.push({
      type: "date_format",
      shiftIndex: index,
      field: "date",
      value: shift.date,
      message: `Invalid date format: ${shift.date}. Expected YYYY-MM-DD`,
    });
  }

  // Time order validation (only if times are valid)
  if (validateTimeFormat(shift.start_time) && validateTimeFormat(shift.end_time)) {
    if (!validateTimeOrder(shift.start_time, shift.end_time)) {
      errors.push({
        type: "time_order",
        shiftIndex: index,
        field: "end_time",
        value: `${shift.start_time}-${shift.end_time}`,
        message: `End time (${shift.end_time}) must be after start time (${shift.start_time})`,
      });
    }
  }

  // Warnings
  if (!shift.role || shift.role.trim() === "") {
    warnings.push({
      type: "missing_role",
      shiftIndex: index,
      field: "role",
      message: "Role is not specified",
    });
  }

  // Check for unusual times (very early or very late)
  const [startH] = shift.start_time.split(":").map(Number);
  const [endH] = shift.end_time.split(":").map(Number);
  
  if (startH < 5 || startH >= 23) {
    warnings.push({
      type: "unusual_time",
      shiftIndex: index,
      field: "start_time",
      message: `Unusual start time: ${shift.start_time}`,
    });
  }

  if (endH < 5 || endH >= 23) {
    warnings.push({
      type: "unusual_time",
      shiftIndex: index,
      field: "end_time",
      message: `Unusual end time: ${shift.end_time}`,
    });
  }

  return { errors, warnings };
}

/**
 * Main validation function
 */
export function validateExtraction(data: ExtractionData): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationWarning[] = [];
  const seenShifts = new Map<string, number>();

  // Validate each shift
  data.shifts.forEach((shift, index) => {
    // Validate individual shift
    const { errors, warnings } = validateShift(shift, index);
    allErrors.push(...errors);
    allWarnings.push(...warnings);

    // Check for duplicates
    const key = createShiftKey(shift);
    if (seenShifts.has(key)) {
      const originalIndex = seenShifts.get(key)!;
      allErrors.push({
        type: "duplicate",
        shiftIndex: index,
        field: "staff_name",
        value: key,
        message: `Duplicate shift: same staff, date, and start time as shift #${originalIndex + 1}`,
      });
    } else {
      seenShifts.set(key, index);
    }
  });

  // Calculate statistics
  const validShifts = data.shifts.filter((_, index) => 
    !allErrors.some(e => e.shiftIndex === index)
  );
  
  const uniqueStaff = new Set(data.shifts.map(s => s.staff_name.toLowerCase()));
  const uniqueDates = new Set(data.shifts.map(s => s.date));
  
  let dateRange: { start: string; end: string } | null = null;
  if (uniqueDates.size > 0) {
    const sortedDates = Array.from(uniqueDates).sort();
    dateRange = {
      start: sortedDates[0],
      end: sortedDates[sortedDates.length - 1],
    };
  }

  // Calculate confidence
  let confidence = 100;
  
  // Deduct for errors
  confidence -= allErrors.length * 10;
  
  // Deduct for warnings
  confidence -= allWarnings.length * 2;
  
  // Deduct for low extraction confidence
  if (data.confidence_score < 80) {
    confidence -= (80 - data.confidence_score);
  }
  
  // Deduct for uncertain fields
  if (data.uncertain_fields && data.uncertain_fields.length > 0) {
    confidence -= data.uncertain_fields.length * 5;
  }
  
  // Ensure confidence is between 0 and 100
  confidence = Math.max(0, Math.min(100, confidence));

  return {
    isValid: allErrors.length === 0,
    confidence,
    errors: allErrors,
    warnings: allWarnings,
    stats: {
      totalShifts: data.shifts.length,
      validShifts: validShifts.length,
      invalidShifts: data.shifts.length - validShifts.length,
      uniqueStaff: uniqueStaff.size,
      uniqueDates: uniqueDates.size,
      dateRange,
    },
  };
}

/**
 * Format validation errors for correction prompt
 */
export function formatErrorsForCorrection(errors: ValidationError[]): string {
  if (errors.length === 0) return "";
  
  return errors.map(e => 
    `- Shift #${e.shiftIndex + 1}: ${e.message} (field: ${e.field}, value: "${e.value}")`
  ).join("\n");
}

/**
 * Clean and normalize extracted data
 */
export function normalizeExtraction(data: ExtractionData): ExtractionData {
  return {
    ...data,
    shifts: data.shifts.map(shift => ({
      ...shift,
      // Normalize staff name (trim, title case)
      staff_name: shift.staff_name.trim(),
      // Normalize times (ensure HH:MM format)
      start_time: normalizeTime(shift.start_time),
      end_time: normalizeTime(shift.end_time),
      // Normalize role
      role: shift.role ? shift.role.trim() : null,
    })),
  };
}

/**
 * Normalize time to HH:MM format
 */
function normalizeTime(time: string): string {
  // Already in HH:MM format
  if (TIME_PATTERN.test(time)) {
    return time;
  }
  
  // Handle H:MM format (single digit hour)
  if (/^[0-9]:[0-5][0-9]$/.test(time)) {
    return "0" + time;
  }
  
  // Handle H.MM format
  if (/^[0-9]\.[0-5][0-9]$/.test(time)) {
    return "0" + time.replace(".", ":");
  }
  
  // Handle HH.MM format
  if (/^[0-2][0-9]\.[0-5][0-9]$/.test(time)) {
    return time.replace(".", ":");
  }
  
  // Return as-is if we can't normalize
  return time;
}
