# Roster Extraction V3 Architecture

## Overview

The V3 Roster Extraction system provides production-grade extraction of roster data from images and spreadsheets using AI-powered analysis with deterministic validation and staff matching.

## Architecture Components

### 1. Extraction Pipeline

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Upload    │───▶│ Preprocessing│───▶│  AI Vision  │───▶│  Validation  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
                                                                │
                                                                ▼
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Confirm   │◀───│   Preview    │◀───│   Matching  │◀───│   Adapters   │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### 2. Core Modules

| Module | Location | Purpose |
|--------|----------|---------|
| Staff Matching Engine | `src/lib/rosters/staff-matching-engine.ts` | Deterministic staff name matching with confidence bands |
| Validation Engine | `src/lib/rosters/validation-engine.ts` | Multi-stage validation with severity classification |
| Preview Engine | `src/lib/rosters/v3-preview-engine.ts` | Canonical domain model and state adapters |
| Idempotency | `src/lib/rosters/extraction-idempotency.ts` | Transaction-safe roster creation with duplicate prevention |
| Limits | `src/lib/rosters/extraction-limits.ts` | Payload limits and performance protections |
| Observability | `src/lib/rosters/extraction-observability.ts` | Structured logging and metrics |
| Security | `src/lib/rosters/extraction-security.ts` | Permission checks and PII-safe prompts |
| Feature Flags | `src/lib/rosters/extraction-feature-flags.ts` | Rollout controls and fallback |

### 3. UI Components

| Component | Location | Purpose |
|-----------|----------|---------|
| RosterUploadWizardV3 | `src/components/rosters/roster-upload-wizard-v3.tsx` | Main wizard orchestration |
| ExtractionMatrixPreview | `src/components/rosters/extraction-matrix-preview.tsx` | Matrix view of extracted shifts |
| UnresolvedIdentityPanel | `src/components/rosters/unresolved-identity-panel.tsx` | Manual staff resolution workflow |
| ExtractionDiagnosticsPanel | `src/components/rosters/extraction-diagnostics-panel.tsx` | Confidence scorecards and issues |

## Staff Matching Engine

### Strategy Chain (Ordered by Priority)

1. **exact_email** (100% confidence) - Email address exact match
2. **exact_full_name** (100% confidence) - Full name exact match
3. **name_with_initial** (95% confidence) - "J. Smith" matches "John Smith"
4. **alias_match** (90% confidence) - Known nickname/alias match
5. **exact_first_name** (75% confidence) - First name only match
6. **fuzzy_high** (85% confidence) - High-confidence fuzzy match
7. **fuzzy_medium** (70% confidence) - Medium-confidence fuzzy match
8. **fuzzy_low** (50% confidence) - Low-confidence fuzzy match
9. **no_match** (0% confidence) - No match found

### Confidence Bands

| Band | Score Range | Description |
|------|-------------|-------------|
| exact | 100% | Exact match (email or full name) |
| high | 85-99% | High confidence, auto-accepted |
| medium | 60-84% | Needs review before confirmation |
| low | 40-59% | Requires manual confirmation |
| none | <40% | Unmatched, must resolve manually |

### Usage

```typescript
import { matchStaffName, matchShiftsToStaff } from "@/lib/rosters/staff-matching-engine";

// Match a single name
const result = matchStaffName("J. Smith", venueStaff);
// Returns: { userId, confidence, strategy, reason, alternatives }

// Match all shifts
const matchedShifts = matchShiftsToStaff(extractedShifts, venueStaff);
```

## Validation Engine

### Validation Stages

1. **schema** - Basic structure validation (required fields, types)
2. **temporal** - Time-based validation (shift order, overnight shifts)
3. **business_rule** - Business logic (max hours, break requirements)
4. **conflict** - Conflict detection (overlapping shifts, double-booking)
5. **staff_match** - Staff matching validation (unmatched staff, low confidence)

### Severity Levels

| Severity | Behavior |
|----------|----------|
| blocking | Must be resolved before confirmation |
| warning | Displayed but allows confirmation |
| info | Informational only |

### Usage

```typescript
import { validateRosterShifts, getBlockingIssues } from "@/lib/rosters/validation-engine";

const result = validateRosterShifts(shifts, { venueId, weekStart });
const blockingIssues = getBlockingIssues(result.issues);
```

## Preview Engine

### Canonical Domain Model

```typescript
interface PreviewShiftState {
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
  matchStrategy?: MatchStrategy;
  matchConfidenceBand?: ConfidenceBand;
  matchReason?: string;
  matchAlternatives?: Array<{ userId; confidence; staffName }>;
  requiresMatchConfirmation?: boolean;
  included: boolean;
  issues: string[];
}
```

### State Adapters

- `buildPreviewShiftState()` - Convert extraction output to preview state
- `buildMatrixExtractionResult()` - Build matrix view data
- `toConfirmPayloadShifts()` - Convert to confirmation payload
- `categorizeShiftsByMatchStatus()` - Group by match status

## Idempotency and Transaction Safety

### Idempotency Key Pattern

```typescript
import { 
  generateIdempotencyKey, 
  createRosterWithIdempotency 
} from "@/lib/rosters/extraction-idempotency";

const key = generateIdempotencyKey();
const result = await createRosterWithIdempotency(key, rosterData, shifts, snapshot);
```

### Duplicate Prevention

