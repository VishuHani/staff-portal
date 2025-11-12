"use server";

import { requireAuth, canAccess } from "@/lib/rbac/access";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import ical, { ICalCalendar } from "ical-generator";
import { format, parseISO } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type ExportFormat = "csv" | "excel" | "pdf" | "ical";
export type ReportType = "matrix" | "coverage" | "conflicts" | "gaps" | "calendar";

export interface ExportOptions {
  reportType: ReportType;
  format: ExportFormat;
  data: any;
  filters?: any;
  filename?: string;
}

// ============================================================================
// CSV EXPORT
// ============================================================================

/**
 * Export report to CSV format
 */
export async function exportToCSV(data: any, reportType: ReportType) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "export_team");
  if (!hasAccess) {
    return { error: "You don't have permission to export reports" };
  }

  try {
    let csvContent = "";

    switch (reportType) {
      case "matrix":
        csvContent = generateMatrixCSV(data);
        break;
      case "coverage":
        csvContent = generateCoverageCSV(data);
        break;
      case "conflicts":
        csvContent = generateConflictsCSV(data);
        break;
      case "gaps":
        csvContent = generateGapsCSV(data);
        break;
      case "calendar":
        csvContent = generateCalendarCSV(data);
        break;
      default:
        return { error: `Unsupported report type for CSV: ${reportType}` };
    }

    return {
      success: true,
      data: csvContent,
      filename: generateExportFilename(reportType, "csv"),
    };
  } catch (error) {
    console.error("Error exporting to CSV:", error);
    return { error: "Failed to export to CSV" };
  }
}

function generateMatrixCSV(data: any): string {
  const { users, dates, matrix } = data;

  // Header row
  const headers = ["Staff Member", "Email", "Role", "Venues", ...dates.map((d: string) => format(parseISO(d), "MMM dd"))];
  const rows = [headers];

  // Data rows
  users.forEach((user: any) => {
    const row = [
      user.name || user.email,
      user.email,
      user.role,
      Array.isArray(user.venues) ? user.venues.map((v: any) => v.name).join("; ") : "",
      ...dates.map((date: string) => {
        const status = matrix[user.id]?.[date];
        if (!status || !status.available) return "Unavailable";
        if (status.isAllDay) return "Available (All Day)";
        return `Available (${status.startTime}-${status.endTime})`;
      }),
    ];
    rows.push(row);
  });

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","")).join("\n");
}

function generateCoverageCSV(data: any): string {
  const { dailyCoverage, summary } = data;

  // Summary section
  const rows = [
    ["Coverage Analysis Summary"],
    [""],
    ["Total Staff", summary.totalStaff],
    ["Average Availability", `${summary.averageAvailability}%`],
    ["Peak Availability", `${summary.peakAvailability.count} on ${format(parseISO(summary.peakAvailability.date), "MMM dd, yyyy")}`],
    ["Low Availability", `${summary.lowAvailability.count} on ${format(parseISO(summary.lowAvailability.date), "MMM dd, yyyy")}`],
    [""],
    ["Date", "Available Staff", "Total Staff", "Coverage %", "Status"],
  ];

  // Daily coverage data
  dailyCoverage.forEach((day: any) => {
    rows.push([
      format(parseISO(day.date), "MMM dd, yyyy"),
      day.availableStaff,
      day.totalStaff,
      `${day.percentage.toFixed(1)}%`,
      day.status,
    ]);
  });

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function generateConflictsCSV(data: any): string {
  const { conflicts, stats } = data;

  // Summary section
  const rows = [
    ["Conflicts Report"],
    [""],
    ["Total Conflicts", stats.total],
    ["Critical", stats.critical],
    ["Warnings", stats.warning],
    ["Info", stats.info],
    [""],
    ["Date", "Day of Week", "Severity", "Type", "Title", "Description", "Venues"],
  ];

  // Conflict details
  conflicts.forEach((conflict: any) => {
    rows.push([
      format(parseISO(conflict.date), "MMM dd, yyyy"),
      conflict.dayOfWeek,
      conflict.severity,
      conflict.type,
      conflict.title,
      conflict.description,
      Array.isArray(conflict.venues) ? conflict.venues.join("; ") : "",
    ]);
  });

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function generateGapsCSV(data: any): string {
  const { gaps } = data;

  const rows = [
    ["Staffing Gaps Report"],
    [""],
    ["Date", "Available Staff", "Required Staff", "Gap"],
  ];

  gaps.forEach((gap: any) => {
    rows.push([
      format(parseISO(gap.date), "MMM dd, yyyy"),
      gap.availableStaff,
      gap.requiredStaff,
      gap.gap,
    ]);
  });

  return rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
}

function generateCalendarCSV(data: any): string {
  // Similar to matrix but with calendar-specific formatting
  return generateMatrixCSV(data);
}

// ============================================================================
// EXCEL EXPORT
// ============================================================================

/**
 * Export report to Excel format with multiple sheets
 */
export async function exportToExcel(data: any, reportType: ReportType) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "export_team");
  if (!hasAccess) {
    return { error: "You don't have permission to export reports" };
  }

  try {
    const workbook = XLSX.utils.book_new();

    switch (reportType) {
      case "matrix":
        generateMatrixExcel(workbook, data);
        break;
      case "coverage":
        generateCoverageExcel(workbook, data);
        break;
      case "conflicts":
        generateConflictsExcel(workbook, data);
        break;
      case "gaps":
        generateGapsExcel(workbook, data);
        break;
      case "calendar":
        generateCalendarExcel(workbook, data);
        break;
      default:
        return { error: `Unsupported report type for Excel: ${reportType}` };
    }

    // Convert workbook to buffer
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    const base64 = buffer.toString("base64");

    return {
      success: true,
      data: base64,
      filename: generateExportFilename(reportType, "excel"),
    };
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    return { error: "Failed to export to Excel" };
  }
}

