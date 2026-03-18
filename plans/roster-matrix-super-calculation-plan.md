# Roster Matrix Superannuation Calculation Implementation Plan

## Overview

This plan details the implementation of superannuation calculations throughout the roster matrix view, showing super per shift card, per day totals, per staff totals, and overall roster totals.

## Current State Analysis

### What's Already Implemented
1. **Database Schema** - Super fields exist on:
   - `VenuePayConfig` (superRate, superEnabled)
   - `User` (superEnabled, customSuperRate)
   - `Roster` (publishedSuperRate, totalGrossPay, totalSuperPay, totalCost)

2. **Pay Calculator** (`src/lib/utils/pay-calculator.ts`)
   - `getEffectiveSuperConfig()` - Determines effective super rate
   - `calculateSuperAmount()` - Calculates super from gross pay
   - `calculateShiftPayBreakdownWithSuper()` - Shift-level super calculation
   - `calculateWeeklyPaySummary()` - Weekly summary with super breakdown

3. **Weekly Cost Summary Component** (`src/components/rosters/weekly-cost-summary.tsx`)
   - Already displays gross pay, super pay, and total cost
   - Shows per-staff and per-day breakdowns

### What's Missing
1. **Roster Page** (`src/app/manage/rosters/[id]/page.tsx`)
   - Not fetching venue pay config with super settings
   - Not passing super config to client component

2. **Roster Editor Client** (`src/app/manage/rosters/[id]/roster-editor-client.tsx`)
   - No venuePayConfig prop
   - Cost calculations only show gross pay, not super

3. **Roster Matrix View** (`src/components/rosters/roster-matrix-view.tsx`)
   - ShiftCard only shows gross pay, not super
   - Daily totals only show gross cost
   - Staff totals only show gross pay

---

## Implementation Plan

### Phase 1: Data Flow Setup

#### 1.1 Update Roster Page
**File:** `src/app/manage/rosters/[id]/page.tsx`

Changes:
- Fetch venue pay config from database
- Include superRate and superEnabled fields
- Pass venuePayConfig to RosterEditorClient

```typescript
// Add to interface
interface VenuePayConfig {
  superRate: number | null;
  superEnabled: boolean;
  defaultWeekdayRate: number | null;
  defaultSaturdayRate: number | null;
  defaultSundayRate: number | null;
  defaultPublicHolidayRate: number | null;
}

// Fetch venue pay config
const venuePayConfigRaw = await prisma.venuePayConfig.findUnique({
  where: { venueId: roster.venueId },
});

// Serialize and pass to client
```

#### 1.2 Update Roster Editor Client Props
**File:** `src/app/manage/rosters/[id]/roster-editor-client.tsx`

Changes:
- Add venuePayConfig to RosterEditorClientProps interface
- Destructure venuePayConfig from props
- Pass venuePayConfig to RosterMatrixView

```typescript
interface RosterEditorClientProps {
  // ... existing props
  venuePayConfig?: {
    superRate: number | null;
    superEnabled: boolean;
    defaultWeekdayRate: number | null;
    defaultSaturdayRate: number | null;
    defaultSundayRate: number | null;
    defaultPublicHolidayRate: number | null;
  };
}
```

---

### Phase 2: Matrix View Updates

#### 2.1 Update RosterMatrixView Props
**File:** `src/components/rosters/roster-matrix-view.tsx`

Changes:
- Add venuePayConfig prop
- Update StaffPayRates interface to include super fields
- Pass super config to ShiftCard

```typescript
interface RosterMatrixViewProps {
  // ... existing props
  venuePayConfig?: {
    superRate: number | null;
    superEnabled: boolean;
    defaultWeekdayRate: number | null;
    defaultSaturdayRate: number | null;
    defaultSundayRate: number | null;
    defaultPublicHolidayRate: number | null;
  };
}

interface StaffPayRates {
  weekdayRate: Decimal | number | null | unknown;
  saturdayRate: Decimal | number | null | unknown;
  sundayRate: Decimal | number | null | unknown;
  superEnabled?: boolean | null;
  customSuperRate?: Decimal | number | null;
}
```

#### 2.2 Update ShiftCard Component
**File:** `src/components/rosters/roster-matrix-view.tsx`

Changes:
- Add super calculation using `calculateShiftPayBreakdownWithSuper()`
- Display super amount below gross pay
- Show total cost (gross + super) in tooltip

```typescript
interface ShiftCardProps {
  // ... existing props
  venuePayConfig?: VenuePayConfig;
}

function ShiftCard({ shift, positionColor, editable, onEdit, onDelete, showPay, staffPayRates, venuePayConfig }) {
  // Calculate shift pay with super
  const payBreakdown = useMemo(() => {
    if (!showPay || !staffPayRates) return null;
    
    const superConfig = getEffectiveSuperConfig(
      staffPayRates.superEnabled,
      staffPayRates.customSuperRate,
      venuePayConfig?.superEnabled,
      venuePayConfig?.superRate
    );
    
    return calculateShiftPayBreakdownWithSuper(
      { date: new Date(shift.date), startTime: shift.startTime, endTime: shift.endTime, breakMinutes: shift.breakMinutes },
      staffPayRates,
      superConfig
    );
  }, [showPay, staffPayRates, venuePayConfig, shift]);

  // In render:
  // Show: $X.XX gross + $X.XX super = $X.XX total
}
```

#### 2.3 Update Daily Totals Footer
**File:** `src/components/rosters/roster-matrix-view.tsx`

