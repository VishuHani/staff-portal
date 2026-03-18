# Roster Module — Comprehensive Fix & Enhancement Plan

## Executive Summary

The Roster module has two creation methods (AI Extraction and Manual Creation) with a sophisticated backend (version chains, approval workflow, conflict detection) but critical gaps in the **manual roster building experience**. The matrix view only shows staff who already have shifts, making it impossible to visually build a roster from scratch. Additionally, there are missing features across all user roles (Admin, Manager, Staff) including export, preview, and proper cross-role integration.

---

## User Roles & Permissions

| Permission | Admin | Manager | Staff |
|-----------|-------|---------|-------|
| `rosters:view_own` | ✅ | ✅ | ✅ |
| `rosters:view_team` | ✅ | ✅ | ❌ |
| `rosters:view_all` | ✅ | ❌ | ❌ |
| `rosters:create` | ✅ | ✅ | ❌ |
| `rosters:edit` | ✅ | ✅ | ❌ |
| `rosters:delete` | ✅ | ❌ | ❌ |
| `rosters:publish` | ✅ | ✅ | ❌ |
| `rosters:approve` | ✅ | ❌ | ❌ |

**Key insight:** Managers have full create/edit/publish permissions. The system is NOT admin-only — managers are the primary roster creators. All fixes must work for both Admin and Manager roles.

---

## Current User Journeys

### Manager/Admin: Create Roster Manually
1. Navigate to `/manage/rosters` (or `/manage/rosters-v3`)
2. Click "Create Roster" → "Create Manually"
3. Fill form: venue, name, dates → Submit
4. Redirected to `/manage/rosters/{id}` (editor)
5. **🔴 BUG: See empty state with "Add Shift" button — NO matrix grid**
6. Click "Add Shift" → Dialog opens → Fill shift details → Submit
7. **Matrix appears but only shows the ONE staff member who has a shift**
8. Must repeat step 6 for every single shift, one at a time

### Manager/Admin: Upload Roster (AI)
1. Navigate to `/manage/rosters` (or `/manage/rosters-v3`)
2. Click "Create Roster" → "Upload File" (or "Upload for {Venue}")
3. Upload image/Excel/CSV → AI extracts shifts
4. Preview extracted shifts in flat table → Confirm
5. Redirected to editor with all shifts populated in matrix

### Staff: View My Shifts
1. Navigate to `/my/rosters`
2. See upcoming shifts grouped by Today/Tomorrow/This Week/Coming Up
3. **No calendar view, no weekly grid, no roster-level grouping**

---

## Phase 1: Critical Fixes (Manual Roster Matrix)

### 1A. Fix RosterMatrixView to Show All Venue Staff

**Problem:** When `shifts.length === 0`, the matrix renders an empty state message instead of a grid. Even with shifts, only staff WITH shifts appear as rows.

**Solution:** Add `allStaff` prop to `RosterMatrixView`. Merge all venue staff into `staffList` so every staff member appears as a row, even with no shifts.

**Files to modify:**
- `src/components/rosters/roster-matrix-view.tsx`
  - Add `allStaff?: StaffMember[]` to `RosterMatrixViewProps`
  - Modify `staffList` useMemo to merge `allStaff` with shift-derived staff
  - Remove the `if (shifts.length === 0)` early return — always render the grid
  - Show empty cells with "+" buttons for staff without shifts

### 1B. Pass allStaff from Editor to Matrix

**Files to modify:**
- `src/app/manage/rosters/[id]/roster-editor-client.tsx`
  - Pass `staff` prop (already available) as `allStaff` to `RosterMatrixView`

### 1C. Add "Add People" Dialog

**New component:** `src/components/rosters/add-people-dialog.tsx`
- Multi-select dialog showing all venue staff
- Allows selecting which staff to include in the matrix
- Selected staff appear as rows even without shifts
- Integrates with the editor's state

**Files to modify:**
- `src/app/manage/rosters/[id]/roster-editor-client.tsx` — Add button and dialog state

### 1D. Wire Header Publish Button

**Problem:** The "Publish Roster" button in the header bar has no `onClick` handler.

**Files to modify:**
- `src/app/manage/rosters/[id]/roster-editor-client.tsx` line ~552
  - Add onClick to trigger the approval workflow publish dialog

### 1E. Fix System Admin Roster Page

**Problem:** `system/rosters/[id]/page.tsx` doesn't pass `positionColors`, `positions`, or `staffPayRates` to `RosterEditorClient`.

**Files to modify:**
- `src/app/system/rosters/[id]/page.tsx`
  - Import and call `getPositions()` for the venue
  - Build `staffPayRates` map from staff data
  - Pass all three props to `RosterEditorClient`

---

## Phase 2: Export, Preview & Navigation

### 2A. Roster Export to Excel/CSV

**New files:**
- `src/lib/utils/roster-export.ts` — Export utility functions
  - `exportRosterToExcel()` — Generate XLSX with Staff×Days matrix
  - `exportRosterToCSV()` — Generate CSV format
  - `exportRosterToPDF()` — Generate printable PDF

**Files to modify:**
- `src/components/rosters/roster-actions-menu.tsx` — Add "Export" menu items
- `src/app/manage/rosters/[id]/roster-editor-client.tsx` — Add export button to header

### 2B. Print/Preview View

**New files:**
- `src/app/manage/rosters/[id]/preview/page.tsx` — Server component
- `src/app/manage/rosters/[id]/preview/roster-preview-client.tsx` — Read-only matrix view optimized for printing

