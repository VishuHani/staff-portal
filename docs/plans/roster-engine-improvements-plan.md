# Roster Engine Improvements - Implementation Plan

## Overview

This document outlines a comprehensive plan to improve the manual roster creation system based on a thorough code review. The improvements are organized into phases based on priority and dependencies.

## Executive Summary

### Critical Issues Found
1. Validation engine exists but is never used
2. Staff cannot see shift conflicts on their shifts
3. Availability changes don't trigger conflict rechecks
4. No cross-venue conflict detection
5. Missing shift confirmation/acknowledgment system

### Impact
- **Compliance Risk**: Business rules (max hours, consecutive days) not enforced
- **Operational Risk**: Staff may not know about scheduling conflicts
- **User Experience**: Managers lack smart suggestions, staff lack visibility

---

## Phase 1: Critical Fixes - Validation Engine Integration

**Duration**: 2-3 days  
**Priority**: P0 - Critical  
**Dependencies**: None

### 1.1 Create Validation Service Wrapper

**File**: `src/lib/rosters/validation-service.ts`

```typescript
// New service that wraps validation-engine.ts for server actions
export interface RosterValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  summary: {
    blocking: number;
    warnings: number;
  };
}

export async function validateRosterForPublish(rosterId: string): Promise<RosterValidationResult>
export async function validateShiftBeforeAdd(rosterId: string, shift: ShiftInput): Promise<ValidationIssue[]>
export async function validateBulkShifts(rosterId: string, shifts: ShiftInput[]): Promise<ValidationIssue[]>
```

**Tasks**:
- [ ] Create validation-service.ts with wrapper functions
- [ ] Add roster context fetching (staff members, existing shifts, config)
- [ ] Implement validation result transformation
- [ ] Add logging and error handling

### 1.2 Integrate Validation into Shift Actions

**File**: `src/lib/actions/rosters/shift-actions.ts`

**Changes**:
- [ ] Import validation service in shift-actions.ts
- [ ] Add validation call in `addShift()` before creating shift
- [ ] Add validation call in `bulkAddShifts()` for all shifts
- [ ] Add validation call in `updateShift()` when time/user changes
- [ ] Return validation warnings in response

**Code Changes**:
```typescript
// In addShift()
const validationIssues = await validateShiftBeforeAdd(rosterId, data);
const blockingIssues = validationIssues.filter(i => i.severity === 'blocking');
if (blockingIssues.length > 0) {
  return { 
    success: false, 
    error: blockingIssues[0].message,
    validationIssues 
  };
}
```

### 1.3 Integrate Validation into Approval Actions

**File**: `src/lib/actions/rosters/approval-actions.ts`

**Changes**:
- [ ] Add full roster validation in `finalizeRoster()`
- [ ] Block finalization if blocking issues exist
- [ ] Return all issues as warnings if only warnings exist
- [ ] Add validation summary to history entry

### 1.4 Add Validation Configuration per Venue

**File**: `src/lib/rosters/validation-config.ts`

**Tasks**:
- [ ] Create validation config type
- [ ] Add venue-level config storage (JSON field in Venue model or separate table)
- [ ] Create default config loader
- [ ] Add admin UI for config management (future phase)

---

## Phase 2: Staff Experience - Conflict Visibility

**Duration**: 2-3 days  
**Priority**: P0 - Critical  
**Dependencies**: Phase 1

### 2.1 Add Conflict Display to My Shifts

**File**: `src/app/my/rosters/my-shifts-client.tsx`

**Changes**:
- [ ] Add conflict badge component to ShiftCard
- [ ] Show conflict type (TIME_OFF, AVAILABILITY, DOUBLE_BOOKED)
- [ ] Add conflict explanation tooltip
- [ ] Add visual indicator (red border, warning icon)
- [ ] Link to request time-off if conflict is availability-related

**New Component**:
```typescript
const ConflictBadge = ({ conflictType, details }: { conflictType: string; details?: string }) => (
  <div className="flex items-center gap-1 text-red-600 text-xs">
    <AlertCircle className="h-3 w-3" />
    <span>{getConflictLabel(conflictType)}</span>
  </div>
);
```

### 2.2 Enhance Shift Data for Staff View

**File**: `src/lib/actions/rosters/roster-queries.ts`

**Changes**:
- [ ] Update `getMyShifts()` to include conflict information
- [ ] Add conflict details to shift response
- [ ] Include conflict resolution suggestions

### 2.3 Add Shift Acknowledgment System

**New Files**:
- `src/lib/actions/rosters/shift-acknowledgment.ts`
- `src/components/rosters/ShiftAcknowledgment.tsx`

