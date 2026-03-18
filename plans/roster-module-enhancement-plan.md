# Roster Module Enhancement Plan

## Executive Summary

This document outlines the comprehensive plan to enhance the manual roster system with:
1. Venue-level and user-level staff rate configuration (hidden from staff)
2. Advanced pay calculation (overtime, late, custom rates)
3. Customizable shift templates
4. Configurable break rules
5. Enhanced roster export (Excel + PDF)
6. Improved matrix view with staff selection

---

## Security & Access Control

### Important: Pay Rate Privacy
**Pay rates are CONFIDENTIAL information** and should NEVER be visible to staff members.

- **STAFF role**: Cannot view any pay rates or cost information
- **MANAGER role**: Can view and edit rates for their venue's staff
- **ADMIN role**: Full access to all venues' rate configurations

Implementation:
- Add field-level permissions for pay rate fields
- API endpoints return null/redacted for unauthorized users
- Matrix view hides cost when viewed by staff
- Export functionality restricted by permission

---

## 1. Staff Rates System

### 1.1 Current State
The `User` model already has basic pay rate fields (lines 203-207 in schema.prisma):
- `weekdayRate` - Monday-Friday rate
- `saturdayRate` - Saturday rate
- `sundayRate` - Sunday rate
- `publicHolidayRate` - Public holiday rate

The pay calculator (`src/lib/utils/pay-calculator.ts`) already supports these rates.

### 1.2 Gaps Identified
1. **No venue-level default rates** - Each staff member needs rates set manually
2. **No overtime rate** - After 8 hours (or configurable threshold)
3. **No late (LTE) rate** - After 10pm
4. **No custom rates** - Specific dates, times, or date ranges
5. **No weekly/monthly wage tracking** - Need aggregated earnings view
6. **Pay rates visible to staff** - Need to restrict access

### 1.3 Implementation Plan

#### Phase 1.3.1: Add New Rate Fields to User Model
```prisma
// Additional pay rate fields in User model
overtimeRate        Decimal?  @db.Decimal(10, 2)  // After threshold hours
lateStartHour      Int?      @default(22)          // When late rate starts (default 10pm)
lateRate           Decimal?  @db.Decimal(10, 2)    // Late rate (after lateStartHour)
```

**Note on Privacy**: These fields are stored in the database but:
- **NOT exposed** in any API responses to STAFF users
- **NOT visible** in the UI when logged in as STAFF
- **Only editable** by ADMIN and MANAGER roles
- Calculated costs shown in matrix view are **hidden** for STAFF

#### Phase 1.3.2: Create VenuePayConfig Model
```prisma
model VenuePayConfig {
  id              String   @id @default(cuid())
  venueId         String
  venue           Venue    @relation(fields: [venueId], references: [id], onDelete: Cascade)
  
  // Default rates for new staff at this venue
  defaultWeekdayRate      Decimal?  @db.Decimal(10, 2)
  defaultSaturdayRate     Decimal?  @db.Decimal(10, 2)
  defaultSundayRate       Decimal?  @db.Decimal(10, 2)
  defaultPublicHolidayRate Decimal? @db.Decimal(10, 2)
  defaultOvertimeRate    Decimal?  @db.Decimal(10, 2)
  defaultLateRate         Decimal?  @db.Decimal(10, 2)
  lateStartHour          Int        @default(22)  // 10pm
  
  // Overtime configuration
  overtimeThresholdHours  Decimal    @default(8.0)  // Hours before overtime kicks in
  overtimeMultiplier     Decimal    @default(1.5)  // 1.5x by default
  
  // Break rules
  autoBreakEnabled       Boolean    @default(false)
  breakThresholdMinutes  Int        @default(300)  // 5 hours
  breakDurationMinutes   Int        @default(30)   // 30 minutes
  
  // Custom templates (JSON for flexibility)
  shiftTemplates         Json?      // Custom shift templates
  
  createdAt              DateTime   @default(now())
  updatedAt              DateTime   @updatedAt

  @@unique([venueId])
}
```

