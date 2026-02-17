# Roster Management System - Implementation Plan

## Overview

A comprehensive roster management system that allows managers to upload roster files (Excel, CSV, or images), have them AI-extracted into structured data, match staff members, manage drafts with approval workflows, and notify staff of their schedules.

## Architecture Principles

1. **Phased Implementation**: Each phase delivers standalone value
2. **Non-Breaking Changes**: All new tables/routes, no modifications to existing core functionality
3. **Integration Points**: Leverages existing notification system, RBAC, file upload, and AI services
4. **Go-Live Ready**: Phase 1 alone provides a functional roster system

---

## Database Schema

### New Tables

```prisma
// Core roster model
model Roster {
  id            String        @id @default(cuid())
  name          String        // e.g., "Week 48 - Main Bar"
  description   String?
  venueId       String
  venue         Venue         @relation(fields: [venueId], references: [id])

  startDate     DateTime      // Roster period start
  endDate       DateTime      // Roster period end

  status        RosterStatus  @default(DRAFT)
  version       Int           @default(1)

  // Source file info
  sourceFileUrl String?       // Supabase Storage URL
  sourceFileName String?
  sourceFileType String?      // excel, csv, image

  // Approval workflow
  publishedAt   DateTime?
  publishedBy   String?
  publishedByUser User?       @relation("RosterPublisher", fields: [publishedBy], references: [id])

  // Audit
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  createdBy     String
  createdByUser User          @relation("RosterCreator", fields: [createdBy], references: [id])

  // Relations
  shifts        RosterShift[]
  history       RosterHistory[]
  unmatchedEntries UnmatchedRosterEntry[]

  @@index([venueId])
  @@index([status])
  @@index([startDate, endDate])
}

enum RosterStatus {
  DRAFT           // Initial state, editable
  PENDING_REVIEW  // Submitted for approval
  APPROVED        // Approved, ready to publish
  PUBLISHED       // Live, staff notified
  ARCHIVED        // Historical record
}

// Individual shifts within a roster
model RosterShift {
  id            String      @id @default(cuid())
  rosterId      String
  roster        Roster      @relation(fields: [rosterId], references: [id], onDelete: Cascade)

  userId        String?     // Null if unmatched
  user          User?       @relation(fields: [userId], references: [id])

  date          DateTime    // Shift date
  startTime     String      // "09:00" format for flexibility
  endTime       String      // "17:00"
  breakMinutes  Int         @default(0)

  position      String?     // Role/position for this shift
  notes         String?

  // For unmatched entries
  originalName  String?     // Name from source file if not matched

  // Conflict detection
  hasConflict   Boolean     @default(false)
  conflictType  String?     // "TIME_OFF", "AVAILABILITY", "DOUBLE_BOOKED"

  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt

  @@index([rosterId])
  @@index([userId])
  @@index([date])
}

// Track unmatched names for resolution
model UnmatchedRosterEntry {
  id            String    @id @default(cuid())
  rosterId      String
  roster        Roster    @relation(fields: [rosterId], references: [id], onDelete: Cascade)

  originalName  String    // Name from source file
  suggestedUserId String? // AI-suggested match
  suggestedUser User?     @relation("SuggestedMatch", fields: [suggestedUserId], references: [id])
  confidence    Float?    // Match confidence 0-1

  resolved      Boolean   @default(false)
  resolvedUserId String?  // Final matched user
  resolvedUser  User?     @relation("ResolvedMatch", fields: [resolvedUserId], references: [id])
  resolvedAt    DateTime?
  resolvedBy    String?

  createdAt     DateTime  @default(now())

  @@index([rosterId])
  @@index([resolved])
}

// Version history for rosters
model RosterHistory {
  id            String    @id @default(cuid())
  rosterId      String
  roster        Roster    @relation(fields: [rosterId], references: [id], onDelete: Cascade)

  version       Int
  action        String    // "CREATED", "UPDATED", "PUBLISHED", "REPUBLISHED"
  changes       Json?     // Diff of what changed

  performedBy   String
  performedByUser User    @relation(fields: [performedBy], references: [id])
  performedAt   DateTime  @default(now())

  @@index([rosterId])
}
```

