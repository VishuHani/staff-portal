# Reporting System Quick Reference Guide

**Quick Links | Common Patterns | Troubleshooting**

---

## 🔗 Quick Links

### Report Pages
- **Main Dashboard:** `/admin/reports`
- **Availability Matrix:** `/admin/reports/availability-matrix`
- **Coverage Analysis:** `/admin/reports/coverage`
- **Conflicts Report:** `/admin/reports/conflicts`
- **Calendar View:** `/admin/reports/calendar`
- **AI Chat:** `/admin/reports/ai-chat`
- **Predictive Analytics:** `/admin/reports/predictive`

### Key Files
- **Core Queries:** `src/lib/actions/reports/availability-reports.ts`
- **Export Functions:** `src/lib/actions/reports/export.ts`
- **AI Integration:** `src/lib/actions/ai/query-parser.ts`
- **AI Conflict Resolution:** `src/lib/actions/ai/conflict-detection.ts`
- **Schemas:** `src/lib/schemas/reports.ts`
- **Permissions:** `src/lib/rbac/permissions.ts`

---

## 🎨 UI Component Reference

### Reusable Components

#### Report Filters (Enhanced with Multi-Select)
```tsx
import { ReportFilters } from "@/components/reports/ReportFilters";

<ReportFilters
  onApplyFilters={(filters) => handleFilters(filters)}
  showVenue={true}
  showRole={true}
  showTimeSlot={true}
  showSearch={true}
  showSeverity={false}
  venues={venues} // Array<{ id: string; name: string }>
  roles={roles}   // Array<{ id: string; name: string }>
/>

// Features:
// - Multi-select for venues and roles
// - Quick date filters (Today, This Week, Next Week, This Month)
// - Filter persistence in localStorage
// - Active filter badges with individual removal
// - Search by staff name/email
// - Time slot filtering
// - Severity filtering (for conflicts report)
```

#### Multi-Select Component
```tsx
import { MultiSelect } from "@/components/ui/multi-select";

const venueOptions = venues.map(v => ({ label: v.name, value: v.id }));

<MultiSelect
  options={venueOptions}
  selected={selectedVenueIds}
  onChange={setSelectedVenueIds}
  placeholder="Select venues..."
/>

// Features:
// - Searchable dropdown with Command component
// - Selected items shown as badges in button
// - Click X on badge to remove individual item
// - Checkbox-style selection with visual feedback
```

#### Date Range Picker
```tsx
import { DateRangePicker } from "@/components/reports/DateRangePicker";

<DateRangePicker
  value={dateRange}
  onChange={setDateRange}
  presets={["today", "thisWeek", "nextWeek", "thisMonth", "nextMonth", "custom"]}
/>
```

#### Coverage Chart
```tsx
import { CoverageChart } from "@/components/reports/CoverageChart";

<CoverageChart
  data={[
    { date: "2024-11-15", availableStaff: 25, requiredStaff: 20 },
    { date: "2024-11-16", availableStaff: 23, requiredStaff: 20 },
  ]}
/>
```

#### Export Button
```tsx
import { ExportButton } from "@/components/reports/ExportButton";

<ExportButton
  reportType="matrix" // "matrix" | "coverage" | "conflicts" | "calendar" | "gaps"
  reportData={rawData} // Store raw data from server action
  formats={["csv", "excel", "pdf", "ical"]} // Optional: customize available formats
/>

// Supported Formats:
// - CSV: UTF-8 encoded, proper escaping
// - Excel: Multi-sheet workbooks with formatting
// - PDF: Landscape orientation, styled tables
// - iCal: RFC 5545 compliant calendar events
//
// Features:
// - Dropdown menu with format icons
// - Loading states during generation
// - Automatic file download
// - Toast notifications on success/error
// - Base64 encoding for binary formats
```