function generateMatrixExcel(workbook: XLSX.WorkBook, data: any) {
  const { users, dates, matrix } = data;

  // Main data sheet
  const headers = ["Staff Member", "Email", "Role", "Venues", ...dates.map((d: string) => format(parseISO(d), "MMM dd"))];
  const rows = [headers];

  users.forEach((user: any) => {
    const row = [
      user.name || user.email,
      user.email,
      user.role,
      Array.isArray(user.venues) ? user.venues.map((v: any) => v.name).join(", ") : "",
      ...dates.map((date: string) => {
        const status = matrix[user.id]?.[date];
        if (!status || !status.available) return "Unavailable";
        if (status.isAllDay) return "Available (All Day)";
        return `${status.startTime}-${status.endTime}`;
      }),
    ];
    rows.push(row);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Set column widths
  worksheet["!cols"] = [
    { wch: 20 }, // Staff Member
    { wch: 25 }, // Email
    { wch: 15 }, // Role
    { wch: 20 }, // Venues
    ...dates.map(() => ({ wch: 12 })), // Dates
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Availability Matrix");
}

function generateCoverageExcel(workbook: XLSX.WorkBook, data: any) {
  const { dailyCoverage, summary } = data;

  // Summary sheet
  const summaryData = [
    ["Coverage Analysis Summary"],
    [""],
    ["Metric", "Value"],
    ["Total Staff", summary.totalStaff],
    ["Average Availability", `${summary.averageAvailability}%`],
    ["Peak Availability", `${summary.peakAvailability.count} on ${format(parseISO(summary.peakAvailability.date), "MMM dd")}`],
    ["Low Availability", `${summary.lowAvailability.count} on ${format(parseISO(summary.lowAvailability.date), "MMM dd")}`],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Daily coverage sheet
  const coverageData = [
    ["Date", "Day", "Available Staff", "Total Staff", "Coverage %", "Status"],
    ...dailyCoverage.map((day: any) => [
      format(parseISO(day.date), "MMM dd, yyyy"),
      format(parseISO(day.date), "EEEE"),
      day.availableStaff,
      day.totalStaff,
      day.percentage.toFixed(1),
      day.status,
    ]),
  ];

  const coverageSheet = XLSX.utils.aoa_to_sheet(coverageData);
  coverageSheet["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, coverageSheet, "Daily Coverage");
}

function generateConflictsExcel(workbook: XLSX.WorkBook, data: any) {
  const { conflicts, stats } = data;

  // Summary sheet
  const summaryData = [
    ["Conflicts Report Summary"],
    [""],
    ["Metric", "Count"],
    ["Total Conflicts", stats.total],
    ["Critical", stats.critical],
    ["Warnings", stats.warning],
    ["Info", stats.info],
    [""],
    ["By Type", "Count"],
    ["Understaffing", stats.byType.understaffing],
    ["No Availability", stats.byType.noAvailability],
    ["Limited Coverage", stats.byType.limitedCoverage],
    ["Overlapping Time-Off", stats.byType.overlappingTimeOff],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

  // Conflicts sheet
  const conflictsData = [
    ["Date", "Day", "Severity", "Type", "Title", "Description", "Venues", "Available", "Total"],
    ...conflicts.map((c: any) => [
      format(parseISO(c.date), "MMM dd, yyyy"),
      c.dayOfWeek,
      c.severity,
      c.type,
      c.title,
      c.description,
      Array.isArray(c.venues) ? c.venues.join(", ") : "",
      c.details?.availableStaff || "",
      c.details?.totalStaff || "",
    ]),
  ];

  const conflictsSheet = XLSX.utils.aoa_to_sheet(conflictsData);
  conflictsSheet["!cols"] = [
    { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 18 }, { wch: 25 }, { wch: 40 }, { wch: 20 }, { wch: 10 }, { wch: 10 }
  ];
  XLSX.utils.book_append_sheet(workbook, conflictsSheet, "Conflicts");
}

function generateGapsExcel(workbook: XLSX.WorkBook, data: any) {
  const { gaps } = data;

  const gapsData = [
    ["Staffing Gaps Report"],
    [""],
    ["Date", "Day", "Available Staff", "Required Staff", "Gap"],
    ...gaps.map((gap: any) => [
      format(parseISO(gap.date), "MMM dd, yyyy"),
      format(parseISO(gap.date), "EEEE"),
      gap.availableStaff,
      gap.requiredStaff,
      gap.gap,
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(gapsData);
  worksheet["!cols"] = [{ wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Staffing Gaps");
}

function generateCalendarExcel(workbook: XLSX.WorkBook, data: any) {
  generateMatrixExcel(workbook, data);
}

// ============================================================================
// PDF EXPORT
// ============================================================================

/**
 * Export report to PDF format
 */
export async function exportToPDF(data: any, reportType: ReportType) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "export_team");
  if (!hasAccess) {
    return { error: "You don't have permission to export reports" };
  }

  try {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

    // Add header
    doc.setFontSize(20);
    doc.text("Staff Portal - Reports", 15, 15);
    doc.setFontSize(10);
    doc.text(`Generated: ${format(new Date(), "MMM dd, yyyy HH:mm")}`, 15, 22);

    switch (reportType) {
      case "matrix":
        generateMatrixPDF(doc, data);
        break;
      case "coverage":
        generateCoveragePDF(doc, data);
        break;
      case "conflicts":
        generateConflictsPDF(doc, data);
        break;
      case "gaps":
        generateGapsPDF(doc, data);
        break;
      case "calendar":
        generateCalendarPDF(doc, data);
        break;
      default:
        return { error: `Unsupported report type for PDF: ${reportType}` };
    }

    // Convert to base64
    const pdfBase64 = doc.output("datauristring").split(",")[1];

    return {
      success: true,
      data: pdfBase64,
      filename: generateExportFilename(reportType, "pdf"),
    };
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    return { error: "Failed to export to PDF" };
  }
}

function generateMatrixPDF(doc: jsPDF, data: any) {
  const { users, dates, matrix } = data;

  doc.setFontSize(16);
  doc.text("Availability Matrix", 15, 32);

  const tableData = users.map((user: any) => [
    user.name || user.email,
    user.role,
    ...dates.slice(0, 7).map((date: string) => {
      const status = matrix[user.id]?.[date];
      if (!status || !status.available) return "X";
      if (status.isAllDay) return "✓ All Day";
      return "✓";
    }),
  ]);

  autoTable(doc, {
    startY: 38,
    head: [["Staff", "Role", ...dates.slice(0, 7).map((d: string) => format(parseISO(d), "MMM dd"))]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 8 },
  });
}

function generateCoveragePDF(doc: jsPDF, data: any) {
  const { dailyCoverage, summary } = data;

  doc.setFontSize(16);
  doc.text("Coverage Analysis", 15, 32);

  // Summary
  doc.setFontSize(10);
  doc.text(`Total Staff: ${summary.totalStaff}`, 15, 42);
  doc.text(`Average Availability: ${summary.averageAvailability}%`, 15, 48);

  // Table
  const tableData = dailyCoverage.map((day: any) => [
    format(parseISO(day.date), "MMM dd, yyyy"),
    day.availableStaff.toString(),
    day.totalStaff.toString(),
    `${day.percentage.toFixed(1)}%`,
    day.status,
  ]);

  autoTable(doc, {
    startY: 55,
    head: [["Date", "Available", "Total", "Coverage", "Status"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [66, 139, 202] },
    styles: { fontSize: 9 },
  });
}

function generateConflictsPDF(doc: jsPDF, data: any) {
  const { conflicts, stats } = data;

  doc.setFontSize(16);
  doc.text("Conflicts Report", 15, 32);

  // Summary
  doc.setFontSize(10);
  doc.text(`Total: ${stats.total} | Critical: ${stats.critical} | Warnings: ${stats.warning} | Info: ${stats.info}`, 15, 42);

  // Table
  const tableData = conflicts.map((c: any) => [
    format(parseISO(c.date), "MMM dd"),
    c.severity,
    c.type,
    c.title,
    c.description.substring(0, 50) + "...",
  ]);

  autoTable(doc, {
    startY: 48,
    head: [["Date", "Severity", "Type", "Title", "Description"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [220, 53, 69] },
    styles: { fontSize: 8 },
  });
}

function generateGapsPDF(doc: jsPDF, data: any) {
  const { gaps } = data;

  doc.setFontSize(16);
  doc.text("Staffing Gaps", 15, 32);

  const tableData = gaps.map((gap: any) => [
    format(parseISO(gap.date), "MMM dd, yyyy"),
    gap.availableStaff.toString(),
    gap.requiredStaff.toString(),
    gap.gap.toString(),
  ]);

  autoTable(doc, {
    startY: 40,
    head: [["Date", "Available", "Required", "Gap"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [255, 193, 7] },
    styles: { fontSize: 10 },
  });
}

function generateCalendarPDF(doc: jsPDF, data: any) {
  generateMatrixPDF(doc, data);
}

// ============================================================================
// ICAL EXPORT
// ============================================================================

/**
 * Export availability to iCal format
 */
export async function exportToICal(data: any) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "export_team");
  if (!hasAccess) {
    return { error: "You don't have permission to export reports" };
  }

  try {
    const calendar: ICalCalendar = ical({
      name: "Staff Availability",
      prodId: "//Staff Portal//Availability Calendar//EN",
      timezone: "UTC",
    });

    // Add events for available staff
    if (data.users && data.dates && data.matrix) {
      data.users.forEach((user: any) => {
        data.dates.forEach((dateStr: string) => {
          const status = data.matrix[user.id]?.[dateStr];
          if (status && status.available) {
            const date = parseISO(dateStr);

            let startTime, endTime;
            if (status.isAllDay) {
              startTime = new Date(date);
              startTime.setHours(9, 0, 0);
              endTime = new Date(date);
              endTime.setHours(17, 0, 0);
            } else {
              const [startHour, startMin] = (status.startTime || "09:00").split(":").map(Number);
              const [endHour, endMin] = (status.endTime || "17:00").split(":").map(Number);
              startTime = new Date(date);
              startTime.setHours(startHour, startMin, 0);
              endTime = new Date(date);
              endTime.setHours(endHour, endMin, 0);
            }

            calendar.createEvent({
              start: startTime,
              end: endTime,
              summary: `${user.name || user.email} - Available`,
              description: `${user.name || user.email} is available${status.isAllDay ? " (All Day)" : ""}`,
              location: user.venues?.map((v: any) => v.name).join(", ") || "",
            });
          }
        });
      });
    }

    const icalString = calendar.toString();

    return {
      success: true,
      data: icalString,
      filename: generateExportFilename("calendar", "ical"),
    };
  } catch (error) {
    console.error("Error exporting to iCal:", error);
    return { error: "Failed to export to iCal" };
  }
}

// ============================================================================
// UNIVERSAL EXPORT
// ============================================================================

/**
 * Universal export function - routes to specific format handler
 */
export async function exportReport(options: ExportOptions) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "export_team");
  if (!hasAccess) {
    return { error: "You don't have permission to export reports" };
  }

  try {
    switch (options.format) {
      case "csv":
        return await exportToCSV(options.data, options.reportType);
      case "excel":
        return await exportToExcel(options.data, options.reportType);
      case "pdf":
        return await exportToPDF(options.data, options.reportType);
      case "ical":
        return await exportToICal(options.data);
      default:
        return { error: `Unsupported export format: ${options.format}` };
    }
  } catch (error) {
    console.error("Error exporting report:", error);
    return { error: "Failed to export report" };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Generate filename for export
 */
export function generateExportFilename(
  reportType: ReportType,
  format: ExportFormat,
  venueId?: string
): string {
  const timestamp = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const venue = venueId ? `-${venueId}` : "";
  const extension = format === "ical" ? "ics" : format === "excel" ? "xlsx" : format;

  return `${reportType}-report${venue}-${timestamp}.${extension}`;
}
