"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";
import { format } from "date-fns";

// ============================================================================
// Types
// ============================================================================

export interface ExportOptions {
  venueId: string;
  startDate?: Date;
  endDate?: Date;
  format?: "csv" | "json";
}

export interface CompletionReportRow {
  templateName: string;
  category: string;
  documentType: string;
  totalAssignments: number;
  completed: number;
  pending: number;
  inProgress: number;
  overdue: number;
  completionRate: string;
  averageCompletionTime: string;
}

export interface UserComplianceReportRow {
  userName: string;
  userEmail: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  complianceRate: string;
  averageCompletionTime: string;
}

export interface AuditLogExportRow {
  date: string;
  time: string;
  action: string;
  resourceType: string;
  resourceId: string;
  userName: string;
  userEmail: string;
  description: string;
  ipAddress: string;
  oldValue: string;
  newValue: string;
}

// ============================================================================
// Permission Check Helper
// ============================================================================

async function checkExportPermission(
  userId: string,
  venueId: string
): Promise<boolean> {
  return hasPermission(userId, "documents", "export" as any, venueId);
}

// ============================================================================
// CSV Helpers
// ============================================================================

function escapeCSV(field: string | number | null | undefined): string {
  const str = String(field ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function arrayToCSV(headers: string[], rows: string[][]): string {
  const headerRow = headers.join(",");
  const dataRows = rows.map((row) => row.join(","));
  return [headerRow, ...dataRows].join("\n");
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export completion report to CSV
 */
export async function exportCompletionReport(
  options: ExportOptions
): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const hasPermission = await checkExportPermission(user.id, options.venueId);
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to export reports" };
    }

    const now = new Date();
    const startDate = options.startDate || new Date(now.getFullYear(), 0, 1);
    const endDate = options.endDate || now;

    // Get templates with assignments
    const templates = await prisma.documentTemplate.findMany({
      where: { venueId: options.venueId, isActive: true },
      select: {
        name: true,
        category: true,
        documentType: true,
        assignments: {
          where: {
            assignedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            status: true,
            dueDate: true,
            assignedAt: true,
            completedAt: true,
          },
        },
      },
    });

    // Build report rows
    const rows: CompletionReportRow[] = templates.map((template) => {
      const totalAssignments = template.assignments.length;
      const completed = template.assignments.filter((a) => a.status === "COMPLETED").length;
      const pending = template.assignments.filter((a) => a.status === "PENDING").length;
      const inProgress = template.assignments.filter((a) => a.status === "IN_PROGRESS").length;
      const overdue = template.assignments.filter(
        (a) =>
          ["PENDING", "IN_PROGRESS"].includes(a.status) &&
          a.dueDate &&
          new Date(a.dueDate) < now
      ).length;

      const completionRate = totalAssignments > 0
        ? `${Math.round((completed / totalAssignments) * 100)}%`
        : "0%";

      // Calculate average completion time
      const completedWithTimes = template.assignments.filter(
        (a) => a.status === "COMPLETED" && a.completedAt
      );
      const avgDays = completedWithTimes.length > 0
        ? Math.round(
            completedWithTimes.reduce((sum, a) => {
              const assigned = new Date(a.assignedAt).getTime();
              const completed = new Date(a.completedAt!).getTime();
              return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
            }, 0) / completedWithTimes.length
          )
        : null;

      return {
        templateName: template.name,
        category: template.category,
        documentType: template.documentType,
        totalAssignments,
        completed,
        pending,
        inProgress,
        overdue,
        completionRate,
        averageCompletionTime: avgDays !== null ? `${avgDays} days` : "N/A",
      };
    });

    // Convert to CSV
    const headers = [
      "Template Name",
      "Category",
      "Document Type",
      "Total Assignments",
      "Completed",
      "Pending",
      "In Progress",
      "Overdue",
      "Completion Rate",
      "Avg. Completion Time",
    ];

    const csvRows = rows.map((row) => [
      escapeCSV(row.templateName),
      escapeCSV(row.category),
      escapeCSV(row.documentType),
      escapeCSV(row.totalAssignments),
      escapeCSV(row.completed),
      escapeCSV(row.pending),
      escapeCSV(row.inProgress),
      escapeCSV(row.overdue),
      escapeCSV(row.completionRate),
      escapeCSV(row.averageCompletionTime),
    ]);

    const csv = arrayToCSV(headers, csvRows);
    const filename = `completion-report-${format(now, "yyyy-MM-dd")}.csv`;

    return { success: true, data: csv, filename };
  } catch (error) {
    console.error("Error exporting completion report:", error);
    return { success: false, error: "Failed to export completion report" };
  }
}