#### Conflict Resolutions (AI-Powered)
```tsx
import { ConflictResolutions } from "@/components/reports/ConflictResolutions";

<ConflictResolutions
  conflictId="conflict-123"
  resolutions={[
    {
      id: "res-1",
      conflictId: "conflict-123",
      strategy: "Contact Available Staff",
      description: "Reach out to staff members who are available",
      steps: ["Step 1", "Step 2", "Step 3"],
      difficulty: "easy",
      estimatedTime: "15 minutes",
      pros: ["Quick fix", "No disruptions"],
      cons: ["May need incentives"],
      confidence: 85,
      affectedStaff: [{ name: "John Doe", action: "Contact" }],
      requiresApproval: false,
    },
  ]}
  onResolutionApplied={() => console.log("Applied")}
/>
```

#### Conflicts List with AI
```tsx
import { ConflictsList } from "@/components/reports/ConflictsList";

<ConflictsList
  conflicts={[
    {
      id: "conflict-1",
      type: "understaffing",
      severity: "critical",
      date: "2024-11-20",
      dayOfWeek: "Wednesday",
      title: "Critical Understaffing",
      description: "Only 1 of 8 staff available",
      venues: ["Downtown", "Uptown"],
      details: { totalStaff: 8, availableStaff: 1 },
      resolutions: [...], // Optional: Pre-generated AI resolutions
    },
  ]}
  title="Detected Conflicts"
  description="Found 5 conflicts in the selected period"
/>
```

---

## 🔧 Common Patterns

### Server Action Pattern

```typescript
"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";

export async function getReportData(filters: Filters) {
  // 1. Authenticate and authorize
  const user = await requireAuth();
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "Unauthorized" };
  }

  // 2. Get venue-filtered users
  const sharedVenueUserIds = await getSharedVenueUsers(user.id);

  // 3. Build query with filters
  const where = {
    active: true,
    id: { in: sharedVenueUserIds },
    // Add more filters...
  };

  // 4. Fetch data
  const data = await prisma.user.findMany({ where, include: {...} });

  // 5. Transform and return
  return {
    success: true,
    data: transformData(data),
  };
}
```

### Client Component Pattern

```tsx
"use client";

import { useState, useEffect } from "react";
import { getReportData } from "@/lib/actions/reports/availability-reports";
import { toast } from "sonner";

export function ReportComponent({ initialData }: Props) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const result = await getReportData(filters);
      if (result.success) {
        setData(result.data);
      } else {
        toast.error(result.error || "Failed to load data");
      }
    } catch (error) {
      console.error(error);
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  return (
    <div>
      <ReportFilters onApplyFilters={setFilters} />
      {loading ? <LoadingSpinner /> : <DataDisplay data={data} />}
    </div>
  );
}
```

### Page Pattern (Server Component + Client)

```tsx
// src/app/admin/reports/example/page.tsx
import { ReportPageClient } from "./report-page-client";
import { getInitialData } from "@/lib/actions/reports/availability-reports";

export default async function ReportPage() {
  const initialData = await getInitialData();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Report Title</h1>
        <p className="text-muted-foreground">Description</p>
      </div>

      <ReportPageClient initialData={initialData} />
    </div>
  );
}
```

---

## 📊 Data Transformation Patterns

### Compute Effective Availability

```typescript
import { eachDayOfInterval, getDay, isWithinInterval } from "date-fns";

function computeEffectiveAvailability(
  user: User & { availability: Availability[], timeOffRequests: TimeOffRequest[] },
  startDate: Date,
  endDate: Date
) {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  return dates.map(date => {
    const dayOfWeek = getDay(date); // 0-6

    // Get recurring availability
    const recurring = user.availability.find(a => a.dayOfWeek === dayOfWeek);

    // Check time-off override
    const timeOff = user.timeOffRequests.find(to =>
      to.status === "APPROVED" &&
      isWithinInterval(date, { start: to.startDate, end: to.endDate })
    );

    // Time-off overrides recurring availability
    if (timeOff) {
      return {
        date: date.toISOString(),
        available: false,
        reason: "Time Off",
        timeOffId: timeOff.id,
      };
    }

    // Not available if no recurring schedule
    if (!recurring || !recurring.isAvailable) {
      return {
        date: date.toISOString(),
        available: false,
        reason: "Not Available",
      };
    }

    // Available
    return {
      date: date.toISOString(),
      available: true,
      isAllDay: recurring.isAllDay,
      startTime: recurring.startTime,
      endTime: recurring.endTime,
    };
  });
}
```

