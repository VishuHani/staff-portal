/**
 * Roster Extraction V2 Service
 * Multi-phase extraction with deep understanding
 * 
 * PHASES:
 * 1. SEE - Structure Analysis (GPT-4o Vision)
 * 2. THINK - Cell Parsing (GPT-4o Vision)
 * 3. EXTRACT - Shift Creation (Rule-based)
 * 4. VALIDATE - Quality Check (GPT-4o-mini)
 */

import * as XLSX from "xlsx";
import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import {
  type RosterExtractionResult,
  type ExtractedShift,
  type ColumnMapping,
  type StaffMatch,
  type ColumnType,
  type RosterFileSource,
  getConfidenceLevel,
  normalizeTimeFormat,
  normalizeDateFormat,
} from "@/lib/schemas/rosters/extraction";

// ============================================================================
// TYPES
// ============================================================================

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
}

interface ExtractionContext {
  venueId: string;
  venueStaff: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  }>;
}

// Phase 1: Structure Analysis Types
interface ColumnInfo {
  name: string;
  type: "staff" | "date" | "day" | "time_start" | "time_end" | "position" | "notes" | "unknown";
  index: number;
}

interface StaffRowInfo {
  rowIndex: number;
  staffName: string;
  dataRegion: { startCol: number; endCol: number };
}

interface ComplexCell {
  row: number;
  col: number;
  columnName: string;
  type: "multi-shift" | "merged" | "overlapping" | "unclear" | "time-range";
  rawContent: string;
}

interface RosterStructure {
  type: "weekly_roster" | "daily_roster" | "monthly_roster" | "unknown";
  columns: ColumnInfo[];
  staffRows: StaffRowInfo[];
  complexCells: ComplexCell[];
  congestedAreas: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  confidence: number;
  rawText?: string;
}

// Phase 2: Cell Parsing Types
interface ParsedShift {
  startTime: string;
  endTime: string;
  position?: string;
  notes?: string;
  isTimeOff?: boolean;
  timeOffType?: string;
}

interface ParsedCell {
  row: number;
  col: number;
  columnName: string;
  staffName: string;
  date: string;
  dayOfWeek?: string;
  rawContent: string;
  shifts: ParsedShift[];
  confidence: number;
  issues: string[];
}

// Phase 4: Validation Types
interface StaffShiftCount {
  extracted: number;
  expected: string;
  daysWithShifts: string[];
  daysWithoutShifts: string[];
}

interface ValidationAnomaly {
  type: "low_shift_count" | "missing_days" | "unusual_times" | "duplicate_shifts" | "unmatched_staff";
  staff: string;
  details: string;
  severity: "warning" | "error" | "info";
}

interface ValidationResult {
  totalShifts: number;
  staffCounts: Record<string, StaffShiftCount>;
  anomalies: ValidationAnomaly[];
  overallConfidence: number;
  recommendations: string[];
  extractionQuality: "excellent" | "good" | "fair" | "poor";
}

// Extended Result Type for V2
interface RosterExtractionResultV2 extends RosterExtractionResult {
  metadata: {
    extractionVersion: "v2";
    phasesCompleted: number;
    processingTimeMs: number;
    structure: RosterStructure;
    validation: ValidationResult;
  };
}

// ============================================================================
// PHASE 1: STRUCTURE ANALYSIS
// ============================================================================

/**
 * Phase 1: Analyze the roster structure
 * Identifies table layout, columns, staff rows, and complex cells
 */
