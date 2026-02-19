# Roster Extraction V2 Implementation Plan

## Overview

Build a new multi-phase extraction system as a **completely separate implementation** alongside the current system. This allows thorough testing before making the current implementation redundant.

## Architecture

### File Structure

```
src/
├── lib/
│   ├── services/
│   │   ├── roster-extraction-service.ts          # CURRENT (keep as-is)
│   │   └── roster-extraction-v2-service.ts       # NEW multi-phase service
│   └── actions/
│       └── rosters/
│           ├── extraction-actions.ts             # CURRENT (keep as-is)
│           └── extraction-v2-actions.ts          # NEW multi-phase actions
├── app/
│   └── manage/
│       └── rosters/
│           └── new/
│               └── v2/                           # NEW page for testing
│                   └── page.tsx
└── components/
    └── rosters/
        ├── roster-upload-wizard.tsx              # CURRENT (keep as-is)
        └── roster-upload-wizard-v2.tsx           # NEW wizard component
```

### Route Structure

- **Current**: `/manage/rosters/new` → Uses single-pass extraction
- **New V2**: `/manage/rosters/new/v2` → Uses multi-phase extraction
- **Future**: Once tested, V2 becomes default at `/manage/rosters/new`

---

## Multi-Phase Extraction Service

### Phase 1: Structure Analysis (GPT-4o Vision)

```typescript
interface RosterStructure {
  type: "weekly_roster" | "daily_roster" | "monthly_roster" | "unknown";
  columns: ColumnInfo[];
  staffRows: StaffRowInfo[];
  complexCells: ComplexCell[];
  congestedAreas: string[];
  confidence: number;
}

interface ColumnInfo {
  name: string;
  type: "staff" | "date" | "day" | "time" | "position" | "unknown";
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
  type: "multi-shift" | "merged" | "overlapping" | "unclear";
  rawContent: string;
}
```

**Prompt for Phase 1:**
```
You are analyzing a roster/schedule image to understand its structure.

STEP 1: Identify the table layout
- What type of roster is this? (weekly, daily, monthly)
- How many columns and rows?
- What are the column headers?

STEP 2: Identify staff rows
- Which rows contain staff names?
- What is the data region for each staff member?

STEP 3: Identify complex cells
- Are there any merged cells?
- Are there cells with multiple shifts (e.g., "8-4, 12-8")?
- Are there congested or overlapping time entries?
- Any unclear or hard-to-read areas?

Return JSON:
{
  "type": "weekly_roster",
  "columns": [
    {"name": "Staff", "type": "staff", "index": 0},
    {"name": "Monday", "type": "day", "index": 1},
    ...
  ],
  "staffRows": [
    {"rowIndex": 1, "staffName": "Amandeep", "dataRegion": {"startCol": 1, "endCol": 7}}
  ],
  "complexCells": [
    {"row": 1, "col": 3, "type": "multi-shift", "rawContent": "8-4,12-8"}
  ],
  "congestedAreas": ["Wednesday column has overlapping times"],
  "confidence": 95
}
```

### Phase 2: Cell Parsing (GPT-4o Vision)

```typescript
interface ParsedCell {
  row: number;
  col: number;
  staffName: string;
  date: string;
  rawContent: string;
  shifts: ParsedShift[];
  confidence: number;
  issues: string[];
}

interface ParsedShift {
  startTime: string;
  endTime: string;
  position?: string;
  notes?: string;
}
```

**Prompt for Phase 2:**
```
You are parsing individual cells from a roster. Each cell may contain one or more shifts.

For the cell at row {row}, column {col}:
- Staff: {staffName}
- Date: {date}
- Raw content: "{rawContent}"

Parse ALL shifts in this cell. A cell may contain:
- Single shift: "9-5" or "9:00 AM - 5:00 PM"
- Multiple shifts: "8-4, 12-8" or "9-5 / 6-10"
- Split shifts: "8-12, 4-8"
- Time off: "OFF", "AL", "Leave"

Return JSON:
{
  "row": 1,
  "col": 3,
  "staffName": "Amandeep",
  "date": "2026-02-18",
  "rawContent": "8-4,12-8",
  "shifts": [
    {"startTime": "08:00", "endTime": "16:00"},
    {"startTime": "12:00", "endTime": "20:00"}
  ],
  "confidence": 95,
  "issues": []
}
```

### Phase 3: Shift Extraction (Rule-based)

