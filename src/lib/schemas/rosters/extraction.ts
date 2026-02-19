/**
 * Roster Extraction Types & Schemas
 * Types for AI-extracted roster data from Excel, CSV, and images
 */

import { z } from "zod";

// ============================================================================
// EXTRACTION RESULT TYPES
// ============================================================================

/**
 * Confidence level for AI extraction accuracy
 */
export type ConfidenceLevel = "high" | "medium" | "low";

/**
 * Source file type for roster uploads
 */
export type RosterFileSource = "excel" | "csv" | "image";

/**
 * Detected column type from roster file
 */
export type ColumnType =
  | "staff_name"
  | "staff_email"
  | "staff_id"
  | "date"
  | "day_of_week"
  | "start_time"
  | "end_time"
  | "shift_duration"
  | "position"
  | "venue"
  | "notes"
  | "unknown";

/**
 * Column mapping for roster extraction
 */
export interface ColumnMapping {
  sourceColumn: string;
  targetField: ColumnType;
  confidence: number; // 0-100
  sampleValues: string[];
}

/**
 * Extracted shift from roster file
 */
export interface ExtractedShift {
  id: string;
  rowIndex: number;
  staffName: string | null;
  staffEmail: string | null;
  staffId: string | null;
  date: string | null; // ISO date string
  dayOfWeek: string | null;
  startTime: string | null; // HH:mm format
  endTime: string | null; // HH:mm format
  position: string | null;
  venue: string | null;
  notes: string | null;
  rawData: Record<string, string>; // Original row data
  confidence: ConfidenceLevel;
  issues: string[]; // Validation issues
  matched: boolean; // Whether staff member was matched in DB
  matchedUserId: string | null;
}

/**
 * Staff matching result
 */
export interface StaffMatch {
  extractedName: string;
  extractedEmail: string | null;
  matchedUserId: string | null;
  matchedUserName: string | null;
  matchedUserEmail: string | null;
  confidence: number; // 0-100
  matchType: "exact_email" | "exact_name" | "fuzzy_name" | "partial" | "none";
}

/**
 * V2 Extraction Metadata
 * Additional metadata for multi-phase extraction
 */
export interface ExtractionV2Metadata {
  extractionVersion: "v2";
  phasesCompleted: number;
  processingTimeMs: number;
  structure: {
    type: string;
    columns: Array<{
      name: string;
      type: string;
      index: number;
    }>;
    staffRows: Array<{
      rowIndex: number;
      staffName: string;
      dataRegion: { startCol: number; endCol: number };
    }>;
    complexCells: Array<{
      row: number;
      col: number;
      columnName: string;
      type: string;
      rawContent: string;
    }>;
    congestedAreas: string[];
    confidence: number;
  };
  validation: {
    totalShifts: number;
    staffCounts: Record<string, {
      extracted: number;
      expected: string;
      daysWithShifts: string[];
      daysWithoutShifts: string[];
    }>;
    anomalies: Array<{
      type: string;
      staff: string;
      details: string;
      severity: string;
    }>;
    overallConfidence: number;
    recommendations: string[];
    extractionQuality: "excellent" | "good" | "fair" | "poor";
  };
}

/**
 * Overall extraction result
 */
export interface RosterExtractionResult {
  id: string;
  fileId: string;
  fileName: string;
  fileType: RosterFileSource;
  fileUrl: string;
  extractedAt: string; // ISO timestamp

  // Column detection
  detectedColumns: ColumnMapping[];
  headerRow: number | null;
  dataStartRow: number;
  totalRows: number;

  // Extracted data
  shifts: ExtractedShift[];

  // Staff matching
  staffMatches: StaffMatch[];
  matchedCount: number;
  unmatchedCount: number;

  // Quality metrics
  overallConfidence: ConfidenceLevel;
  confidenceScore: number; // 0-100
  validShifts: number;
  invalidShifts: number;
  warnings: string[];
  errors: string[];

  // For image extraction
  ocrConfidence?: number;
  imageQuality?: "good" | "fair" | "poor";

  // V2 metadata (optional, only for multi-phase extraction)
  metadata?: ExtractionV2Metadata;
}

/**
 * Extraction session state
 */
