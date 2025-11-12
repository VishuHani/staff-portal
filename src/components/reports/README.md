# Reports System Components

This directory contains all reusable components for the staff portal reporting system.

## Overview

The reporting system provides comprehensive workforce analytics with AI-powered insights, multi-format exports, and advanced filtering capabilities.

## Core Components

### Availability & Coverage

- **`AvailabilityMatrixGrid.tsx`** - Interactive grid displaying staff availability across dates
  - Color-coded availability status (available, unavailable, time-off)
  - Clickable cells for detailed day view
  - Responsive grid layout with date headers

- **`CoverageChart.tsx`** - Line chart showing coverage percentages over time
  - Built with Recharts library
  - Interactive tooltips with detailed metrics
  - Color-coded coverage levels (green >70%, yellow 50-70%, orange 30-50%, red <30%)

- **`CoverageHeatmap.tsx`** - Calendar heatmap visualization
  - Weekly view with day-of-week patterns
  - Color intensity based on coverage percentage
  - Quick visual identification of coverage gaps

### Conflicts & AI

- **`ConflictsList.tsx`** - Displays scheduling conflicts with severity levels
  - Critical, Warning, and Info severity badges
  - Expandable conflict details with affected staff
  - "Get AI Resolutions" button for on-demand AI suggestions
  - Auto-generated resolutions for top 3 critical/warning conflicts

- **`ConflictResolutions.tsx`** - AI-generated conflict resolution strategies
  - Gradient card UI with difficulty badges (easy/medium/hard)
  - Confidence scores with progress bars
  - Detailed steps, pros/cons, estimated time
  - Affected staff list with recommended actions
  - Apply and Dismiss actions (placeholders for future implementation)

### Smart Suggestions

- **`SmartSuggestions.tsx`** - AI-powered scheduling recommendations
  - Suggests available staff for specific dates
  - Filters by role and venue compatibility
  - Shows availability hours and confidence scores
  - Reasons for each suggestion (high availability, right role, venue match)
  - Interactive suggestion cards with user actions

### Filtering & Navigation

- **`ReportFilters.tsx`** - Advanced filtering component (427 lines)
  - Multi-select for venues and roles (using Command + Popover)
  - Date range picker with calendar UI
  - Quick filter buttons (Today, This Week, Next Week, This Month)
  - Time slot filtering for specific hours
  - Search query input
  - Severity level filter for conflicts
  - Active filter badges with individual removal
  - localStorage persistence for user preferences
  - "Clear All" functionality

- **`DateRangePicker.tsx`** - Calendar-based date range selector
  - Built with shadcn/ui Calendar component
  - Preset ranges (Today, Yesterday, Last 7 days, Last 30 days, etc.)
  - Custom range selection
  - Popover UI with apply/cancel actions

### Data Display

- **`ReportSummaryCards.tsx`** - Key metrics display
  - Grid layout of summary statistics
  - Icon-based visual indicators
  - Trend indicators (up/down arrows)
  - Color-coded values based on thresholds

- **`DayDetailsModal.tsx`** - Detailed view for a specific date
  - Modal dialog with staff availability breakdown
  - Lists available/unavailable staff
  - Shows time-off reasons and time slots
  - Venue assignments
  - Close and action buttons

### Export & Sharing

- **`ExportButton.tsx`** - Multi-format export dropdown (150 lines)
  - Dropdown menu with 4 export formats:
    - CSV (UTF-8 with BOM, proper escaping)
    - Excel (XLSX with formatted sheets)
    - PDF (landscape A4 with tables)
    - iCal (RFC 5545 compliant calendar events)
  - Format-specific icons (FileText, FileSpreadsheet, FileType, Calendar)
  - Loading states during export generation
  - Automatic file download with proper MIME types
  - Base64 decoding for binary formats (Excel, PDF)

## UI Components (shadcn/ui)

These are reusable UI primitives used throughout the reporting system:

