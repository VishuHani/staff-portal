# Staff Availability Reporting & AI Dashboard System - Implementation Plan

**Project:** Staff Portal - Advanced Reporting System
**Created:** November 11, 2025
**Estimated Duration:** 19 working days (~4 weeks)
**Status:** Planning Complete - Ready for Implementation

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Requirements](#requirements)
3. [Architecture](#architecture)
4. [Phase 1: Foundation & Core Data Layer](#phase-1-foundation--core-data-layer)
5. [Phase 2: Interactive Dashboard UI](#phase-2-interactive-dashboard-ui)
6. [Phase 3: AI-Powered Features](#phase-3-ai-powered-features)
7. [Phase 4: Export System & Responsive Design](#phase-4-export-system--responsive-design)
8. [Phase 5: Performance & Optimization](#phase-5-performance--optimization)
9. [File Structure](#file-structure)
10. [Design Specifications](#design-specifications)
11. [Testing Strategy](#testing-strategy)
12. [MVP Quick Wins](#mvp-quick-wins)

---

## Overview

### Project Goals

Build an enterprise-grade reporting system that empowers admins and venue managers to:
- **View staff availability** across date ranges with interactive visualizations
- **Analyze coverage** and identify staffing gaps automatically
- **Detect conflicts** between availability and time-off requests
- **Get AI-powered insights** through natural language queries
- **Export reports** in multiple formats (CSV, Excel, PDF, iCal)
- **Access from any device** with fully responsive design

### Key Features

✅ **Interactive Dashboards** - Beautiful, data-rich visualizations
✅ **Availability Matrix** - Grid view of staff availability (Days × Names)
✅ **Coverage Analysis** - Charts, heatmaps, and trends
✅ **Conflict Detection** - Automatic identification of scheduling issues
✅ **Calendar Views** - Month/week/day visual planning
✅ **AI Natural Language** - Ask questions like "Who's available next Tuesday?"
✅ **Smart Suggestions** - AI-powered scheduling recommendations
✅ **Predictive Analytics** - Forecast availability and staffing needs
✅ **Multi-Format Export** - CSV, Excel, PDF, iCal
✅ **Responsive Design** - Desktop, tablet, and mobile optimized
✅ **Venue-Scoped** - Managers only see their venue staff

### User Personas

**Admin**
- Sees all venues and staff
- Creates organization-wide reports
- Analyzes cross-venue trends
- Exports comprehensive reports

**Venue Manager**
- Sees only assigned venue(s) staff
- Plans weekly/monthly rosters
- Identifies coverage gaps
- Resolves scheduling conflicts

**Staff** (View-Only Reports)
- Views own availability summary
- Sees team availability (if permitted)

---

## Requirements

### Functional Requirements

1. **Data Querying**
   - Query availability by date range (not just day-of-week)
   - Combine recurring availability + time-off requests
   - Filter by venue, role, status, time slots
   - Support complex queries (e.g., "available 9am-5pm on weekdays")

2. **Visualizations**
   - Matrix grid: Days (columns) × Staff (rows)
   - Coverage charts: Bar, line, area, heatmap
   - Calendar views: Month, week, day
   - Stats cards with key metrics

3. **AI Features**
   - Natural language query parsing
   - Smart scheduling suggestions
   - Conflict detection with resolutions
   - Predictive availability forecasting

4. **Exports**
   - CSV: Simple table format
   - Excel: Multi-sheet with formatting and charts
   - PDF: Professional layout with branding
   - iCal: Calendar import for availability

5. **Permissions**
   - Admin: Global access to all data
   - Manager: Venue-scoped access only
   - Staff: Own data only (future)

### Non-Functional Requirements

- **Performance:** Reports load in < 2 seconds for 500 staff
- **Scalability:** Handle 2000+ staff and 1 year date ranges
- **Responsive:** Works on desktop (1200px+), tablet (768px+), mobile (< 768px)
- **Accessibility:** WCAG 2.1 AA compliant
- **Security:** RBAC enforced, audit logging
- **Browser Support:** Chrome, Firefox, Safari, Edge (latest 2 versions)

---

## Architecture

### Tech Stack

**Frontend:**
- Next.js 16.0.1 (App Router, Server Components)
- React 19.2.0
- TypeScript 5
- Tailwind CSS 4
- Radix UI (components)
- Recharts (charts)
- React Day Picker (calendar)
- TanStack Table (data tables)

**Backend:**
- Next.js Server Actions
- Prisma 6.19.0 (ORM)
- PostgreSQL (via Supabase)
- OpenAI GPT-4 (AI features)

**Libraries (New):**
- `recharts` - Data visualization
- `react-day-picker` - Calendar component
- `@tanstack/react-table` - Advanced tables
- `jspdf` + `jspdf-autotable` - PDF generation
- `xlsx` - Excel export
- `ical-generator` - iCal export
- `ai` + `openai` - LLM integration

### Data Model

**Existing Models (Leveraged):**
- `Availability` - Recurring weekly schedules (day-of-week based)
- `TimeOffRequest` - Specific date ranges with approval workflow
- `User` - Staff with venue assignments
- `UserVenue` - Multi-venue support
- `Store` (Venue) - Locations

**New Models (To Add):**
```prisma
// Cache snapshots for performance
model AvailabilitySnapshot {
  id             String   @id @default(cuid())
  venueId        String?
  snapshotDate   DateTime
  totalStaff     Int
  availableStaff Int
  coverage       Json     // { dayOfWeek: { timeSlot: count } }
  createdAt      DateTime @default(now())

  @@index([venueId, snapshotDate])
}

// Cache report results
model ReportCache {
  id         String   @id @default(cuid())
  reportType String   // "coverage", "availability_matrix", "conflicts"
  filters    Json     // Serialized filter state
  data       Json     // Cached report data
  createdAt  DateTime @default(now())
  expiresAt  DateTime

  @@index([reportType, expiresAt])
}

// Track AI queries for learning
model AIQuery {
  id         String   @id @default(cuid())
  userId     String
  query      String   // Natural language query
  response   Json     // AI response with data
  filters    Json     // Generated filters
  createdAt  DateTime @default(now())
  user       User     @relation(...)

  @@index([userId])
}
```

### Core Query Logic

**Challenge:** Availability is recurring (day-of-week), but reports need specific dates.

**Solution:** Compute effective availability for date ranges:

```typescript
function getEffectiveAvailability(user, startDate, endDate) {
  const dates = eachDayOfInterval({ start: startDate, end: endDate })

  return dates.map(date => {
    const dayOfWeek = getDay(date) // 0-6

    // Get recurring availability for this day
    const recurring = user.availability.find(a => a.dayOfWeek === dayOfWeek)

    // Check if time-off overrides
    const timeOff = user.timeOffRequests.find(to =>
      isWithinInterval(date, { start: to.startDate, end: to.endDate }) &&
      to.status === "APPROVED"
    )

    // Time-off overrides recurring availability
    if (timeOff) {
      return { date, available: false, reason: "Time Off", ...timeOff }
    }

    return { date, ...recurring }
  })
}
```

---

## Phase 1: Foundation & Core Data Layer

**Duration:** 3 days
**Goal:** Set up infrastructure, install dependencies, create core server actions

### 1.1 Install Dependencies

```bash
npm install recharts react-day-picker @tanstack/react-table @dnd-kit/core @dnd-kit/sortable jspdf jspdf-autotable xlsx ical-generator ai openai date-fns-tz
```

**Purpose:**
- `recharts` - Charts and data visualization
- `react-day-picker` - Calendar components
- `@tanstack/react-table` - Advanced data tables with sorting/filtering/pagination
- `@dnd-kit` - Drag and drop (for future scheduling features)
- `jspdf` + `jspdf-autotable` - PDF generation
- `xlsx` - Excel export with formatting
- `ical-generator` - Calendar file (.ics) export
- `ai` + `openai` - AI/LLM integration for natural language queries
- `date-fns-tz` - Timezone handling

### 1.2 Database Schema Updates

**File:** `prisma/schema.prisma`

Add the three new models shown in [Architecture > Data Model](#data-model).

**Commands:**
```bash
npx prisma format          # Format schema
npx prisma migrate dev --name add_reporting_models
npx prisma generate        # Update Prisma client
```

### 1.3 Core Server Actions

**File:** `src/lib/actions/reports/availability-reports.ts` (NEW)

Create comprehensive query functions:

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { eachDayOfInterval, getDay, isWithinInterval } from "date-fns";

/**
 * Get availability matrix for date range
 * Returns: { users: [...], dates: [...], matrix: { userId: { date: availabilityData } } }
 */
export async function getAvailabilityMatrix(filters: {
  startDate: Date
  endDate: Date
  venueId?: string
  roleId?: string
  userIds?: string[]
  timeSlot?: { start: string, end: string } // "09:00" to "17:00"
}) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view reports" };
  }

  // Get venue-filtered users
  const sharedVenueUserIds = await getSharedVenueUsers(user.id);

  // Build where clause
  const where: any = {
    active: true,
    id: { in: sharedVenueUserIds },
  };

  if (filters.venueId) {
    where.venues = { some: { venueId: filters.venueId } };
  }

  if (filters.roleId) {
    where.roleId = filters.roleId;
  }

  if (filters.userIds && filters.userIds.length > 0) {
    where.id = { in: filters.userIds };
  }

  // Fetch users with availability and time-off
  const users = await prisma.user.findMany({
    where,
    include: {
      role: { select: { name: true } },
      store: { select: { name: true } },
      venues: {
        include: {
          venue: { select: { id: true, name: true } }
        }
      },
      availability: true,
      timeOffRequests: {
        where: {
          status: "APPROVED",
          startDate: { lte: filters.endDate },
          endDate: { gte: filters.startDate },
        }
      }
    },
    orderBy: [
      { lastName: "asc" },
      { firstName: "asc" },
      { email: "asc" }
    ]
  });

  // Generate date array
  const dates = eachDayOfInterval({
    start: filters.startDate,
    end: filters.endDate
  });

  // Compute matrix
  const matrix: Record<string, Record<string, any>> = {};

  for (const user of users) {
    matrix[user.id] = {};

    for (const date of dates) {
      const dayOfWeek = getDay(date);

      // Get recurring availability
      const recurring = user.availability.find(a => a.dayOfWeek === dayOfWeek);

      // Check time-off override
      const timeOff = user.timeOffRequests.find(to =>
        isWithinInterval(date, { start: to.startDate, end: to.endDate })
      );

      if (timeOff) {
        matrix[user.id][date.toISOString()] = {
          available: false,
          reason: "Time Off",
          type: timeOff.type,
          timeOffId: timeOff.id,
        };
      } else if (!recurring || !recurring.isAvailable) {
        matrix[user.id][date.toISOString()] = {
          available: false,
          reason: "Not Available",
        };
      } else {
        // Check time slot filter
        if (filters.timeSlot) {
          const matchesTimeSlot = checkTimeSlotOverlap(
            recurring.startTime,
            recurring.endTime,
            filters.timeSlot.start,
            filters.timeSlot.end
          );

          matrix[user.id][date.toISOString()] = {
            available: matchesTimeSlot,
            isAllDay: recurring.isAllDay,
            startTime: recurring.startTime,
            endTime: recurring.endTime,
            filteredByTimeSlot: !matchesTimeSlot,
          };
        } else {
          matrix[user.id][date.toISOString()] = {
            available: true,
            isAllDay: recurring.isAllDay,
            startTime: recurring.startTime,
            endTime: recurring.endTime,
          };
        }
      }
    }
  }

  return {
    success: true,
    users: users.map(u => ({
      id: u.id,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role.name,
      venues: u.venues.map(uv => uv.venue.name),
    })),
    dates: dates.map(d => d.toISOString()),
    matrix,
  };
}

/**
 * Get coverage analysis (how many staff available per day/time)
 */
export async function getCoverageAnalysis(filters: {
  startDate: Date
  endDate: Date
  venueId?: string
  timeSlot?: { start: string, end: string }
}) {
  // Similar structure to getAvailabilityMatrix
  // Returns aggregated counts per date/time slot
  // Implementation details...
}

/**
 * Detect scheduling conflicts
 */
export async function getAvailabilityConflicts(filters: {
  startDate: Date
  endDate: Date
  venueId?: string
  minimumStaffing?: number
}) {
  // Identify:
  // 1. Overlapping time-off requests
  // 2. Days with < minimumStaffing available
  // 3. Staff with no availability submitted
  // 4. Pending time-off blocking critical coverage
  // Implementation details...
}

/**
 * Get staffing gaps (understaffed periods)
 */
export async function getStaffingGaps(filters: {
  startDate: Date
  endDate: Date
  venueId?: string
  minimumStaffing: number
}) {
  // Returns dates where available staff < minimumStaffing
  // Implementation details...
}

// Helper function
function checkTimeSlotOverlap(
  availStart: string,
  availEnd: string,
  filterStart: string,
  filterEnd: string
): boolean {
  // Check if availability overlaps with filter time slot
  // "09:00" format comparison
  return availStart <= filterEnd && availEnd >= filterStart;
}
```

### 1.4 Export Server Actions

**File:** `src/lib/actions/reports/export.ts` (NEW)

```typescript
"use server";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import ical from "ical-generator";
import { format } from "date-fns";

export async function exportToCSV(
  reportData: any,
  reportType: string
): Promise<string> {
  // Convert data to CSV format
  // Return as data URL or file path
}

export async function exportToExcel(
  reportData: any,
  reportType: string
): Promise<Blob> {
  // Create Excel workbook
  // Multiple sheets: Summary, Matrix, Coverage, Conflicts
  // Apply formatting and colors
  // Return blob
}

export async function exportToPDF(
  reportData: any,
  reportType: string
): Promise<Blob> {
  // Create PDF with jsPDF
  // Add header/footer
  // Tables with autoTable
  // Charts as images
  // Return blob
}

export async function exportToICal(
  availabilityData: any
): Promise<string> {
  // Generate .ics calendar file
  // Events for availability blocks
  // All-day events for time-off
  // Return iCal string
}
```

### 1.5 Zod Schemas

**File:** `src/lib/schemas/reports.ts` (NEW)

```typescript
import { z } from "zod";

export const matrixFiltersSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  venueId: z.string().optional(),
  roleId: z.string().optional(),
  userIds: z.array(z.string()).optional(),
  timeSlot: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
});

export const coverageFiltersSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  venueId: z.string().optional(),
  timeSlot: z.object({
    start: z.string().regex(/^\d{2}:\d{2}$/),
    end: z.string().regex(/^\d{2}:\d{2}$/),
  }).optional(),
});

export const conflictFiltersSchema = z.object({
  startDate: z.date(),
  endDate: z.date(),
  venueId: z.string().optional(),
  minimumStaffing: z.number().int().positive().optional(),
  severity: z.enum(["critical", "warning", "info"]).optional(),
});

export const exportSchema = z.object({
  reportType: z.enum(["matrix", "coverage", "conflicts", "calendar"]),
  format: z.enum(["csv", "excel", "pdf", "ical"]),
  filters: z.record(z.any()),
});

export type MatrixFilters = z.infer<typeof matrixFiltersSchema>;
export type CoverageFilters = z.infer<typeof coverageFiltersSchema>;
export type ConflictFilters = z.infer<typeof conflictFiltersSchema>;
export type ExportOptions = z.infer<typeof exportSchema>;
```

### 1.6 Permissions Update

**File:** `src/lib/rbac/permissions.ts`

Add new report permissions:

```typescript
export const PERMISSION_DEFINITIONS = {
  // ... existing permissions

  reports: {
    view_own: "View own reports",
    view_team: "View team reports",
    export_team: "Export team reports",
    view_ai: "Access AI features",
  },
} as const;
```

Update role defaults:
- **Admin:** All report permissions
- **Manager:** `view_team`, `export_team`, `view_ai`
- **Staff:** `view_own`

---

## Phase 2: Interactive Dashboard UI

**Duration:** 5 days
**Goal:** Build all interactive dashboard pages with charts and filters

### 2.1 Main Reports Dashboard

**File:** `src/app/admin/reports/page.tsx` (NEW)

Landing page with quick stats and navigation.

**Features:**
- 4 stats cards: Total Staff, Available Today, Active Conflicts, Coverage %
- Quick action cards:
  - "Availability Matrix" → `/admin/reports/availability-matrix`
  - "Coverage Analysis" → `/admin/reports/coverage`
  - "Conflicts Report" → `/admin/reports/conflicts`
  - "Calendar View" → `/admin/reports/calendar`
  - "AI Chat" → `/admin/reports/ai-chat`
- Recent reports list (if saved reports feature added later)
- Welcome message and getting started guide

### 2.2 Availability Matrix View

**File:** `src/app/admin/reports/availability-matrix/page.tsx` (NEW)

**Layout:**
```
[Header: Availability Matrix]
[Filter Panel: Date Range, Venue, Role, Time Slot, Search]
[Stats Bar: X staff, Y available, Z unavailable]
[Matrix Grid: Scrollable table]
[Export Button Dropdown: CSV, Excel, PDF]
```

**Component:** `src/components/reports/AvailabilityMatrixGrid.tsx`

```tsx
"use client";

import { useState, useMemo } from "react";
import { format, eachDayOfInterval } from "date-fns";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface MatrixGridProps {
  users: Array<{
    id: string;
    name: string;
    role: string;
    venues: string[];
  }>;
  dates: string[]; // ISO date strings
  matrix: Record<string, Record<string, any>>;
}

export function AvailabilityMatrixGrid({ users, dates, matrix }: MatrixGridProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 sticky top-0">
            <th className="border p-2 text-left min-w-[200px]">Staff Member</th>
            {dates.map(date => (
              <th key={date} className="border p-2 text-center min-w-[100px]">
                <div className="text-xs font-medium">
                  {format(new Date(date), "EEE")}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(date), "MMM d")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map(user => (
            <tr key={user.id} className="hover:bg-gray-50">
              <td className="border p-2">
                <div className="font-medium">{user.name}</div>
                <div className="text-xs text-muted-foreground">{user.role}</div>
                <div className="text-xs text-muted-foreground">{user.venues.join(", ")}</div>
              </td>
              {dates.map(date => {
                const cell = matrix[user.id]?.[date];
                return (
                  <td
                    key={date}
                    className={`border p-2 text-center ${
                      cell?.available
                        ? "bg-green-50"
                        : cell?.reason === "Time Off"
                        ? "bg-yellow-50"
                        : "bg-red-50"
                    }`}
                  >
                    {cell?.available ? (
                      <div>
                        {cell.isAllDay ? (
                          <Badge variant="outline" className="text-xs">All Day</Badge>
                        ) : (
                          <div className="text-xs">
                            {cell.startTime} - {cell.endTime}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        {cell?.reason || "N/A"}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### 2.3 Coverage Analysis Dashboard

**File:** `src/app/admin/reports/coverage/page.tsx` (NEW)

**Charts:**
1. Bar Chart: Staff count by day
2. Line Chart: Coverage trend over time
3. Heatmap: Hour × Day coverage density
4. Area Chart: Available vs required staffing

**Component:** `src/components/reports/CoverageChart.tsx`

```tsx
"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

interface CoverageChartProps {
  data: Array<{
    date: string;
    availableStaff: number;
    requiredStaff?: number;
  }>;
}

export function CoverageChart({ data }: CoverageChartProps) {
  const chartData = data.map(d => ({
    date: format(new Date(d.date), "MMM d"),
    Available: d.availableStaff,
    Required: d.requiredStaff || 0,
  }));

  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey="Available" fill="#10b981" />
        {data.some(d => d.requiredStaff) && (
          <Bar dataKey="Required" fill="#6b7280" />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Component:** `src/components/reports/CoverageHeatmap.tsx`

(Heatmap showing coverage density by hour and day)

### 2.4 Conflicts & Gaps Report

**File:** `src/app/admin/reports/conflicts/page.tsx` (NEW)

**Features:**
- List of detected conflicts with severity badges
- Grouped by type: Time-off Overlaps, Understaffed Periods, Missing Availability
- Each conflict card shows:
  - Title and description
  - Affected staff/dates
  - Severity indicator
  - Suggested resolution (AI-powered later)
  - Quick actions

**Component:** `src/components/reports/ConflictCard.tsx`

```tsx
"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ConflictCardProps {
  conflict: {
    type: "time_off_overlap" | "understaffed" | "missing_availability";
    severity: "critical" | "warning" | "info";
    title: string;
    description: string;
    affectedUsers?: string[];
    affectedDates?: string[];
    suggestions?: string[];
  };
}

export function ConflictCard({ conflict }: ConflictCardProps) {
  const Icon =
    conflict.severity === "critical" ? AlertCircle :
    conflict.severity === "warning" ? AlertTriangle :
    Info;

  const colorClass =
    conflict.severity === "critical" ? "text-red-600" :
    conflict.severity === "warning" ? "text-yellow-600" :
    "text-blue-600";

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-3">
        <Icon className={`h-5 w-5 ${colorClass} mt-1`} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{conflict.title}</h3>
            <Badge variant={
              conflict.severity === "critical" ? "destructive" :
              conflict.severity === "warning" ? "outline" :
              "secondary"
            }>
              {conflict.severity}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {conflict.description}
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {conflict.affectedUsers && conflict.affectedUsers.length > 0 && (
          <div className="mb-2">
            <span className="text-sm font-medium">Affected Staff: </span>
            <span className="text-sm">{conflict.affectedUsers.join(", ")}</span>
          </div>
        )}
        {conflict.affectedDates && conflict.affectedDates.length > 0 && (
          <div className="mb-2">
            <span className="text-sm font-medium">Dates: </span>
            <span className="text-sm">{conflict.affectedDates.join(", ")}</span>
          </div>
        )}
        {conflict.suggestions && conflict.suggestions.length > 0 && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <p className="text-sm font-medium text-blue-900 mb-1">Suggested Actions:</p>
            <ul className="text-sm text-blue-800 list-disc list-inside">
              {conflict.suggestions.map((suggestion, idx) => (
                <li key={idx}>{suggestion}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

### 2.5 Calendar View

**File:** `src/app/admin/reports/calendar/page.tsx` (NEW)

**Features:**
- Month/week/day view toggle
- Click day to see detailed staff list
- Color-coded coverage indicators
- Navigation controls
- Venue switcher

**Component:** `src/components/reports/AvailabilityCalendar.tsx`

Use `react-day-picker` for base calendar, customize with coverage data.

### 2.6 Reusable Filter Component

**Component:** `src/components/reports/ReportFilters.tsx`

```tsx
"use client";

import { useState } from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/reports/DateRangePicker";
import { VenueSelect } from "@/components/reports/VenueSelect";
import { RoleSelect } from "@/components/reports/RoleSelect";
import { TimeSlotPicker } from "@/components/reports/TimeSlotPicker";

interface ReportFiltersProps {
  onApplyFilters: (filters: any) => void;
  showTimeSlot?: boolean;
  showVenue?: boolean;
  showRole?: boolean;
}

export function ReportFilters({
  onApplyFilters,
  showTimeSlot = true,
  showVenue = true,
  showRole = true
}: ReportFiltersProps) {
  const [dateRange, setDateRange] = useState<{ start: Date, end: Date }>();
  const [venueId, setVenueId] = useState<string>();
  const [roleId, setRoleId] = useState<string>();
  const [timeSlot, setTimeSlot] = useState<{ start: string, end: string }>();

  const handleApply = () => {
    onApplyFilters({
      dateRange,
      venueId,
      roleId,
      timeSlot,
    });
  };

  const handleClear = () => {
    setDateRange(undefined);
    setVenueId(undefined);
    setRoleId(undefined);
    setTimeSlot(undefined);
    onApplyFilters({});
  };

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold">Filters</h3>
      </CardHeader>
      <CardContent className="space-y-4">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
          presets={["today", "thisWeek", "nextWeek", "thisMonth", "nextMonth"]}
        />

        {showVenue && (
          <VenueSelect value={venueId} onChange={setVenueId} />
        )}

        {showRole && (
          <RoleSelect value={roleId} onChange={setRoleId} />
        )}

        {showTimeSlot && (
          <TimeSlotPicker value={timeSlot} onChange={setTimeSlot} />
        )}

        <div className="flex gap-2">
          <Button onClick={handleApply} className="flex-1">
            Apply Filters
          </Button>
          <Button onClick={handleClear} variant="outline">
            Clear
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## Phase 3: AI-Powered Features

**Duration:** 5 days
**Goal:** Implement AI natural language queries, smart suggestions, conflict resolution, and predictive analytics

### 3.1 Natural Language Query Interface

**File:** `src/app/admin/reports/ai-chat/page.tsx` (NEW)

**Features:**
- ChatGPT-like interface
- Example queries on empty state
- Chat history
- Export current results
- Copy to clipboard

**Server Action:** `src/lib/actions/ai/query-parser.ts`

```typescript
"use server";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { z } from "zod";

const queryIntentSchema = z.object({
  reportType: z.enum(["matrix", "coverage", "conflicts", "calendar"]),
  filters: z.object({
    dateRange: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
    venueId: z.string().optional(),
    roleId: z.string().optional(),
    timeSlot: z.object({
      start: z.string(),
      end: z.string(),
    }).optional(),
  }),
  summary: z.string(),
});

export async function parseNaturalLanguageQuery(query: string) {
  const prompt = `
You are an AI assistant for a staff scheduling system. Parse the following natural language query into structured filters.

Current date: ${new Date().toISOString()}

Query: "${query}"

Extract:
1. Report type: "matrix", "coverage", "conflicts", or "calendar"
2. Date range (convert relative dates like "next week" to actual dates)
3. Venue name (if mentioned)
4. Role (if mentioned)
5. Time slot (if mentioned, e.g., "morning", "2pm-6pm")
6. A natural language summary of what the user wants to see

Return JSON matching this schema:
{
  "reportType": "matrix",
  "filters": {
    "dateRange": { "start": "2024-11-15", "end": "2024-11-21" },
    "venueId": "optional-venue-id",
    "roleId": "optional-role-id",
    "timeSlot": { "start": "09:00", "end": "17:00" }
  },
  "summary": "Showing availability for all staff next week"
}
`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4-turbo"),
      prompt,
    });

    const parsed = JSON.parse(text);
    const validated = queryIntentSchema.parse(parsed);

    // TODO: Fetch actual data based on validated filters

    return {
      success: true,
      intent: validated,
      data: null, // Fetch real data here
    };
  } catch (error) {
    console.error("Error parsing query:", error);
    return {
      success: false,
      error: "Failed to parse query. Please try rephrasing.",
    };
  }
}
```

**UI Component:** `src/components/ai/ChatInterface.tsx`

```tsx
"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { parseNaturalLanguageQuery } from "@/lib/actions/ai/query-parser";

export function ChatInterface() {
  const [messages, setMessages] = useState<Array<{
    role: "user" | "assistant";
    content: string;
  }>>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = input.trim();
    setInput("");
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLoading(true);

    try {
      const result = await parseNaturalLanguageQuery(userMessage);

      if (result.success) {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: result.intent.summary,
        }]);
        // TODO: Render data visualization
      } else {
        setMessages(prev => [...prev, {
          role: "assistant",
          content: result.error || "Failed to process query",
        }]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "An error occurred. Please try again.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground mt-8">
            <p className="mb-4">Ask me about staff availability!</p>
            <div className="space-y-2">
              <p className="text-sm">Try:</p>
              <ul className="text-sm space-y-1">
                <li>"Who is available next Tuesday between 2pm and 6pm?"</li>
                <li>"Show me coverage for next week at Downtown venue"</li>
                <li>"Which staff members have the most conflicts?"</li>
                <li>"Find understaffed days in November"</li>
              </ul>
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <Card key={idx} className={`p-3 ${
              msg.role === "user" ? "bg-blue-50 ml-12" : "bg-gray-50 mr-12"
            }`}>
              <p className="text-sm">{msg.content}</p>
            </Card>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about availability..."
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
```

### 3.2 Smart Scheduling Suggestions

**File:** `src/lib/actions/ai/suggestions.ts` (NEW)

```typescript
"use server";

import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { getAvailabilityMatrix } from "@/lib/actions/reports/availability-reports";

export async function generateSchedulingSuggestions(filters: {
  dateRange: { start: Date; end: Date };
  venueId: string;
  requiredStaffing: number;
  constraints?: {
    fairDistribution?: boolean;
    preferredStaff?: string[];
    avoidStaff?: string[];
  };
}) {
  // Get availability data
  const matrixResult = await getAvailabilityMatrix({
    startDate: filters.dateRange.start,
    endDate: filters.dateRange.end,
    venueId: filters.venueId,
  });

  if (!matrixResult.success) {
    return { error: "Failed to fetch availability data" };
  }

  // Prepare data for AI
  const context = {
    dates: matrixResult.dates,
    staff: matrixResult.users,
    availability: matrixResult.matrix,
    required: filters.requiredStaffing,
    constraints: filters.constraints,
  };

  const prompt = `
You are a scheduling AI assistant. Based on the availability data below, suggest optimal staff assignments for each date.

Context:
${JSON.stringify(context, null, 2)}

Consider:
1. Fair distribution (no one works too much or too little)
2. Coverage requirements (${filters.requiredStaffing} staff per day)
3. Staff preferences and constraints
4. Continuity (prefer consistent assignments where possible)

For each date, suggest which staff members to schedule and explain why.

Return JSON:
{
  "suggestions": [
    {
      "date": "2024-11-15",
      "assignedStaff": ["user-id-1", "user-id-2"],
      "reasoning": "These staff have full availability and haven't worked recently",
      "confidence": 0.95
    }
  ],
  "summary": "Overall scheduling strategy explanation"
}
`;

  try {
    const { text } = await generateText({
      model: openai("gpt-4-turbo"),
      prompt,
    });

    const result = JSON.parse(text);

    return {
      success: true,
      suggestions: result.suggestions,
      summary: result.summary,
    };
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return {
      success: false,
      error: "Failed to generate suggestions",
    };
  }
}
```

### 3.3 Conflict Detection & Resolution

**File:** `src/lib/actions/ai/conflict-detection.ts` (NEW)

Automatically detect conflicts and suggest resolutions using AI.

### 3.4 Predictive Analytics

**File:** `src/lib/actions/ai/predictive.ts` (NEW)

Forecast future availability patterns, time-off requests, and staffing needs.

**Page:** `src/app/admin/reports/predictive/page.tsx` (NEW)

Dashboard with trend charts and predictions.

---

## Phase 4: Export System & Responsive Design

**Duration:** 3 days
**Goal:** Implement multi-format exports and ensure responsive design across devices

### 4.1 CSV Export

Simple table format with readable headers.

### 4.2 Excel Export

Multiple sheets with formatting:
- Summary sheet: Stats and overview
- Matrix sheet: Availability grid with colors
- Coverage sheet: Daily/weekly coverage data
- Conflicts sheet: List of detected issues

### 4.3 PDF Export

Professional layout with:
- Header/footer with branding
- Page numbers
- Charts embedded as images
- Tables with proper pagination

### 4.4 iCal Export

Generate calendar events for:
- Staff availability blocks
- Approved time-off (blocked time)
- Understaffed periods (tasks/reminders)

### 4.5 Responsive Design

**Desktop (1200px+):**
- Full-featured layout
- Multi-column grids
- Expanded filters sidebar
- Large charts

**Tablet (768px - 1199px):**
- Collapsible filter panel
- 2-column grids
- Touch-optimized controls
- Scrollable tables with sticky headers

**Mobile (< 768px):**
- Single column layout
- Bottom sheet filters
- Simplified charts
- Swipe gestures
- Accordion sections
- Large touch targets (min 44px)

### 4.6 Print Stylesheet

Add print media queries to hide navigation/filters and optimize for printing.

---

## Phase 5: Performance & Optimization

**Duration:** 3 days
**Goal:** Optimize queries, add caching, implement advanced features

### 5.1 Query Optimization

- Report caching (5-minute TTL)
- Pagination for large datasets
- Database indexes for common queries
- Result memoization

### 5.2 Advanced Features

**Saved Reports:**
- Save filter configurations
- Quick load saved filters

**Comparison Mode:**
- Side-by-side date range comparison
- Week-over-week trends
- Venue-over-venue comparison

**Bulk Operations:**
- Export multiple reports at once
- Batch conflict resolution

**Notifications:**
- Daily coverage summaries
- Critical conflict alerts
- Low availability warnings

### 5.3 Audit Logging

Log all report access and exports for compliance.

---

## File Structure

```
src/
├── app/admin/reports/
│   ├── page.tsx                          # Main dashboard
│   ├── availability-matrix/
│   │   └── page.tsx                      # Matrix view
│   ├── coverage/
│   │   └── page.tsx                      # Coverage analysis
│   ├── conflicts/
│   │   └── page.tsx                      # Conflicts report
│   ├── calendar/
│   │   └── page.tsx                      # Calendar view
│   ├── ai-chat/
│   │   └── page.tsx                      # AI query interface
│   └── predictive/
│       └── page.tsx                      # Predictive analytics
│
├── components/reports/
│   ├── AvailabilityMatrixGrid.tsx        # Matrix grid
│   ├── CoverageChart.tsx                 # Bar/line charts
│   ├── CoverageHeatmap.tsx               # Heatmap
│   ├── CoverageStats.tsx                 # Stats cards
│   ├── ConflictCard.tsx                  # Conflict display
│   ├── AvailabilityCalendar.tsx          # Calendar
│   ├── ReportFilters.tsx                 # Filter panel
│   ├── DateRangePicker.tsx               # Date selector
│   ├── VenueSelect.tsx                   # Venue dropdown
│   ├── RoleSelect.tsx                    # Role dropdown
│   ├── TimeSlotPicker.tsx                # Time range picker
│   ├── ExportButton.tsx                  # Export dropdown
│   └── ReportSummaryCards.tsx            # Stats cards
│
├── components/ai/
│   ├── ChatInterface.tsx                 # AI chat UI
│   ├── SchedulingSuggestions.tsx         # AI suggestions
│   └── ConflictResolutions.tsx           # AI resolutions
│
├── lib/actions/reports/
│   ├── availability-reports.ts           # Core queries
│   ├── export.ts                         # Export functions
│   └── cache.ts                          # Caching layer
│
├── lib/actions/ai/
│   ├── query-parser.ts                   # NL query parsing
│   ├── suggestions.ts                    # Scheduling AI
│   ├── conflict-detection.ts             # Conflict AI
│   └── predictive.ts                     # Predictive analytics
│
└── lib/schemas/
    └── reports.ts                        # Zod schemas
```

---

## Design Specifications

### Color Scheme

- **Available:** Green (#10b981, `bg-green-50`, `text-green-700`)
- **Unavailable:** Red (#ef4444, `bg-red-50`, `text-red-700`)
- **Partial/Time-off:** Yellow (#f59e0b, `bg-yellow-50`, `text-yellow-700`)
- **Unscheduled:** Gray (#6b7280, `bg-gray-50`, `text-gray-700`)
- **AI Suggestions:** Blue (#3b82f6, `bg-blue-50`, `text-blue-700`)

### Typography

- **Headers:** `font-bold text-2xl sm:text-3xl`
- **Subheaders:** `font-semibold text-lg`
- **Body:** `text-base`
- **Captions:** `text-sm text-muted-foreground`
- **Monospace (times):** `font-mono text-sm`

### Spacing

- **Card padding:** `p-6`
- **Grid gaps:** `gap-4` or `gap-6`
- **Section spacing:** `space-y-6` or `space-y-8`
- **Mobile:** Reduce padding by 25% (`p-4`)

### Icons

Use **Lucide React** icons:
- Calendar: `Calendar`
- Chart: `BarChart3`, `LineChart`, `TrendingUp`
- Filter: `Filter`, `Search`, `X`
- Export: `Download`, `FileText`, `File`
- AI: `Sparkles`, `Bot`, `Wand2`
- Actions: `Edit`, `Trash2`, `MoreHorizontal`

---

## Testing Strategy

### Unit Tests

- All server actions
- AI query parsing
- Date range calculations
- Time slot overlap logic
- Export functions

### Integration Tests

- Report generation end-to-end
- Filter combinations
- Export format validation
- Permission checks

### E2E Tests

- Generate availability matrix
- Apply filters and export
- AI chat query flow
- Calendar navigation

### Performance Tests

- Large dataset queries (1000+ staff)
- Matrix with 365 days
- Concurrent report generation

### Accessibility

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Color contrast validation

### Browser Tests

- Chrome (latest 2 versions)
- Firefox (latest 2 versions)
- Safari (latest 2 versions)
- Edge (latest 2 versions)

---

## MVP Quick Wins

If you need faster incremental delivery:

**Week 1: Core Reports**
- Availability Matrix + Basic Filters + CSV Export

**Week 2: Visualizations**
- Coverage Dashboard + Charts + PDF Export

**Week 3: Advanced Features**
- Conflicts Report + Calendar View

**Week 4: AI Features**
- Natural Language Queries + Smart Suggestions

**Later: Advanced AI**
- Predictive Analytics + Conflict Resolution AI

---

## Success Metrics

1. **Adoption:** 80% of managers use reports weekly
2. **Performance:** Reports load in < 2 seconds
3. **Accuracy:** AI query parsing 90%+ accuracy
4. **Exports:** 50+ reports exported per week
5. **Satisfaction:** 4.5+ rating from user feedback

---

## Next Steps

1. Review and approve this plan
2. Set up project tracking in `ReportingSystemProgress.md`
3. Begin Phase 1 implementation
4. Daily standup reviews of progress
5. Weekly demos of completed features

---

**Document Version:** 1.0
**Last Updated:** November 11, 2025
**Owner:** Development Team
**Reviewers:** Product, Design, Engineering