export interface ExtractionSession {
  id: string;
  venueId: string;
  userId: string;
  status: "uploading" | "extracting" | "mapping" | "reviewing" | "confirmed" | "failed";
  fileUrl: string | null;
  fileName: string | null;
  fileType: RosterFileSource | null;
  extraction: RosterExtractionResult | null;
  columnMappings: ColumnMapping[] | null;
  confirmedShifts: ExtractedShift[] | null;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// ZOD SCHEMAS FOR VALIDATION
// ============================================================================

export const columnMappingSchema = z.object({
  sourceColumn: z.string(),
  targetField: z.enum([
    "staff_name",
    "staff_email",
    "staff_id",
    "date",
    "day_of_week",
    "start_time",
    "end_time",
    "shift_duration",
    "position",
    "venue",
    "notes",
    "unknown",
  ]),
  confidence: z.number().min(0).max(100),
  sampleValues: z.array(z.string()),
});

export const extractedShiftSchema = z.object({
  id: z.string(),
  rowIndex: z.number(),
  staffName: z.string().nullable(),
  staffEmail: z.string().nullable(),
  staffId: z.string().nullable(),
  date: z.string().nullable(), // Will be validated as ISO date
  dayOfWeek: z.string().nullable(),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  position: z.string().nullable(),
  venue: z.string().nullable(),
  notes: z.string().nullable(),
  rawData: z.record(z.string(), z.string()),
  confidence: z.enum(["high", "medium", "low"]),
  issues: z.array(z.string()),
  matched: z.boolean(),
  matchedUserId: z.string().nullable(),
});

export const staffMatchSchema = z.object({
  extractedName: z.string(),
  extractedEmail: z.string().nullable(),
  matchedUserId: z.string().nullable(),
  matchedUserName: z.string().nullable(),
  matchedUserEmail: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  matchType: z.enum(["exact_email", "exact_name", "fuzzy_name", "partial", "none"]),
});

export const rosterExtractionResultSchema = z.object({
  id: z.string(),
  fileId: z.string(),
  fileName: z.string(),
  fileType: z.enum(["excel", "csv", "image"]),
  fileUrl: z.string().url(),
  extractedAt: z.string(),
  detectedColumns: z.array(columnMappingSchema),
  headerRow: z.number().nullable(),
  dataStartRow: z.number(),
  totalRows: z.number(),
  shifts: z.array(extractedShiftSchema),
  staffMatches: z.array(staffMatchSchema),
  matchedCount: z.number(),
  unmatchedCount: z.number(),
  overallConfidence: z.enum(["high", "medium", "low"]),
  confidenceScore: z.number().min(0).max(100),
  validShifts: z.number(),
  invalidShifts: z.number(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
  ocrConfidence: z.number().optional(),
  imageQuality: z.enum(["good", "fair", "poor"]).optional(),
});

// ============================================================================
// INPUT SCHEMAS FOR SERVER ACTIONS
// ============================================================================

/**
 * Input for starting extraction
 * Note: Uses .cuid() for IDs since Prisma uses CUID by default
 */
export const startExtractionInputSchema = z.object({
  venueId: z.string().min(1),
  fileUrl: z.string().url(),
  fileName: z.string(),
  fileType: z.enum(["excel", "csv", "image"]),
});

export type StartExtractionInput = z.infer<typeof startExtractionInputSchema>;

/**
 * Input for updating column mappings
 */
export const updateColumnMappingsInputSchema = z.object({
  extractionId: z.string(),
  mappings: z.array(columnMappingSchema),
});

export type UpdateColumnMappingsInput = z.infer<typeof updateColumnMappingsInputSchema>;

/**
 * Input for confirming extraction
 * Note: Uses .min(1) for IDs since Prisma uses CUID by default (not UUID)
 */
export const confirmExtractionInputSchema = z.object({
  extractionId: z.string(),
  venueId: z.string().min(1),
  weekStart: z.string(), // ISO date for week start
  shifts: z.array(
    z.object({
      staffName: z.string(),
      staffEmail: z.string().email().optional(),
      matchedUserId: z.string().min(1).optional(),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      position: z.string().optional(),
      notes: z.string().optional(),
    })
  ),
  unmatchedStaff: z.array(
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      shifts: z.array(
        z.object({
          date: z.string(),
          startTime: z.string(),
          endTime: z.string(),
          position: z.string().optional(),
        })
      ),
    })
  ).optional(),
  // Version creation options
  createAsNewVersion: z.boolean().optional(),
  existingRosterId: z.string().optional(), // The roster to create a new version from
  chainId: z.string().optional(), // Existing chain ID
  versionNumber: z.number().optional(), // Version number for new version
});