/**
 * Export user compliance report to CSV
 */
export async function exportUserComplianceReport(
  options: ExportOptions
): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const hasPermission = await checkExportPermission(user.id, options.venueId);
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to export reports" };
    }

    const now = new Date();

    // Get users with their assignments
    const users = await prisma.user.findMany({
      where: {
        documentAssignmentsNew: {
          some: { venueId: options.venueId },
        },
      },
      select: {
        firstName: true,
        lastName: true,
        email: true,
        documentAssignmentsNew: {
          where: { venueId: options.venueId },
          select: {
            status: true,
            dueDate: true,
            assignedAt: true,
            completedAt: true,
          },
        },
      },
    });

    // Build report rows
    const rows: UserComplianceReportRow[] = users.map((u) => {
      const totalAssigned = u.documentAssignmentsNew.length;
      const completed = u.documentAssignmentsNew.filter((a) => a.status === "COMPLETED").length;
      const inProgress = u.documentAssignmentsNew.filter((a) => a.status === "IN_PROGRESS").length;
      const pending = u.documentAssignmentsNew.filter((a) => a.status === "PENDING").length;
      const overdue = u.documentAssignmentsNew.filter(
        (a) =>
          ["PENDING", "IN_PROGRESS"].includes(a.status) &&
          a.dueDate &&
          new Date(a.dueDate) < now
      ).length;

      const complianceRate = totalAssigned > 0
        ? `${Math.round((completed / totalAssigned) * 100)}%`
        : "100%";

      // Calculate average completion time
      const completedWithTimes = u.documentAssignmentsNew.filter(
        (a) => a.status === "COMPLETED" && a.completedAt
      );
      const avgDays = completedWithTimes.length > 0
        ? Math.round(
            completedWithTimes.reduce((sum, a) => {
              const assigned = new Date(a.assignedAt).getTime();
              const completed = new Date(a.completedAt!).getTime();
              return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
            }, 0) / completedWithTimes.length
          )
        : null;

      return {
        userName: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
        userEmail: u.email,
        totalAssigned,
        completed,
        inProgress,
        pending,
        overdue,
        complianceRate,
        averageCompletionTime: avgDays !== null ? `${avgDays} days` : "N/A",
      };
    });

    // Sort by compliance rate (ascending)
    rows.sort((a, b) => {
      const aRate = parseInt(a.complianceRate);
      const bRate = parseInt(b.complianceRate);
      return aRate - bRate;
    });

    // Convert to CSV
    const headers = [
      "User Name",
      "User Email",
      "Total Assigned",
      "Completed",
      "In Progress",
      "Pending",
      "Overdue",
      "Compliance Rate",
      "Avg. Completion Time",
    ];

    const csvRows = rows.map((row) => [
      escapeCSV(row.userName),
      escapeCSV(row.userEmail),
      escapeCSV(row.totalAssigned),
      escapeCSV(row.completed),
      escapeCSV(row.inProgress),
      escapeCSV(row.pending),
      escapeCSV(row.overdue),
      escapeCSV(row.complianceRate),
      escapeCSV(row.averageCompletionTime),
    ]);

    const csv = arrayToCSV(headers, csvRows);
    const filename = `user-compliance-report-${format(now, "yyyy-MM-dd")}.csv`;

    return { success: true, data: csv, filename };
  } catch (error) {
    console.error("Error exporting user compliance report:", error);
    return { success: false, error: "Failed to export user compliance report" };
  }
}

/**
 * Export audit logs to CSV
 */