1. **Idempotency Key Check** - Prevents double-submission
2. **Existing Roster Check** - Prevents duplicate rosters for same venue/week
3. **Audit Trail** - Full snapshot stored for recovery

## Performance Protections

### Limits

| Limit | Value |
|-------|-------|
| Max file size (image) | 10 MB |
| Max file size (spreadsheet) | 5 MB |
| Max shifts per extraction | 500 |
| Max staff per extraction | 100 |
| Extraction timeout | 2 minutes |
| Max retries | 2 |

### Usage

```typescript
import { 
  validateFile, 
  checkExtractionLimits,
  shouldUseBackgroundProcessing 
} from "@/lib/rosters/extraction-limits";

const fileValidation = validateFile(file);
const limitsCheck = checkExtractionLimits(shifts, staff);
const useBackground = shouldUseBackgroundProcessing(fileSize, shiftCount);
```

## Observability

### Structured Logging

```typescript
import { 
  logExtractionEvent, 
  createCorrelationId,
  createTimedLogger 
} from "@/lib/rosters/extraction-observability";

const correlationId = createCorrelationId();
const logger = createTimedLogger("extraction_started", { venueId, userId, correlationId });

// On success
logger.complete({ shiftCount: 50, confidence: 92 });

// On failure
logger.fail("ai_timeout", "AI call timed out after 60s");
```

### Metrics

- Total attempts / success / failure rates
- Processing time percentiles (p50, p95, p99)
- Average confidence and match rate
- Failures by category

## Security

### Permission Checks

```typescript
import { checkExtractionPermission } from "@/lib/rosters/extraction-security";

const permission = await checkExtractionPermission(venueId);
if (!permission.allowed) {
  return { error: permission.reason };
}
```

### PII-Safe Prompts

Staff data is sanitized before sending to AI:

- Full email replaced with domain only
- Internal IDs truncated
- No sensitive fields included

### Rate Limiting

- 10 extraction attempts per minute per user
- Configurable via `checkExtractionRateLimit()`

## Feature Flags

### Configuration

```typescript
import { 
  getFeatureFlags, 
  updateFeatureFlags,
  shouldUseV3Extraction 
} from "@/lib/rosters/extraction-feature-flags";

// Check if V3 should be used
const result = shouldUseV3Extraction({ userId, venueId, userRole });

// Update rollout percentage
updateFeatureFlags({ v3RolloutPercentage: 50 });

// Enable for specific venue
enableV3ForVenue(venueId);
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `V3_EXTRACTION_ENABLED` | Master switch |
| `V3_ROLLOUT_PERCENTAGE` | Rollout percentage (0-100) |
| `V3_FALLBACK_TO_LEGACY` | Enable fallback on errors |
| `V3_DEBUG_LOGGING` | Enable debug logging |

## End-to-End Workflow

### 1. Upload

1. User selects file (image or spreadsheet)
2. File validation (size, type)
3. Permission check
4. Rate limit check

### 2. Extraction

1. Image preprocessing (contrast, crop, resize)
2. AI vision call (single-pass GPT-4o)
3. Response parsing and validation

### 3. Matching

1. Extract staff names from shifts
2. Run matching engine against venue staff
3. Categorize by confidence band
4. Queue unresolved identities

### 4. Preview

1. Build preview state from canonical model
2. Display matrix view with issues
3. Allow manual staff matching
4. Allow shift inclusion/exclusion

### 5. Validation

1. Run multi-stage validation
2. Display blocking issues
3. Display warnings

### 6. Confirmation

1. Generate idempotency key
2. Check for duplicate roster
3. Create roster in transaction
4. Store audit trail
5. Navigate to roster editor

## Error Handling

### Failure Categories

| Category | User Message |
|----------|--------------|
| upload_error | Failed to upload the file. Please check your connection. |
| file_too_large | The file is too large. Please use a smaller image. |
| invalid_file_type | Invalid file type. Please upload PNG, JPG, or spreadsheet. |
| preprocessing_error | Failed to process the image. Try a clearer image. |
| ai_timeout | The extraction took too long. Try a simpler roster. |
| ai_rate_limit | Too many requests. Please wait and try again. |
| ai_invalid_response | Received invalid response. Please try again. |
| ai_content_filter | Image blocked by content filters. |
| matching_error | Failed to match staff. Verify your staff list. |
| validation_error | Validation errors found. Review and correct. |
| database_error | Database error occurred. Try again later. |
| idempotency_conflict | This roster has already been created. |

## Testing

### Unit Tests

- Staff matching strategies
- Validation rules
- Preview state adapters
- Idempotency logic

### Integration Tests

- Full wizard flow
- Error recovery
- Fallback behavior

### Regression Fixtures

- Tricky rosters (cross-midnight, overnight)
- Edge cases (empty cells, merged cells)
- Various image qualities

## Operational Runbook

### Monitoring

1. Watch extraction success rate
2. Monitor average processing time
3. Alert on error rate spikes
4. Track match quality metrics

### Rollout Procedure

1. Start with 10% rollout
2. Monitor for 24 hours
3. Increase by 10% increments
4. Full rollout at 100%

### Rollback Procedure

1. Set `V3_EXTRACTION_ENABLED=false`
2. Or set `v3RolloutPercentage=0`
3. Or add venue to `v3DisabledVenues`

### Incident Response

1. Check feature flag status
2. Review recent error logs
3. Check AI service status
4. Enable fallback if needed
5. Communicate to users