export type ConfirmExtractionInput = z.infer<typeof confirmExtractionInputSchema>;

/**
 * Input for manual staff matching
 * Note: Uses .min(1) for IDs since Prisma uses CUID by default (not UUID)
 */
export const manualStaffMatchInputSchema = z.object({
  extractionId: z.string(),
  extractedName: z.string(),
  userId: z.string().min(1),
});

export type ManualStaffMatchInput = z.infer<typeof manualStaffMatchInputSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get confidence level from numeric score
 */
export function getConfidenceLevel(score: number): ConfidenceLevel {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

/**
 * Get confidence color for UI display
 */
export function getConfidenceColor(confidence: ConfidenceLevel): string {
  switch (confidence) {
    case "high":
      return "text-green-600 bg-green-50 border-green-200";
    case "medium":
      return "text-yellow-600 bg-yellow-50 border-yellow-200";
    case "low":
      return "text-red-600 bg-red-50 border-red-200";
  }
}

/**
 * Format confidence as percentage string
 */
export function formatConfidence(score: number): string {
  return `${Math.round(score)}%`;
}

/**
 * Get column type display name
 */
export function getColumnTypeLabel(type: ColumnType): string {
  const labels: Record<ColumnType, string> = {
    staff_name: "Staff Name",
    staff_email: "Staff Email",
    staff_id: "Staff ID",
    date: "Date",
    day_of_week: "Day of Week",
    start_time: "Start Time",
    end_time: "End Time",
    shift_duration: "Shift Duration",
    position: "Position/Role",
    venue: "Venue",
    notes: "Notes",
    unknown: "Unknown",
  };
  return labels[type];
}

/**
 * Validate time format (HH:mm)
 */
export function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(time);
}

/**
 * Parse various time formats to HH:mm
 */
export function normalizeTimeFormat(time: string): string | null {
  if (!time) return null;

  // Already in HH:mm format
  if (isValidTimeFormat(time)) return time;

  // Handle 12-hour format (e.g., "9:00 AM", "2:30 PM")
  const twelveHourRegex = /^(\d{1,2}):?(\d{2})?\s*(am|pm|AM|PM)$/;
  const match = time.match(twelveHourRegex);

  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3].toLowerCase();

    if (period === "pm" && hours !== 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  // Handle decimal hours (e.g., "9.5" -> "09:30")
  const decimalMatch = time.match(/^(\d+)\.(\d+)$/);
  if (decimalMatch) {
    const hours = parseInt(decimalMatch[1], 10);
    const decimalPart = parseFloat(`0.${decimalMatch[2]}`);
    const minutes = Math.round(decimalPart * 60);
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  return null;
}

/**
 * Parse various date formats to ISO date string
 */
export function normalizeDateFormat(date: string): string | null {
  if (!date) return null;

  // Try parsing as ISO date
  const isoDate = new Date(date);
  if (!isNaN(isoDate.getTime())) {
    return isoDate.toISOString().split("T")[0];
  }

  // Handle common formats: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY
  const datePatterns = [
    { regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, format: "DD/MM/YYYY" },
    { regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, format: "DD-MM-YYYY" },
    { regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, format: "YYYY-MM-DD" },
  ];

  for (const pattern of datePatterns) {
    const match = date.match(pattern.regex);
    if (match) {
      let year: number, month: number, day: number;

      if (pattern.format === "YYYY-MM-DD") {
        [, year, month, day] = match.map(Number) as [string, number, number, number];
      } else {
        // Assume DD/MM/YYYY format (common in Australia)
        [, day, month, year] = match.map(Number) as [string, number, number, number];
      }

      const parsedDate = new Date(year, month - 1, day);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString().split("T")[0];
      }
    }
  }

  return null;
}