#### Phase 1.3.3: Create CustomRate Model
```prisma
model CustomRate {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Rate type
  type        String   // SPECIFIC_DATE, TIME_RANGE, DATE_RANGE
  
  // Configuration
  rate        Decimal  @db.Decimal(10, 2)
  
  // For SPECIFIC_DATE
  specificDate DateTime?
  
  // For TIME_RANGE  
  startTime   String?  // HH:mm format
  endTime     String?  // HH:mm format
  
  // For DATE_RANGE
  startDate   DateTime?
  endDate     DateTime?
  
  // Description
  name        String?
  
  active      Boolean  @default(true)
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([active])
}
```

#### Phase 1.3.4: Enhance Pay Calculator
Update `src/lib/utils/pay-calculator.ts`:
1. Add overtime calculation logic
2. Add late rate calculation (after configured hour)
3. Add custom rate lookup
4. Add breakdown by rate type (regular, overtime, late)
5. Add daily/weekly wage summaries

---

## 2. Shift Templates System

### 2.1 Current State
Shift templates are hardcoded in `ShiftForm` component (lines 120-126 in shift-form.tsx):
- Morning Shift: 06:00-14:00
- Day Shift: 09:00-17:00
- Afternoon Shift: 12:00-20:00
- Evening Shift: 16:00-23:00
- Night Shift: 22:00-06:00

### 2.2 Gaps Identified
1. Not customizable per venue
2. Not editable by managers
3. Break duration is fixed at 30 minutes
4. No ability to add custom templates

### 2.3 Implementation Plan

#### Phase 2.3.1: Shift Templates in VenuePayConfig
The `shiftTemplates` JSON field in `VenuePayConfig` will store:
```json
[
  {
    "id": "custom-1",
    "name": "Morning Barista",
    "startTime": "06:00",
    "endTime": "14:00",
    "breakMinutes": 30,
    "position": "Barista",
    "color": "#3B82F6"
  },
  {
    "id": "custom-2",
    "name": "Late Kitchen",
    "endTime": "23:00",
    "breakMinutes": 45,
    "position": "Kitchen",
    "color": "#F97316"
  }
]
```

#### Phase 2.3.2: Create Venue Settings Page
New admin page: `/admin/venues/[id]/pay-settings`
- Configure all pay rates
- Manage shift templates
- Set break rules
- Configure overtime settings

#### Phase 2.3.3: Update ShiftForm Component
- Fetch templates from venue config
- Allow adding/editing custom templates (for admins/managers)
- Auto-apply break based on venue rules

---

## 3. Break Rules System

### 3.1 Current State
- `RosterShift` has `breakMinutes: Int @default(0)`
- Currently manually entered per shift

### 3.2 Gaps Identified
1. No automatic break calculation
2. No configurable rules (e.g., "shift > 5 hours = 30min break")
3. No break penalty rules

### 3.3 Implementation Plan

#### Phase 3.3.1: Break Rule Engine
Add to `VenuePayConfig`:
```prisma
autoBreakEnabled       Boolean   @default(false)
breakThresholdMinutes  Int       @default(300)  // 5 hours
breakDurationMinutes   Int       @default(30)   // 30 minutes
breakThreshold2Minutes Int?      // Second threshold (e.g., 8 hours)
breakDuration2Minutes  Int?      // Second break (e.g., 15 minutes)
```

#### Phase 3.3.2: Auto-Apply Breaks
In `ShiftForm`:
1. When adding a shift, calculate break based on duration
2. Show break auto-calculated indicator
3. Allow override but with confirmation

#### Phase 3.3.3: Break Compliance Warnings
- Show warning if break not taken for long shifts
- Track break compliance in reports

---

## 4. Roster Export Enhancement

### 4.1 Current State
- Export functionality exists but likely just exports the web view
- Not formatted for Excel/printing