### Update Existing Models

```prisma
// Add to User model
model User {
  // ... existing fields

  // Roster relations
  rosterShifts        RosterShift[]
  rostersCreated      Roster[]    @relation("RosterCreator")
  rostersPublished    Roster[]    @relation("RosterPublisher")
  rosterHistory       RosterHistory[]
  suggestedMatches    UnmatchedRosterEntry[] @relation("SuggestedMatch")
  resolvedMatches     UnmatchedRosterEntry[] @relation("ResolvedMatch")
}

// Add to Venue model
model Venue {
  // ... existing fields
  rosters       Roster[]
}
```

### New Notification Types

```typescript
// Add to NotificationType enum
ROSTER_PUBLISHED      // Staff: Your roster has been published
ROSTER_UPDATED        // Staff: Your shifts have changed
ROSTER_SHIFT_REMINDER // Staff: Reminder of upcoming shift
ROSTER_CONFLICT       // Manager: Conflict detected in roster
ROSTER_PENDING_REVIEW // Admin: Roster submitted for approval
```

---

## Phase 1: Core Roster Management (Go-Live Ready)

**Goal**: Manual roster creation and management with basic notifications

### Features
1. **Manual Roster Creation**
   - Create roster with date range and venue
   - Add/edit/delete shifts manually
   - Assign staff to shifts from dropdown

2. **Draft Workflow**
   - Save as draft (DRAFT status)
   - Publish roster (PUBLISHED status)
   - Basic version tracking

3. **Staff Notifications**
   - Email notification on roster publish
   - In-app notification with shift details

4. **Basic Conflict Detection**
   - Check against approved time-off requests
   - Visual warning (non-blocking)

### Routes
```
/manage/rosters                    - Roster list for managers
/manage/rosters/new               - Create new roster
/manage/rosters/[id]              - View/edit roster
/manage/rosters/[id]/publish      - Publish confirmation

/my/rosters                       - Staff view of their shifts
/my/rosters/[id]                  - Shift details

/system/rosters                   - Admin roster overview
/system/rosters/[id]              - Admin view/edit any roster
```

### Components
```
/src/components/rosters/
  roster-calendar.tsx              - Calendar view of shifts
  roster-table.tsx                 - Table view of shifts
  shift-form.tsx                   - Add/edit shift form
  staff-selector.tsx               - Staff assignment dropdown
  conflict-badge.tsx               - Visual conflict indicator
  roster-status-badge.tsx          - Draft/Published badge
```

### Server Actions
```typescript
// /src/lib/actions/rosters/roster-actions.ts
createRoster(data: CreateRosterInput)
updateRoster(id: string, data: UpdateRosterInput)
deleteRoster(id: string)
publishRoster(id: string)

// /src/lib/actions/rosters/shift-actions.ts
addShift(rosterId: string, data: ShiftInput)
updateShift(shiftId: string, data: ShiftInput)
deleteShift(shiftId: string)
bulkAddShifts(rosterId: string, shifts: ShiftInput[])

// /src/lib/actions/rosters/roster-queries.ts
getRosters(filters: RosterFilters)
getRosterById(id: string)
getMyShifts(userId: string, dateRange: DateRange)
checkShiftConflicts(userId: string, date: Date, startTime: string, endTime: string)
```

---

## Phase 2: File Upload & AI Extraction

**Goal**: Upload roster files and extract structured data using AI

### Features
1. **File Upload**
   - Support Excel (.xlsx, .xls), CSV, and images
   - Upload to Supabase Storage (new `roster-uploads` bucket)
   - File validation and size limits

2. **AI Extraction**
   - Parse Excel/CSV with column detection
   - Use OpenAI Vision for image extraction
   - Extract: staff names, dates, times, positions