**Database Changes**:
```sql
ALTER TABLE "RosterShift" ADD COLUMN "acknowledgedAt" TIMESTAMP;
ALTER TABLE "RosterShift" ADD COLUMN "acknowledgedBy" TEXT;
```

**Tasks**:
- [ ] Create acknowledgment server action
- [ ] Add acknowledgment button to shift cards
- [ ] Track acknowledgment timestamp
- [ ] Show "Acknowledged" badge after action
- [ ] Add acknowledgment status to manager view

### 2.4 Add Unacknowledged Shift Warnings

**File**: `src/components/dashboard/staff/UpcomingShiftsWidget.tsx`

**Changes**:
- [ ] Show warning for unacknowledged upcoming shifts
- [ ] Add bulk acknowledge action
- [ ] Display acknowledgment status

---

## Phase 3: Availability Integration

**Duration**: 2 days  
**Priority**: P1 - High  
**Dependencies**: Phase 1

### 3.1 Trigger Conflict Recheck on Availability Change

**File**: `src/lib/actions/availability.ts`

**Changes**:
- [ ] Add conflict recheck function call after availability update
- [ ] Find affected future shifts
- [ ] Update conflict status
- [ ] Notify managers of new conflicts

**New Function**:
```typescript
async function recheckConflictsForAvailabilityChange(
  userId: string,
  dayOfWeek: number,
  oldAvailability: Availability,
  newAvailability: Availability
): Promise<void> {
  // Find all future shifts on this day of week
  // Recheck conflicts
  // Update shift conflict flags
  // Notify managers if new conflicts found
}
```

### 3.2 Add Availability-Aware Staff Suggestions

**File**: `src/lib/actions/rosters/roster-queries.ts`

**Changes**:
- [ ] Enhance `getVenueStaff()` to accept date/time parameters
- [ ] Filter staff by availability for given date
- [ ] Add availability score to each staff member
- [ ] Sort by availability match

**New Response Structure**:
```typescript
interface StaffWithAvailability {
  id: string;
  name: string;
  email: string;
  isAvailable: boolean;
  availabilityMatch: 'full' | 'partial' | 'none';
  availabilityHours?: { start: string; end: string };
  hasTimeOff: boolean;
  existingShiftsCount: number;
}
```

### 3.3 Show Availability in Roster Editor

**File**: `src/components/rosters/roster-matrix-view.tsx`

**Changes**:
- [ ] Add availability indicator to staff cells
- [ ] Show availability hours on hover
- [ ] Highlight staff with matching availability
- [ ] Add filter for "only show available staff"

---

## Phase 4: Cross-Venue Conflict Detection

**Duration**: 1-2 days  
**Priority**: P1 - High  
**Dependencies**: Phase 1

### 4.1 Enhance Conflict Detection for Multi-Venue

**File**: `src/lib/actions/rosters/shift-actions.ts`

**Changes**:
- [ ] Update `checkShiftConflicts()` to check all venues
- [ ] Add cross-venue conflict type
- [ ] Include venue name in conflict details

**Updated Query**:
```typescript
// Check for shifts at ANY venue, not just current roster's venue
const existingShifts = await prisma.rosterShift.findMany({
  where: {
    userId,
    date: { gte: dayStart, lte: dayEnd },
    roster: { status: { in: [RosterStatus.DRAFT, RosterStatus.PUBLISHED] } },
    // Remove venueId filter - check all venues
  },
  include: { roster: { include: { venue: true } } }
});
```

### 4.2 Add Cross-Venue Conflict Display

**File**: `src/components/rosters/conflict-summary.tsx`

**Changes**:
- [ ] Add cross-venue conflict section
- [ ] Show which venue has the conflicting shift
- [ ] Add link to the other roster

---

## Phase 5: Shift Swap System

**Duration**: 3-4 days  
**Priority**: P1 - High  
**Dependencies**: Phase 2

### 5.1 Database Schema for Swap Requests

