# Roster Versioning & History Enhancement Plan

## Overview

This plan addresses all core versioning and history tracking issues in the roster management system.

---

## Phase 0: Comprehensive Versioning & History Fixes

### 0.1 Fix Draft Versions Not Appearing in List

**Root Cause:**
The `getRosters()` function in `src/lib/actions/rosters/roster-queries.ts:78-84` filters with `isActive: true` by default. Draft versions created via "Create New Version" have `isActive: false`, so they're hidden.

**Fix:**
```typescript
// In roster-queries.ts, update lines 78-84
if (filters.isActive !== undefined) {
  where.isActive = filters.isActive;
} else if (!filters.includeSuperseded) {
  // Show active rosters OR any drafts (drafts may have isActive: false when created as new version)
  where.OR = [
    { isActive: true },
    { status: 'DRAFT' }
  ];
}
```

**File:** `src/lib/actions/rosters/roster-queries.ts`

---

### 0.2 Fix Version Number Display Inconsistency

**Problem:**
- Title badge shows edit revision (RosterHistory.version)
- These are confusing without context

**Two Different Concepts:**
1. **Chain Version** (`roster.versionNumber`): Position in version chain (v1, v2, v3)
2. **Edit Revision** (`roster.revision` / `RosterHistory.version`): Internal edit counter

**Fix Approach:**

1. **Title Badge** - Show chain version number:
   ```tsx
   <Badge variant="outline" className="text-sm">
     v{roster.versionNumber}
     {roster.chainId && ` (rev ${roster.revision})`}
   </Badge>
   ```

2. **Change Log Header** - Clarify it shows edit history:
   ```tsx
   <CardDescription>
     {history.length} edits | Currently at revision {currentVersion}
   </CardDescription>
   ```

**Files:**
- `src/app/manage/rosters/[id]/roster-editor-client.tsx`
- `src/components/rosters/version-history.tsx`

---

### 0.3 Enable Navigation to Old/Superseded Versions

**Current Issue:**
- Old versions become `isActive: false` and disappear from main list
- Version Chain Panel only shows if `roster.chainId` exists

**Fix Approach:**

1. **Add Tabs/Filter to Roster List Page:**
   - [All Rosters] [Drafts] [Published] [Superseded/Archived]

2. **Always Show Version Chain Panel** for any roster

3. **Mark Old Versions as Read-Only:**
   - Add banner: "This is a superseded version. View the current version"

4. **Update Version Chain Panel:**
   - Add "Go to Latest" button when viewing old version
   - Add "Go to Draft" button if a draft version exists

**Files:**
- `src/app/manage/rosters/page.tsx`
- `src/app/manage/rosters/[id]/roster-editor-client.tsx`
- `src/components/rosters/version-chain-panel.tsx`

---

### 0.4 Version Chain Rollback (Restore Old Version)

**Requirement:** Ability to rollback to a previous version in the chain

**Flow:**
```
User viewing v2 (current active)
         |
Click "Restore v1" in Version Chain Panel
         |
Confirmation: "This will create a new draft copying v1's shifts"
         |
Creates v3 draft with v1's shifts copied
         |
User can edit and publish as usual
```

**Implementation:**

1. **Add Server Action:** `restoreFromVersion(currentRosterId, sourceVersionId)`
2. **Add UI Button in Version Chain Panel**

**Files:**
- `src/lib/actions/rosters/version-actions.ts`
- `src/components/rosters/version-chain-panel.tsx`

---

### 0.5 Enhanced Approval History (Audit Log)

**Current State:**
- `ApprovalHistory` component shows workflow actions
- Missing: complete status transitions, affected staff, shift changes

**Enhancements:**

1. **Store Status Transitions Consistently:**
   - Add `previousStatus` and `newStatus` in the `changes` JSON

2. **Enhanced Approval History Display:**
   - Show status transitions (DRAFT -> APPROVED -> PUBLISHED)
   - Show staff notified count
   - Show shift count at each point

3. **Add More Action Types to Track:**
   - `CREATED`, `VERSION_CREATED`, `RESTORED_FROM_VERSION`

**Files:**
- `src/lib/actions/rosters/approval-actions.ts`
- `src/lib/actions/rosters/roster-actions.ts`
- `src/components/rosters/approval-history.tsx`

---

## Files to Modify Summary

| Priority | File | Changes |
|----------|------|---------|
| P0 | `src/lib/actions/rosters/roster-queries.ts` | Fix filter to show DRAFT rosters |
| P1 | `src/app/manage/rosters/[id]/roster-editor-client.tsx` | Fix version badge, remove chainId condition |
| P1 | `src/components/rosters/version-history.tsx` | Clarify "revision" terminology |
| P2 | `src/app/manage/rosters/page.tsx` | Add status tabs for Superseded filter |
| P2 | `src/components/rosters/version-chain-panel.tsx` | Add Restore button, Go to Latest/Draft buttons |
| P3 | `src/lib/actions/rosters/version-actions.ts` | Add `restoreFromVersion()` function |
| P3 | `src/lib/actions/rosters/approval-actions.ts` | Add status transitions to all actions |
| P3 | `src/components/rosters/approval-history.tsx` | Display enhanced audit info |

---

## Testing Checklist

- [ ] Create new version from published roster -> Draft appears in list immediately
- [ ] Version badge in title shows chain version (v1, v2), not edit revision
- [ ] Change Log clarifies it shows edit revisions, not chain versions
- [ ] Can click "Superseded" tab to see old versions
- [ ] Version Chain Panel shows for all rosters (even without chainId)
- [ ] "View" button on old version opens in read-only mode with banner
- [ ] "Restore This Version" creates a new draft with old shifts
- [ ] Approval History shows status transitions (DRAFT -> APPROVED -> PUBLISHED)
- [ ] Approval History shows staff notified count and shift count