async function analyzeRosterStructure(
  base64Image: string,
  mimeType: string
): Promise<RosterStructure> {
  const prompt = `You are analyzing a roster/schedule image to understand its structure BEFORE extracting data.

STEP 1: Identify the table layout
- What type of roster is this? (weekly, daily, monthly)
- How many columns and rows?
- What are the column headers?

STEP 2: Identify date context
- What is the date range for this roster?
- Are dates explicit (written in cells) or implicit (day names only)?

STEP 3: Identify staff rows
- Which rows contain staff names?
- What is the data region for each staff member?

STEP 4: Identify complex cells (CRITICAL)
- Are there any merged cells?
- Are there cells with multiple shifts (e.g., "8-4, 12-8" or "9-5 / 6-10")?
- Are there congested or overlapping time entries?
- Any cells with split shifts?
- Any unclear or hard-to-read areas?

STEP 5: Identify congested areas
- Which columns have overlapping or hard-to-read times?
- Are there any areas where shifts might be missed?

Return JSON with this EXACT structure:
{
  "type": "weekly_roster" | "daily_roster" | "monthly_roster" | "unknown",
  "columns": [
    {"name": "Staff", "type": "staff", "index": 0},
    {"name": "Monday", "type": "day", "index": 1},
    ...
  ],
  "staffRows": [
    {"rowIndex": 1, "staffName": "Amandeep", "dataRegion": {"startCol": 1, "endCol": 7}}
  ],
  "complexCells": [
    {"row": 1, "col": 3, "columnName": "Wednesday", "type": "multi-shift", "rawContent": "8-4,12-8"}
  ],
  "congestedAreas": ["Wednesday column has overlapping times"],
  "dateRange": {"start": "2026-02-15", "end": "2026-02-21"},
  "confidence": 95,
  "rawText": "Any raw text you can extract for reference"
}

IMPORTANT: 
- Be thorough in identifying complex cells - this is where shifts get missed
- A cell with "8-4,12-8" contains TWO shifts, not one
- A cell with "9-5 / 6-10" contains TWO shifts
- Mark any cell that seems to have multiple time entries

Return ONLY valid JSON, no other text.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              image: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
      temperature: 0.1, // Lower for structure analysis
    });

    const cleanedText = cleanJsonResponse(text);
    const parsed = JSON.parse(cleanedText);

    return {
      type: parsed.type || "unknown",
      columns: parsed.columns || [],
      staffRows: parsed.staffRows || [],
      complexCells: parsed.complexCells || [],
      congestedAreas: parsed.congestedAreas || [],
      dateRange: parsed.dateRange,
      confidence: parsed.confidence || 50,
      rawText: parsed.rawText,
    };
  } catch (error) {
    console.error("[V2] Phase 1 - Structure analysis failed:", error);
    return {
      type: "unknown",
      columns: [],
      staffRows: [],
      complexCells: [],
      congestedAreas: ["Failed to analyze structure"],
      confidence: 0,
    };
  }
}

// ============================================================================
// PHASE 2: CELL PARSING
// ============================================================================

/**
 * Phase 2: Parse all cells in batch for efficiency
 * Uses a single API call to extract all cell data at once
 */
async function parseRosterCells(
  base64Image: string,
  mimeType: string,
  structure: RosterStructure
): Promise<ParsedCell[]> {
  // If no structure was identified, fall back to bulk extraction
  if (structure.columns.length === 0 || structure.staffRows.length === 0) {
    console.log("[V2] Phase 2 - No structure found, using bulk extraction");
    return parseRosterCellsBulk(base64Image, mimeType);
  }

  // Build a list of all cells to parse
  const cellsToParse: Array<{
    staffName: string;
    columnName: string;
    date: string;
    isComplex: boolean;
    complexType?: string;
    rawContentHint?: string;
  }> = [];

  for (const staffRow of structure.staffRows) {
    for (const column of structure.columns) {
      if (column.type === "staff") continue;

      const complexCell = structure.complexCells.find(
        (c) => c.row === staffRow.rowIndex && c.col === column.index
      );

      const date = determineDateForColumn(column, structure.dateRange);

      cellsToParse.push({
        staffName: staffRow.staffName,
        columnName: column.name,
        date,
        isComplex: complexCell !== undefined,
        complexType: complexCell?.type,
        rawContentHint: complexCell?.rawContent,
      });
    }
  }

  console.log(`[V2] Phase 2 - Parsing ${cellsToParse.length} cells in batch...`);

  // Parse all cells in a single batch API call
  return parseRosterCellsBatch(base64Image, mimeType, cellsToParse, structure);
}

/**
 * Batch parse all cells in a single API call for efficiency
 */
async function parseRosterCellsBatch(
  base64Image: string,
  mimeType: string,
  cellsToParse: Array<{
    staffName: string;
    columnName: string;
    date: string;
    isComplex: boolean;
    complexType?: string;
    rawContentHint?: string;
  }>,
  structure: RosterStructure
): Promise<ParsedCell[]> {
  // Build the cell list for the prompt
  const cellList = cellsToParse
    .map((cell, idx) => {
      let hint = "";
      if (cell.isComplex) {
        hint = ` [COMPLEX: ${cell.complexType}${cell.rawContentHint ? ` - "${cell.rawContentHint}"` : ""}]`;
      }
      return `${idx + 1}. ${cell.staffName} | ${cell.columnName} (${cell.date})${hint}`;
    })
    .join("\n");

  const prompt = `You are parsing ALL cells from a roster image. Extract shifts for each cell listed below.

CELLS TO PARSE:
${cellList}

CRITICAL INSTRUCTIONS:
1. Parse EACH cell listed above - do not skip any
2. Look for MULTIPLE shifts in a single cell:
   - "8-4, 12-8" = TWO shifts (8:00-16:00 and 12:00-20:00)
   - "9-5 / 6-10" = TWO shifts
   - "8-12, 4-8" = TWO shifts (split shift)
3. Complex cells are marked with [COMPLEX] - pay extra attention to these
4. Empty cells should have empty shifts array
5. Time off entries: "OFF", "AL", "Leave" = isTimeOff: true

Return JSON with this EXACT structure:
{
  "cells": [
    {
      "staffName": "Amandeep",
      "columnName": "Monday",
      "date": "2026-02-15",
      "rawContent": "9-5",
      "shifts": [{"startTime": "09:00", "endTime": "17:00"}],
      "confidence": 95,
      "issues": []
    },
    {
      "staffName": "Amandeep",
      "columnName": "Wednesday",
      "date": "2026-02-17",
      "rawContent": "8-4,12-8",
      "shifts": [
        {"startTime": "08:00", "endTime": "16:00"},
        {"startTime": "12:00", "endTime": "20:00"}
      ],
      "confidence": 90,
      "issues": []
    },
    {
      "staffName": "John",
      "columnName": "Monday",
      "date": "2026-02-15",
      "rawContent": "OFF",
      "shifts": [{"startTime": "", "endTime": "", "isTimeOff": true, "timeOffType": "OFF"}],
      "confidence": 100,
      "issues": []
    }
  ]
}

IMPORTANT: Return ALL ${cellsToParse.length} cells, even if some are empty.

Return ONLY valid JSON, no other text.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              image: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
      temperature: 0.2,
      maxTokens: 8000, // Ensure we get all cells
    });

    const cleanedText = cleanJsonResponse(text);
    const parsed = JSON.parse(cleanedText);

    return (parsed.cells || []).map((cell: any) => ({
      row: 0,
      col: 0,
      columnName: cell.columnName || "",
      staffName: cell.staffName || "",
      date: cell.date || "",
      rawContent: cell.rawContent || "",
      shifts: cell.shifts || [],
      confidence: cell.confidence || 50,
      issues: cell.issues || [],
    }));
  } catch (error) {
    console.error("[V2] Phase 2 - Batch parsing failed:", error);
    // Fall back to individual cell parsing
    return parseRosterCellsIndividually(base64Image, mimeType, cellsToParse);
  }
}

