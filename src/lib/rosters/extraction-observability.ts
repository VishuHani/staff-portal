/**
 * Observability utilities for roster extraction
 * 
 * This module provides:
 * - Structured logging for extraction events
 * - Metrics collection for extraction attempts
 * - Match quality metrics
 * - Failure taxonomy for error classification
 */

// ============================================================================
// TYPES
// ============================================================================

export type ExtractionEventType =
  | "extraction_started"
  | "extraction_completed"
  | "extraction_failed"
  | "extraction_retried"
  | "upload_received"
  | "preprocessing_completed"
  | "ai_call_started"
  | "ai_call_completed"
  | "ai_call_failed"
  | "matching_started"
  | "matching_completed"
  | "validation_started"
  | "validation_completed"
  | "roster_created"
  | "roster_creation_failed";

export type FailureCategory =
  | "upload_error"
  | "file_too_large"
  | "invalid_file_type"
  | "preprocessing_error"
  | "ai_timeout"
  | "ai_rate_limit"
  | "ai_invalid_response"
  | "ai_content_filter"
  | "matching_error"
  | "validation_error"
  | "database_error"
  | "idempotency_conflict"
  | "unknown_error";

export type MatchQualityLevel = "excellent" | "good" | "fair" | "poor";

export interface ExtractionLogEvent {
  timestamp: string;
  eventType: ExtractionEventType;
  venueId: string;
  userId: string;
  correlationId: string;
  duration?: number;
  metadata: Record<string, unknown>;
  error?: {
    category: FailureCategory;
    message: string;
    stack?: string;
  };
}

export interface ExtractionMetrics {
  // Attempt metrics
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  retriedAttempts: number;
  
  // Timing metrics
  averageProcessingTimeMs: number;
  p50ProcessingTimeMs: number;
  p95ProcessingTimeMs: number;
  p99ProcessingTimeMs: number;
  
  // Quality metrics
  averageConfidence: number;
  averageMatchRate: number;
  shiftsPerExtraction: number;
  
  // Failure breakdown
  failuresByCategory: Record<FailureCategory, number>;
}

export interface MatchQualityMetrics {
  totalShifts: number;
  matchedShifts: number;
  unmatchedShifts: number;
  exactMatches: number;
  highConfidenceMatches: number;
  mediumConfidenceMatches: number;
  lowConfidenceMatches: number;
  manualConfirmations: number;
  averageConfidence: number;
  matchRate: number;
  qualityLevel: MatchQualityLevel;
}

// ============================================================================
// STRUCTURED LOGGING
// ============================================================================

/**
 * Log an extraction event with structured data
 */
export function logExtractionEvent(
  eventType: ExtractionEventType,
  params: {
    venueId: string;
    userId: string;
    correlationId: string;
    duration?: number;
    metadata?: Record<string, unknown>;
    error?: {
      category: FailureCategory;
      message: string;
      stack?: string;
    };
  }
): void {
  const event: ExtractionLogEvent = {
    timestamp: new Date().toISOString(),
    eventType,
    venueId: params.venueId,
    userId: params.userId,
    correlationId: params.correlationId,
    duration: params.duration,
    metadata: params.metadata || {},
    error: params.error,
  };

  // Use structured logging format
  const logLevel = eventType.includes("failed") ? "error" : "info";
  const logMessage = `[EXTRACTION] ${eventType}`;

  if (logLevel === "error") {
    console.error(logMessage, JSON.stringify(event, null, 2));
  } else {
    console.log(logMessage, JSON.stringify(event));
  }
}

/**
 * Create a correlation ID for tracking related events
 */
