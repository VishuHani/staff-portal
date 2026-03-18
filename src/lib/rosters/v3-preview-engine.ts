import { addDays, format, parseISO } from "date-fns";
import type {
  ConfidenceLevel,
  ExtractedShift,
  RosterExtractionResult,
  StaffMatch,
} from "@/lib/schemas/rosters/extraction";
import type {
  MatchStrategy,
  ConfidenceBand,
} from "@/lib/rosters/staff-matching-engine";

export interface V3MatchedShiftInput {
  shift: {
    date: string;
    day: string;
    role: string | null;
    staff_name: string;
    start_time: string;
    end_time: string;
    break?: boolean;
  };
  matchedUserId: string | null;
  matchConfidence: number;
  /** Strategy used for matching (from staff-matching-engine) */
  matchStrategy?: MatchStrategy;
  /** Human-readable explanation of how match was determined */
  matchReason?: string;
  /** Alternative matches that were considered */
  matchAlternatives?: Array<{
    userId: string;
    confidence: number;
    staffName: string;
  }>;
  /** Whether this match requires manual confirmation */
  requiresConfirmation?: boolean;
}

export interface PreviewShiftState {
  id: string;
  rowIndex: number;
  staff_name: string;
  date: string;
  day: string;
  role: string | null;
  start_time: string;
  end_time: string;
  break: boolean;
  matchedUserId: string | null;
  matchConfidence: number;
  /** Strategy used for matching */
  matchStrategy?: MatchStrategy;
  /** Confidence band classification */
  matchConfidenceBand?: ConfidenceBand;
  /** Human-readable explanation */
  matchReason?: string;
  /** Alternative matches for disambiguation UI */
  matchAlternatives?: Array<{
    userId: string;
    confidence: number;
    staffName: string;
  }>;
  /** Whether manual confirmation is required */
  requiresMatchConfirmation?: boolean;
  included: boolean;
  issues: string[];
}