/**
 * Fallback: Parse cells individually (slower but more reliable)
 */
async function parseRosterCellsIndividually(
  base64Image: string,
  mimeType: string,
  cellsToParse: Array<{
    staffName: string;
    columnName: string;
    date: string;
    isComplex: boolean;
    complexType?: string;
    rawContentHint?: string;
  }>
): Promise<ParsedCell[]> {
  const cells: ParsedCell[] = [];

  for (const cellInfo of cellsToParse) {
    const parsedCell = await parseSingleCell(
      base64Image,
      mimeType,
      cellInfo.staffName,
      cellInfo.columnName,
      cellInfo.date,
      cellInfo.isComplex ? {
        row: 0,
        col: 0,
        columnName: cellInfo.columnName,
        type: (cellInfo.complexType as any) || "multi-shift",
        rawContent: cellInfo.rawContentHint || "",
      } : undefined
    );

    if (parsedCell) {
      cells.push(parsedCell);
    }
  }

  return cells;
}

/**
 * Parse a single cell, with special handling for complex cells
 */
async function parseSingleCell(
  base64Image: string,
  mimeType: string,
  staffName: string,
  columnName: string,
  date: string,
  complexCell: ComplexCell | undefined
): Promise<ParsedCell | null> {
  const isComplex = complexCell !== undefined;

  const prompt = `You are parsing a SINGLE CELL from a roster.

Context:
- Staff: ${staffName}
- Column: ${columnName}
- Date: ${date}
${isComplex ? `- This cell was identified as COMPLEX: ${complexCell.type}` : ""}
${isComplex ? `- Raw content hint: "${complexCell.rawContent}"` : ""}

${isComplex ? `IMPORTANT: This cell may contain MULTIPLE shifts. Look carefully for:
- Multiple time ranges separated by commas: "8-4, 12-8" = TWO shifts
- Multiple time ranges separated by slashes: "9-5 / 6-10" = TWO shifts
- Split shifts: "8-12, 4-8" = TWO shifts
- Overlapping times that need to be separated` : ""}

Parse ALL shifts in this cell. A cell may contain:
- Single shift: "9-5" or "9:00 AM - 5:00 PM"
- Multiple shifts: "8-4, 12-8" (TWO shifts)
- Split shifts: "8-12, 4-8" (TWO shifts)
- Time off: "OFF", "AL", "Leave", "Annual Leave"
- Empty: "" or blank

Return JSON with this EXACT structure:
{
  "row": 0,
  "col": 0,
  "columnName": "${columnName}",
  "staffName": "${staffName}",
  "date": "${date}",
  "rawContent": "what you see in the cell",
  "shifts": [
    {"startTime": "09:00", "endTime": "17:00"},
    {"startTime": "12:00", "endTime": "20:00"}
  ],
  "confidence": 95,
  "issues": []
}

For time off entries:
{
  "shifts": [{"startTime": "", "endTime": "", "isTimeOff": true, "timeOffType": "OFF"}]
}

For empty cells:
{
  "shifts": [],
  "confidence": 100,
  "issues": []
}

Return ONLY valid JSON, no other text.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              image: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
      temperature: 0.2,
    });

    const cleanedText = cleanJsonResponse(text);
    const parsed = JSON.parse(cleanedText);

    return {
      row: parsed.row || 0,
      col: parsed.col || 0,
      columnName: parsed.columnName || columnName,
      staffName: parsed.staffName || staffName,
      date: parsed.date || date,
      rawContent: parsed.rawContent || "",
      shifts: parsed.shifts || [],
      confidence: parsed.confidence || 50,
      issues: parsed.issues || [],
    };
  } catch (error) {
    console.error(`[V2] Phase 2 - Failed to parse cell for ${staffName} - ${columnName}:`, error);
    return {
      row: 0,
      col: 0,
      columnName,
      staffName,
      date,
      rawContent: "",
      shifts: [],
      confidence: 0,
      issues: ["Failed to parse cell"],
    };
  }
}

/**
 * Fallback bulk extraction when structure analysis fails
 */
async function parseRosterCellsBulk(
  base64Image: string,
  mimeType: string
): Promise<ParsedCell[]> {
  const prompt = `You are extracting roster data from an image. Extract ALL shifts for ALL staff.

CRITICAL INSTRUCTIONS:
1. Look at EACH cell carefully - some cells may contain MULTIPLE shifts
2. A cell like "8-4, 12-8" contains TWO shifts, not one
3. A cell like "9-5 / 6-10" contains TWO shifts
4. Do NOT skip or merge shifts - extract each one separately

Return JSON with this EXACT structure:
{
  "cells": [
    {
      "staffName": "Amandeep",
      "columnName": "Monday",
      "date": "2026-02-15",
      "rawContent": "9-5",
      "shifts": [{"startTime": "09:00", "endTime": "17:00"}],
      "confidence": 95,
      "issues": []
    },
    {
      "staffName": "Amandeep",
      "columnName": "Wednesday",
      "date": "2026-02-17",
      "rawContent": "8-4,12-8",
      "shifts": [
        {"startTime": "08:00", "endTime": "16:00"},
        {"startTime": "12:00", "endTime": "20:00"}
      ],
      "confidence": 90,
      "issues": []
    }
  ]
}

Return ONLY valid JSON, no other text.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image",
              image: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
      temperature: 0.2,
    });

    const cleanedText = cleanJsonResponse(text);
    const parsed = JSON.parse(cleanedText);

    return (parsed.cells || []).map((cell: any) => ({
      row: cell.row || 0,
      col: cell.col || 0,
      columnName: cell.columnName || "",
      staffName: cell.staffName || "",
      date: cell.date || "",
      rawContent: cell.rawContent || "",
      shifts: cell.shifts || [],
      confidence: cell.confidence || 50,
      issues: cell.issues || [],
    }));
  } catch (error) {
    console.error("[V2] Phase 2 - Bulk extraction failed:", error);
    return [];
  }
}

