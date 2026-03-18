# Manual Roster Creation - Fix Plan

## Problem Diagnosis

### Current Flow Analysis

```mermaid
flowchart TD
    A[/manage/rosters/new] --> B[CreateRosterForm]
    B --> C[Submit: createRoster API]
    C --> D[Redirect to /manage/rosters/id]
    D --> E[RosterEditorClient]
    E --> F{shifts.length === 0?}
    F -->|Yes| G[Empty State: Add Shift Button]
    F -->|No| H[Matrix Grid Displayed]
    G --> I[Click Add Shift]
    I --> J[ShiftForm Dialog Opens]
    J --> K[Submit: addShift API]
    K --> L[onSuccess: router.refresh]
    L --> M[Server Re-renders]
    M --> N[Props Update]
    N --> O[useState Does NOT Update]
    O --> F
```

### Root Cause: State Synchronization Bug

**File:** [`src/app/manage/rosters/[id]/roster-editor-client.tsx`](src/app/manage/rosters/[id]/roster-editor-client.tsx:258)

```typescript
// Line 258 - The Problem
const [roster, setRoster] = useState(initialRoster);
```

**Issue:** When `router.refresh()` is called after adding a shift:
1. Server component re-fetches data with new shifts
2. New props are passed to `RosterEditorClient`
3. BUT `useState(initialRoster)` only initializes once on mount
4. The `roster` state never updates with the new shifts
5. Matrix view still shows empty state

### Evidence in Code

1. **ShiftForm onSuccess callback** (line 686):
   ```typescript
   onSuccess={() => router.refresh()}
   ```

2. **No useEffect to sync props to state** - Missing synchronization

3. **Matrix view condition** (roster-matrix-view.tsx:488):
   ```typescript
   if (shifts.length === 0) {
     return (/* Empty state */);
   }
   ```

---

## Pages and Views Analysis

### Existing Pages

| Page | Path | Status | Purpose |
|------|------|--------|---------|
| Roster List | `/manage/rosters` | ✅ Works | Shows all rosters |
| Create Roster | `/manage/rosters/new` | ✅ Works | Form to create roster |
| Roster Editor | `/manage/rosters/[id]` | ❌ Buggy | Matrix view + shift management |

### Existing Components

| Component | File | Status | Purpose |
|-----------|------|--------|---------|
| CreateRosterForm | `create-roster-form.tsx` | ✅ Works | Creates empty roster |
| RosterEditorClient | `roster-editor-client.tsx` | ❌ Buggy | Main editor page |
| RosterMatrixView | `roster-matrix-view.tsx` | ✅ Works | Staff × Days grid |
| ShiftForm | `shift-form.tsx` | ✅ Works | Add/Edit shift dialog |
| ApprovalWorkflow | `approval-workflow.tsx` | ✅ Works | Finalize/Publish |

### Missing Views/Features

| Feature | Status | Impact |
|---------|--------|--------|
| State sync after shift add | ❌ Missing | **Critical** - Matrix doesn't update |
| Roster preview before publish | ❌ Missing | Medium |
| Export to Excel/PDF | ❌ Missing | Medium |
| Bulk shift operations | ❌ Missing | Medium |
| Template library | ❌ Missing | Low |

---

## Fix Plan

### Phase 1: Critical Fix - State Synchronization

**File:** `src/app/manage/rosters/[id]/roster-editor-client.tsx`

**Solution:** Add useEffect to sync props to state

```typescript
// Add after line 258
useEffect(() => {
  setRoster(initialRoster);
}, [initialRoster]);
```

**Alternative Solution:** Use props directly instead of state

```typescript
// Replace state with direct prop usage where possible
// Only use state for local UI state like dialogs
```

### Phase 2: Enhanced Shift Management

1. **Optimistic UI Updates**
   - Update local state immediately after shift add
   - Rollback on API failure
   - Already partially implemented for shift move (line 383-453)

2. **Add Shift with Immediate Display**
   ```typescript
   const handleShiftAdded = (newShift: Shift) => {
     setRoster(prev => ({
       ...prev,
       shifts: [...prev.shifts, newShift]
     }));
   };
   ```

### Phase 3: Missing Features

1. **Roster Preview Modal**
   - Show summary before publishing
   - Display total hours, cost, conflicts
   - List all shifts by day

2. **Export Functionality**
   - Export to Excel/CSV
   - Export to PDF (print-friendly)
   - Use existing export utilities from reports module

3. **Bulk Operations**
   - Multi-select shifts
   - Bulk edit position/time
   - Bulk delete

---

## Implementation Checklist

### Immediate Fix (Critical)
- [ ] Add useEffect to sync `initialRoster` prop to `roster` state
- [ ] Test: Create roster → Add shift → Matrix appears
- [ ] Test: Add multiple shifts → All appear in matrix

### Short-term Improvements
- [ ] Add optimistic UI update for shift creation
- [ ] Add loading state during shift creation
- [ ] Improve error handling and rollback

### Medium-term Features
- [ ] Add roster preview before publish
- [ ] Add export to Excel functionality
- [ ] Add bulk shift selection and operations

---

## Testing Scenarios

### Scenario 1: Basic Manual Roster Creation
1. Navigate to `/manage/rosters/new`
2. Select venue, enter name, set dates
3. Click "Create Roster"
4. **Expected:** Redirect to roster editor
5. Click "Add Shift" button
6. Fill shift details, click "Add Shift"
7. **Expected:** Dialog closes, shift appears in matrix
8. Add more shifts
9. **Expected:** All shifts appear in matrix grid

### Scenario 2: Edit Existing Shift
1. Click on existing shift in matrix
2. **Expected:** ShiftForm opens with pre-filled data
3. Modify details, click "Update Shift"
4. **Expected:** Changes reflect in matrix immediately

### Scenario 3: Drag and Drop
1. Drag shift from one cell to another
2. **Expected:** Shift moves to new cell
3. **Expected:** Optimistic update shows immediately
4. **Expected:** API sync happens in background

---

## Code Changes Required

### File: `src/app/manage/rosters/[id]/roster-editor-client.tsx`

**Change 1:** Add useEffect for state sync (after line 258)

```typescript
// Sync roster state when props change
useEffect(() => {
  setRoster(initialRoster);
}, [initialRoster]);
```

**Change 2:** Add optimistic shift creation (modify handleShiftAdded)

```typescript
// Add new handler for optimistic shift creation
const handleShiftSuccess = (newShift?: Shift) => {
  if (newShift) {
    // Optimistic update - add shift to local state immediately
    setRoster(prev => ({
      ...prev,
      shifts: [...prev.shifts, newShift]
    }));
  }
  router.refresh(); // Sync with server
};
```

**Change 3:** Update ShiftForm onSuccess callback

```typescript
<ShiftForm
  // ... other props
  onSuccess={(newShift) => handleShiftSuccess(newShift)}
/>
```

---

## Estimated Effort

| Task | Complexity | Priority |
|------|------------|----------|
| Fix state sync bug | Low | Critical |
| Add optimistic updates | Medium | High |
| Add preview modal | Medium | Medium |
| Add export functionality | Medium | Medium |
| Add bulk operations | High | Low |

---

## Next Steps

1. **Immediate:** Fix the state synchronization bug
2. **Verify:** Test complete manual roster creation flow
3. **Enhance:** Add optimistic UI updates
4. **Expand:** Implement missing features based on priority
