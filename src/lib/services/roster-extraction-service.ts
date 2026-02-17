/**
 * Roster AI Extraction Service
 * Handles parsing of Excel, CSV, and image files with AI-powered column detection
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

// ============================================================================
// MAIN EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract roster data from a file
 */
export async function extractRosterFromFile(
  fileBuffer: ArrayBuffer,
  fileName: string,
  fileType: RosterFileSource,
  context: ExtractionContext
): Promise<RosterExtractionResult> {
  const fileId = generateId();
  const extractionId = generateId();

  let rows: ParsedRow[] = [];
  let headerRow: number | null = null;
  let ocrConfidence: number | undefined;
  let imageQuality: "good" | "fair" | "poor" | undefined;

  // Parse file based on type
  switch (fileType) {
    case "excel":
      const excelResult = parseExcelFile(fileBuffer);
      rows = excelResult.rows;
      headerRow = excelResult.headerRow;
      break;

    case "csv":
      const csvResult = parseCsvFile(fileBuffer);
      rows = csvResult.rows;
      headerRow = csvResult.headerRow;
      break;

    case "image":
      const imageResult = await extractFromImage(fileBuffer);
      rows = imageResult.rows;
      headerRow = imageResult.headerRow;
      ocrConfidence = imageResult.ocrConfidence;
      imageQuality = imageResult.imageQuality;
      break;
  }

  if (rows.length === 0) {
    return createEmptyExtractionResult(extractionId, fileId, fileName, fileType, "");
  }

  // Detect columns using AI
  const detectedColumns = await detectColumns(rows, headerRow);

  // Extract shifts from rows
  const shifts = extractShiftsFromRows(rows, detectedColumns, headerRow);

  // Match staff members
  const { shifts: matchedShifts, staffMatches } = await matchStaffMembers(
    shifts,
    context.venueStaff
  );

  // Calculate quality metrics
  const validShifts = matchedShifts.filter((s) => s.issues.length === 0).length;
  const invalidShifts = matchedShifts.length - validShifts;
  const matchedCount = staffMatches.filter((m) => m.matchedUserId !== null).length;
  const unmatchedCount = staffMatches.filter((m) => m.matchedUserId === null).length;

  // Calculate overall confidence
  const confidenceScore = calculateOverallConfidence(
    matchedShifts,
    staffMatches,
    detectedColumns,
    ocrConfidence
  );

  const warnings: string[] = [];
  const errors: string[] = [];

  if (unmatchedCount > 0) {
    warnings.push(`${unmatchedCount} staff member(s) could not be matched to existing users`);
  }
  if (invalidShifts > 0) {
    warnings.push(`${invalidShifts} shift(s) have validation issues`);
  }
  if (confidenceScore < 50) {
    warnings.push("Low extraction confidence - please review carefully");
  }

  return {
    id: extractionId,
    fileId,
    fileName,
    fileType,
    fileUrl: "", // Will be set by the caller
    extractedAt: new Date().toISOString(),
    detectedColumns,
    headerRow,
    dataStartRow: headerRow !== null ? headerRow + 1 : 0,
    totalRows: rows.length,
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
    ocrConfidence,
    imageQuality,
  };
}

// ============================================================================
// FILE PARSING FUNCTIONS
// ============================================================================

/**
 * Parse Excel file to rows
 */
function parseExcelFile(buffer: ArrayBuffer): { rows: ParsedRow[]; headerRow: number | null } {
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];

  // Convert to JSON with headers
  const jsonData = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: false,
    defval: "",
  }) as unknown as string[][];

  if (jsonData.length === 0) {
    return { rows: [], headerRow: null };
  }

  // Find header row (first row with multiple non-empty cells)
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, jsonData.length); i++) {
    const row = jsonData[i];
    const nonEmptyCells = row.filter((cell) => cell && String(cell).trim() !== "").length;
    if (nonEmptyCells >= 3) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = jsonData[headerRowIndex].map((h) => String(h || "").trim());

  // Convert data rows to ParsedRow format
  const rows: ParsedRow[] = [];
  for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
    const rowData = jsonData[i];
    const data: Record<string, string> = {};

    headers.forEach((header, colIndex) => {
      if (header) {
        data[header] = String(rowData[colIndex] || "").trim();
      }
    });

    // Only add rows that have some data
    const hasData = Object.values(data).some((v) => v !== "");
    if (hasData) {
      rows.push({ rowIndex: i, data });
    }
  }

  return { rows, headerRow: headerRowIndex };
}