3. **Preview & Confirm**
   - Show extracted data before saving
   - Highlight parsing confidence levels
   - Allow corrections before import

### New Components
```
/src/components/rosters/
  file-upload-zone.tsx            - Drag & drop upload
  extraction-preview.tsx          - Preview extracted data
  extraction-confidence.tsx       - Show parsing confidence
  column-mapper.tsx               - Map columns for CSV/Excel
```

### New Server Actions
```typescript
// /src/lib/actions/rosters/extraction-actions.ts
uploadRosterFile(formData: FormData)
extractFromExcel(fileUrl: string)
extractFromCSV(fileUrl: string)
extractFromImage(fileUrl: string)
confirmExtraction(rosterId: string, extractedData: ExtractedShift[])
```

### AI Service Extension
```typescript
// /src/lib/services/roster-ai-service.ts
parseRosterImage(imageUrl: string): Promise<ExtractedRosterData>
parseRosterExcel(buffer: Buffer): Promise<ExtractedRosterData>
parseRosterCSV(content: string): Promise<ExtractedRosterData>
```

---

## Phase 3: Staff Matching & Resolution

**Goal**: Automatically match extracted names to users with resolution workflow

### Features
1. **Automatic Matching**
   - Fuzzy matching on name (first, last, display name)
   - Match by email if present
   - Confidence scoring (0-100%)

2. **Unmatched Resolution**
   - List all unmatched entries
   - Suggest possible matches with confidence
   - Manual assignment dropdown
   - Option to create new user (future)

3. **Match Learning** (Optional)
   - Store successful matches for future
   - Improve suggestions over time

### New Components
```
/src/components/rosters/
  unmatched-resolver.tsx          - Resolve unmatched entries
  staff-match-suggestion.tsx      - Show suggested matches
  match-confidence-bar.tsx        - Visual confidence indicator
```

### New Server Actions
```typescript
// /src/lib/actions/rosters/matching-actions.ts
matchExtractedNames(rosterId: string, names: string[])
resolveUnmatchedEntry(entryId: string, userId: string)
bulkResolveMatches(resolutions: { entryId: string, userId: string }[])
getUnmatchedEntries(rosterId: string)
getSuggestedMatches(name: string, venueId: string)
```

### Matching Service
```typescript
// /src/lib/services/staff-matching-service.ts
interface MatchResult {
  userId: string;
  confidence: number;
  matchedOn: 'firstName' | 'lastName' | 'displayName' | 'email';
}

findBestMatch(name: string, venueUsers: User[]): MatchResult | null
findAllMatches(name: string, venueUsers: User[]): MatchResult[]
calculateSimilarity(name1: string, name2: string): number // Levenshtein
```

---

## Phase 4: Approval Workflow

**Goal**: Multi-stage approval for roster publication

### Features
1. **Workflow States**
   - DRAFT -> PENDING_REVIEW -> APPROVED -> PUBLISHED
   - Only admins can approve (configurable)
   - Managers can submit for review

2. **Review Interface**
   - Side-by-side comparison with previous roster
   - Conflict summary
   - Approve/reject with comments

3. **Notifications**
   - ROSTER_PENDING_REVIEW to approvers
   - ROSTER_APPROVED/REJECTED to submitter

### New Components
```
/src/components/rosters/
  approval-workflow.tsx           - Status progression UI
  roster-comparison.tsx           - Compare versions
  review-comments.tsx             - Approval notes
```

### New Server Actions
```typescript
// /src/lib/actions/rosters/approval-actions.ts
submitForReview(rosterId: string)
approveRoster(rosterId: string, comments?: string)
rejectRoster(rosterId: string, reason: string)
getPendingApprovals()
```

---

## Phase 5: Advanced Conflict Detection & Reports

**Goal**: Comprehensive conflict detection and roster reports

