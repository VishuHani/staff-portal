import { DashboardWidget } from "./DashboardCustomizationPanel";

// Default widgets for each role - exported separately to avoid RSC bundler issues
export const DEFAULT_STAFF_WIDGETS: DashboardWidget[] = [
  { id: "kpis", name: "KPI Cards", description: "Hours, shifts, and messages summary", enabled: true, order: 0 },
  { id: "quick-actions", name: "Quick Actions", description: "Shortcuts to common tasks", enabled: true, order: 1 },
  { id: "upcoming-shifts", name: "Upcoming Shifts", description: "Your next scheduled shifts", enabled: true, order: 2 },
  { id: "week-at-glance", name: "Week at a Glance", description: "Weekly availability overview", enabled: true, order: 3 },
  { id: "recent-activity", name: "Recent Activity", description: "Latest notifications", enabled: true, order: 4 },
  { id: "personal-stats", name: "Personal Stats", description: "Scheduled hours trends", enabled: true, order: 5 },
];

export const DEFAULT_MANAGER_WIDGETS: DashboardWidget[] = [
  { id: "hero-stats", name: "Hero Stats", description: "Coverage and pending approvals", enabled: true, order: 0 },
  { id: "coverage-heatmap", name: "Coverage Heatmap", description: "Team availability by day/time", enabled: true, order: 1 },
  { id: "availability-pie", name: "Team Availability", description: "Distribution of team status", enabled: true, order: 2 },
  { id: "coverage-trend", name: "Coverage Trend", description: "Historical coverage data", enabled: true, order: 3 },
  { id: "ai-insights", name: "Smart Suggestions", description: "AI-powered scheduling insights", enabled: true, order: 4 },
  { id: "team-snapshot", name: "Team Snapshot", description: "Staff member overview", enabled: true, order: 5 },
];

export const DEFAULT_ADMIN_WIDGETS: DashboardWidget[] = [
  { id: "global-stats", name: "Global Stats", description: "System-wide metrics", enabled: true, order: 0, required: true },
  { id: "venue-comparison", name: "Venue Comparison", description: "Coverage by venue", enabled: true, order: 1 },
  { id: "activity-heatmap", name: "Activity Heatmap", description: "User activity by time", enabled: true, order: 2 },
  { id: "action-distribution", name: "Action Distribution", description: "Audit log breakdown", enabled: true, order: 3 },
  { id: "role-distribution", name: "Role Distribution", description: "Users by role", enabled: true, order: 4 },
  { id: "approval-metrics", name: "Approval Metrics", description: "Request turnaround time", enabled: true, order: 5 },
  { id: "audit-logs", name: "Audit Logs", description: "Recent system activity", enabled: true, order: 6 },
];