**New Migration**:
```sql
CREATE TABLE "ShiftSwapRequest" (
  "id" TEXT PRIMARY KEY,
  "shiftId" TEXT NOT NULL REFERENCES "RosterShift"("id"),
  "requesterId" TEXT NOT NULL REFERENCES "User"("id"),
  "targetUserId" TEXT REFERENCES "User"("id"),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reason" TEXT,
  "adminNotes" TEXT,
  "reviewedBy" TEXT REFERENCES "User"("id"),
  "reviewedAt" TIMESTAMP,
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE "ShiftSwapOffer" (
  "id" TEXT PRIMARY KEY,
  "swapRequestId" TEXT NOT NULL REFERENCES "ShiftSwapRequest"("id"),
  "offeredShiftId" TEXT REFERENCES "RosterShift"("id"),
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 5.2 Swap Request Server Actions

**New File**: `src/lib/actions/rosters/shift-swap.ts`

**Functions**:
- [ ] `createSwapRequest(shiftId, targetUserId?, reason?)`
- [ ] `offerSwap(swapRequestId, offeredShiftId)`
- [ ] `acceptSwapOffer(offerId)`
- [ ] `rejectSwapRequest(swapRequestId, reason?)`
- [ ] `approveSwap(swapRequestId)` - Manager action
- [ ] `getPendingSwapRequests()` - For managers
- [ ] `getMySwapRequests()` - For staff

### 5.3 Swap Request UI Components

**New Files**:
- `src/components/rosters/ShiftSwapRequest.tsx`
- `src/components/rosters/ShiftSwapDialog.tsx`
- `src/app/my/shifts/swap/[id]/page.tsx`

**Tasks**:
- [ ] Create swap request button on shift cards
- [ ] Create swap request dialog
- [ ] Create swap offers list
- [ ] Create manager approval view
- [ ] Add swap status indicators

### 5.4 Swap Notifications

**File**: `src/lib/services/notifications.ts`

**Tasks**:
- [ ] Add `SHIFT_SWAP_REQUESTED` notification type
- [ ] Add `SHIFT_SWAP_OFFERED` notification type
- [ ] Add `SHIFT_SWAP_APPROVED` notification type
- [ ] Add `SHIFT_SWAP_REJECTED` notification type
- [ ] Create notification helper functions

---

## Phase 6: Shift Reminders

**Duration**: 2 days  
**Priority**: P2 - Medium  
**Dependencies**: None

### 6.1 Create Reminder Cron Job

**New File**: `src/lib/jobs/shift-reminders.ts`

**Tasks**:
- [ ] Create reminder job function
- [ ] Query upcoming shifts (24h, 2h before)
- [ ] Send notifications via multiple channels
- [ ] Track reminder sent status

**Database Changes**:
```sql
ALTER TABLE "RosterShift" ADD COLUMN "reminder24hSentAt" TIMESTAMP;
ALTER TABLE "RosterShift" ADD COLUMN "reminder2hSentAt" TIMESTAMP;
```

### 6.2 Add Reminder Preferences

**File**: `src/lib/actions/notification-preferences.ts`

**Tasks**:
- [ ] Add shift reminder notification type
- [ ] Add reminder timing preferences
- [ ] Allow users to disable reminders

### 6.3 Create API Route for Cron

**New File**: `src/app/api/cron/shift-reminders/route.ts`

**Tasks**:
- [ ] Create authenticated cron endpoint
- [ ] Add cron secret validation
- [ ] Execute reminder job
- [ ] Return execution summary

---

## Phase 7: Bulk Operations

**Duration**: 2 days  
**Priority**: P2 - Medium  
**Dependencies**: Phase 1

### 7.1 Bulk Shift Operations

**File**: `src/lib/actions/rosters/shift-actions.ts`

**New Functions**:
- [ ] `bulkUpdateShifts(shiftIds[], updates)` - Update multiple shifts
- [ ] `bulkReassignShifts(shiftIds[], newUserId)` - Reassign multiple shifts
- [ ] `bulkDeleteShifts(shiftIds[])` - Delete multiple shifts
- [ ] `copyShiftsToDates(shiftIds[], dates[])` - Copy shifts to other dates

### 7.2 Bulk Operation UI

**File**: `src/components/rosters/roster-matrix-view.tsx`

**Tasks**:
- [ ] Add shift selection checkboxes
- [ ] Add bulk action toolbar
- [ ] Add bulk edit dialog
- [ ] Add confirmation dialogs

---

## Phase 8: Roster Templates

**Duration**: 2 days  
**Priority**: P3 - Low  
**Dependencies**: None

### 8.1 Template Schema

**New Migration**:
```sql
CREATE TABLE "RosterTemplate" (
  "id" TEXT PRIMARY KEY,
  "venueId" TEXT NOT NULL REFERENCES "Venue"("id"),
  "name" TEXT NOT NULL,
  "description" TEXT,
  "shifts" JSONB NOT NULL,
  "createdBy" TEXT NOT NULL REFERENCES "User"("id"),
  "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### 8.2 Template Actions

**New File**: `src/lib/actions/rosters/roster-templates.ts`

**Functions**:
- [ ] `createTemplate(rosterId, name, description)`
- [ ] `getTemplates(venueId)`
- [ ] `applyTemplate(rosterId, templateId, weekStart)`
- [ ] `deleteTemplate(templateId)`

### 8.3 Template UI

**Tasks**:
- [ ] Add "Save as Template" button in roster editor
- [ ] Create template selection dialog
- [ ] Add template management page

---

## Phase 9: Cost Estimation & Budget

**Duration**: 2-3 days  
**Priority**: P3 - Low  
**Dependencies**: None

### 9.1 Real-Time Cost Calculation

**File**: `src/lib/utils/pay-calculator.ts` (enhance existing)

**Tasks**:
- [ ] Add function to calculate roster total cost
- [ ] Add per-day cost breakdown
- [ ] Add per-staff cost breakdown
- [ ] Include overtime calculations

### 9.2 Cost Display in Roster Editor

**Tasks**:
- [ ] Add cost summary widget
- [ ] Show cost per day
- [ ] Show budget vs actual (if budget set)
- [ ] Add cost warnings for overtime

---

## Phase 10: Coverage Analysis

**Duration**: 3 days  
**Priority**: P3 - Low  
**Dependencies**: None

### 10.1 Coverage Analysis Service

**New File**: `src/lib/rosters/coverage-analysis.ts`

**Functions**:
- [ ] `analyzeCoverage(rosterId)` - Analyze staffing levels
- [ ] `identifyGaps(rosterId)` - Find understaffed periods
- [ ] `suggestCoverage(rosterId)` - Suggest staff for gaps

### 10.2 Coverage Visualization

**New File**: `src/components/rosters/CoverageAnalysis.tsx`

**Tasks**:
- [ ] Create coverage heatmap
- [ ] Show gap indicators
- [ ] Display coverage score
- [ ] Add suggestions panel

---

## Implementation Timeline

| Phase | Duration | Start | End | Dependencies |
|-------|----------|-------|-----|--------------|
| Phase 1: Validation Integration | 3 days | Day 1 | Day 3 | None |
| Phase 2: Staff Conflict Visibility | 3 days | Day 4 | Day 6 | Phase 1 |
| Phase 3: Availability Integration | 2 days | Day 4 | Day 5 | Phase 1 |
| Phase 4: Cross-Venue Conflicts | 2 days | Day 7 | Day 8 | Phase 1 |
| Phase 5: Shift Swap System | 4 days | Day 9 | Day 12 | Phase 2 |
| Phase 6: Shift Reminders | 2 days | Day 7 | Day 8 | None |
| Phase 7: Bulk Operations | 2 days | Day 13 | Day 14 | Phase 1 |
| Phase 8: Roster Templates | 2 days | Day 15 | Day 16 | None |
| Phase 9: Cost Estimation | 3 days | Day 17 | Day 19 | None |
| Phase 10: Coverage Analysis | 3 days | Day 20 | Day 22 | None |

**Total Estimated Duration**: 22 days (4-5 weeks with buffer)

---

## Testing Strategy

### Unit Tests
- [ ] Validation service tests
- [ ] Conflict detection tests
- [ ] Swap request flow tests
- [ ] Cost calculation tests

### Integration Tests
- [ ] End-to-end roster creation flow
- [ ] Conflict detection with real database
- [ ] Notification delivery
- [ ] Cron job execution

### Manual Testing Checklist
- [ ] Create roster with conflicts - verify warnings
- [ ] Staff views conflicting shift - verify visibility
- [ ] Staff acknowledges shift - verify tracking
- [ ] Manager publishes roster - verify validation
- [ ] Staff requests swap - verify notifications
- [ ] Reminder cron runs - verify delivery

---

## Rollback Plan

Each phase includes:
1. Feature flags to disable new functionality
2. Database migrations with down migrations
3. Backward-compatible API changes
4. Monitoring for error rates

### Feature Flags
```typescript
// src/lib/config.ts
export const FEATURES = {
  ROSTER_VALIDATION: process.env.FEATURE_ROSTER_VALIDATION === 'true',
  SHIFT_ACKNOWLEDGMENT: process.env.FEATURE_SHIFT_ACKNOWLEDGMENT === 'true',
  SHIFT_SWAPS: process.env.FEATURE_SHIFT_SWAPS === 'true',
  SHIFT_REMINDERS: process.env.FEATURE_SHIFT_REMINDERS === 'true',
};
```

---

## Success Metrics

### Technical Metrics
- [ ] 100% of shifts validated before creation
- [ ] < 100ms validation response time
- [ ] Zero data integrity issues

### Business Metrics
- [ ] Reduction in scheduling conflicts (target: 80%)
- [ ] Shift acknowledgment rate (target: 90%)
- [ ] Manager time saved on roster creation (target: 30%)

### User Satisfaction
- [ ] Staff survey on schedule visibility
- [ ] Manager survey on tool usability
- [ ] Support ticket reduction

---

## Next Steps

1. **Review and approve this plan**
2. **Set up feature flags infrastructure**
3. **Begin Phase 1 implementation**
4. **Schedule daily standups during implementation**
5. **Plan user acceptance testing for each phase**