function confidenceFromScore(score: number): ConfidenceLevel {
  if (score >= 85) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function normalizeDateToWeek(date: string, day: string, weekStart: string): string {
  // Prefer valid ISO date when present
  const parsed = new Date(date);
  if (!Number.isNaN(parsed.getTime())) {
    return format(parsed, "yyyy-MM-dd");
  }

  // Fallback: map day label to weekStart + offset
  const dayMap: Record<string, number> = {
    monday: 0,
    mon: 0,
    tuesday: 1,
    tue: 1,
    tues: 1,
    wednesday: 2,
    wed: 2,
    thursday: 3,
    thu: 3,
    thurs: 3,
    friday: 4,
    fri: 4,
    saturday: 5,
    sat: 5,
    sunday: 6,
    sun: 6,
  };

  const key = day.toLowerCase().trim();
  const offset = dayMap[key] ?? 0;
  return format(addDays(parseISO(weekStart), offset), "yyyy-MM-dd");
}

function hasOvernightTimeOrder(startTime: string, endTime: string): boolean {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return false;
  return eh * 60 + em <= sh * 60 + sm;
}

export function buildPreviewShiftState(params: {
  matchedShifts: V3MatchedShiftInput[];
  weekStart: string;
  validationErrorsByIndex: Map<number, string[]>;
  validationWarningsByIndex: Map<number, string[]>;
}): PreviewShiftState[] {
  const { matchedShifts, weekStart, validationErrorsByIndex, validationWarningsByIndex } = params;

  return matchedShifts.map((entry, idx) => {
    const normalizedDate = normalizeDateToWeek(entry.shift.date, entry.shift.day, weekStart);
    const issues = [
      ...(validationErrorsByIndex.get(idx) || []),
      ...(validationWarningsByIndex.get(idx) || []),
    ];

    if (hasOvernightTimeOrder(entry.shift.start_time, entry.shift.end_time)) {
      issues.push("Shift appears overnight or has invalid time order (end <= start)");
    }

    // Add match-related issues
    if (!entry.matchedUserId) {
      issues.push(`No staff match found for "${entry.shift.staff_name}"`);
    } else if (entry.requiresConfirmation) {
      issues.push(`Match requires confirmation (${entry.matchConfidence}% confidence)`);
    }

    return {
      id: `v3-${idx}`,
      rowIndex: idx,
      staff_name: entry.shift.staff_name,
      date: normalizedDate,
      day: entry.shift.day,
      role: entry.shift.role,
      start_time: entry.shift.start_time,
      end_time: entry.shift.end_time,
      break: !!entry.shift.break,
      matchedUserId: entry.matchedUserId,
      matchConfidence: entry.matchConfidence,
      matchStrategy: entry.matchStrategy,
      matchConfidenceBand: entry.matchConfidence >= 100 ? 'exact' 
        : entry.matchConfidence >= 85 ? 'high'
        : entry.matchConfidence >= 60 ? 'medium'
        : entry.matchConfidence >= 40 ? 'low'
        : 'none',
      matchReason: entry.matchReason,
      matchAlternatives: entry.matchAlternatives,
      requiresMatchConfirmation: entry.requiresConfirmation,
      included: true,
      issues,
    };
  });
}

export function buildStaffMatches(
  shifts: PreviewShiftState[],
  venueStaff: Array<{ id: string; name: string; email: string }>
): StaffMatch[] {
  const byName = new Map<string, PreviewShiftState[]>();

  for (const shift of shifts) {
    const key = shift.staff_name.toLowerCase().trim();
    const list = byName.get(key) || [];
    list.push(shift);
    byName.set(key, list);
  }

  const matches: StaffMatch[] = [];
  for (const [key, list] of byName.entries()) {
    const first = list[0];
    const bestMatch = list.find((s) => s.matchedUserId) || first;
    const matchedStaff = bestMatch.matchedUserId
      ? venueStaff.find((s) => s.id === bestMatch.matchedUserId)
      : undefined;

    const confidence = Math.max(...list.map((s) => s.matchConfidence));
    
    // Determine match type based on strategy and confidence
    let matchType: StaffMatch["matchType"] = "none";
    if (matchedStaff) {
      if (bestMatch.matchStrategy === 'exact_email' || bestMatch.matchStrategy === 'exact_full_name') {
        matchType = "exact_name";
      } else if (bestMatch.matchStrategy === 'alias_match') {
        matchType = "exact_name"; // Alias matches are treated as exact
      } else if (confidence >= 85) {
        matchType = "fuzzy_name";
      } else {
        matchType = "partial";
      }
    }

    matches.push({
      extractedName: first.staff_name,
      extractedEmail: null,
      matchedUserId: matchedStaff?.id || null,
      matchedUserName: matchedStaff?.name || null,
      matchedUserEmail: matchedStaff?.email || null,
      confidence,
      matchType,
      // Include additional metadata for UI
      matchStrategy: bestMatch.matchStrategy,
      matchReason: bestMatch.matchReason,
      alternatives: bestMatch.matchAlternatives,
      requiresConfirmation: bestMatch.requiresMatchConfirmation,
    } as StaffMatch & {
      matchStrategy?: MatchStrategy;
      matchReason?: string;
      alternatives?: Array<{ userId: string; confidence: number; staffName: string }>;
      requiresConfirmation?: boolean;
    });
  }

  return matches;
}

export function buildMatrixExtractionResult(params: {
  shifts: PreviewShiftState[];
  venueStaff: Array<{ id: string; name: string; email: string }>;
  fileName: string;
  weekStart: string;
  extractionConfidence: number;
  warnings: string[];
  errors: string[];
}): RosterExtractionResult {
  const {
    shifts,
    venueStaff,
    fileName,
    weekStart,
    extractionConfidence,
    warnings,
    errors,
  } = params;

  const staffMatches = buildStaffMatches(shifts, venueStaff);

  const mappedShifts: ExtractedShift[] = shifts.map((s) => ({
    id: s.id,
    rowIndex: s.rowIndex,
    staffName: s.staff_name,
    staffEmail: null,
    staffId: null,
    date: s.date,
    dayOfWeek: s.day,
    startTime: s.start_time,
    endTime: s.end_time,
    position: s.role,
    venue: null,
    notes: s.break ? "Break included" : null,
    rawData: {
      staff_name: s.staff_name,
      date: s.date,
      day: s.day,
      start_time: s.start_time,
      end_time: s.end_time,
      role: s.role || "",
      break: String(s.break),
    },
    confidence: confidenceFromScore(s.matchConfidence),
    issues: s.issues,
    matched: !!s.matchedUserId,
    matchedUserId: s.matchedUserId,
  }));

  const validShifts = mappedShifts.filter((s) => s.issues.length === 0).length;
  const matchedCount = staffMatches.filter((m) => m.matchedUserId).length;

  return {
    id: `v3-preview-${fileName}`,
    fileId: `v3-file-${fileName}`,
    fileName,
    fileType: "image",
    fileUrl: "https://local/v3-preview",
    extractedAt: new Date().toISOString(),
    detectedColumns: [],
    headerRow: null,
    dataStartRow: 1,
    totalRows: shifts.length,
    shifts: mappedShifts,
    staffMatches,
    matchedCount,
    unmatchedCount: staffMatches.length - matchedCount,
    overallConfidence: confidenceFromScore(extractionConfidence),
    confidenceScore: extractionConfidence,
    validShifts,
    invalidShifts: shifts.length - validShifts,
    warnings,
    errors,
    ocrConfidence: extractionConfidence,
    imageQuality: "fair",
    metadata: {
      extractionVersion: "v2",
      phasesCompleted: 1,
      processingTimeMs: 0,
      structure: {
        type: "matrix",
        columns: [],
        staffRows: [],
        complexCells: [],
        congestedAreas: [],
        confidence: extractionConfidence,
      },
      validation: {
        totalShifts: shifts.length,
        staffCounts: {},
        anomalies: [],
        overallConfidence: extractionConfidence,
        recommendations: [],
        extractionQuality:
          extractionConfidence >= 90
            ? "excellent"
            : extractionConfidence >= 75
              ? "good"
              : extractionConfidence >= 60
                ? "fair"
                : "poor",
      },
    },
  };
}

export function toConfirmPayloadShifts(shifts: PreviewShiftState[]) {
  return shifts
    .filter((s) => s.included)
    .map((s) => ({
      staff_name: s.staff_name,
      matchedUserId: s.matchedUserId || undefined,
      date: s.date,
      start_time: s.start_time,
      end_time: s.end_time,
      role: s.role || undefined,
      break: s.break,
    }));
}

/**
 * Categorize shifts into resolved, needs review, and unresolved
 * for the unresolved identity workflow
 */
export function categorizeShiftsByMatchStatus(shifts: PreviewShiftState[]): {
  resolved: PreviewShiftState[];
  needsReview: PreviewShiftState[];
  unresolved: PreviewShiftState[];
} {
  const resolved: PreviewShiftState[] = [];
  const needsReview: PreviewShiftState[] = [];
  const unresolved: PreviewShiftState[] = [];

  for (const shift of shifts) {
    if (!shift.matchedUserId) {
      unresolved.push(shift);
    } else if (shift.requiresMatchConfirmation) {
      needsReview.push(shift);
    } else {
      resolved.push(shift);
    }
  }

  return { resolved, needsReview, unresolved };
}

/**
 * Get matching statistics for display in the UI
 */
export function getMatchingStatistics(shifts: PreviewShiftState[]): {
  total: number;
  matched: number;
  autoMatched: number;
  needsConfirmation: number;
  unmatched: number;
  byConfidenceBand: Record<ConfidenceBand, number>;
  byStrategy: Record<MatchStrategy, number>;
} {
  const stats = {
    total: shifts.length,
    matched: 0,
    autoMatched: 0,
    needsConfirmation: 0,
    unmatched: 0,
    byConfidenceBand: {
      exact: 0,
      high: 0,
      medium: 0,
      low: 0,
      none: 0,
    } as Record<ConfidenceBand, number>,
    byStrategy: {
      exact_email: 0,
      exact_full_name: 0,
      exact_first_name: 0,
      name_with_initial: 0,
      alias_match: 0,
      fuzzy_high: 0,
      fuzzy_medium: 0,
      fuzzy_low: 0,
      no_match: 0,
    } as Record<MatchStrategy, number>,
  };

  for (const shift of shifts) {
    if (shift.matchedUserId) {
      stats.matched++;
      if (!shift.requiresMatchConfirmation) {
        stats.autoMatched++;
      } else {
        stats.needsConfirmation++;
      }
    } else {
      stats.unmatched++;
    }

    stats.byConfidenceBand[shift.matchConfidenceBand || 'none']++;
    stats.byStrategy[shift.matchStrategy || 'no_match']++;
  }

  return stats;
}

/**
 * Check if confirmation should be blocked due to unresolved identities
 */
export function hasBlockingUnresolvedIdentities(
  shifts: PreviewShiftState[],
  config: { allowPartialMatch?: boolean; minConfidence?: number } = {}
): {
  blocked: boolean;
  reason: string | null;
  unresolvedCount: number;
  needsReviewCount: number;
} {
  const { allowPartialMatch = false, minConfidence = 85 } = config;
  
  const { unresolved, needsReview } = categorizeShiftsByMatchStatus(shifts);
  
  // Count included shifts that have issues
  const includedUnresolved = unresolved.filter(s => s.included);
  const includedNeedsReview = needsReview.filter(s => s.included);
  
  if (includedUnresolved.length > 0) {
    return {
      blocked: true,
      reason: `${includedUnresolved.length} shift(s) have unmatched staff that must be resolved before confirmation`,
      unresolvedCount: includedUnresolved.length,
      needsReviewCount: includedNeedsReview.length,
    };
  }
  
  if (!allowPartialMatch && includedNeedsReview.length > 0) {
    return {
      blocked: true,
      reason: `${includedNeedsReview.length} shift(s) have low-confidence matches that require manual confirmation`,
      unresolvedCount: 0,
      needsReviewCount: includedNeedsReview.length,
    };
  }
  
  return {
    blocked: false,
    reason: null,
    unresolvedCount: 0,
    needsReviewCount: includedNeedsReview.length,
  };
}