export function createCorrelationId(): string {
  return `ext-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a timed logger that automatically tracks duration
 */
export function createTimedLogger(
  eventType: ExtractionEventType,
  params: {
    venueId: string;
    userId: string;
    correlationId: string;
  }
): {
  complete: (metadata?: Record<string, unknown>) => void;
  fail: (category: FailureCategory, message: string, metadata?: Record<string, unknown>) => void;
} {
  const startTime = Date.now();

  return {
    complete: (metadata?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      logExtractionEvent(eventType, {
        ...params,
        duration,
        metadata,
      });
    },

    fail: (category: FailureCategory, message: string, metadata?: Record<string, unknown>) => {
      const duration = Date.now() - startTime;
      logExtractionEvent(`${eventType}_failed` as ExtractionEventType, {
        ...params,
        duration,
        metadata,
        error: {
          category,
          message,
        },
      });
    },
  };
}

// ============================================================================
// FAILURE TAXONOMY
// ============================================================================

/**
 * Classify an error into a failure category
 */
export function classifyFailure(error: unknown): FailureCategory {
  if (!error) return "unknown_error";

  const message = error instanceof Error ? error.message : String(error).toLowerCase();

  // Upload errors
  if (message.includes("file too large") || message.includes("size exceeds")) {
    return "file_too_large";
  }
  if (message.includes("invalid file type") || message.includes("unsupported file")) {
    return "invalid_file_type";
  }
  if (message.includes("upload failed") || message.includes("network error")) {
    return "upload_error";
  }

  // AI errors
  if (message.includes("timeout") || message.includes("timed out")) {
    return "ai_timeout";
  }
  if (message.includes("rate limit") || message.includes("too many requests")) {
    return "ai_rate_limit";
  }
  if (message.includes("invalid response") || message.includes("parse error") || message.includes("json")) {
    return "ai_invalid_response";
  }
  if (message.includes("content filter") || message.includes("safety") || message.includes("blocked")) {
    return "ai_content_filter";
  }

  // Processing errors
  if (message.includes("preprocessing") || message.includes("image processing")) {
    return "preprocessing_error";
  }
  if (message.includes("matching") || message.includes("staff match")) {
    return "matching_error";
  }
  if (message.includes("validation") || message.includes("invalid shift")) {
    return "validation_error";
  }

  // Database errors
  if (message.includes("database") || message.includes("prisma") || message.includes("connection")) {
    return "database_error";
  }
  if (message.includes("duplicate") || message.includes("idempotency") || message.includes("already exists")) {
    return "idempotency_conflict";
  }

  return "unknown_error";
}

/**
 * Get a user-friendly error message for a failure category
 */
export function getFailureMessage(category: FailureCategory): string {
  const messages: Record<FailureCategory, string> = {
    upload_error: "Failed to upload the file. Please check your connection and try again.",
    file_too_large: "The file is too large. Please use a smaller image (max 10MB).",
    invalid_file_type: "Invalid file type. Please upload a PNG, JPG, or spreadsheet file.",
    preprocessing_error: "Failed to process the image. Please try a clearer image.",
    ai_timeout: "The extraction took too long. Please try again with a simpler roster.",
    ai_rate_limit: "Too many extraction requests. Please wait a moment and try again.",
    ai_invalid_response: "Received an invalid response from the AI. Please try again.",
    ai_content_filter: "The image was blocked by content filters. Please use a different image.",
    matching_error: "Failed to match staff members. Please verify your staff list.",
    validation_error: "The extracted data has validation errors. Please review and correct.",
    database_error: "A database error occurred. Please try again later.",
    idempotency_conflict: "This roster has already been created.",
    unknown_error: "An unexpected error occurred. Please try again.",
  };

  return messages[category];
}

// ============================================================================
// MATCH QUALITY METRICS
// ============================================================================

/**
 * Calculate match quality metrics from shift data
 */
export function calculateMatchQualityMetrics(shifts: Array<{
  matchedUserId: string | null;
  matchConfidence: number;
  matchStrategy?: string;
  requiresMatchConfirmation?: boolean;
}>): MatchQualityMetrics {
  const totalShifts = shifts.length;
  const matchedShifts = shifts.filter((s) => s.matchedUserId).length;
  const unmatchedShifts = totalShifts - matchedShifts;

  const exactMatches = shifts.filter(
    (s) => s.matchStrategy === "exact_email" || s.matchStrategy === "exact_full_name"
  ).length;

  const highConfidenceMatches = shifts.filter(
    (s) => s.matchedUserId && s.matchConfidence >= 85 && s.matchStrategy !== "exact_email" && s.matchStrategy !== "exact_full_name"
  ).length;

  const mediumConfidenceMatches = shifts.filter(
    (s) => s.matchedUserId && s.matchConfidence >= 60 && s.matchConfidence < 85
  ).length;

  const lowConfidenceMatches = shifts.filter(
    (s) => s.matchedUserId && s.matchConfidence < 60
  ).length;

  const manualConfirmations = shifts.filter((s) => s.requiresMatchConfirmation).length;

  const confidenceScores = shifts
    .filter((s) => s.matchedUserId)
    .map((s) => s.matchConfidence);

  const averageConfidence =
    confidenceScores.length > 0
      ? confidenceScores.reduce((a, b) => a + b, 0) / confidenceScores.length
      : 0;

  const matchRate = totalShifts > 0 ? (matchedShifts / totalShifts) * 100 : 0;

  // Determine quality level
  let qualityLevel: MatchQualityLevel;
  if (matchRate >= 95 && averageConfidence >= 90) {
    qualityLevel = "excellent";
  } else if (matchRate >= 85 && averageConfidence >= 75) {
    qualityLevel = "good";
  } else if (matchRate >= 70 && averageConfidence >= 60) {
    qualityLevel = "fair";
  } else {
    qualityLevel = "poor";
  }

  return {
    totalShifts,
    matchedShifts,
    unmatchedShifts,
    exactMatches,
    highConfidenceMatches,
    mediumConfidenceMatches,
    lowConfidenceMatches,
    manualConfirmations,
    averageConfidence,
    matchRate,
    qualityLevel,
  };
}

/**
 * Get a quality assessment message
 */
export function getQualityAssessment(metrics: MatchQualityMetrics): {
  summary: string;
  recommendations: string[];
} {
  const recommendations: string[] = [];
  let summary = "";

  switch (metrics.qualityLevel) {
    case "excellent":
      summary = "Excellent extraction quality! All staff matched with high confidence.";
      break;
    case "good":
      summary = "Good extraction quality. Most staff matched successfully.";
      if (metrics.unmatchedShifts > 0) {
        recommendations.push(
          `${metrics.unmatchedShifts} staff members could not be automatically matched. Review and confirm manually.`
        );
      }
      break;
    case "fair":
      summary = "Fair extraction quality. Some staff require manual verification.";
      recommendations.push(
        "Review all matches before confirming the roster.",
        "Consider adding staff nicknames or aliases to improve future matching."
      );
      break;
    case "poor":
      summary = "Poor extraction quality. Significant manual intervention required.";
      recommendations.push(
        "Check the image quality and ensure staff names are clearly visible.",
        "Verify that all staff members exist in the system.",
        "Consider manually creating the roster instead."
      );
      break;
  }

  if (metrics.lowConfidenceMatches > 0) {
    recommendations.push(
      `${metrics.lowConfidenceMatches} matches have low confidence. Please verify these manually.`
    );
  }

  return { summary, recommendations };
}

// ============================================================================
// METRICS AGGREGATION
// ============================================================================

/**
 * In-memory metrics store (for development/testing)
 * In production, this should be replaced with a proper metrics service
 */
const metricsStore: {
  attempts: Array<{
    timestamp: number;
    success: boolean;
    duration: number;
    confidence: number;
    matchRate: number;
    shiftCount: number;
    failureCategory?: FailureCategory;
  }>;
} = {
  attempts: [],
};

/**
 * Record an extraction attempt
 */
export function recordExtractionAttempt(params: {
  success: boolean;
  duration: number;
  confidence: number;
  matchRate: number;
  shiftCount: number;
  failureCategory?: FailureCategory;
}): void {
  metricsStore.attempts.push({
    timestamp: Date.now(),
    success: params.success,
    duration: params.duration,
    confidence: params.confidence,
    matchRate: params.matchRate,
    shiftCount: params.shiftCount,
    failureCategory: params.failureCategory,
  });

  // Keep only last 1000 attempts in memory
  if (metricsStore.attempts.length > 1000) {
    metricsStore.attempts = metricsStore.attempts.slice(-1000);
  }
}

/**
 * Get aggregated metrics
 */
export function getExtractionMetrics(timeWindowMs?: number): ExtractionMetrics {
  const now = Date.now();
  const cutoff = timeWindowMs ? now - timeWindowMs : 0;

  const attempts = metricsStore.attempts.filter((a) => a.timestamp >= cutoff);

  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      successfulAttempts: 0,
      failedAttempts: 0,
      retriedAttempts: 0,
      averageProcessingTimeMs: 0,
      p50ProcessingTimeMs: 0,
      p95ProcessingTimeMs: 0,
      p99ProcessingTimeMs: 0,
      averageConfidence: 0,
      averageMatchRate: 0,
      shiftsPerExtraction: 0,
      failuresByCategory: {} as Record<FailureCategory, number>,
    };
  }

  const successful = attempts.filter((a) => a.success);
  const failed = attempts.filter((a) => !a.success);

  const durations = attempts.map((a) => a.duration).sort((a, b) => a - b);
  const confidences = successful.map((a) => a.confidence);
  const matchRates = successful.map((a) => a.matchRate);
  const shiftCounts = successful.map((a) => a.shiftCount);

  // Calculate percentiles
  const percentile = (arr: number[], p: number): number => {
    if (arr.length === 0) return 0;
    const idx = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, idx)];
  };

  // Count failures by category
  const failuresByCategory: Record<FailureCategory, number> = {
    upload_error: 0,
    file_too_large: 0,
    invalid_file_type: 0,
    preprocessing_error: 0,
    ai_timeout: 0,
    ai_rate_limit: 0,
    ai_invalid_response: 0,
    ai_content_filter: 0,
    matching_error: 0,
    validation_error: 0,
    database_error: 0,
    idempotency_conflict: 0,
    unknown_error: 0,
  };

  for (const attempt of failed) {
    if (attempt.failureCategory) {
      failuresByCategory[attempt.failureCategory]++;
    }
  }

  return {
    totalAttempts: attempts.length,
    successfulAttempts: successful.length,
    failedAttempts: failed.length,
    retriedAttempts: 0, // Would need to track this separately
    averageProcessingTimeMs:
      durations.reduce((a, b) => a + b, 0) / durations.length,
    p50ProcessingTimeMs: percentile(durations, 50),
    p95ProcessingTimeMs: percentile(durations, 95),
    p99ProcessingTimeMs: percentile(durations, 99),
    averageConfidence:
      confidences.length > 0
        ? confidences.reduce((a, b) => a + b, 0) / confidences.length
        : 0,
    averageMatchRate:
      matchRates.length > 0
        ? matchRates.reduce((a, b) => a + b, 0) / matchRates.length
        : 0,
    shiftsPerExtraction:
      shiftCounts.length > 0
        ? shiftCounts.reduce((a, b) => a + b, 0) / shiftCounts.length
        : 0,
    failuresByCategory,
  };
}
