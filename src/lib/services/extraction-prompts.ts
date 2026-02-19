/**
 * Extraction Prompts
 * 
 * Focused, rule-based prompts for GPT-4o vision extraction.
 * No explanations, no commentary - just structured JSON output.
 */

import type { ValidationError } from "./extraction-validator";

// ============================================================================
// MAIN EXTRACTION PROMPT
// ============================================================================

/**
 * System prompt for structured data extraction
 */
export const SYSTEM_PROMPT = `You are a structured data extraction engine.

Your objective is to reconstruct structured information from roster images with high fidelity.

You must:
- Observe before interpreting.
- Classify before extracting.
- Reconstruct structure before populating data.
- Avoid hallucination.
- Preserve relationships.
- Report uncertainty explicitly.

Your output must be structured JSON only.
No explanations.
No commentary.
No markdown.`;

/**
 * Main extraction prompt for roster images
 */
export const EXTRACTION_PROMPT = `Extract ALL shift entries from this roster image.

INTERNAL PROCESS:

Phase 1 — Visual Decomposition
- Identify layout zones (headers, data rows, sections).
- Detect alignment patterns (rows, columns, blocks).
- Detect grouping through spacing or borders.
- Detect repeated patterns (time formats, names).
- Detect labels and headers (days, dates, roles).

Phase 2 — Document Classification
- Determine roster type: weekly_roster, daily_roster, or monthly_roster
- Identify header row with dates
- Identify role sections if present (Driver, Kitchen Hand, etc.)

Phase 3 — Structural Reconstruction
- Identify header row with dates.
- Determine column count.
- Ensure row consistency.
- Maintain column alignment.
- Associate each time cell with: Name, Role, Date.

Phase 4 — Data Extraction
- Extract text exactly as seen.
- Identify role sections correctly (Driver, Kitchen Hand, Store Manager, etc.).
- Match each shift to correct date column.
- Detect (B) marker as break=true.
- Do not hallucinate missing entries.
- If uncertain about a cell, add to uncertain_fields and omit from shifts.

RULES:
- Each shift must become one JSON object.
- Only include rows where a time is present.
- Time format must be HH:MM-HH:MM (24-hour).
- If "(B)" appears next to a shift, set break=true.
- If a cell has multiple times like "8-4, 12-8", create TWO separate shift objects.
- Empty cells should not produce shifts.
- Time off entries (OFF, AL, Leave) should NOT be included as shifts.

OUTPUT SCHEMA:
{
  "week_start": "YYYY-MM-DD (first date in the roster)",
  "venue_name": "string or null",
  "confidence_score": 0-100,
  "shifts": [
    {
      "date": "YYYY-MM-DD",
      "day": "Monday",
      "role": "Driver",
      "staff_name": "Full Name",
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "break": false,
      "raw_cell": "original cell content"
    }
  ],
  "uncertain_fields": [
    {
      "field": "staff_name",
      "value": "J??n",
      "reason": "Unclear handwriting"
    }
  ]
}

Return only valid JSON following this schema.
No explanations.`;

// ============================================================================
// CORRECTION PROMPT
// ============================================================================

/**
 * Generate a correction prompt based on validation errors
 */
export function generateCorrectionPrompt(errors: ValidationError[]): string {
  const errorList = errors
    .map((e) => `- Shift #${e.shiftIndex + 1}: ${e.message} (field: ${e.field}, value: "${e.value}")`)
    .join("\n");

  return `The previous extraction had these validation errors:

${errorList}

Please correct these issues and extract again.

CORRECTION RULES:
- Fix time formats to HH:MM (24-hour).
- Fix date formats to YYYY-MM-DD.
- Ensure end_time > start_time (unless overnight shift).
- Remove duplicate entries.
- Fill in missing required fields if possible.
- If a field cannot be determined, remove that shift.

Return only valid JSON following the schema.
No explanations.`;
}

// ============================================================================
// CONFIDENCE THRESHOLDS
// ============================================================================

export const CONFIDENCE_THRESHOLDS = {
  /** Excellent extraction - accept immediately */
  excellent: 90,
  /** Good extraction - accept with minor review */
  good: 80,
  /** Fair extraction - accept but require review */
  fair: 70,
  /** Poor extraction - retry with correction prompt */
  poor: 60,
  /** Reject - manual review required */
  reject: 50,
} as const;

/**
 * Get confidence level label
 */
export function getConfidenceLevel(score: number): "excellent" | "good" | "fair" | "poor" | "reject" {
  if (score >= CONFIDENCE_THRESHOLDS.excellent) return "excellent";
  if (score >= CONFIDENCE_THRESHOLDS.good) return "good";
  if (score >= CONFIDENCE_THRESHOLDS.fair) return "fair";
  if (score >= CONFIDENCE_THRESHOLDS.poor) return "poor";
  return "reject";
}

/**
 * Check if confidence is acceptable
 */
export function isConfidenceAcceptable(score: number): boolean {
  return score >= CONFIDENCE_THRESHOLDS.fair;
}

/**
 * Check if retry should be attempted
 */
export function shouldRetry(score: number, attemptCount: number): boolean {
  return score < CONFIDENCE_THRESHOLDS.fair && attemptCount < 2;
}