### 4.2 Gaps Identified
1. No proper Excel export with formulas
2. No beautiful formatting
3. Missing cost summaries
4. No weekly/monthly roster sheets
5. **No PDF export option**

### 4.3 Implementation Plan

#### Phase 4.3.1: Create Roster Export Service
New file: `src/lib/services/roster-export-service.ts`

**Supported Formats:**
- **Excel (.xlsx)** - With formulas, multiple sheets, professional formatting
- **PDF** - Print-ready, formatted for distribution

Features:
- Export to Excel format with formulas for automatic calculations
- Export to PDF format with professional styling
- Multiple sheets: Summary, Daily Details, Staff List, Cost Breakdown
- Formulas for automatic calculations
- Professional formatting with colors
- Print-ready PDF option

#### Phase 4.3.2: Export Sheets Structure (Excel)
```
Sheet 1: Summary
- Week/Period dates
- Total hours
- Total cost
- Staff count

Sheet 2: Roster Grid
- Staff names (rows) × Days (columns)
- Shift times in cells
- Color-coded by position

Sheet 3: Staff Details
- Each staff member's shifts
- Hours per day
- Pay calculation breakdown

Sheet 4: Cost Summary
- Per staff cost
- Daily totals
- Weekly totals
- Rate breakdown (regular, overtime, late)
```

#### Phase 4.3.3: PDF Export Format
```
Page 1: Cover/Summary
- Venue name
- Roster period
- Total hours/cost

Page 2+: Roster Grid
- Full page roster view
- Staff names and shifts
- Print-optimized layout
```

#### Phase 4.3.4: Export Actions
Add to roster actions menu:
- "Export to Excel"
- "Export to PDF"
- "Export Staff Hours Only"

---

## 5. Matrix View Enhancement

### 5.1 Current State
- Shows shifts in Staff × Day matrix
- Supports drag-and-drop
- Shows pay totals per staff
- Shows availability indicators

### 5.2 Gaps Identified
1. Staff are auto-populated based on shifts
2. No way to explicitly add/remove staff from roster
3. Empty roster shows "no shifts" but no staff selection
4. Pay breakdown not visible in shift cards

### 5.3 Implementation Plan

#### Phase 5.3.1: Explicit Staff Selection
Enhance the "Add People" workflow:
1. Create empty roster → Show "Add Staff" prompt
2. Staff selection panel to choose who to roster
3. Selected staff appear as rows in matrix
4. Unselected staff don't appear (even if they have shifts)

#### Phase 5.3.2: Staff Management Panel
In roster editor:
- "Manage Roster Staff" button
- Multi-select staff picker
- Filter by position/role
- Bulk add/remove

#### Phase 5.3.3: Enhanced Pay Display
In shift cards and staff columns:
- Show shift cost directly on card
- Show daily/weekly earnings
- Show rate type indicator (regular/overtime/late)
- Color-code by cost tier

---

## 6. Permission System

### 6.1 Current State
Basic RBAC exists with venue permissions.

### 6.2 Implementation Plan

#### Phase 6.2.1: New Permissions
Add to permissions system:
- `rosters.manageRates` - Manage pay rates (ADMIN, MANAGER only)
- `rosters.manageTemplates` - Manage shift templates (ADMIN, MANAGER)
- `rosters.manageBreakRules` - Configure break rules (ADMIN, MANAGER)
- `rosters.export` - Export rosters (ADMIN, MANAGER)
- `rosters.viewCosts` - View cost information (ADMIN, MANAGER) - **STAFF denied**

#### Phase 6.2.2: Role Configuration
| Role | View Rates | Edit Rates | View Costs | Export |
|------|------------|------------|------------|--------|
| ADMIN | ✅ | ✅ | ✅ | ✅ |
| MANAGER | ✅ (own venue) | ✅ (own venue) | ✅ (own venue) | ✅ (own venue) |
| STAFF | ❌ | ❌ | ❌ | ❌ |