### Time Slot Overlap Check

```typescript
function checkTimeSlotOverlap(
  availStart: string, // "09:00"
  availEnd: string,   // "17:00"
  filterStart: string,
  filterEnd: string
): boolean {
  // Convert to minutes for easier comparison
  const toMinutes = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const as = toMinutes(availStart);
  const ae = toMinutes(availEnd);
  const fs = toMinutes(filterStart);
  const fe = toMinutes(filterEnd);

  // Check overlap: start before filter end AND end after filter start
  return as < fe && ae > fs;
}
```

---

## 🎨 Styling Reference

### Color Classes

```css
/* Available (Green) */
.bg-green-50 .text-green-700 .border-green-200

/* Unavailable (Red) */
.bg-red-50 .text-red-700 .border-red-200

/* Time-Off (Yellow) */
.bg-yellow-50 .text-yellow-700 .border-yellow-200

/* Unscheduled (Gray) */
.bg-gray-50 .text-gray-700 .border-gray-200

/* AI Suggestions (Blue) */
.bg-blue-50 .text-blue-700 .border-blue-200

/* Critical Severity */
.bg-red-100 .text-red-900 .border-red-300

/* Warning Severity */
.bg-yellow-100 .text-yellow-900 .border-yellow-300

/* Info Severity */
.bg-blue-100 .text-blue-900 .border-blue-300
```

### Common Layouts

**Stats Cards Grid:**
```tsx
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>
```

**Two-Column Layout:**
```tsx
<div className="grid gap-6 lg:grid-cols-[300px_1fr]">
  <aside className="space-y-4">
    {/* Filters */}
  </aside>
  <main className="space-y-6">
    {/* Content */}
  </main>
</div>
```

**Responsive Container:**
```tsx
<div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
  {/* Content */}
</div>
```

---

## 🤖 AI Integration Patterns

### Parse Natural Language Query

```typescript
import { parseNaturalLanguageQuery } from "@/lib/actions/ai/query-parser";

const result = await parseNaturalLanguageQuery(
  "Who is available next Tuesday between 2pm and 6pm?"
);

if (result.success) {
  const { reportType, filters, summary } = result.intent;
  // Use filters to fetch data
}
```

### Generate Scheduling Suggestions

```typescript
import { generateSchedulingSuggestions } from "@/lib/actions/ai/suggestions";

const result = await generateSchedulingSuggestions({
  dateRange: { start: new Date("2024-11-15"), end: new Date("2024-11-21") },
  venueId: "venue-123",
  requiredStaffing: 5,
  constraints: {
    fairDistribution: true,
    preferredStaff: ["user-1", "user-2"],
  },
});

if (result.success) {
  const { suggestions, summary } = result;
  // Display suggestions to user
}
```

### Generate Conflict Resolutions (AI-Powered)

```typescript
import { generateConflictResolutions } from "@/lib/actions/ai/conflict-detection";

// Conflict object from conflicts report
const conflict = {
  id: "conflict-123",
  type: "understaffing",
  severity: "critical",
  date: "2024-11-20",
  dayOfWeek: "Wednesday",
  title: "Critical Understaffing",
  description: "Only 1 of 8 staff available (12%)",
  details: {
    totalStaff: 8,
    availableStaff: 1,
    coveragePercentage: 12,
    unavailableStaff: [...],
  },
};

// Generate AI resolutions
const result = await generateConflictResolutions(conflict);

if (result.success) {
  const resolutions = result.resolutions;
  // Each resolution includes:
  // - strategy: string
  // - description: string
  // - steps: string[] (3-5 actionable steps)
  // - difficulty: "easy" | "medium" | "hard"
  // - estimatedTime: string
  // - pros: string[]
  // - cons: string[]
  // - confidence: number (0-100)
  // - affectedStaff: Array<{name, action}>
  // - requiresApproval: boolean
}
```

### Apply Conflict Resolution

```typescript
import { applyConflictResolution } from "@/lib/actions/ai/conflict-detection";

// Apply a resolution (placeholder - will integrate with scheduling system)
const result = await applyConflictResolution(resolutionId, conflictId);

if (result.success) {
  toast.success(result.message);
  // Resolution noted, manual follow-up required
}
```

