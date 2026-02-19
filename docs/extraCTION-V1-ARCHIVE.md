# Roster Extraction V1 - Archive Documentation

> **Status**: DEPRECATED - Replaced by V3 extraction system
> **Date Archived**: February 2026
> **Reason for Deprecation**: Slow performance (5+ minutes), missed shifts in congested columns, multiple API calls

## Overview

The V1 extraction system was the original AI-powered roster image extraction system. It used a single-pass approach with GPT-4 Vision but had several limitations that led to the development of V3.

## Files (Archived)

The following files comprised the V1 extraction system:

### Service Layer
- `src/lib/services/roster-extraction-service.ts` - Main extraction service (NOTE: This file may be shared with other versions)

### Server Actions
- `src/lib/actions/rosters/extraction-actions.ts` - Server actions for V1 extraction

### UI Components
- `src/components/rosters/roster-upload-wizard.tsx` - Upload wizard component

### Pages
- `src/app/manage/rosters/new/page.tsx` - New roster page
- Upload flow integrated into existing rosters page

## How V1 Worked

### 1. Upload Flow
```
User selects venue → Uploads image → System processes image → Shows extracted shifts → User confirms
```

### 2. Extraction Process
1. **Image Upload**: Image uploaded to Supabase storage
2. **AI Processing**: Single GPT-4 Vision API call
3. **Staff Matching**: Fuzzy matching of staff names to user database
4. **Result Display**: Shows extracted shifts with confidence scores
5. **Manual Review**: User can fix unmatched entries

### 3. Data Flow
```
Image → GPT-4 Vision → JSON Extraction → Staff Matching → Roster Creation
```

## Limitations of V1

### Performance Issues
- **Single API call approach**: All extraction in one prompt
- **No preprocessing**: Raw images sent to AI
- **No validation**: No code-based validation layer
- **No retry mechanism**: Failed extractions required re-upload

### Accuracy Issues
- **Missed shifts in congested columns**: When multiple shifts were in one cell (e.g., "8-4, 12-8"), the AI often missed some
- **Name matching issues**: Fuzzy matching sometimes matched wrong users
- **No confidence gating**: Low-confidence extractions were still accepted

### User Experience Issues
- **Long wait times**: 5+ minutes for extraction
- **No progress indication**: Users couldn't see what was happening
- **No error recovery**: Had to start over on failure

## V1 API Structure

### `uploadAndExtractRoster`
```typescript
async function uploadAndExtractRoster(
  venueId: string,
  file: File,
  options?: {
    rosterName?: string;
    createAsNewVersion?: boolean;
    existingRosterId?: string;
  }
): Promise<ExtractionActionResult>
```

### `confirmExtractionAndCreateRoster`
```typescript
async function confirmExtractionAndCreateRoster(
  extractionId: string,
  options?: {
    name?: string;
    finalize?: boolean;
  }
): Promise<ConfirmActionResult>
```

## How to Revert to V1

If you need to revert to V1 extraction:

### 1. Restore Files
```bash
# From git history before V3 was introduced
git checkout <commit-before-v3> -- src/lib/actions/rosters/extraction-actions.ts
git checkout <commit-before-v3> -- src/components/rosters/roster-upload-wizard.tsx
```

### 2. Update Import Paths
The V1 components should still be importable from their original locations.

### 3. Environment Variables
V1 requires:
```
OPENAI_API_KEY=sk-...
```

### 4. Database Schema
V1 uses the same schema as V3, no database changes needed.

## Differences Between V1 and V3

| Feature | V1 | V3 |
|---------|----|----|
| API Calls | Single call | Single call with retry |
| Image Preprocessing | None | Contrast, crop, resize |
| Validation | None | Code-based (regex, consistency) |
| Retry Mechanism | None | Max 2 retries with correction prompt |
| Confidence Gating | None | 70% threshold |
| Prompt Type | Free-form | Strict JSON schema |
| Model | GPT-4 Vision | GPT-4o |

## Migration Guide

### For Developers
1. V1 actions are still exported from `@/lib/actions/rosters`
2. V3 actions are in `@/lib/actions/rosters/extraction-v3-actions`
3. Both can coexist during transition

### For Users
1. V3 upload is at `/manage/rosters-v2/upload`
2. V1 upload remains at `/manage/rosters` (Create Roster → Upload)
3. Both create rosters in the same format

## Deprecation Timeline

- **February 2026**: V3 introduced, V1 deprecated
- **March 2026**: V1 UI removed from main flow
- **April 2026**: V1 code archived (this document)

## References

- Original extraction plan: `plans/roster-extraction-enhancement-plan.md`
- Deep analysis: `plans/roster-extraction-deep-analysis.md`
- V3 implementation: `plans/roster-extraction-v3-plan.md`