### Features
1. **Conflict Types**
   - Rostered on approved time-off
   - Rostered outside availability
   - Double-booked (overlapping shifts)
   - Overtime threshold exceeded
   - Missing required coverage

2. **Conflict Resolution**
   - List all conflicts with severity
   - One-click resolution options
   - Bulk conflict management

3. **Reports**
   - Rostered on day-off report
   - Coverage gaps report
   - Hours distribution report
   - Overtime report

### New Routes
```
/manage/reports/roster-conflicts  - Roster conflict report
/manage/reports/roster-coverage   - Coverage analysis
/system/reports/roster-hours      - Hours/overtime analysis
```

### New Components
```
/src/components/rosters/
  conflict-resolver.tsx           - Resolve conflicts
  conflict-summary.tsx            - Conflict overview card

/src/components/reports/
  roster-conflicts-report.tsx     - Detailed conflict report
  roster-coverage-report.tsx      - Coverage analysis
```

### New Server Actions
```typescript
// /src/lib/actions/rosters/conflict-actions.ts
detectAllConflicts(rosterId: string)
getConflictsByType(rosterId: string, type: ConflictType)
resolveConflict(shiftId: string, resolution: ConflictResolution)
getRosteredOnDayOff(rosterId: string)

// /src/lib/actions/reports/roster-reports.ts
getRosterConflictsReport(filters: ReportFilters)
getRosterCoverageReport(venueId: string, dateRange: DateRange)
getRosterHoursReport(venueId: string, dateRange: DateRange)
```

---

## Phase 6: Re-upload & Version History

**Goal**: Full version control and re-extraction capability

### Features
1. **Re-upload**
   - Upload new file to existing roster
   - Compare with current shifts
   - Selective merge or full replace

2. **Version History**
   - Full history of all changes
   - View any historical version
   - Rollback capability

3. **Change Notifications**
   - ROSTER_UPDATED for affected staff
   - Diff summary in notification

### New Components
```
/src/components/rosters/
  version-history.tsx             - Timeline of versions
  version-diff.tsx                - Compare two versions
  reupload-dialog.tsx             - Re-upload flow
  merge-preview.tsx               - Preview merge changes
```

### New Server Actions
```typescript
// /src/lib/actions/rosters/version-actions.ts
getVersionHistory(rosterId: string)
getVersionDiff(rosterId: string, version1: number, version2: number)
rollbackToVersion(rosterId: string, version: number)
reuploadAndMerge(rosterId: string, formData: FormData, mergeStrategy: 'replace' | 'merge')
```

---

## Implementation Order & Dependencies

```
Phase 1 (Core) ─────────────────────────────────────────────┐
   │                                                        │
   ├── Phase 2 (File Upload) ──┬── Phase 3 (Matching) ──────┤
   │                           │                            │
   │                           └── Phase 6 (Versioning) ────┤
   │                                                        │
   ├── Phase 4 (Approval) ──────────────────────────────────┤
   │                                                        │
   └── Phase 5 (Conflicts/Reports) ─────────────────────────┘
```

### Go-Live Checkpoints

1. **Minimum Viable (Phase 1)**: Manual roster creation, publish, staff notifications
2. **AI-Powered (Phase 1 + 2 + 3)**: File upload with extraction and matching
3. **Enterprise (All Phases)**: Full workflow, versioning, advanced reports

---

## Technical Considerations

### Performance
- Index on `RosterShift.date` and `RosterShift.userId` for fast queries
- Paginate shift lists for large rosters
- Cache staff list for matching service

### Security
- RBAC enforcement on all roster actions
- Venue-scoped access (managers see only their venues)
- Audit trail via RosterHistory

### File Storage
- Supabase bucket: `roster-uploads`
- Path structure: `{venueId}/{rosterId}/{filename}`
- Retention: Keep source files for re-extraction

### AI Costs
- OpenAI Vision for images: ~$0.01-0.02 per image
- Rate limit extraction requests
- Cache extraction results
