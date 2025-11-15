# Staff Portal Dashboard Redesign Plan

## Overview
Transform the current basic dashboard into a modern, role-specific analytics dashboard with interactive visualizations, AI-powered insights, and actionable quick actions.

## Design Philosophy (2025 Best Practices)
- **Focus on 5-7 key KPIs** per role (avoid information overload)
- **Interactive charts** using Recharts (React-native charting library)
- **Real-time data** with automatic updates
- **Mobile-first responsive** design
- **Data storytelling** approach with contextual insights
- **Minimalist UI** with smart use of white space
- **Role-specific views** tailored to each user's needs

---

## STAFF DASHBOARD REDESIGN

### Hero Section
**My Week at a Glance** - Horizontal calendar card showing next 7 days with:
- Color-coded availability status (green=available, gray=unavailable, yellow=partial, red=time-off)
- Mini bar chart showing hours available per day
- Quick "Set Availability" button

### KPI Cards (Grid of 4)
1. **Hours Available This Week** - Large number with trend indicator (↑↓ vs last week)
2. **Upcoming Time Off** - Count of approved days in next 30 days, next date highlighted
3. **Pending Requests** - Count with yellow alert badge if >0
4. **Unread Messages** - Count with link to messages

### Quick Actions (Functional Cards - 2x2 Grid)
1. **Update Availability** → Link to /availability with calendar icon
2. **Request Time Off** → Link to /time-off with plane icon
3. **View Messages** → Link to /messages with mail icon + unread count
4. **View Schedule** → Placeholder for future scheduling feature

### Recent Activity Feed
- Last 5 notifications/updates (time-off approvals, schedule changes, mentions)
- Scrollable list with timestamps
- "View All" link to /notifications

### Personal Stats Chart
**Availability Trends** - Line chart showing:
- X-axis: Last 4 weeks
- Y-axis: Hours available per week
- Smooth curve with gradient fill
- Tooltip on hover

---

## MANAGER DASHBOARD REDESIGN

### Hero Stats Bar (4 Metrics)
1. **Team Coverage Today** - Percentage with color coding (green >80%, yellow 60-80%, red <60%)
2. **Available Staff Now** - Count out of total active staff
3. **Pending Approvals** - Count with orange badge, clickable
4. **Upcoming Absences** - Next 7 days count

### Main Visualizations (2x2 Grid)

**1. Weekly Coverage Heatmap**
- 7 days × time slots grid
- Color intensity = staffing level (green=good, yellow=tight, red=understaffed)
- Interactive hover showing exact staff count
- Click to view detailed breakdown

**2. Team Availability Pie Chart**
- Segments: Available, Unavailable, On Leave, Partial
- Percentage labels
- Click to filter team view

**3. Time-Off Timeline (Next 30 Days)**
- Horizontal Gantt-style bars showing approved time-off
- Staff names on Y-axis, dates on X-axis
- Color-coded by type (vacation, sick, personal)
- Identify overlapping absences

**4. Coverage Trend Line Chart**
- X-axis: Last 8 weeks
- Y-axis: Average daily coverage percentage
- Target line at 80%
- Identify trends and patterns

### AI-Powered Insights Panel
- 3-5 smart suggestions from the suggestions service:
  - "Low coverage alert: Thursday needs 2 more staff"
  - "3 pending time-off requests need review"
  - "Scheduling conflict detected for next week"
- Each insight is actionable with a button (View Details, Resolve, Approve)

### Quick Actions (Functional)
1. **Review Requests** → /admin/time-off with pending filter
2. **View Full Coverage** → /admin/reports/coverage
3. **Check Conflicts** → /admin/reports/conflicts
4. **Manage Availability** → /admin/availability

### Team Snapshot Table
- Top 10 staff members
- Columns: Name, Status, Hours This Week, Next Time Off
- Sortable, with "View All" link

---

## ADMIN DASHBOARD REDESIGN

### Global Stats (5 Cards)
1. **Total Active Staff** - Count with trend vs last month
2. **Multi-Venue Coverage** - Average across all venues
3. **System Health** - Based on audit logs (API response times, error rate)
4. **Pending Actions** - All pending approvals + unresolved conflicts
5. **Active Users Today** - Login count from audit logs

### Cross-Venue Comparison Bar Chart
- X-axis: Venue names
- Y-axis: Coverage percentage
- Grouped bars: Today, This Week Average, This Month Average
- Identify underperforming locations

### System Activity Dashboard (2x2 Grid)

**1. User Activity Heatmap**
- Days of week × hours of day
- Color = login/action frequency
- Identify peak usage times

**2. Action Distribution Pie Chart**
- Segments: Logins, Availability Updates, Time-Off Requests, Approvals, Posts
- Based on audit logs
- Last 30 days

**3. Role Distribution Donut Chart**
- Inner ring: Role counts (Admin, Manager, Staff)
- Outer ring: Active vs Inactive
- Click to view user list

**4. Approval Turnaround Time**
- Line chart showing average days to approve time-off
- Target line at 2 days
- Last 12 weeks trend

