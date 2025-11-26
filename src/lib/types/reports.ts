/**
 * Report Types - Phase 3 Security (Nov 2025)
 * Replaces `any` types with proper interfaces for type safety
 */

import type { Prisma } from "@prisma/client";

// ============================================================================
// Staff Types with Relations
// ============================================================================

/**
 * Availability record from Prisma
 */
export interface AvailabilityRecord {
  id: string;
  userId: string;
  dayOfWeek: number;
  startTime: string | null;
  endTime: string | null;
  isAvailable: boolean;
  isAllDay: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Time-off request from Prisma
 */
export interface TimeOffRequestRecord {
  id: string;
  userId: string;
  startDate: Date;
  endDate: Date;
  type: string;
  reason: string | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  notes: string | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Venue assignment with venue details
 */
export interface UserVenueRecord {
  id: string;
  userId: string;
  venueId: string;
  isPrimary: boolean;
  venue: {
    id: string;
    name: string;
    code: string;
    active: boolean;
  };
}

/**
 * Staff member with availability and time-off data
 * Used in suggestions service and availability reports
 */
export interface StaffWithAvailability {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  active: boolean;
  roleId: string;
  role?: {
    id: string;
    name: string;
  };
  availability: AvailabilityRecord[];
  timeOffRequests: TimeOffRequestRecord[];
  venues: UserVenueRecord[];
}

// ============================================================================
// Report Data Types
// ============================================================================

/**
 * Matrix report user data
 */
export interface MatrixReportUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role?: { name: string };
  venues?: Array<{ name: string }>;
  availability?: Record<string, {
    available: boolean;
    startTime?: string | null;
    endTime?: string | null;
    isAllDay?: boolean;
  }>;
}

/**
 * Coverage report daily data
 */
export interface CoverageDailyData {
  date: string;
  dayName: string;
  totalStaff: number;
  availableStaff: number;
  onTimeOff: number;
  coveragePercentage: number;
}

/**
 * Coverage report heatmap cell
 */
export interface CoverageHeatmapCell {
  dayOfWeek: number;
  hour: number;
  count: number;
  intensity: number;
}

/**
 * Conflict report entry
 */
export interface ConflictEntry {
  id: string;
  date: string;
  type: "understaffing" | "overlap" | "gap";
  severity: "critical" | "warning" | "info";
  description: string;
  affectedStaff: string[];
  resolution?: ConflictResolution;
}

/**
 * AI-generated conflict resolution
 */
export interface ConflictResolution {
  id: string;
  strategy: string;
  description: string;
  confidence: number;
  suggestedActions: string[];
}

/**
 * Gap report entry
 */
export interface GapEntry {
  id: string;
  date: string;
  dayName: string;
  startTime: string;
  endTime: string;
  gapHours: number;
}

/**
 * Calendar day data
 */
export interface CalendarDayData {
  date: string;
  totalStaff: number;
  availableStaff: number;
  onTimeOff: number;
  coverageStatus: "good" | "warning" | "critical";
}

// ============================================================================
// Export Report Types
// ============================================================================

/**
 * Report types for export functionality
 */
export type ReportType =
  | "availability-matrix"
  | "coverage"
  | "conflicts"
  | "gaps"
  | "calendar"
  | "time-off";

/**
 * Export format options
 */
export type ExportFormat = "csv" | "xlsx" | "pdf" | "ical";

/**
 * Matrix report data structure
 */
export interface MatrixReportData {
  users: MatrixReportUser[];
  dates: string[];
  startDate: string;
  endDate: string;
  venueFilter?: string;
}

/**
 * Coverage report data structure
 */
export interface CoverageReportData {
  summary: {
    totalStaff: number;
    avgCoverage: number;
    peakCoverage: number;
    lowCoverage: number;
  };
  dailyCoverage: CoverageDailyData[];
  heatmap: CoverageHeatmapCell[];
}

/**
 * Conflicts report data structure
 */
export interface ConflictsReportData {
  conflicts: ConflictEntry[];
  totalConflicts: number;
  criticalCount: number;
  warningCount: number;
}

/**
 * Gaps report data structure
 */
export interface GapsReportData {
  gaps: GapEntry[];
  totalGapHours: number;
}

/**
 * Calendar report data structure
 */
export interface CalendarReportData {
  days: CalendarDayData[];
  month: number;
  year: number;
}

/**
 * Union type for all report data structures
 */
export type ReportData =
  | MatrixReportData
  | CoverageReportData
  | ConflictsReportData
  | GapsReportData
  | CalendarReportData;

// ============================================================================
// Prisma Where Clause Types
// ============================================================================

/**
 * Type-safe user where input
 */
export type UserWhereInput = Prisma.UserWhereInput;

/**
 * Type-safe time-off request where input
 */
export type TimeOffRequestWhereInput = Prisma.TimeOffRequestWhereInput;