### Auto-Generate Resolutions in Report

```typescript
import { getConflictsReport } from "@/lib/actions/reports/availability-reports";

// Auto-generate AI resolutions for top 3 critical/warning conflicts
const result = await getConflictsReport({
  startDate: new Date("2024-11-15"),
  endDate: new Date("2024-11-21"),
  venueId: "venue-123",
  severityLevel: "all",
  includeAIResolutions: true, // Enable auto-generation
});

if (result.success) {
  const { conflicts } = result.data;
  // Top 3 critical/warning conflicts will have resolutions[] property
  conflicts.forEach(conflict => {
    if (conflict.resolutions) {
      console.log(`${conflict.resolutions.length} AI strategies generated`);
    }
  });
}
```

---

## 📤 Export Patterns

### Export to CSV

```typescript
import { exportToCSV } from "@/lib/actions/reports/export";

const csvData = await exportToCSV(reportData, "matrix");
// Download or display CSV
```

### Export to Excel

```typescript
import { exportToExcel } from "@/lib/actions/reports/export";

const excelBlob = await exportToExcel(reportData, "coverage");
// Trigger download
const url = URL.createObjectURL(excelBlob);
const a = document.createElement("a");
a.href = url;
a.download = "coverage-report.xlsx";
a.click();
```

### Export to PDF

```typescript
import { exportToPDF } from "@/lib/actions/reports/export";

const pdfBlob = await exportToPDF(reportData, "matrix");
// Trigger download or print
```

### Export to iCal

```typescript
import { exportToICal } from "@/lib/actions/reports/export";

const icalData = await exportToICal(availabilityData);
// Trigger download
const blob = new Blob([icalData], { type: "text/calendar" });
const url = URL.createObjectURL(blob);
const a = document.createElement("a");
a.href = url;
a.download = "availability.ics";
a.click();
```

---

## 🔒 Permission Checks

### Check Report Access

```typescript
import { canAccess } from "@/lib/rbac/access";

// Check if user can view team reports
const hasAccess = await canAccess("reports", "view_team");

// Check if user can export reports
const canExport = await canAccess("reports", "export_team");

// Check if user can access AI features
const canUseAI = await canAccess("reports", "view_ai");
```

### Venue Filtering

```typescript
import { getSharedVenueUsers } from "@/lib/utils/venue";

// Get user IDs in shared venues (venue-scoped for managers, all for admins)
const userIds = await getSharedVenueUsers(currentUserId);

// Use in query
const users = await prisma.user.findMany({
  where: { id: { in: userIds } },
});
```

---

## 🐛 Troubleshooting

### Issue: Reports Load Slowly

**Solution:**
1. Check if caching is enabled
2. Add database indexes for commonly filtered fields
3. Reduce date range for large queries
4. Enable pagination for large result sets

```typescript
// Add index in Prisma schema
@@index([userId, dayOfWeek])
@@index([startDate, endDate])
```

### Issue: Matrix Grid Not Displaying

**Solution:**
1. Verify data structure matches expected format
2. Check console for errors
3. Ensure dates are ISO strings
4. Verify user IDs exist in matrix object

```typescript
// Expected structure
{
  users: [{ id: "user-1", name: "John Doe", ... }],
  dates: ["2024-11-15T00:00:00.000Z", ...],
  matrix: {
    "user-1": {
      "2024-11-15T00:00:00.000Z": { available: true, ... },
    },
  },
}
```

### Issue: Filters Not Applying

**Solution:**
1. Check if filter state is updated correctly
2. Verify server action receives filters
3. Check network tab for correct payload
4. Ensure loading state shows while fetching

```typescript
// Debug filter flow
console.log("Filters changed:", filters);
console.log("Calling server action with:", filters);
const result = await getReportData(filters);
console.log("Server response:", result);
```

### Issue: AI Queries Failing

**Solution:**
1. Check OPENAI_API_KEY is set in environment
2. Verify API rate limits not exceeded
3. Check query format and error messages
4. Test with simpler queries first

