# Roster Extraction V3 - Production-Grade Implementation Plan

## Overview

This plan outlines a complete refactor of the roster extraction system based on best practices recommended by GPT-4o for vision-based structured data extraction.

## Current Problems

| Issue | Current State | Impact |
|-------|---------------|--------|
| Multiple API calls | 3 separate GPT-4o calls | Slow (3+ minutes), expensive |
| Verbose prompts | Explanatory text in prompts | Model gets distracted |
| Weak validation | AI-based validation | Inconsistent results |
| No retry | Single attempt | Failures require manual intervention |
| No preprocessing | Raw image sent | Poor quality images fail |
| Flexible schema | Optional fields | Incomplete data accepted |

## New Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         V3 EXTRACTION PIPELINE                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐                                                           │
│  │   Upload     │                                                           │
│  │   Image      │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐     ┌─────────────────────────────────────────┐           │
│  │ Preprocess   │     │ - Auto-crop whitespace                  │           │
│  │   Image      │────►│ - Increase contrast                     │           │
│  └──────┬───────┘     │ - Resize to 1000-2000px width           │           │
│         │             │ - Convert to PNG                         │           │
│         ▼             └─────────────────────────────────────────┘           │
│  ┌──────────────┐                                                           │
│  │   Single     │     ┌─────────────────────────────────────────┐           │
│  │   GPT-4o     │     │ EXTRACTION PROMPT:                      │           │
│  │   Vision     │────►│ - Strict JSON schema                    │           │
│  │   Call       │     │ - Clear extraction rules                │           │
│  └──────┬───────┘     │ - No explanations                       │           │
│         │             │ - Role section detection                │           │
│         ▼             │ - Break marker detection                │           │
│  ┌──────────────┐     └─────────────────────────────────────────┘           │
│  │   Parse      │                                                           │
│  │   JSON       │                                                           │
│  └──────┬───────┘                                                           │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐     ┌─────────────────────────────────────────┐           │
│  │  Validate    │     │ CODE-BASED VALIDATION:                  │           │
│  │   Output     │────►│ - Time format regex: HH:MM-HH:MM        │           │
│  └──────┬───────┘     │ - Date format validation                │           │
│         │             │ - end_time > start_time                 │           │
│         │             │ - No duplicate entries                  │           │
│         │             │ - Required fields present               │           │
│         ▼             └─────────────────────────────────────────┘           │
│  ┌──────────────┐                                                           │
│  │  Confidence  │     ┌─────────────────────────────────────────┐           │
│  │    Gate      │────►│ IF confidence < 70%:                    │           │
│  └──────┬───────┘     │   → Retry with correction prompt        │           │
│         │             │   → Max 2 retries                       │           │
│         ▼             └─────────────────────────────────────────┘           │
│  ┌──────────────┐                                                           │
│  │   Return     │                                                           │
│  │   Result     │                                                           │
│  └──────────────┘                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Image Preprocessing

**File:** `src/lib/services/image-preprocessing.ts`

```typescript
interface PreprocessOptions {
  minWidth: number;      // 1000
  maxWidth: number;      // 2000
  contrastBoost: number; // 1.2
  cropWhitespace: boolean;
}

async function preprocessImage(
  imageBuffer: Buffer,
  options: PreprocessOptions
): Promise<Buffer>;
```

**Steps:**
1. Auto-crop whitespace borders
2. Increase contrast for better text recognition
3. Resize to optimal width (1000-2000px)
4. Convert to PNG format

### 2. Strict JSON Schema

**Output Schema:**

```json
{
  "week_start": "YYYY-MM-DD",
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
      "break": true,
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
```

### 3. Focused Extraction Prompt

```
You are a structured data extraction engine.

Extract ALL shift entries from this roster image.

Rules:
- Each shift must become one JSON object.
- Only include rows where a time is present.
- Time format must be HH:MM-HH:MM (24-hour).
- If (B) appears next to a shift, set break=true.
- Identify role sections correctly (Driver, Kitchen Hand, Store Manager, etc.)
- Match each shift to correct date column.
- Do not hallucinate missing entries.
- If uncertain about a cell, add to uncertain_fields and omit from shifts.

Return only valid JSON following the provided schema.
No explanations.
```

### 4. Code-Based Validation Layer

**File:** `src/lib/services/extraction-validator.ts`

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  confidence: number;
}

function validateExtraction(data: ExtractedData): ValidationResult;

// Validations:
// 1. Time format: /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/
// 2. Date format: /^\d{4}-\d{2}-\d{2}$/
// 3. end_time > start_time
// 4. No duplicate (staff_name + date + start_time)
// 5. Required fields: date, staff_name, start_time, end_time
// 6. week_start matches first date in shifts
```

### 5. Retry Mechanism with Correction Prompt

```typescript
async function extractWithRetry(
  imageBuffer: Buffer,
  maxRetries: number = 2
): Promise<ExtractionResult> {
  let attempt = 0;
  let lastErrors: ValidationError[] = [];
  
  while (attempt <= maxRetries) {
    const result = await extractShifts(imageBuffer, lastErrors);
    const validation = validateExtraction(result);
    
    if (validation.isValid || validation.confidence >= 70) {
      return result;
    }
    
    lastErrors = validation.errors;
    attempt++;
  }
  
  throw new ExtractionError('Max retries exceeded', lastErrors);
}
```

**Correction Prompt (used on retry):**

```
The previous extraction had these errors:
- [ERROR 1]
- [ERROR 2]

Please correct these issues and extract again.
Return only valid JSON.
```

### 6. Confidence Gating

```typescript
interface ConfidenceThresholds {
  excellent: 90;  // Accept immediately
  good: 80;       // Accept with minor review
  fair: 70;       // Accept with review required
  poor: 60;       // Retry with correction prompt
  reject: 50;     // Manual review required
}
```

## File Structure

```
src/lib/services/
├── roster-extraction-v3-service.ts    # Main extraction service
├── image-preprocessing.ts             # Image preprocessing utilities
├── extraction-validator.ts            # Code-based validation
└── extraction-prompts.ts              # Prompt templates

src/lib/actions/rosters/
└── extraction-v3-actions.ts           # Server actions for V3
```

## Expected Performance

| Metric | Current (V2) | Target (V3) |
|--------|--------------|-------------|
| API Calls | 3 | 1-2 |
| Processing Time | 3-5 minutes | 30-60 seconds |
| Accuracy | 60-70% | 90-95% |
| Cost per extraction | ~$0.15 | ~$0.05 |

## Migration Plan

1. **Create new V3 service** alongside V2 (no breaking changes)
2. **Add feature flag** to switch between V2 and V3
3. **Test with existing roster images** to compare accuracy
4. **Gradual rollout** with fallback to V2 if confidence is low
5. **Deprecate V2** once V3 proves stable

## Next Steps

1. Create `image-preprocessing.ts` with sharp library
2. Create `extraction-validator.ts` with validation logic
3. Create `extraction-prompts.ts` with prompt templates
4. Create `roster-extraction-v3-service.ts` with single-pass extraction
5. Create `extraction-v3-actions.ts` with server actions
6. Update UI to show V3 progress and results
7. Add feature flag for V2/V3 selection
