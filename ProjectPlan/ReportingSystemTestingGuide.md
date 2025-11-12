# Reporting System Testing Guide

**Version**: 1.0
**Last Updated**: 2025-11-12
**Phase 3 Implementation**: Days 1-16 Complete

---

## Table of Contents

1. [Quick Start Testing](#quick-start-testing)
2. [Feature Testing Checklist](#feature-testing-checklist)
3. [Report-Specific Tests](#report-specific-tests)
4. [Advanced Filtering Tests](#advanced-filtering-tests)
5. [Export Functionality Tests](#export-functionality-tests)
6. [AI Features Tests](#ai-features-tests)
7. [Performance Testing](#performance-testing)
8. [Edge Cases & Error Handling](#edge-cases--error-handling)
9. [Browser Compatibility](#browser-compatibility)
10. [Accessibility Testing](#accessibility-testing)

---

## Quick Start Testing

### Prerequisites
- Admin account with `reports:view_team` permission
- At least 2 active venues in the system
- At least 3 roles configured
- Sample staff with availability data
- Time-off requests (approved and pending)

### Access Reports
1. Login as admin
2. Navigate to `/admin/reports`
3. Verify all 5 report cards are visible:
   - Availability Matrix
   - Coverage Analysis
   - Conflicts Report
   - Calendar View
   - AI Chat Interface

---

## Feature Testing Checklist

### Core Filtering (All Reports)

#### Multi-Select Venues
- [ ] Can select multiple venues
- [ ] Selected venues appear as badges in filter button
- [ ] Shows count: "Venues (X selected)"
- [ ] Can remove individual venue by clicking X on badge
- [ ] Filter applies correctly when "Apply Filters" clicked
- [ ] Active venue filters show in badges section
- [ ] Can clear all venue selections

#### Multi-Select Roles
- [ ] Can select multiple roles
- [ ] Selected roles appear as badges in filter button
- [ ] Shows count: "Roles (X selected)"
- [ ] Can remove individual role by clicking X on badge
- [ ] Filter applies correctly when "Apply Filters" clicked
- [ ] Active role filters show in badges section
- [ ] Can clear all role selections

#### Quick Date Filters
- [ ] "Today" button sets date range to today only
- [ ] "This Week" button sets Monday-Sunday of current week
- [ ] "Next Week" button sets next week's range
- [ ] "This Month" button sets full current month
- [ ] Date picker updates when quick filter clicked
- [ ] Can still use custom date range after quick filter

#### Filter Persistence
- [ ] Apply filters and refresh page - filters are restored
- [ ] Filters persist in localStorage (check DevTools)
- [ ] Clear button removes saved filters
- [ ] Date range is NOT persisted (expected behavior)
- [ ] Navigate to different report - filters are loaded

#### Active Filter Badges
- [ ] All active filters display as badges
- [ ] Venue badges show venue names (not IDs)
- [ ] Role badges show role names (not IDs)
- [ ] Search query shows in badge
- [ ] Time slots show as "Time: HH:MM - HH:MM"
- [ ] Severity shows as "Severity: level"
- [ ] Can click X on any badge to remove that filter
- [ ] Removing badge updates report immediately

---

## Report-Specific Tests

### 1. Availability Matrix

**URL**: `/admin/reports/availability-matrix`

#### Basic Functionality
- [ ] Matrix loads with default date range (current week)
- [ ] Staff names appear in left column
- [ ] Dates appear as column headers
- [ ] Cells show availability status (available/unavailable/partial)
- [ ] Green = available, Red = unavailable, Yellow = partial

#### Filtering
- [ ] Filter by single venue - only staff from that venue shown
- [ ] Filter by multiple venues - staff from selected venues shown
- [ ] Filter by single role - only staff with that role shown
- [ ] Filter by multiple roles - staff with selected roles shown
- [ ] Time slot filter - shows staff available during time range
- [ ] Search by name - filters staff list correctly
- [ ] Combine filters - all filters work together

#### Export
- [ ] Export as CSV - downloads file, opens in Excel correctly
- [ ] Export as Excel - multi-sheet workbook with formatting
- [ ] Export as PDF - readable table layout, landscape orientation
- [ ] Export as iCal - opens in calendar app, events correct
- [ ] Export includes filtered data only (not all data)
- [ ] Filename includes date and report type

---

### 2. Coverage Analysis

**URL**: `/admin/reports/coverage`

#### Summary Cards
- [ ] Total Staff count is accurate
- [ ] Available Staff count is correct
- [ ] Average Coverage % is calculated correctly
- [ ] Peak Coverage shows maximum availability

#### Daily Coverage Chart
- [ ] Chart displays for selected date range
- [ ] Bars show available staff per day
- [ ] Hover shows exact numbers
- [ ] X-axis shows dates
- [ ] Y-axis shows staff count

#### Coverage Heatmap
- [ ] Heatmap shows days × hours grid
- [ ] Color intensity indicates coverage level
- [ ] Darker = more staff available
- [ ] Hover shows count for that hour
- [ ] All days in range are shown

#### Filtering
- [ ] Venue filter affects all visualizations
- [ ] Role filter affects all visualizations
- [ ] Date range changes update all charts
- [ ] Summary cards update with filters

#### Export
- [ ] CSV export includes summary stats and daily data
- [ ] Excel export has separate sheets for stats and coverage
- [ ] PDF export includes summary and chart (if possible)

---

### 3. Conflicts Report

**URL**: `/admin/reports/conflicts`

#### AI Auto-Generation Toggle
- [ ] Toggle is visible and enabled by default
- [ ] Icon shows sparkle (AI indicator)
- [ ] Description text explains feature
- [ ] Toggling off disables auto AI resolution
- [ ] Toggling on enables auto AI resolution

#### Summary Cards
- [ ] Total Conflicts count is accurate
- [ ] Critical count shows red badge
- [ ] Warning count shows orange badge
- [ ] Info count shows blue badge

#### Conflict Breakdown
- [ ] Shows counts by type: understaffing, no availability, etc.
- [ ] Counts match conflict list

#### Conflicts List
- [ ] Each conflict shows severity badge (critical/warning/info)
- [ ] Shows venue name
- [ ] Shows date and description
- [ ] Affected staff listed
- [ ] "Get AI Resolutions" button visible

#### AI Conflict Resolutions
- [ ] Auto-generates for critical/warning conflicts (if toggle on)
- [ ] Manual button generates resolutions on demand
- [ ] Shows 2-4 resolution strategies
- [ ] Each strategy has: name, description, steps, difficulty
- [ ] Shows pros/cons for each strategy
- [ ] Confidence score displayed as progress bar
- [ ] Affected staff listed with actions
- [ ] "Apply" and "Dismiss" buttons visible

#### Filtering
- [ ] Severity filter: "Critical Only" shows only critical conflicts
- [ ] Severity filter: "Warning Only" shows only warnings
- [ ] Severity filter: "Info Only" shows only info
- [ ] Venue filter shows conflicts for selected venues
- [ ] Role filter shows conflicts involving selected roles
- [ ] Date range affects which conflicts are shown

#### Export
- [ ] CSV includes conflict details and AI resolutions (if generated)
- [ ] Excel has sheets for conflicts and resolutions
- [ ] PDF shows conflicts with severity badges

---

### 4. Calendar View

**URL**: `/admin/reports/calendar`

#### Calendar Display
- [ ] Shows current month by default
- [ ] 7×5 or 7×6 grid (depending on month)
- [ ] Weekday headers visible (Sun-Sat)
- [ ] Today's date highlighted with blue border
- [ ] Days outside current month are dimmed

#### Coverage Indicators
- [ ] Each day shows "X/Y" (available/total)
- [ ] Shows "X% coverage"
- [ ] Color coding: Green (70%+), Yellow (50-70%), Orange (30-50%), Red (<30%)
- [ ] Days with no data show as gray

#### Navigation
- [ ] "Today" button returns to current month
- [ ] Left arrow goes to previous month
- [ ] Right arrow goes to next month
- [ ] Month/year title updates correctly

#### Day Details Modal
- [ ] Clicking a day opens modal
- [ ] Modal shows staff list for that day
- [ ] Shows available/unavailable status per staff member
- [ ] Can close modal with X button or outside click

#### Filtering
- [ ] Venue filter affects coverage calculations
- [ ] Role filter affects which staff are counted
- [ ] Filters persist when navigating months

#### Export
- [ ] CSV includes daily coverage summary
- [ ] Excel has calendar format with coverage data
- [ ] iCal includes availability events
- [ ] PDF shows month grid with coverage indicators

---

## Advanced Filtering Tests

### Multi-Select Behavior
- [ ] Selecting no venues = all venues (no filter)
- [ ] Selecting all venues = same as no filter
- [ ] Selecting some venues = only those venues
- [ ] Same logic applies to roles
- [ ] Can select venues, then add more
- [ ] Can select roles, then add more

### Filter Combinations
- [ ] Venue + Role filters work together (AND logic)
- [ ] Venue + Date Range works correctly
- [ ] Role + Time Slot works correctly
- [ ] Venue + Role + Date + Search = complex filter works
- [ ] Removing one filter leaves others active

### Filter Persistence Edge Cases
- [ ] Filters survive browser refresh
- [ ] Filters survive page navigation within reports
- [ ] Filters DON'T interfere between different admins (different localStorage)
- [ ] Clearing filters removes from localStorage
- [ ] Invalid saved data doesn't crash (graceful fallback)

### Quick Filter Edge Cases
- [ ] Quick filters work at year boundaries (Dec 31, Jan 1)
- [ ] "This Week" uses Monday as week start
- [ ] "This Month" includes all days of current month
- [ ] Quick filters don't conflict with manual date selection

---

## Export Functionality Tests

### Export Formats

#### CSV Export
- [ ] Proper UTF-8 encoding (special characters display correctly)
- [ ] Double-quotes escaped correctly
- [ ] Commas in data don't break columns
- [ ] Date format is consistent (MMM dd, yyyy)
- [ ] Opens correctly in Excel
- [ ] Opens correctly in Google Sheets

#### Excel Export
- [ ] Multi-sheet workbook (Summary, Data, etc.)
- [ ] Column widths auto-adjusted
- [ ] Headers are bold
- [ ] No formatting issues
- [ ] Opens in Excel without errors
- [ ] Opens in LibreOffice Calc

#### PDF Export
- [ ] Landscape orientation for wide tables
- [ ] Header includes report title and date
- [ ] Table fits on page (no cut-off)
- [ ] Page breaks work correctly
- [ ] Text is readable (font size appropriate)
- [ ] Opens in PDF reader without errors

#### iCal Export
- [ ] RFC 5545 compliant format
- [ ] Events have correct dates and times
- [ ] All-day events for full-day availability
- [ ] Time-range events for partial availability
- [ ] Venue name in location field
- [ ] Opens in Google Calendar
- [ ] Opens in Outlook
- [ ] Opens in Apple Calendar

### Export Edge Cases
- [ ] Export with no data shows appropriate message
- [ ] Export with large dataset (1000+ rows) completes
- [ ] Export with special characters works
- [ ] Multiple rapid exports don't cause issues
- [ ] Export during loading doesn't crash

---

## AI Features Tests

### AI Conflict Resolution Generation

#### Basic Generation
- [ ] Click "Get AI Resolutions" generates strategies
- [ ] Loading spinner shows during generation
- [ ] Success toast appears when complete
- [ ] Resolutions display in cards below conflict

#### Resolution Quality
- [ ] Strategies are relevant to the conflict type
- [ ] Steps are actionable and specific
- [ ] Difficulty assessment seems accurate (easy/medium/hard)
- [ ] Time estimates are reasonable
- [ ] Pros/cons are balanced and helpful
- [ ] Confidence score reflects strategy quality

#### Auto-Generation
- [ ] Top 3 critical/warning conflicts get resolutions automatically
- [ ] Only top 3 (not all conflicts)
- [ ] Loading indicators show for each conflict
- [ ] Errors on one conflict don't stop others

#### Fallback Behavior
- [ ] If OpenAI fails, rule-based resolutions are shown
- [ ] Fallback strategies are reasonable
- [ ] User sees resolutions even if AI unavailable
- [ ] Error toast appears but doesn't block usage

### AI Query Parser (if implemented)
- [ ] Natural language queries work: "Who is available next Tuesday?"
- [ ] Extracts date correctly from query
- [ ] Extracts venue if mentioned
- [ ] Extracts role if mentioned
- [ ] Shows parsed filters to user
- [ ] Applies filters and shows results

---

## Performance Testing

### Load Times
- [ ] Initial page load < 3 seconds
- [ ] Filter application < 1 second
- [ ] Matrix with 50 staff × 30 days loads < 2 seconds
- [ ] Chart rendering < 1 second
- [ ] Export generation < 5 seconds

### Data Fetching
- [ ] Venues and roles fetched in parallel (Promise.all)
- [ ] No unnecessary re-fetching on filter change
- [ ] Cached data used when appropriate
- [ ] Loading states show during fetch

### UI Responsiveness
- [ ] Filter dropdowns open immediately
- [ ] Multi-select is responsive with 50+ options
- [ ] Scrolling is smooth in lists
- [ ] Buttons respond instantly to clicks
- [ ] No lag when typing in search box

### Memory Usage
- [ ] No memory leaks when navigating between reports
- [ ] localStorage size stays reasonable (< 5MB)
- [ ] Large exports don't crash browser

---

## Edge Cases & Error Handling

### No Data Scenarios
- [ ] No staff: Shows appropriate message
- [ ] No availability: Shows empty state with helpful text
- [ ] No venues: Graceful handling or appropriate error
- [ ] No roles: Shows all staff regardless

### Invalid Data
- [ ] Invalid date range: Validation prevents submission
- [ ] End date before start date: Validation error shown
- [ ] Very large date range (> 1 year): Warning or limitation
- [ ] Missing required fields: Clear error messages

### Network Errors
- [ ] API failure: Error toast shown, doesn't crash
- [ ] Timeout: Appropriate error message
- [ ] Retry mechanism works if implemented
- [ ] Offline: Graceful degradation

### Permission Errors
- [ ] User without `reports:view_team`: Redirected or blocked
- [ ] User can't export without `reports:export_team`: Export button hidden
- [ ] Permission checks happen server-side (security)

### Concurrent Users
- [ ] Multiple admins can use reports simultaneously
- [ ] Each user's filters are independent
- [ ] No data collision in exports
- [ ] Real-time updates if implemented

---

## Browser Compatibility

### Desktop Browsers
- [ ] Chrome (latest): Full functionality
- [ ] Firefox (latest): Full functionality
- [ ] Safari (latest): Full functionality
- [ ] Edge (latest): Full functionality

### Mobile Browsers
- [ ] Mobile Chrome: Responsive layout works
- [ ] Mobile Safari: Touch interactions work
- [ ] Filters usable on mobile
- [ ] Exports work on mobile
- [ ] Calendar view usable on mobile

### Responsive Design
- [ ] Desktop (1920×1080): Full layout
- [ ] Laptop (1366×768): Good layout
- [ ] Tablet (768×1024): Responsive, usable
- [ ] Mobile (375×667): Single column, scrollable

---

## Accessibility Testing

### Keyboard Navigation
- [ ] Can tab through all interactive elements
- [ ] Filter dropdowns accessible via keyboard
- [ ] Multi-select works with keyboard (Arrow keys, Space, Enter)
- [ ] Export buttons accessible via keyboard
- [ ] Modal dialogs can be closed with Escape
- [ ] No keyboard traps

### Screen Reader
- [ ] Page structure is logical (H1, H2, etc.)
- [ ] Filter labels are read correctly
- [ ] Buttons have descriptive labels
- [ ] Loading states announced
- [ ] Error messages announced
- [ ] Success toasts announced

### Visual Accessibility
- [ ] Color contrast meets WCAG AA standards
- [ ] Information not conveyed by color alone
- [ ] Text size is readable (minimum 14px)
- [ ] Icons have text alternatives
- [ ] Focus indicators visible on all interactive elements

### ARIA Attributes
- [ ] `aria-label` on icon-only buttons
- [ ] `aria-live` regions for dynamic updates
- [ ] `role` attributes where appropriate
- [ ] `aria-expanded` on dropdowns
- [ ] `aria-selected` on multi-select items

---

## Test Data Setup

### Minimal Test Data
```
Venues: 2 (Venue A, Venue B)
Roles: 3 (Manager, Staff, Intern)
Staff: 10 (distributed across venues and roles)
Availability: 2 weeks of data
Time-off: 3 requests (1 approved, 1 pending, 1 rejected)
```

### Comprehensive Test Data
```
Venues: 5
Roles: 5
Staff: 50 (realistic distribution)
Availability: 60 days of data (past and future)
Time-off: 20 requests (various statuses)
Conflicts: 10+ (various types and severities)
```

### Edge Case Test Data
```
Staff with no availability submissions
Staff with conflicting time-off requests
Overlapping time-off for multiple staff
Days with zero coverage
Days with 100% coverage
Staff assigned to multiple venues
Staff with multiple roles
```

---

## Automated Testing Recommendations

### Unit Tests
- Server action functions (`getAvailabilityMatrix`, etc.)
- AI query parsing logic
- Date range calculations
- Filter combination logic
- Export format generators

### Integration Tests
- Filter → data fetch → display pipeline
- Export → download → file validation
- AI generation → display → apply resolution

### E2E Tests (Playwright/Cypress)
- Complete user flow: Login → Navigate → Filter → Export
- AI resolution generation flow
- Multi-select filter application
- Calendar navigation and day details

---

## Known Issues & Limitations

### Current Limitations
1. **AI Resolutions**: Requires OpenAI API key, costs money per request
2. **Export Size**: Very large datasets (5000+ rows) may timeout
3. **Date Range**: Recommend < 90 days for performance
4. **Concurrent Exports**: Rate-limited to prevent abuse
5. **Filter Persistence**: Date range intentionally not persisted

### Future Enhancements
- Real-time updates via WebSocket
- Export scheduling (generate offline, email when ready)
- Advanced analytics (trends, predictions)
- Custom report builder
- Saved filter presets (named favorites)

---

## Troubleshooting

### Common Issues

**Filters not applying**
- Check browser console for errors
- Verify filter values are selected
- Try clearing localStorage and re-applying

**Export failing**
- Check server logs for errors
- Verify user has `reports:export_team` permission
- Try smaller date range

**AI resolutions not generating**
- Check OpenAI API key is set in .env
- Verify API key has credits
- Check server logs for API errors
- Fallback to rule-based resolutions should still work

**Slow performance**
- Check date range (recommend < 30 days for large datasets)
- Verify database indexes exist
- Check server resources (CPU, memory)

---

## Success Criteria

✅ **Core Functionality**: All 4 report types load and display data correctly
✅ **Filtering**: Multi-select, quick filters, and persistence all work
✅ **Exports**: All 4 formats (CSV, Excel, PDF, iCal) download and open correctly
✅ **AI Features**: Conflict resolutions generate and display properly
✅ **Performance**: Pages load in < 3s, filters apply in < 1s
✅ **Accessibility**: Keyboard navigation and screen reader compatible
✅ **Error Handling**: Graceful failures, helpful error messages
✅ **Cross-Browser**: Works in Chrome, Firefox, Safari, Edge
✅ **Mobile**: Responsive and usable on mobile devices

---

## Test Report Template

```markdown
## Reporting System Test Report

**Date**: YYYY-MM-DD
**Tester**: [Name]
**Environment**: [Dev/Staging/Production]
**Browser**: [Chrome/Firefox/Safari/Edge] [Version]

### Tests Passed
- List features that worked correctly

### Tests Failed
- List features that failed with details

### Bugs Found
1. **Bug Title**: Description, steps to reproduce, expected vs actual

### Performance Notes
- Load times, responsiveness observations

### Recommendations
- Suggested improvements or fixes

### Sign-off
- [ ] Core functionality working
- [ ] Ready for production / Needs fixes
```

---

**Document Version**: 1.0
**Maintained By**: Development Team
**Review Schedule**: After each phase completion