#### Phase 6.2.3: Field-Level Security
- Pay rate fields in User model marked as sensitive
- API responses redact rates for unauthorized users
- Matrix view conditionally shows/hides cost based on permission
- Export blocked for staff users

---

## 7. Technical Implementation Roadmap

### Phase 1: Database Schema (Priority: High)
- [ ] Add fields to User model
- [ ] Create VenuePayConfig model
- [ ] Create CustomRate model
- [ ] Run migration

### Phase 2: Pay Calculator Enhancement (Priority: High)
- [ ] Update pay-calculator.ts with overtime logic
- [ ] Add late rate calculation
- [ ] Add custom rate lookup
- [ ] Add wage summary functions

### Phase 3: Admin UI (Priority: High)
- [ ] Create venue pay settings page
- [ ] Add shift template editor
- [ ] Add break rule configuration
- [ ] Add rate management UI

### Phase 4: Roster Editor Integration (Priority: High)
- [ ] Update ShiftForm to use venue templates
- [ ] Auto-calculate breaks
- [ ] Show pay in shift cards
- [ ] Show daily/weekly totals

### Phase 5: Export Enhancement (Priority: Medium)
- [ ] Create Excel export service
- [ ] Add PDF export option
- [ ] Add to roster actions menu

### Phase 6: Matrix View Enhancement (Priority: Medium)
- [ ] Explicit staff selection workflow
- [ ] Staff management panel
- [ ] Enhanced cost display

---

## 8. User Workflows

### Workflow 8.1: Admin Sets Up Venue Rates
1. Admin goes to Venue Settings → Pay & Roster
2. Sets default rates for the venue
3. Configures overtime rules
4. Creates custom shift templates
5. Sets break rules

### Workflow 8.2: Manager Creates Roster
1. Manager creates new roster for week
2. Adds staff to roster (explicit selection)
3. Adds shifts using templates or manually
4. System auto-calculates breaks
5. System shows running cost totals
6. Exports roster when done

### Workflow 8.3: Staff Views Roster
1. Staff sees their shifts for the week
2. Can see total hours
3. Can see pay (if enabled by venue)

---

## 9. API Endpoints Needed

### Venue Settings
- `GET /api/venues/[id]/pay-config` - Get pay configuration
- `PUT /api/venues/[id]/pay-config` - Update pay configuration

### Custom Rates
- `GET /api/users/[id]/custom-rates` - Get user's custom rates
- `POST /api/users/[id]/custom-rates` - Add custom rate
- `DELETE /api/custom-rates/[id]` - Remove custom rate

### Export
- `POST /api/rosters/[id]/export` - Export roster (Excel/PDF)

---

## 10. Testing Plan

### Unit Tests
- Pay calculator with all rate types
- Break rule engine
- Custom rate matching

### Integration Tests
- Full roster creation flow
- Export generation
- Permission checks

### Manual Testing
- Test with various rate configurations
- Test overtime calculations
- Test export formatting

---

## Summary

This enhancement plan covers:

| Feature | Status | Priority | Privacy |
|---------|--------|----------|---------|
| Venue-level pay rates | New | High | Admin/Manager only |
| User-level pay rates | New | High | Hidden from staff |
| Overtime calculation | New | High | Hidden from staff |
| Late (LTE) rate | New | High | Hidden from staff |
| Custom rates | New | Medium | Hidden from staff |
| Shift templates | Enhanced | High | Admin/Manager only |
| Break rules | New | High | Admin/Manager only |
| **Excel export** | Enhanced | Medium | Admin/Manager only |
| **PDF export** | New | Medium | Admin/Manager only |
| Matrix view | Enhanced | Medium | Cost hidden from staff |
| Staff selection | Enhanced | High | - |

The implementation can be done in phases, with Phase 1 (Database + Pay Calculator) being the most critical foundation.