export async function exportAuditLogsCSV(
  options: ExportOptions & {
    action?: string;
    resourceType?: string;
    userId?: string;
  }
): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const hasPermission = await checkExportPermission(user.id, options.venueId);
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to export audit logs" };
    }

    const now = new Date();
    const startDate = options.startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = options.endDate || now;

    // Get venue's resource IDs
    const [templateIds, assignmentIds] = await Promise.all([
      prisma.documentTemplate.findMany({
        where: { venueId: options.venueId },
        select: { id: true },
      }),
      prisma.documentAssignment.findMany({
        where: { venueId: options.venueId },
        select: { id: true },
      }),
    ]);

    const resourceIds = [
      ...templateIds.map((t) => t.id),
      ...assignmentIds.map((a) => a.id),
    ];

    // Build where clause
    const where: any = {
      resourceId: { in: resourceIds },
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (options.action) {
      where.action = options.action;
    }
    if (options.resourceType) {
      where.resourceType = options.resourceType;
    }
    if (options.userId) {
      where.userId = options.userId;
    }

    // Get audit logs
    const logs = await prisma.documentAuditLog.findMany({
      where,
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10000, // Limit to prevent memory issues
    });

    // Convert to CSV
    const headers = [
      "Date",
      "Time",
      "Action",
      "Resource Type",
      "Resource ID",
      "User Name",
      "User Email",
      "Description",
      "IP Address",
      "Old Value",
      "New Value",
    ];

    const csvRows = logs.map((log) => {
      const date = new Date(log.createdAt);
      return [
        escapeCSV(format(date, "yyyy-MM-dd")),
        escapeCSV(format(date, "HH:mm:ss")),
        escapeCSV(log.action),
        escapeCSV(log.resourceType),
        escapeCSV(log.resourceId),
        escapeCSV(
          log.user
            ? `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email
            : "System"
        ),
        escapeCSV(log.user?.email || ""),
        escapeCSV(log.description || ""),
        escapeCSV(log.ipAddress || ""),
        escapeCSV(log.oldValue ? JSON.stringify(log.oldValue) : ""),
        escapeCSV(log.newValue ? JSON.stringify(log.newValue) : ""),
      ];
    });

    const csv = arrayToCSV(headers, csvRows);
    const filename = `audit-logs-${format(now, "yyyy-MM-dd")}.csv`;

    return { success: true, data: csv, filename };
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return { success: false, error: "Failed to export audit logs" };
  }
}

/**
 * Generate PDF summary report (returns HTML for client-side PDF generation)
 */
export async function generateSummaryReportHTML(
  venueId: string
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const hasPermission = await checkExportPermission(user.id, venueId);
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to export reports" };
    }

    const now = new Date();

    // Get venue info
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { name: true, code: true },
    });

    // Get summary stats
    const [
      totalTemplates,
      activeTemplates,
      totalAssignments,
      completedAssignments,
      pendingAssignments,
      overdueAssignments,
    ] = await Promise.all([
      prisma.documentTemplate.count({ where: { venueId } }),
      prisma.documentTemplate.count({ where: { venueId, isActive: true } }),
      prisma.documentAssignment.count({ where: { venueId } }),
      prisma.documentAssignment.count({ where: { venueId, status: "COMPLETED" } }),
      prisma.documentAssignment.count({ where: { venueId, status: "PENDING" } }),
      prisma.documentAssignment.count({
        where: {
          venueId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lt: now },
        },
      }),
    ]);

    const completionRate = totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0;

    // Get category breakdown
    const templates = await prisma.documentTemplate.findMany({
      where: { venueId },
      select: {
        category: true,
        assignments: {
          select: { status: true },
        },
      },
    });

    const categoryMap = new Map<string, { count: number; completed: number; total: number }>();
    for (const template of templates) {
      const category = template.category || "GENERAL";
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { count: 0, completed: 0, total: 0 });
      }
      const cat = categoryMap.get(category)!;
      cat.count++;
      cat.total += template.assignments.length;
      cat.completed += template.assignments.filter((a) => a.status === "COMPLETED").length;
    }

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      count: data.count,
      completionRate: data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0,
    }));

    // Generate HTML
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Document Management Summary Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
      color: #1f2937;
    }
    h1 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    h2 {
      font-size: 18px;
      font-weight: 600;
      margin-top: 32px;
      margin-bottom: 16px;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 8px;
    }
    .meta {
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 32px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .stat-value {
      font-size: 28px;
      font-weight: 600;
      color: #111827;
    }
    .stat-label {
      font-size: 12px;
      color: #6b7280;
      margin-top: 4px;
    }
    .stat-card.highlight {
      background: #eff6ff;
      border-color: #3b82f6;
    }
    .stat-card.highlight .stat-value {
      color: #2563eb;
    }
    .stat-card.warning {
      background: #fef3c7;
      border-color: #f59e0b;
    }
    .stat-card.warning .stat-value {
      color: #d97706;
    }
    .stat-card.danger {
      background: #fee2e2;
      border-color: #ef4444;
    }
    .stat-card.danger .stat-value {
      color: #dc2626;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 16px;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
    th {
      background: #f9fafb;
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #6b7280;
    }
    td {
      font-size: 14px;
    }
    .progress-bar {
      background: #e5e7eb;
      border-radius: 4px;
      height: 8px;
      overflow: hidden;
      width: 100px;
    }
    .progress-fill {
      height: 100%;
      background: #3b82f6;
    }
    .footer {
      margin-top: 48px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
      text-align: center;
    }
    @media print {
      body {
        padding: 20px;
      }
    }
  </style>
</head>
<body>
  <h1>Document Management Summary Report</h1>
  <div class="meta">
    <p><strong>Venue:</strong> ${venue?.name || "Unknown"} (${venue?.code || "N/A"})</p>
    <p><strong>Generated:</strong> ${format(now, "MMMM d, yyyy 'at' h:mm a")}</p>
    <p><strong>Report Period:</strong> All time</p>
  </div>

  <h2>Overview</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${totalTemplates}</div>
      <div class="stat-label">Total Templates</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${activeTemplates}</div>
      <div class="stat-label">Active Templates</div>
    </div>
    <div class="stat-card highlight">
      <div class="stat-value">${completionRate}%</div>
      <div class="stat-label">Completion Rate</div>
    </div>
  </div>

  <h2>Assignment Status</h2>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-value">${totalAssignments}</div>
      <div class="stat-label">Total Assignments</div>
    </div>
    <div class="stat-card">
      <div class="stat-value">${completedAssignments}</div>
      <div class="stat-label">Completed</div>
    </div>
    <div class="stat-card warning">
      <div class="stat-value">${pendingAssignments}</div>
      <div class="stat-label">Pending</div>
    </div>
    <div class="stat-card danger">
      <div class="stat-value">${overdueAssignments}</div>
      <div class="stat-label">Overdue</div>
    </div>
  </div>

  <h2>Category Breakdown</h2>
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Templates</th>
        <th>Completion Rate</th>
      </tr>
    </thead>
    <tbody>
      ${categoryBreakdown
        .map(
          (cat) => `
        <tr>
          <td>${cat.category}</td>
          <td>${cat.count}</td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${cat.completionRate}%"></div>
              </div>
              <span>${cat.completionRate}%</span>
            </div>
          </td>
        </tr>
      `
        )
        .join("")}
    </tbody>
  </table>

  <div class="footer">
    <p>Generated by Staff Portal Document Management System</p>
  </div>
</body>
</html>
    `.trim();

    return { success: true, data: html };
  } catch (error) {
    console.error("Error generating summary report:", error);
    return { success: false, error: "Failed to generate summary report" };
  }
}

/**
 * Export bundle analytics report
 */
export async function exportBundleAnalyticsReport(
  venueId: string,
  bundleId?: string
): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const hasPermission = await checkExportPermission(user.id, venueId);
    if (!hasPermission) {
      return { success: false, error: "You don't have permission to export reports" };
    }

    const now = new Date();

    // Get bundles
    const bundles = await prisma.documentBundle.findMany({
      where: {
        venueId,
        ...(bundleId ? { id: bundleId } : {}),
      },
      include: {
        items: {
          include: {
            template: {
              select: { name: true },
            },
          },
        },
        assignments: {
          include: {
            assignment: {
              include: {
                user: {
                  select: { firstName: true, lastName: true, email: true },
                },
              },
            },
          },
        },
      },
    });

    // Build report rows
    const rows: string[][] = [];
    const headers = [
      "Bundle Name",
      "Category",
      "Total Items",
      "Total Assignments",
      "Completed",
      "In Progress",
      "Pending",
      "Overdue",
      "Completion Rate",
    ];

    for (const bundle of bundles) {
      const totalAssignments = bundle.assignments.length;
      const completed = bundle.assignments.filter(
        (a) => a.assignment.status === "COMPLETED"
      ).length;
      const inProgress = bundle.assignments.filter(
        (a) => a.assignment.status === "IN_PROGRESS"
      ).length;
      const pending = bundle.assignments.filter(
        (a) => a.assignment.status === "PENDING"
      ).length;
      const overdue = bundle.assignments.filter(
        (a) =>
          ["PENDING", "IN_PROGRESS"].includes(a.assignment.status) &&
          a.assignment.dueDate &&
          new Date(a.assignment.dueDate) < now
      ).length;

      const completionRate = totalAssignments > 0
        ? `${Math.round((completed / totalAssignments) * 100)}%`
        : "0%";

      rows.push([
        escapeCSV(bundle.name),
        escapeCSV(bundle.category),
        escapeCSV(bundle.items.length),
        escapeCSV(totalAssignments),
        escapeCSV(completed),
        escapeCSV(inProgress),
        escapeCSV(pending),
        escapeCSV(overdue),
        escapeCSV(completionRate),
      ]);
    }

    const csv = arrayToCSV(headers, rows);
    const filename = `bundle-analytics-${format(now, "yyyy-MM-dd")}.csv`;

    return { success: true, data: csv, filename };
  } catch (error) {
    console.error("Error exporting bundle analytics:", error);
    return { success: false, error: "Failed to export bundle analytics" };
  }
}