```typescript
// No AI needed - pure data transformation
function extractShiftsFromParsedCells(cells: ParsedCell[]): ExtractedShift[] {
  const shifts: ExtractedShift[] = [];
  
  for (const cell of cells) {
    for (const shift of cell.shifts) {
      shifts.push({
        id: generateId(),
        staffName: cell.staffName,
        date: cell.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        position: shift.position,
        notes: shift.notes,
        confidence: cell.confidence,
        issues: cell.issues,
        matched: false,
        matchedUserId: null,
      });
    }
  }
  
  return shifts;
}
```

### Phase 4: Validation (GPT-4o-mini)

```typescript
interface ValidationResult {
  totalShifts: number;
  staffCounts: Record<string, { extracted: number; expected: string }>;
  anomalies: ValidationAnomaly[];
  overallConfidence: number;
  recommendations: string[];
}

interface ValidationAnomaly {
  type: "low_shift_count" | "missing_days" | "unusual_times" | "duplicate_shifts";
  staff: string;
  details: string;
  severity: "warning" | "error";
}
```

**Prompt for Phase 4:**
```
Review this extraction for completeness and accuracy.

Staff extracted: {staffList}
Total shifts per staff: {shiftCounts}
Complex cells identified: {complexCells}

Check for:
1. Staff with unusually few shifts (might indicate missed data)
2. Missing days that should have shifts
3. Unusual time patterns
4. Potential duplicate shifts

Return JSON:
{
  "totalShifts": 21,
  "staffCounts": {
    "Amandeep": {"extracted": 5, "expected": "5+"}
  },
  "anomalies": [],
  "overallConfidence": 95,
  "recommendations": []
}
```

---

## Service Implementation

### Main Service File: `roster-extraction-v2-service.ts`

```typescript
/**
 * Roster Extraction V2 Service
 * Multi-phase extraction with deep understanding
 */

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import {
  type RosterExtractionResult,
  type ExtractedShift,
  // ... other imports from current service
} from "@/lib/schemas/rosters/extraction";

// ============================================================================
// PHASE 1: STRUCTURE ANALYSIS
// ============================================================================

async function analyzeRosterStructure(
  imageBuffer: ArrayBuffer,
  mimeType: string
): Promise<RosterStructure> {
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  
  const prompt = `...`; // Phase 1 prompt
  
  const { text } = await generateText({
    model: openai("gpt-4o"),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image", image: `data:${mimeType};base64,${base64Image}` },
        ],
      },
    ],
    temperature: 0.1, // Lower for structure analysis
  });
  
  return JSON.parse(cleanJsonResponse(text));
}

// ============================================================================
// PHASE 2: CELL PARSING
// ============================================================================

async function parseRosterCells(
  imageBuffer: ArrayBuffer,
  mimeType: string,
  structure: RosterStructure
): Promise<ParsedCell[]> {
  const base64Image = Buffer.from(imageBuffer).toString("base64");
  const cells: ParsedCell[] = [];
  
  // Parse each complex cell individually for better accuracy
  for (const complexCell of structure.complexCells) {
    const prompt = `...`; // Phase 2 prompt with cell context
    
    const { text } = await generateText({
      model: openai("gpt-4o"),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image", image: `data:${mimeType};base64,${base64Image}` },
          ],
        },
      ],
      temperature: 0.2,
    });
    
    cells.push(JSON.parse(cleanJsonResponse(text)));
  }
  
  // Parse regular cells (can be batched)
  // ...
  
  return cells;
}

// ============================================================================
// PHASE 3: SHIFT EXTRACTION (Rule-based)
// ============================================================================

function extractShiftsFromParsedCells(cells: ParsedCell[]): ExtractedShift[] {
  // Pure data transformation - no AI needed
  // ...
}

// ============================================================================
// PHASE 4: VALIDATION
// ============================================================================

async function validateExtraction(
  shifts: ExtractedShift[],
  structure: RosterStructure
): Promise<ValidationResult> {
  const prompt = `...`; // Phase 4 prompt
  
  const { text } = await generateText({
    model: openai("gpt-4o-mini"), // Faster, cheaper for validation
    prompt,
    temperature: 0.1,
  });
  
  return JSON.parse(cleanJsonResponse(text));
}

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

export async function extractRosterV2(
  fileBuffer: ArrayBuffer,
  fileName: string,
  fileType: "excel" | "csv" | "image",
  context: ExtractionContext
): Promise<RosterExtractionResult> {
  const startTime = Date.now();
  
  // Phase 1: Structure Analysis
  console.log("[V2] Phase 1: Analyzing structure...");
  const structure = await analyzeRosterStructure(fileBuffer, mimeType);
  
  // Phase 2: Cell Parsing
  console.log("[V2] Phase 2: Parsing cells...");
  const parsedCells = await parseRosterCells(fileBuffer, mimeType, structure);
  
  // Phase 3: Shift Extraction
  console.log("[V2] Phase 3: Extracting shifts...");
  const shifts = extractShiftsFromParsedCells(parsedCells);
  
  // Phase 4: Validation
  console.log("[V2] Phase 4: Validating extraction...");
  const validation = await validateExtraction(shifts, structure);
  
  // Staff Matching (reuse current implementation)
  const { shifts: matchedShifts, staffMatches } = await matchStaffMembers(
    shifts,
    context.venueStaff
  );
  
  // Build result (same structure as current)
  const result: RosterExtractionResult = {
    // ... same fields as current implementation
    metadata: {
      extractionVersion: "v2",
      phasesCompleted: 4,
      processingTime: Date.now() - startTime,
      structure,
      validation,
    },
  };
  
  return result;
}
```