### Recent Audit Log Feed
- Live feed of system actions (last 20)
- Filter by: All, Logins, Approvals, Changes
- User avatars, action descriptions, timestamps

### Admin Quick Actions
1. **Manage Users** → /admin/users
2. **Venue Management** → /admin/stores
3. **View Reports** → /admin/reports
4. **Audit Logs** → /admin/audit
5. **System Settings** → /admin/settings (future)

---

## TECHNICAL IMPLEMENTATION

### Phase 1: Infrastructure (Days 1-2)
1. Install Recharts library (`npm install recharts`)
2. Create reusable chart components:
   - `LineChart.tsx`, `BarChart.tsx`, `PieChart.tsx`, `HeatmapChart.tsx`, `DonutChart.tsx`
3. Create dashboard data fetching actions:
   - `src/lib/actions/dashboard/staff-dashboard.ts`
   - `src/lib/actions/dashboard/manager-dashboard.ts`
   - `src/lib/actions/dashboard/admin-dashboard.ts`
4. Set up real-time data hooks with SWR or React Query for auto-refresh

### Phase 2: Staff Dashboard (Days 3-4)
1. Create `src/components/dashboard/staff/` components:
   - `WeekAtGlance.tsx`
   - `StaffKPICards.tsx`
   - `QuickActions.tsx`
   - `RecentActivityFeed.tsx`
   - `PersonalStatsChart.tsx`
2. Update `src/app/dashboard/page.tsx` with role detection
3. Wire up data from existing actions

### Phase 3: Manager Dashboard (Days 5-7)
1. Create `src/components/dashboard/manager/` components:
   - `HeroStatsBar.tsx`
   - `CoverageHeatmap.tsx`
   - `TeamAvailabilityPie.tsx`
   - `TimeOffTimeline.tsx`
   - `CoverageTrendChart.tsx`
   - `AIInsightsPanel.tsx`
   - `TeamSnapshotTable.tsx`
2. Integrate with existing suggestions service
3. Add interactive filters and drill-downs

### Phase 4: Admin Dashboard (Days 8-10)
1. Create `src/components/dashboard/admin/` components:
   - `GlobalStatsCards.tsx`
   - `VenueComparisonChart.tsx`
   - `UserActivityHeatmap.tsx`
   - `ActionDistributionPie.tsx`
   - `RoleDistributionDonut.tsx`
   - `ApprovalTurnaroundChart.tsx`
   - `AuditLogFeed.tsx`
2. Wire up audit log queries with aggregations
3. Implement real-time activity feed

### Phase 5: Polish & Optimization (Days 11-12)
1. Add loading skeletons for all charts
2. Implement error boundaries
3. Mobile responsive testing and fixes
4. Add tooltips and help text
5. Performance optimization (memoization, lazy loading)
6. Dark mode support for charts
7. Export functionality for charts (PNG, PDF)

---

## DATA SOURCES (Already Available)

- **Availability**: `getMyAvailability()`, `getAllUsersAvailability()`, `getAvailabilityStats()`
- **Time-Off**: `getMyTimeOffRequests()`, `getAllTimeOffRequests()`, `getTimeOffStats()`
- **Reports**: `getCoverageReport()`, `getConflictsReport()`, `getTimeOffReport()`
- **Suggestions**: `getSchedulingSuggestions()`
- **Notifications**: `getUnreadCount()`, `getNotifications()`
- **Messages**: `getUnreadMessageCount()`
- **Audit**: `getAuditLogs()` (for admin activity tracking)
- **Users**: `getAllUsers()` (for team stats)

---

## NEW SERVER ACTIONS NEEDED

1. `getDashboardStats(role)` - Aggregated KPIs based on role
2. `getWeeklyAvailabilitySummary(userId)` - Next 7 days for staff
3. `getTeamCoverageHeatmap(venueIds, dateRange)` - Manager heatmap data
4. `getVenueCoverageComparison()` - Cross-venue stats for admin
5. `getUserActivityStats(days)` - Activity heatmap for admin
6. `getApprovalMetrics()` - Turnaround time calculations

---

## UI/UX ENHANCEMENTS

- **Color Palette**:
  - Green: Good coverage (>80%), Available
  - Yellow: Warning (60-80%), Pending
  - Red: Critical (<60%), Unavailable
  - Blue: Informational, Links
  - Purple: AI insights, Smart features

- **Interactive Elements**:
  - Click charts to drill down to detailed reports
  - Hover tooltips with detailed breakdowns
  - Filter buttons to adjust date ranges
  - Refresh button with auto-refresh toggle

- **Responsive Breakpoints**:
  - Mobile: Stack all cards vertically, simplify charts
  - Tablet: 2-column grid
  - Desktop: 3-4 column grid with optimal spacing

---

## SUCCESS METRICS

1. Dashboard load time < 2 seconds
2. All charts interactive and responsive
3. Real-time updates within 30 seconds
4. Mobile-friendly on all devices
5. Reduced clicks to common actions (availability, time-off, approvals)
6. Increased user engagement with dashboard (track page views)

---

**Estimated Timeline**: 12 working days
**Dependencies**: Recharts library, existing data actions
**Breaking Changes**: None - enhances existing dashboard
