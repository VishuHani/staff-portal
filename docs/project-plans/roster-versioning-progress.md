# Roster Versioning - Implementation Progress

## Status: In Progress

Started: 2025-11-28

---

## Phase 0: Comprehensive Versioning & History Fixes

### 0.1 Fix Draft Versions Not Appearing in List
- [ ] Modify `roster-queries.ts` filter logic to include DRAFT status
- **Status:** Not Started
- **File:** `src/lib/actions/rosters/roster-queries.ts`

### 0.2 Fix Version Number Display Inconsistency
- [ ] Update title badge to show `versionNumber` instead of history max
- [ ] Update Change Log header to clarify "revisions" terminology
- **Status:** Not Started
- **Files:**
  - `src/app/manage/rosters/[id]/roster-editor-client.tsx`
  - `src/components/rosters/version-history.tsx`

### 0.3 Enable Navigation to Old/Superseded Versions
- [ ] Add status tabs to roster list page (All, Drafts, Published, Superseded)
- [ ] Remove `chainId &&` condition from Version Chain Panel render
- [ ] Add read-only banner for superseded versions
- [ ] Add "Go to Latest" and "Go to Draft" buttons in Version Chain Panel
- **Status:** Not Started
- **Files:**
  - `src/app/manage/rosters/page.tsx`
  - `src/app/manage/rosters/[id]/roster-editor-client.tsx`
  - `src/components/rosters/version-chain-panel.tsx`

### 0.4 Version Chain Rollback (Restore Old Version)
- [ ] Create `restoreFromVersion()` server action
- [ ] Add "Restore This Version" button in Version Chain Panel
- [ ] Add confirmation dialog for restore action
- **Status:** Not Started
- **Files:**
  - `src/lib/actions/rosters/version-actions.ts`
  - `src/components/rosters/version-chain-panel.tsx`

### 0.5 Enhanced Approval History (Audit Log)
- [ ] Add `previousStatus`/`newStatus` to all workflow actions
- [ ] Update ApprovalHistory component to display enhanced info
- [ ] Add new action types (VERSION_CREATED, RESTORED_FROM_VERSION)
- **Status:** Not Started
- **Files:**
  - `src/lib/actions/rosters/approval-actions.ts`
  - `src/lib/actions/rosters/roster-actions.ts`
  - `src/components/rosters/approval-history.tsx`

---

## Progress Log

### 2025-11-28

- Created project plan documentation
- Created progress tracking file
- Starting implementation...

---

## Testing Results

| Test Case | Status | Notes |
|-----------|--------|-------|
| Draft appears in list after "Create New Version" | Pending | |
| Version badge shows chain version | Pending | |
| Change Log shows revision terminology | Pending | |
| Superseded tab shows old versions | Pending | |
| Version Chain Panel always visible | Pending | |
| Old version opens in read-only mode | Pending | |
| Restore creates new draft | Pending | |
| Approval History shows transitions | Pending | |