---

## Server Actions: `extraction-v2-actions.ts`

```typescript
"use server";

/**
 * Roster Extraction V2 Server Actions
 * Multi-phase extraction with deep understanding
 */

import { revalidatePath } from "next/cache";
import { extractRosterV2 } from "@/lib/services/roster-extraction-v2-service";
// ... other imports

export async function uploadAndExtractRosterV2(
  formData: FormData
): Promise<ExtractionActionResult> {
  // Similar to current implementation but calls extractRosterV2
  // ...
}

export async function confirmExtractionAndCreateRosterV2(
  input: ConfirmExtractionInput
): Promise<ConfirmActionResult> {
  // Same as current - no changes needed for confirmation
  // ...
}
```

---

## UI Component: `roster-upload-wizard-v2.tsx`

```typescript
/**
 * Roster Upload Wizard V2
 * Uses multi-phase extraction
 */

export function RosterUploadWizardV2() {
  const [phase, setPhase] = useState<"upload" | "analyzing" | "parsing" | "extracting" | "validating" | "review" | "confirming">();
  
  // Show progress through phases
  // Display validation results
  // Allow manual corrections
  // ...
}
```

---

## Testing Strategy

### Test Cases

1. **Simple Roster**: Single shift per cell, clear columns
   - Expected: Both V1 and V2 should work well
   
2. **Congested Columns**: Multiple shifts in single cells
   - Expected: V2 should catch more shifts
   
3. **Merged Cells**: Staff names spanning multiple rows
   - Expected: V2 should handle correctly
   
4. **Complex Layouts**: Non-standard roster formats
   - Expected: V2 should adapt better

### Comparison Metrics

| Metric | V1 (Current) | V2 (Multi-Phase) |
|--------|--------------|------------------|
| Shifts extracted | ? | ? |
| Accuracy | ? | ? |
| Processing time | ~30s | ~60s |
| API calls | 1-2 | 4+ |
| Cost per extraction | $0.015 | $0.045 |

---

## Implementation Checklist

### Phase 1: Service Layer
- [ ] Create `roster-extraction-v2-service.ts`
- [ ] Implement `analyzeRosterStructure()`
- [ ] Implement `parseRosterCells()`
- [ ] Implement `extractShiftsFromParsedCells()`
- [ ] Implement `validateExtraction()`
- [ ] Implement main `extractRosterV2()` function

### Phase 2: Server Actions
- [ ] Create `extraction-v2-actions.ts`
- [ ] Implement `uploadAndExtractRosterV2()`
- [ ] Implement `confirmExtractionAndCreateRosterV2()`
- [ ] Add session management for multi-phase

### Phase 3: UI Components
- [ ] Create `roster-upload-wizard-v2.tsx`
- [ ] Add phase progress indicator
- [ ] Add validation results display
- [ ] Add manual correction interface

### Phase 4: Page & Routing
- [ ] Create `/manage/rosters/new/v2/page.tsx`
- [ ] Add navigation link from main rosters page
- [ ] Add "Try V2" button on current upload page

### Phase 5: Testing
- [ ] Test with simple rosters
- [ ] Test with congested columns
- [ ] Test with merged cells
- [ ] Compare V1 vs V2 results
- [ ] Performance benchmarking

---

## Backward Compatibility

- Current implementation remains unchanged
- All existing routes continue to work
- V2 is completely opt-in via `/manage/rosters/new/v2`
- Once V2 is proven, we can:
  1. Make V2 the default at `/manage/rosters/new`
  2. Move V1 to `/manage/rosters/new/v1`
  3. Eventually deprecate V1

---

## Questions Resolved

✅ Keep current implementation intact
✅ Use GPT-4o for all phases (or GPT-4o-mini for validation)
✅ Same matching, versioning, and confirmation flow
✅ Separate page for testing
✅ Can be made redundant after thorough testing