// ============================================================================
// PHASE 3: SHIFT EXTRACTION (Rule-based)
// ============================================================================

/**
 * Phase 3: Convert parsed cells to extracted shifts
 * Pure data transformation - no AI needed
 */
function extractShiftsFromParsedCells(
  cells: ParsedCell[],
  columnMappings: ColumnMapping[]
): ExtractedShift[] {
  const shifts: ExtractedShift[] = [];

  for (const cell of cells) {
    // Skip cells with no shifts or time off
    if (cell.shifts.length === 0) continue;
    if (cell.shifts.some((s) => s.isTimeOff)) continue;

    for (const shift of cell.shifts) {
      // Normalize times
      const startTime = normalizeTimeFormat(shift.startTime);
      const endTime = normalizeTimeFormat(shift.endTime);

      // Skip invalid shifts
      if (!startTime || !endTime) {
        console.log(`[V2] Phase 3 - Skipping invalid shift: ${shift.startTime} - ${shift.endTime}`);
        continue;
      }

      // Normalize date
      const date = normalizeDateFormat(cell.date);

      const extractedShift: ExtractedShift = {
        id: generateId(),
        rowIndex: cell.row,
        staffName: cell.staffName,
        staffEmail: null,
        staffId: null,
        date,
        dayOfWeek: cell.dayOfWeek || cell.columnName,
        startTime,
        endTime,
        position: shift.position || null,
        venue: null,
        notes: shift.notes || cell.rawContent,
        rawData: { columnName: cell.columnName, rawContent: cell.rawContent },
        confidence: getConfidenceLevel(cell.confidence),
        issues: cell.issues,
        matched: false,
        matchedUserId: null,
      };

      shifts.push(extractedShift);
    }
  }

  return shifts;
}