- **`calendar.tsx`** - Date picker calendar component
- **`skeleton.tsx`** - Loading state placeholders
- **`table.tsx`** - Data table with sorting and pagination
- **`tooltip.tsx`** - Hover tooltips for additional context
- **`multi-select.tsx`** - Multi-select dropdown with search and badges

## Data Flow

1. **Report Pages** (`/src/app/admin/reports/*`) fetch data using Server Actions
2. **Server Actions** (`/src/lib/actions/reports/*`) query database via Prisma
3. **Client Components** receive data and render visualizations
4. **User Interactions** (filters, exports, AI queries) trigger server actions
5. **AI Services** (OpenAI GPT-4) generate insights and resolutions

## Key Features

### Advanced Filtering
- Multi-select dropdowns for venues and roles
- Date range selection with presets
- Quick filter buttons for common ranges
- Persistent filters saved to localStorage
- Active filter badges with individual removal
- Real-time filter application

### Multi-Format Export
- CSV: UTF-8 with BOM for Excel compatibility
- Excel: Formatted XLSX workbooks with headers
- PDF: Professional A4 landscape layouts
- iCal: Calendar events for external apps
- Server-side generation for large datasets
- Automatic file download with proper naming

### AI-Powered Insights
- **Conflict Resolution**: GPT-4 analyzes scheduling conflicts and suggests actionable solutions
- **Smart Suggestions**: Recommends available staff based on availability, role, and venue
- **Context-Aware**: Considers time-off, business rules, and historical patterns
- **Fallback Logic**: Rule-based resolutions if AI unavailable
- **Confidence Scoring**: 0-100 scale for suggestion reliability

### Real-Time Updates
- Optimistic UI updates
- Toast notifications for actions
- Loading skeletons during data fetch
- Error boundaries for graceful failures

## Permissions

All report components respect role-based access control (RBAC):

- **View Reports**: `reports:view_team` or `reports:view_all`
- **Export Data**: `reports:export_team` or `reports:export_all`
- **AI Features**: Requires view permissions
- **Venue Isolation**: Users only see data for their assigned venues (unless admin)

## Styling

- **Tailwind CSS**: Utility-first styling
- **shadcn/ui**: Consistent design system
- **Responsive Design**: Mobile-friendly layouts
- **Dark Mode**: Not yet implemented (future enhancement)
- **Color Coding**:
  - Green: Good coverage (>70%)
  - Yellow: Moderate coverage (50-70%)
  - Orange: Low coverage (30-50%)
  - Red: Critical coverage (<30%)

## Dependencies

- `react` - UI framework
- `react-hook-form` - Form state management
- `zod` - Schema validation
- `date-fns` - Date manipulation
- `recharts` - Chart visualizations
- `lucide-react` - Icon library
- `sonner` - Toast notifications
- `@ai-sdk/openai` - OpenAI integration
- `jspdf` + `jspdf-autotable` - PDF generation
- `xlsx` - Excel file generation
- `ical-generator` - iCal file generation

## Future Enhancements

- [ ] Error boundaries for each report component
- [ ] Tooltips for filter options
- [ ] Performance optimization (React.memo, useMemo)
- [ ] Real-time data refresh with polling
- [ ] PDF export customization options
- [ ] Email report scheduling
- [ ] Custom report templates
- [ ] Dark mode support
- [ ] Accessibility improvements (ARIA labels, keyboard navigation)

## Testing

See `/ProjectPlan/ReportingSystemTestingGuide.md` for comprehensive testing instructions.

## Related Documentation

- **Planning**: `/ProjectPlan/ReportingSystemPlan.md`
- **Quick Reference**: `/ProjectPlan/ReportingSystemQuickRef.md`
- **Testing Guide**: `/ProjectPlan/ReportingSystemTestingGuide.md`
- **Session Context**: `/SessionContext_Phase3_Days12-17.md`
- **Progress Tracking**: `/Progress.md`