```bash
# Check environment variable
echo $OPENAI_API_KEY

# Test API connectivity
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Issue: Exports Not Downloading

**Solution:**
1. Check browser console for errors
2. Verify blob creation successful
3. Check file size not too large
4. Try different export format

```typescript
// Debug export
try {
  const blob = await exportToExcel(data, "matrix");
  console.log("Blob created:", blob.size, "bytes");
  console.log("Blob type:", blob.type);

  if (blob.size === 0) {
    console.error("Empty blob generated");
  }

  // Try manual download
  const url = URL.createObjectURL(blob);
  console.log("Download URL:", url);
  window.open(url);
} catch (error) {
  console.error("Export error:", error);
}
```

### Issue: Permission Denied

**Solution:**
1. Verify user role has correct permissions
2. Check permission seeding ran successfully
3. Test with admin account
4. Review RBAC logs

```sql
-- Check user permissions
SELECT u.email, r.name AS role, p.resource, p.action
FROM "User" u
JOIN "Role" r ON u."roleId" = r.id
JOIN "RolePermission" rp ON r.id = rp."roleId"
JOIN "Permission" p ON rp."permissionId" = p.id
WHERE u.email = 'user@example.com'
  AND p.resource = 'reports';
```

### Issue: Charts Not Rendering

**Solution:**
1. Verify recharts installed correctly
2. Check data format matches chart requirements
3. Ensure parent container has defined height
4. Check for console warnings

```tsx
// Charts need explicit height
<div className="h-[400px]">
  <ResponsiveContainer width="100%" height="100%">
    <BarChart data={chartData}>
      {/* ... */}
    </BarChart>
  </ResponsiveContainer>
</div>
```

---

## 🧪 Testing Snippets

### Test Server Action

```typescript
// __tests__/reports/availability-reports.test.ts
import { getAvailabilityMatrix } from "@/lib/actions/reports/availability-reports";

test("getAvailabilityMatrix returns correct structure", async () => {
  const result = await getAvailabilityMatrix({
    startDate: new Date("2024-11-15"),
    endDate: new Date("2024-11-21"),
  });

  expect(result.success).toBe(true);
  expect(result.users).toBeInstanceOf(Array);
  expect(result.dates).toBeInstanceOf(Array);
  expect(result.matrix).toBeInstanceOf(Object);
});
```

### Test Component

```tsx
// __tests__/components/AvailabilityMatrixGrid.test.tsx
import { render, screen } from "@testing-library/react";
import { AvailabilityMatrixGrid } from "@/components/reports/AvailabilityMatrixGrid";

test("renders matrix grid with data", () => {
  const mockData = {
    users: [{ id: "1", name: "John Doe", role: "Staff", venues: [] }],
    dates: ["2024-11-15T00:00:00.000Z"],
    matrix: { "1": { "2024-11-15T00:00:00.000Z": { available: true } } },
  };

  render(<AvailabilityMatrixGrid {...mockData} />);

  expect(screen.getByText("John Doe")).toBeInTheDocument();
});
```

---

## 📚 Useful Links

### Documentation
- [Next.js App Router](https://nextjs.org/docs/app)
- [Prisma Client](https://www.prisma.io/docs/concepts/components/prisma-client)
- [Recharts](https://recharts.org/en-US/)
- [React Day Picker](https://react-day-picker.js.org/)
- [TanStack Table](https://tanstack.com/table/latest)
- [OpenAI API](https://platform.openai.com/docs/)

### Related Files
- **Main Plan:** `ProjectPlan/ReportingSystemPlan.md`
- **Progress Tracker:** `ProjectPlan/ReportingSystemProgress.md`
- **Availability Actions:** `src/lib/actions/availability.ts`
- **Time-Off Actions:** `src/lib/actions/time-off.ts`
- **RBAC Utilities:** `src/lib/rbac/access.ts`

---

**Last Updated:** November 12, 2025
**Maintained By:** Development Team

**Recent Additions:**
- AI-Powered Conflict Resolution (Day 12)
- ConflictResolutions component
- Auto-generation toggle for conflicts report
- Dual mode resolution generation (auto + manual)