// ============================================================================
// PHASE 4: VALIDATION
// ============================================================================

/**
 * Phase 4: Validate extraction completeness
 * Uses GPT-4o-mini for fast, cost-effective validation
 */
async function validateExtraction(
  shifts: ExtractedShift[],
  structure: RosterStructure
): Promise<ValidationResult> {
  // Build summary for validation
  const staffCounts: Record<string, StaffShiftCount> = {};

  for (const shift of shifts) {
    if (!shift.staffName) continue;

    if (!staffCounts[shift.staffName]) {
      staffCounts[shift.staffName] = {
        extracted: 0,
        expected: "unknown",
        daysWithShifts: [],
        daysWithoutShifts: [],
      };
    }

    staffCounts[shift.staffName].extracted++;
    if (shift.dayOfWeek && !staffCounts[shift.staffName].daysWithShifts.includes(shift.dayOfWeek)) {
      staffCounts[shift.staffName].daysWithShifts.push(shift.dayOfWeek);
    }
  }

  // Determine expected days from structure
  const expectedDays = structure.columns
    .filter((c) => c.type === "day")
    .map((c) => c.name);

  for (const staff of Object.keys(staffCounts)) {
    staffCounts[staff].daysWithoutShifts = expectedDays.filter(
      (day) => !staffCounts[staff].daysWithShifts.includes(day)
    );
    staffCounts[staff].expected = expectedDays.length > 0 ? `${expectedDays.length} days` : "unknown";
  }

  const prompt = `You are validating a roster extraction for completeness.

Staff extracted: ${Object.keys(staffCounts).join(", ")}

Shift counts per staff:
${Object.entries(staffCounts)
  .map(([name, count]) => `- ${name}: ${count.extracted} shifts (${count.daysWithShifts.join(", ")})`)
  .join("\n")}

Complex cells identified: ${structure.complexCells.length}
Congested areas: ${structure.congestedAreas.join(", ")}

Check for:
1. Staff with unusually few shifts (might indicate missed data)
2. Staff missing shifts on days where others have shifts
3. Unusual time patterns
4. Potential issues with complex cells

Return JSON with this EXACT structure:
{
  "totalShifts": ${shifts.length},
  "staffCounts": ${JSON.stringify(staffCounts)},
  "anomalies": [
    {"type": "low_shift_count", "staff": "Name", "details": "Only 2 shifts extracted", "severity": "warning"}
  ],
  "overallConfidence": 95,
  "recommendations": ["Review Wednesday shifts for Amandeep"],
  "extractionQuality": "excellent" | "good" | "fair" | "poor"
}

Return ONLY valid JSON, no other text.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"), // Faster, cheaper for validation
      prompt,
      temperature: 0.1,
    });

    const cleanedText = cleanJsonResponse(text);
    const parsed = JSON.parse(cleanedText);

    return {
      totalShifts: parsed.totalShifts || shifts.length,
      staffCounts: parsed.staffCounts || staffCounts,
      anomalies: parsed.anomalies || [],
      overallConfidence: parsed.overallConfidence || 70,
      recommendations: parsed.recommendations || [],
      extractionQuality: parsed.extractionQuality || "fair",
    };
  } catch (error) {
    console.error("[V2] Phase 4 - Validation failed:", error);
    return {
      totalShifts: shifts.length,
      staffCounts,
      anomalies: [{ type: "unmatched_staff", staff: "unknown", details: "Validation failed", severity: "warning" }],
      overallConfidence: 50,
      recommendations: ["Manual review recommended"],
      extractionQuality: "fair",
    };
  }
}

// ============================================================================
// STAFF MATCHING (Reuse from V1)
// ============================================================================

/**
 * Match extracted staff names/emails to database users
 * Reused from V1 implementation
 */
async function matchStaffMembers(
  shifts: ExtractedShift[],
  venueStaff: ExtractionContext["venueStaff"]
): Promise<{ shifts: ExtractedShift[]; staffMatches: StaffMatch[] }> {
  // Get unique staff identifiers from shifts
  const uniqueStaff = new Map<string, { name: string; email: string | null }>();

  for (const shift of shifts) {
    const key = (shift.staffEmail || shift.staffName || "").toLowerCase();
    if (key && !uniqueStaff.has(key)) {
      uniqueStaff.set(key, {
        name: shift.staffName || "",
        email: shift.staffEmail,
      });
    }
  }

  // Match each unique staff member
  const staffMatches: StaffMatch[] = [];
  const matchCache = new Map<string, { userId: string | null; matchType: StaffMatch["matchType"] }>();

  for (const [key, staff] of uniqueStaff) {
    const match = findBestStaffMatch(staff.name, staff.email, venueStaff);
    matchCache.set(key, { userId: match.matchedUserId, matchType: match.matchType });
    staffMatches.push(match);
  }

  // Update shifts with match results
  const matchedShifts = shifts.map((shift) => {
    const key = (shift.staffEmail || shift.staffName || "").toLowerCase();
    const match = matchCache.get(key);

    return {
      ...shift,
      matched: match?.userId !== null,
      matchedUserId: match?.userId || null,
    };
  });

  return { shifts: matchedShifts, staffMatches };
}

/**
 * Find the best matching user for a staff member
 */
function findBestStaffMatch(
  name: string,
  email: string | null,
  venueStaff: ExtractionContext["venueStaff"]
): StaffMatch {
  const result: StaffMatch = {
    extractedName: name,
    extractedEmail: email,
    matchedUserId: null,
    matchedUserName: null,
    matchedUserEmail: null,
    confidence: 0,
    matchType: "none",
  };

  // Exact email match (highest priority)
  if (email) {
    const emailMatch = venueStaff.find(
      (user) => user.email.toLowerCase() === email.toLowerCase()
    );
    if (emailMatch) {
      return {
        ...result,
        matchedUserId: emailMatch.id,
        matchedUserName: `${emailMatch.firstName || ""} ${emailMatch.lastName || ""}`.trim(),
        matchedUserEmail: emailMatch.email,
        confidence: 100,
        matchType: "exact_email",
      };
    }
  }

  // Exact name match
  if (name) {
    const normalizedName = normalizeName(name);
    const exactNameMatch = venueStaff.find((user) => {
      const fullName = normalizeName(`${user.firstName || ""} ${user.lastName || ""}`);
      return fullName === normalizedName;
    });
    if (exactNameMatch) {
      return {
        ...result,
        matchedUserId: exactNameMatch.id,
        matchedUserName: `${exactNameMatch.firstName || ""} ${exactNameMatch.lastName || ""}`.trim(),
        matchedUserEmail: exactNameMatch.email,
        confidence: 95,
        matchType: "exact_name",
      };
    }

    // Fuzzy name match
    let bestFuzzyMatch: { user: (typeof venueStaff)[0]; score: number } | null = null;
    for (const user of venueStaff) {
      const fullName = `${user.firstName || ""} ${user.lastName || ""}`.trim();
      const score = calculateNameSimilarity(name, fullName);
      if (score > 0.7 && (!bestFuzzyMatch || score > bestFuzzyMatch.score)) {
        bestFuzzyMatch = { user, score };
      }
    }
    if (bestFuzzyMatch) {
      return {
        ...result,
        matchedUserId: bestFuzzyMatch.user.id,
        matchedUserName: `${bestFuzzyMatch.user.firstName || ""} ${bestFuzzyMatch.user.lastName || ""}`.trim(),
        matchedUserEmail: bestFuzzyMatch.user.email,
        confidence: Math.round(bestFuzzyMatch.score * 100),
        matchType: "fuzzy_name",
      };
    }

    // Partial match (first name only)
    const firstName = name.split(/\s+/)[0];
    const partialMatch = venueStaff.find(
      (user) =>
        user.firstName &&
        normalizeName(user.firstName) === normalizeName(firstName)
    );
    if (partialMatch) {
      return {
        ...result,
        matchedUserId: partialMatch.id,
        matchedUserName: `${partialMatch.firstName || ""} ${partialMatch.lastName || ""}`.trim(),
        matchedUserEmail: partialMatch.email,
        confidence: 60,
        matchType: "partial",
      };
    }
  }

  return result;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Normalize name for comparison
 */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
}

/**
 * Calculate name similarity using Levenshtein distance
 */
function calculateNameSimilarity(name1: string, name2: string): number {
  const s1 = normalizeName(name1);
  const s2 = normalizeName(name2);

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const maxLength = Math.max(s1.length, s2.length);
  return 1 - matrix[s1.length][s2.length] / maxLength;
}

/**
 * Clean JSON response from AI
 */
function cleanJsonResponse(text: string): string {
  return text.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
}

/**
 * Detect image MIME type from buffer
 */
function detectImageMimeType(buffer: ArrayBuffer): string {
  const uint8 = new Uint8Array(buffer);

  // PNG
  if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47) {
    return "image/png";
  }

  // JPEG
  if (uint8[0] === 0xff && uint8[1] === 0xd8 && uint8[2] === 0xff) {
    return "image/jpeg";
  }

  // WebP
  if (
    uint8[0] === 0x52 &&
    uint8[1] === 0x49 &&
    uint8[2] === 0x46 &&
    uint8[3] === 0x46 &&
    uint8[8] === 0x57 &&
    uint8[9] === 0x45 &&
    uint8[10] === 0x42 &&
    uint8[11] === 0x50
  ) {
    return "image/webp";
  }

  return "image/jpeg"; // Default fallback
}

/**
 * Determine date for a column based on column type and date range
 */
function determineDateForColumn(
  column: ColumnInfo,
  dateRange?: { start: string; end: string }
): string {
  if (column.type === "date" && column.name) {
    // Try to parse the column name as a date
    const parsed = normalizeDateFormat(column.name);
    if (parsed) return parsed;
  }

  if (dateRange?.start) {
    // Calculate date based on day of week
    const startDate = new Date(dateRange.start);
    const dayMap: Record<string, number> = {
      "sunday": 0, "monday": 1, "tuesday": 2, "wednesday": 3,
      "thursday": 4, "friday": 5, "saturday": 6,
      "sun": 0, "mon": 1, "tue": 2, "wed": 3,
      "thu": 4, "fri": 5, "sat": 6,
    };

    const dayName = column.name.toLowerCase();
    const targetDay = dayMap[dayName];

    if (targetDay !== undefined) {
      const currentDay = startDate.getDay();
      const diff = targetDay - currentDay;
      const targetDate = new Date(startDate);
      targetDate.setDate(startDate.getDate() + diff);
      return targetDate.toISOString().split("T")[0];
    }
  }

  // Return column name as-is if we can't determine the date
  return column.name;
}

/**
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
  shifts: ExtractedShift[],
  staffMatches: StaffMatch[],
  structure: RosterStructure,
  validation: ValidationResult
): number {
  if (shifts.length === 0) return 0;

  // Factor 1: Structure confidence (20%)
  const structureScore = structure.confidence * 0.2;

  // Factor 2: Shift extraction quality (30%)
  const validShiftRatio = shifts.filter((s) => s.issues.length === 0).length / shifts.length;
  const shiftScore = validShiftRatio * 30;

  // Factor 3: Staff matching (25%)
  const matchedRatio =
    staffMatches.filter((m) => m.matchedUserId !== null).length /
    Math.max(staffMatches.length, 1);
  const matchScore = matchedRatio * 25;

  // Factor 4: Validation confidence (25%)
  const validationScore = (validation.overallConfidence / 100) * 25;

  return Math.round(structureScore + shiftScore + matchScore + validationScore);
}

/**
 * Create empty extraction result for error cases
 */
function createEmptyExtractionResult(
  id: string,
  fileId: string,
  fileName: string,
  fileType: RosterFileSource,
  fileUrl: string
): RosterExtractionResultV2 {
  return {
    id,
    fileId,
    fileName,
    fileType,
    fileUrl,
    extractedAt: new Date().toISOString(),
    detectedColumns: [],
    headerRow: null,
    dataStartRow: 0,
    totalRows: 0,
    shifts: [],
    staffMatches: [],
    matchedCount: 0,
    unmatchedCount: 0,
    overallConfidence: "low",
    confidenceScore: 0,
    validShifts: 0,
    invalidShifts: 0,
    warnings: [],
    errors: ["No data could be extracted from the file"],
    metadata: {
      extractionVersion: "v2",
      phasesCompleted: 0,
      processingTimeMs: 0,
      structure: {
        type: "unknown",
        columns: [],
        staffRows: [],
        complexCells: [],
        congestedAreas: [],
        confidence: 0,
      },
      validation: {
        totalShifts: 0,
        staffCounts: {},
        anomalies: [],
        overallConfidence: 0,
        recommendations: [],
        extractionQuality: "poor",
      },
    },
  };
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract roster data from an image file using multi-phase approach
 */
export async function extractRosterFromImageV2(
  imageBuffer: ArrayBuffer,
  fileName: string,
  context: ExtractionContext
): Promise<RosterExtractionResultV2> {
  const startTime = Date.now();
  const extractionId = generateId();
  const fileId = generateId();

  console.log(`[V2] Starting multi-phase extraction for: ${fileName}`);

  const mimeType = detectImageMimeType(imageBuffer);
  const base64Image = Buffer.from(imageBuffer).toString("base64");

  let phasesCompleted = 0;

  try {
    // Phase 1: Structure Analysis
    console.log("[V2] Phase 1: Analyzing structure...");
    const structure = await analyzeRosterStructure(base64Image, mimeType);
    phasesCompleted = 1;
    console.log(`[V2] Phase 1 complete: ${structure.type}, ${structure.columns.length} columns, ${structure.staffRows.length} staff, ${structure.complexCells.length} complex cells`);

    // Phase 2: Cell Parsing
    console.log("[V2] Phase 2: Parsing cells...");
    const parsedCells = await parseRosterCells(base64Image, mimeType, structure);
    phasesCompleted = 2;
    console.log(`[V2] Phase 2 complete: ${parsedCells.length} cells parsed`);

    // Phase 3: Shift Extraction
    console.log("[V2] Phase 3: Extracting shifts...");
    const columnMappings: ColumnMapping[] = structure.columns.map((col) => ({
      sourceColumn: col.name,
      targetField: (col.type === "day" ? "day_of_week" : col.type === "time_start" ? "start_time" : col.type === "time_end" ? "end_time" : col.type === "staff" ? "staff_name" : "unknown") as ColumnType,
      confidence: structure.confidence,
      sampleValues: [],
    }));
    const shifts = extractShiftsFromParsedCells(parsedCells, columnMappings);
    phasesCompleted = 3;
    console.log(`[V2] Phase 3 complete: ${shifts.length} shifts extracted`);

    // Phase 4: Validation
    console.log("[V2] Phase 4: Validating extraction...");
    const validation = await validateExtraction(shifts, structure);
    phasesCompleted = 4;
    console.log(`[V2] Phase 4 complete: ${validation.extractionQuality} quality, ${validation.anomalies.length} anomalies`);

    // Staff Matching
    console.log("[V2] Matching staff...");
    const { shifts: matchedShifts, staffMatches } = await matchStaffMembers(shifts, context.venueStaff);

    // Calculate quality metrics
    const validShifts = matchedShifts.filter((s) => s.issues.length === 0).length;
    const invalidShifts = matchedShifts.length - validShifts;
    const matchedCount = staffMatches.filter((m) => m.matchedUserId !== null).length;
    const unmatchedCount = staffMatches.filter((m) => m.matchedUserId === null).length;

    // Calculate overall confidence
    const confidenceScore = calculateOverallConfidence(matchedShifts, staffMatches, structure, validation);

    const warnings: string[] = [];
    const errors: string[] = [];

    if (unmatchedCount > 0) {
      warnings.push(`${unmatchedCount} staff member(s) could not be matched to existing users`);
    }
    if (invalidShifts > 0) {
      warnings.push(`${invalidShifts} shift(s) have validation issues`);
    }
    if (validation.anomalies.length > 0) {
      warnings.push(...validation.anomalies.map((a) => `${a.staff}: ${a.details}`));
    }
    if (confidenceScore < 50) {
      warnings.push("Low extraction confidence - please review carefully");
    }

    const processingTime = Date.now() - startTime;
    console.log(`[V2] Extraction complete: ${shifts.length} shifts, ${matchedCount}/${matchedCount + unmatchedCount} staff matched, ${processingTime}ms`);

    return {
      id: extractionId,
      fileId,
      fileName,
      fileType: "image",
      fileUrl: "", // Will be set by caller
      extractedAt: new Date().toISOString(),
      detectedColumns: columnMappings,
      headerRow: 0,
      dataStartRow: 0,
      totalRows: parsedCells.length,
      shifts: matchedShifts,
      staffMatches,
      matchedCount,
      unmatchedCount,
      overallConfidence: getConfidenceLevel(confidenceScore),
      confidenceScore,
      validShifts,
      invalidShifts,
      warnings,
      errors,
      metadata: {
        extractionVersion: "v2",
        phasesCompleted,
        processingTimeMs: processingTime,
        structure,
        validation,
      },
    };
  } catch (error) {
    console.error("[V2] Extraction failed:", error);
    return createEmptyExtractionResult(extractionId, fileId, fileName, "image", "");
  }
}

/**
 * Get venue staff for extraction context
 */
export async function getExtractionContextV2(venueId: string): Promise<ExtractionContext> {
  const venueStaff = await prisma.user.findMany({
    where: {
      venues: {
        some: {
          venueId,
        },
      },
      active: true,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });

  return {
    venueId,
    venueStaff,
  };
}