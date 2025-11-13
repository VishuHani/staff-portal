import { z } from "zod";

// ============================================================================
// DATE & TIME VALIDATION HELPERS
// ============================================================================

const dateSchema = z.union([
  z.string().datetime(), // ISO date string
  z.date(), // Date object
  z.string().refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  }),
]);

const timeSlotSchema = z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, {
  message: "Time must be in HH:mm format (e.g., 09:00, 14:30)",
});

// ============================================================================
// AVAILABILITY MATRIX FILTERS
// ============================================================================

export const matrixFiltersSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  venueId: z.string().optional(),
  roleId: z.string().optional(),
  timeSlotStart: timeSlotSchema.optional(),
  timeSlotEnd: timeSlotSchema.optional(),
  searchQuery: z.string().optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
  }
).refine(
  (data) => {
    // If time slot is provided, both start and end must be present
    if (data.timeSlotStart || data.timeSlotEnd) {
      return data.timeSlotStart && data.timeSlotEnd;
    }
    return true;
  },
  {
    message: "Both time slot start and end must be provided",
    path: ["timeSlotStart"],
  }
).refine(
  (data) => {
    // If time slot is provided, start must be before end
    if (data.timeSlotStart && data.timeSlotEnd) {
      const [startHour, startMin] = data.timeSlotStart.split(":").map(Number);
      const [endHour, endMin] = data.timeSlotEnd.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return startMinutes < endMinutes;
    }
    return true;
  },
  {
    message: "Time slot start must be before end",
    path: ["timeSlotStart"],
  }
);

export type MatrixFiltersInput = z.infer<typeof matrixFiltersSchema>;

// ============================================================================
// COVERAGE ANALYSIS FILTERS
// ============================================================================

export const coverageFiltersSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  venueId: z.string().optional(),
  requiredStaffing: z.number().int().positive().optional(),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
  }
);

export type CoverageFiltersInput = z.infer<typeof coverageFiltersSchema>;

// ============================================================================
// CONFLICTS REPORT FILTERS
// ============================================================================

export const conflictFiltersSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  venueId: z.string().optional(),
  severityLevel: z.enum(["all", "critical", "warning", "info"]).optional().default("all"),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
  }
);

export type ConflictFiltersInput = z.infer<typeof conflictFiltersSchema>;

// ============================================================================
// STAFFING GAPS FILTERS
// ============================================================================

export const gapFiltersSchema = z.object({
  startDate: dateSchema,
  endDate: dateSchema,
  venueId: z.string().optional(),
  minimumStaff: z.number().int().positive().optional().default(3),
}).refine(
  (data) => {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    return start <= end;
  },
  {
    message: "Start date must be before or equal to end date",
    path: ["startDate"],
  }
);

export type GapFiltersInput = z.infer<typeof gapFiltersSchema>;

// ============================================================================
// EXPORT SCHEMA
// ============================================================================

export const exportSchema = z.object({
  reportType: z.enum(["matrix", "coverage", "conflicts", "gaps", "calendar"]),
  format: z.enum(["csv", "excel", "pdf", "ical"]),
  data: z.any(), // The report data to export
  filters: z.any().optional(), // Optional filter metadata
  filename: z.string().optional(),
});

export type ExportInput = z.infer<typeof exportSchema>;

// ============================================================================
// DATE RANGE PRESETS (for UI)
// ============================================================================

export type DateRangePreset =
  | "today"
  | "tomorrow"
  | "thisWeek"
  | "nextWeek"
  | "thisMonth"
  | "nextMonth"
  | "lastMonth"
  | "custom";

export const dateRangePresetSchema = z.enum([
  "today",
  "tomorrow",
  "thisWeek",
  "nextWeek",
  "thisMonth",
  "nextMonth",
  "lastMonth",
  "custom",
]);

// ============================================================================
// SAVED REPORT FILTERS (for future saved reports feature)
// ============================================================================

export const savedReportSchema = z.object({
  id: z.string().optional(), // For updates
  name: z.string().min(1, "Name is required").max(100),
  reportType: z.enum(["matrix", "coverage", "conflicts", "gaps"]),
  filters: z.any(), // The actual filter object (will be one of the above schemas)
  isDefault: z.boolean().optional().default(false),
});

export type SavedReportInput = z.infer<typeof savedReportSchema>;

// ============================================================================
// AI QUERY SCHEMA (for Phase 3)
// ============================================================================

export const aiQuerySchema = z.object({
  query: z.string().min(3, "Query must be at least 3 characters").max(500),
  context: z.object({
    venueId: z.string().optional(),
    dateRange: z.object({
      start: dateSchema.optional(),
      end: dateSchema.optional(),
    }).optional(),
  }).optional(),
});

export type AIQueryInput = z.infer<typeof aiQuerySchema>;

// ============================================================================
// REPORT CACHE SCHEMA
// ============================================================================

export const reportCacheSchema = z.object({
  reportType: z.string(),
  filters: z.any(),
  data: z.any(),
  expiresAt: z.date(),
});

export type ReportCacheInput = z.infer<typeof reportCacheSchema>;

// ============================================================================
// AVAILABILITY SNAPSHOT SCHEMA
// ============================================================================

export const availabilitySnapshotSchema = z.object({
  venueId: z.string().optional(),
  snapshotDate: z.date(),
  totalStaff: z.number().int().nonnegative(),
  availableStaff: z.number().int().nonnegative(),
  coverage: z.record(z.string(), z.any()), // JSON object with coverage data
});

export type AvailabilitySnapshotInput = z.infer<typeof availabilitySnapshotSchema>;