/**
 * Parse CSV file to rows
 */
function parseCsvFile(buffer: ArrayBuffer): { rows: ParsedRow[]; headerRow: number | null } {
  const text = new TextDecoder("utf-8").decode(buffer);
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");

  if (lines.length === 0) {
    return { rows: [], headerRow: null };
  }

  // Parse CSV with proper handling of quoted fields
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());

    return result;
  };

  // Find header row
  let headerRowIndex = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const cells = parseCSVLine(lines[i]);
    const nonEmptyCells = cells.filter((cell) => cell !== "").length;
    if (nonEmptyCells >= 3) {
      headerRowIndex = i;
      break;
    }
  }

  const headers = parseCSVLine(lines[headerRowIndex]);

  // Convert data rows
  const rows: ParsedRow[] = [];
  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const data: Record<string, string> = {};

    headers.forEach((header, colIndex) => {
      if (header) {
        data[header] = cells[colIndex] || "";
      }
    });

    const hasData = Object.values(data).some((v) => v !== "");
    if (hasData) {
      rows.push({ rowIndex: i, data });
    }
  }

  return { rows, headerRow: headerRowIndex };
}

/**
 * Extract data from image using OpenAI Vision
 */
async function extractFromImage(buffer: ArrayBuffer): Promise<{
  rows: ParsedRow[];
  headerRow: number | null;
  ocrConfidence: number;
  imageQuality: "good" | "fair" | "poor";
}> {
  const base64Image = Buffer.from(buffer).toString("base64");
  const mimeType = detectImageMimeType(buffer);

  const prompt = `You are an expert at extracting roster/schedule data from images. Analyze this roster image and extract ALL shift information.

Return a JSON object with this exact structure:
{
  "quality": "good" | "fair" | "poor",
  "confidence": <number 0-100>,
  "headers": ["Column1", "Column2", ...],
  "rows": [
    {"Column1": "value1", "Column2": "value2", ...},
    ...
  ]
}

Guidelines:
1. Extract EVERY row of shift data you can see
2. Common columns include: Staff Name, Date, Day, Start Time, End Time, Position, Notes
3. Handle abbreviated day names (Mon, Tue, etc.)
4. Parse times in any format (9am, 09:00, 9:00 AM, etc.)
5. If you see a weekly roster, extract each day's shifts separately
6. Set quality based on image clarity and text readability
7. Set confidence based on how certain you are of the extraction accuracy

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

    // Parse AI response
    const cleanedText = text.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const parsed = JSON.parse(cleanedText);

    const headers = parsed.headers || [];
    const rawRows = parsed.rows || [];

    const rows: ParsedRow[] = rawRows.map((row: Record<string, string>, index: number) => ({
      rowIndex: index,
      data: row,
    }));

    return {
      rows,
      headerRow: 0,
      ocrConfidence: parsed.confidence || 50,
      imageQuality: parsed.quality || "fair",
    };
  } catch (error) {
    console.error("Image extraction failed:", error);
    return {
      rows: [],
      headerRow: null,
      ocrConfidence: 0,
      imageQuality: "poor",
    };
  }
}

// ============================================================================
// COLUMN DETECTION
// ============================================================================

/**
 * Detect column types using AI
 */
async function detectColumns(
  rows: ParsedRow[],
  headerRow: number | null
): Promise<ColumnMapping[]> {
  if (rows.length === 0) return [];

  // Get column names and sample values
  const firstRow = rows[0];
  const columnNames = Object.keys(firstRow.data);

  const columnSamples: Record<string, string[]> = {};
  columnNames.forEach((col) => {
    columnSamples[col] = rows
      .slice(0, 5)
      .map((row) => row.data[col])
      .filter((v) => v !== "");
  });

  // Use AI to detect column types
  const prompt = `Analyze these columns from a roster/schedule file and determine what type of data each contains.

Columns and sample values:
${JSON.stringify(columnSamples, null, 2)}

For each column, determine if it matches one of these types:
- staff_name: Staff member's full name
- staff_email: Email address
- staff_id: Employee ID or code
- date: Calendar date
- day_of_week: Day name (Monday, Tue, etc.)
- start_time: Shift start time
- end_time: Shift end time
- shift_duration: Length of shift (hours)
- position: Job title or role
- venue: Location or venue name
- notes: Comments or notes
- unknown: Cannot determine

Return a JSON array:
[
  {
    "sourceColumn": "column name",
    "targetField": "type from list above",
    "confidence": <number 0-100>
  }
]

Return ONLY valid JSON, no other text.`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4-turbo"),
      prompt,
      temperature: 0.2,
    });

    const cleanedText = text.trim().replace(/```json\n?/g, "").replace(/```\n?/g, "");
    const parsed = JSON.parse(cleanedText);

    const mappings: ColumnMapping[] = parsed.map(
      (col: { sourceColumn: string; targetField: string; confidence: number }) => ({
        sourceColumn: col.sourceColumn,
        targetField: col.targetField as ColumnType,
        confidence: col.confidence || 50,
        sampleValues: columnSamples[col.sourceColumn] || [],
      })
    );

    return mappings;
  } catch (error) {
    console.error("Column detection failed:", error);

    // Fallback: Use heuristic detection
    return detectColumnsHeuristically(columnNames, columnSamples);
  }
}

/**
 * Fallback heuristic column detection
 */
function detectColumnsHeuristically(
  columnNames: string[],
  columnSamples: Record<string, string[]>
): ColumnMapping[] {
  const mappings: ColumnMapping[] = [];

  const patterns: Array<{
    type: ColumnType;
    namePatterns: RegExp[];
    valuePatterns?: RegExp[];
  }> = [
    {
      type: "staff_name",
      namePatterns: [/name/i, /staff/i, /employee/i, /worker/i],
    },
    {
      type: "staff_email",
      namePatterns: [/email/i, /e-mail/i],
      valuePatterns: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/],
    },
    {
      type: "staff_id",
      namePatterns: [/id/i, /code/i, /number/i],
    },
    {
      type: "date",
      namePatterns: [/date/i],
      valuePatterns: [/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/, /\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/],
    },
    {
      type: "day_of_week",
      namePatterns: [/day/i],
      valuePatterns: [/^(mon|tue|wed|thu|fri|sat|sun)/i],
    },
    {
      type: "start_time",
      namePatterns: [/start/i, /begin/i, /from/i, /^time$/i],
      valuePatterns: [/^\d{1,2}:\d{2}/, /^\d{1,2}(am|pm)/i],
    },
    {
      type: "end_time",
      namePatterns: [/end/i, /finish/i, /to$/i, /until/i],
      valuePatterns: [/^\d{1,2}:\d{2}/, /^\d{1,2}(am|pm)/i],
    },
    {
      type: "position",
      namePatterns: [/position/i, /role/i, /title/i, /job/i],
    },
    {
      type: "venue",
      namePatterns: [/venue/i, /location/i, /site/i, /place/i],
    },
    {
      type: "notes",
      namePatterns: [/note/i, /comment/i, /remark/i],
    },
  ];

  for (const colName of columnNames) {
    const samples = columnSamples[colName] || [];
    let bestMatch: { type: ColumnType; confidence: number } = { type: "unknown", confidence: 0 };

    for (const pattern of patterns) {
      let confidence = 0;

      // Check column name
      if (pattern.namePatterns.some((p) => p.test(colName))) {
        confidence += 50;
      }

      // Check value patterns
      if (pattern.valuePatterns && samples.length > 0) {
        const matchCount = samples.filter((s) =>
          pattern.valuePatterns!.some((p) => p.test(s))
        ).length;
        confidence += (matchCount / samples.length) * 50;
      }

      if (confidence > bestMatch.confidence) {
        bestMatch = { type: pattern.type, confidence };
      }
    }

    mappings.push({
      sourceColumn: colName,
      targetField: bestMatch.type,
      confidence: bestMatch.confidence,
      sampleValues: samples,
    });
  }

  return mappings;
}

// ============================================================================
// SHIFT EXTRACTION
// ============================================================================

/**
 * Extract shifts from parsed rows using column mappings
 */
function extractShiftsFromRows(
  rows: ParsedRow[],
  columnMappings: ColumnMapping[],
  headerRow: number | null
): ExtractedShift[] {
  const getColumnValue = (row: ParsedRow, targetField: ColumnType): string | null => {
    const mapping = columnMappings.find((m) => m.targetField === targetField);
    if (!mapping) return null;
    return row.data[mapping.sourceColumn] || null;
  };

  return rows.map((row) => {
    const issues: string[] = [];

    // Extract and normalize values
    const staffName = getColumnValue(row, "staff_name");
    const staffEmail = getColumnValue(row, "staff_email");
    const staffId = getColumnValue(row, "staff_id");
    const rawDate = getColumnValue(row, "date");
    const dayOfWeek = getColumnValue(row, "day_of_week");
    const rawStartTime = getColumnValue(row, "start_time");
    const rawEndTime = getColumnValue(row, "end_time");
    const position = getColumnValue(row, "position");
    const venue = getColumnValue(row, "venue");
    const notes = getColumnValue(row, "notes");

    // Normalize date
    const date = rawDate ? normalizeDateFormat(rawDate) : null;
    if (rawDate && !date) {
      issues.push(`Invalid date format: "${rawDate}"`);
    }

    // Normalize times
    const startTime = rawStartTime ? normalizeTimeFormat(rawStartTime) : null;
    if (rawStartTime && !startTime) {
      issues.push(`Invalid start time format: "${rawStartTime}"`);
    }

    const endTime = rawEndTime ? normalizeTimeFormat(rawEndTime) : null;
    if (rawEndTime && !endTime) {
      issues.push(`Invalid end time format: "${rawEndTime}"`);
    }

    // Validation
    if (!staffName && !staffEmail && !staffId) {
      issues.push("No staff identifier found");
    }
    if (!date && !dayOfWeek) {
      issues.push("No date or day information found");
    }
    if (!startTime || !endTime) {
      issues.push("Missing shift times");
    }

    // Calculate confidence
    let confidenceScore = 100;
    confidenceScore -= issues.length * 20;
    confidenceScore = Math.max(0, confidenceScore);

    return {
      id: generateId(),
      rowIndex: row.rowIndex,
      staffName,
      staffEmail,
      staffId,
      date,
      dayOfWeek,
      startTime,
      endTime,
      position,
      venue,
      notes,
      rawData: row.data,
      confidence: getConfidenceLevel(confidenceScore),
      issues,
      matched: false,
      matchedUserId: null,
    };
  });
}

// ============================================================================
// STAFF MATCHING
// ============================================================================

/**
 * Match extracted staff names/emails to database users
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
        matchedUserName:
          `${bestFuzzyMatch.user.firstName || ""} ${bestFuzzyMatch.user.lastName || ""}`.trim(),
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
        matchedUserName:
          `${partialMatch.firstName || ""} ${partialMatch.lastName || ""}`.trim(),
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
 * Calculate overall confidence score
 */
function calculateOverallConfidence(
  shifts: ExtractedShift[],
  staffMatches: StaffMatch[],
  columnMappings: ColumnMapping[],
  ocrConfidence?: number
): number {
  if (shifts.length === 0) return 0;

  // Factor 1: Shift extraction quality (40%)
  const validShiftRatio = shifts.filter((s) => s.issues.length === 0).length / shifts.length;
  const shiftScore = validShiftRatio * 40;

  // Factor 2: Staff matching (30%)
  const matchedRatio =
    staffMatches.filter((m) => m.matchedUserId !== null).length /
    Math.max(staffMatches.length, 1);
  const matchScore = matchedRatio * 30;

  // Factor 3: Column detection confidence (20%)
  const avgColumnConfidence =
    columnMappings.reduce((sum, m) => sum + m.confidence, 0) /
    Math.max(columnMappings.length, 1);
  const columnScore = (avgColumnConfidence / 100) * 20;

  // Factor 4: OCR confidence for images (10%) or bonus for non-images
  const ocrScore = ocrConfidence !== undefined ? (ocrConfidence / 100) * 10 : 10;

  return Math.round(shiftScore + matchScore + columnScore + ocrScore);
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
): RosterExtractionResult {
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
  };
}

/**
 * Get venue staff for extraction context
 */
export async function getExtractionContext(venueId: string): Promise<ExtractionContext> {
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