Changes:
- Calculate super per day
- Display gross, super, and total cost

```typescript
// In footer row
{weekDays.map((day) => {
  const dayTotal = calculateDayTotalsWithSuper(day, shifts, staffPayRates, venuePayConfig);
  return (
    <div key={dateKey}>
      <div>{formatHours(dayTotal.hours)}</div>
      <div>Gross: {formatCurrency(dayTotal.grossPay)}</div>
      <div>Super: {formatCurrency(dayTotal.superPay)}</div>
      <div>Total: {formatCurrency(dayTotal.totalCost)}</div>
    </div>
  );
})}
```

#### 2.4 Update Staff Totals Column
**File:** `src/components/rosters/roster-matrix-view.tsx`

Changes:
- Calculate super per staff member
- Display gross, super, and total in staff column

```typescript
const getStaffTotalsWithSuper = (staffId: string) => {
  const staffShifts = shifts.filter(s => s.user?.id === staffId);
  
  const result = calculateWeeklyPaySummary(
    staffShifts.map(s => ({ date: s.date, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes })),
    staffPayRates[staffId],
    venuePayConfig
  );
  
  return {
    hours: result.totalHours,
    grossPay: result.grossPay,
    superPay: result.superPay,
    totalCost: result.totalCost
  };
};
```

---

### Phase 3: Stats Bar Updates

#### 3.1 Update Stats Bar in RosterEditorClient
**File:** `src/app/manage/rosters/[id]/roster-editor-client.tsx`

Changes:
- Calculate total gross, super, and total cost
- Display breakdown in stats bar

```typescript
const { totalHours, totalGrossPay, totalSuperPay, totalCost, dailyTotals, staffTotals } = useMemo(() => {
  // Calculate with super
  const summary = calculateWeeklyPaySummary(
    roster.shifts.map(s => ({ date: s.date, startTime: s.startTime, endTime: s.endTime, breakMinutes: s.breakMinutes })),
    staffPayRates,
    venuePayConfig
  );
  
  return {
    totalHours: summary.totalHours,
    totalGrossPay: summary.grossPay,
    totalSuperPay: summary.superPay,
    totalCost: summary.totalCost,
    dailyTotals: summary.byDay,
    staffTotals: summary.byStaff
  };
}, [roster.shifts, staffPayRates, venuePayConfig]);
```

---

### Phase 4: Type Updates

#### 4.1 Update Totals Interfaces
**File:** `src/components/rosters/roster-matrix-view.tsx`

```typescript
interface DayTotals {
  hours: number;
  grossPay: number;
  superPay: number;
  totalCost: number;
}

interface StaffTotals {
  hours: number;
  grossPay: number;
  superPay: number;
  totalCost: number;
}

interface RosterMatrixViewProps {
  // ... existing props
  dailyTotals?: Map<string, DayTotals>;
  staffTotals?: Map<string, StaffTotals>;
}
```

---

## Implementation Order

1. **Phase 1.1** - Update roster page to fetch venuePayConfig
2. **Phase 1.2** - Update RosterEditorClient props
3. **Phase 2.1** - Update RosterMatrixView props
4. **Phase 2.2** - Update ShiftCard to show super
5. **Phase 2.3** - Update daily totals
6. **Phase 2.4** - Update staff totals
7. **Phase 3.1** - Update stats bar
8. **Phase 4.1** - Update interfaces

---

## UI Design

### Shift Card Display
```
┌─────────────────────────────┐
│ 09:00 - 17:00          ⋮   │
│ BARISTA                     │
│ 🕐 7.5h  ☕ 30m             │
│ $187.50 + $21.56 = $209.06  │
└─────────────────────────────┘
```

### Staff Column Display
```
┌──────────────────────┐
│ 👤 John Smith        │
│    Barista           │
│    🕐 32h            │
│    $800 + $92 = $892 │
└──────────────────────┘
```

### Daily Totals Display
```
┌─────────────────────┐
│ MON 12              │
│                     │
│ 45h                 │
│ $1,125              │
│ +$129.38 super      │
│ $1,254.38 total     │
└─────────────────────┘
```

### Stats Bar Display
```
┌────────────────────────────────────────────────────────────────────┐
│ Total Cost $15,234.56  │  Total Hours 320h / 480h Cap  │  0 Issues │
│ ($13,500 gross +       │                              │           │
│  $1,734.56 super)      │                              │           │
└────────────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

- [ ] Venue pay config is fetched correctly
- [ ] Super config is passed through all components
- [ ] Shift card shows gross, super, and total
- [ ] Daily totals show super breakdown
- [ ] Staff totals show super breakdown
- [ ] Stats bar shows total cost with super
- [ ] Super calculations respect user overrides
- [ ] Super calculations respect venue defaults
- [ ] Super is disabled when user has superEnabled = false
- [ ] Custom super rates are applied correctly

---

## Files to Modify

1. `src/app/manage/rosters/[id]/page.tsx` - Fetch and pass venuePayConfig
2. `src/app/manage/rosters/[id]/roster-editor-client.tsx` - Accept and pass venuePayConfig, update stats bar
3. `src/components/rosters/roster-matrix-view.tsx` - Update props, ShiftCard, daily totals, staff totals
4. `src/lib/utils/pay-calculator.ts` - Ensure all functions are exported correctly

## Dependencies

- Existing `calculateShiftPayBreakdownWithSuper()` function
- Existing `calculateWeeklyPaySummary()` function
- Existing `getEffectiveSuperConfig()` function
- Prisma client with super fields