**Features:**
- Clean, print-optimized layout
- No edit controls, no drag-and-drop
- Company/venue branding header
- Print CSS media queries
- Accessible to anyone with `rosters:view_team` or `rosters:view_all`

### 2C. Consolidate Sidebar Navigation

**Problem:** Sidebar links to `/manage/rosters-v3` which is a duplicate of `/manage/rosters` with the V3 upload wizard. Should consolidate.

**Files to modify:**
- `src/components/layout/sidebar.tsx` — Change href from `/manage/rosters-v3` to `/manage/rosters`

---

## Phase 3: Enhanced Editing & Cross-Role Integration

### 3A. Bulk Shift Creation

**Enhancement to ShiftForm:**
- Add "Apply to multiple days" checkbox
- Day selector (Mon-Sun checkboxes)
- Creates shifts for all selected days in one action

**Files to modify:**
- `src/components/rosters/shift-form.tsx` — Add multi-day selection UI
- `src/lib/actions/rosters/shift-actions.ts` — Already has `bulkAddShifts()` action

### 3B. Staff Availability Overlay

**Enhancement to RosterMatrixView:**
- Fetch staff availability data
- Show green/yellow/red indicators in matrix cells
- Green = available, Yellow = partial, Red = unavailable

**Files to modify:**
- `src/components/rosters/roster-matrix-view.tsx` — Add availability indicators
- `src/app/manage/rosters/[id]/page.tsx` — Fetch and pass availability data
- `src/app/manage/rosters/[id]/roster-editor-client.tsx` — Pass to matrix

### 3C. Time-Off Integration

**Enhancement to RosterMatrixView:**
- Show approved time-off as blocked cells
- Visual warning when scheduling during time-off

**Files to modify:**
- `src/components/rosters/roster-matrix-view.tsx` — Add time-off overlay
- `src/app/manage/rosters/[id]/page.tsx` — Fetch time-off data for date range

### 3D. Enhance Staff "My Shifts" View

**Current state:** Card-based list grouped by day. No weekly grid view.

**Enhancements:**
- Add weekly calendar/grid view toggle
- Show roster name and venue prominently
- Add "View Full Roster" link (read-only matrix view)
- Show position colors consistently

**Files to modify:**
- `src/app/my/rosters/my-shifts-client.tsx` — Add calendar view toggle
- `src/app/my/rosters/page.tsx` — Pass additional data

---

## Phase 4: AI Extraction Improvements

### 4A. Matrix Preview in V3 Wizard

**Use existing component:** `src/components/rosters/extraction-matrix-preview.tsx` exists but isn't used.

**Files to modify:**
- `src/components/rosters/roster-upload-wizard-v3.tsx` — Replace flat table with `ExtractionMatrixPreview`

### 4B. Inline Editing of Extracted Shifts

**Enhancement to preview step:**
- Allow editing times, positions, staff names before confirming
- Inline edit in the preview table/matrix

**Files to modify:**
- `src/components/rosters/roster-upload-wizard-v3.tsx` — Add edit capabilities to preview

### 4C. Manual Staff Re-matching

**Enhancement to preview step:**
- For unmatched names, show a dropdown to manually select a staff member
- Update match status in real-time

**Files to modify:**
- `src/components/rosters/roster-upload-wizard-v3.tsx` — Add staff selector for unmatched entries

---

## Implementation Order

```
Phase 1 (Critical — Fix broken manual creation)
├── 1A: Fix RosterMatrixView empty state → show all staff grid
├── 1B: Pass allStaff prop from editor
├── 1C: Add People dialog
├── 1D: Wire Publish button
└── 1E: Fix admin roster page props

Phase 2 (Important — Export & Navigation)
├── 2A: Export to Excel/CSV
├── 2B: Print/Preview view
└── 2C: Consolidate sidebar

Phase 3 (Enhancement — Cross-role integration)
├── 3A: Bulk shift creation
├── 3B: Availability overlay
├── 3C: Time-off integration
└── 3D: Enhanced My Shifts view

Phase 4 (Polish — AI extraction improvements)
├── 4A: Matrix preview in wizard
├── 4B: Inline editing
└── 4C: Manual re-matching
```

---

## Files Inventory

### Files to CREATE:
1. `src/components/rosters/add-people-dialog.tsx` — Staff selection dialog
2. `src/lib/utils/roster-export.ts` — Export utilities
3. `src/app/manage/rosters/[id]/preview/page.tsx` — Preview server page
4. `src/app/manage/rosters/[id]/preview/roster-preview-client.tsx` — Preview client

### Files to MODIFY:
1. `src/components/rosters/roster-matrix-view.tsx` — Core matrix fix (allStaff, empty state, availability)
2. `src/app/manage/rosters/[id]/roster-editor-client.tsx` — Pass allStaff, wire publish, add export
3. `src/app/system/rosters/[id]/page.tsx` — Pass positions and pay rates
4. `src/components/rosters/roster-actions-menu.tsx` — Add export menu items
5. `src/components/rosters/shift-form.tsx` — Bulk shift creation
6. `src/components/rosters/roster-upload-wizard-v3.tsx` — AI extraction improvements
7. `src/components/layout/sidebar.tsx` — Fix roster nav link
8. `src/app/my/rosters/my-shifts-client.tsx` — Enhanced staff view
9. `src/app/manage/rosters/[id]/page.tsx` — Fetch availability/time-off data
10. `src/components/rosters/index.ts` — Export new components
