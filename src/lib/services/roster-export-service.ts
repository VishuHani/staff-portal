/**
 * Roster Export Service
 * 
 * Exports rosters to Excel and PDF formats
 * Supports:
 * - Staff list with shift details
 * - Pay calculations (base, overtime, late)
 * - Daily/weekly summaries
 * - Professional print-ready format
 */

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import { formatCurrency, formatHours, formatTime12Hour } from "@/lib/utils/pay-calculator";
import type { ShiftPayBreakdown, ShiftPayBreakdownWithSuper } from "@/lib/utils/pay-calculator";

// ============================================================================
// TYPES
// ============================================================================

export interface RosterExportData {
  roster: {
    id: string;
    name: string;
    description: string | null;
    venueId: string;
    venueName: string;
    startDate: Date;
    endDate: Date;
    status: string;
    createdAt: Date;
  };
  shifts: Array<{
    id: string;
    date: Date;
    startTime: string;
    endTime: string;
    breakMinutes: number;
    position: string | null;
    notes: string | null;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    payBreakdown?: ShiftPayBreakdownWithSuper | null;
  }>;
  staff: Array<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
    totalHours: number;
    totalPay: number | null;
    shiftsCount: number;
  }>;
  summary: {
    totalStaff: number;
    totalShifts: number;
    totalHours: number;
    totalPay: number | null;
    dateRange: {
      start: Date;
      end: Date;
    };
  };
}

export interface ExportOptions {
  format: "excel" | "pdf";
  includePayRates: boolean; // Only for admin/manager
  groupByStaff: boolean;
  includeBreakdown: boolean;
  dateFormat: "d-m-y" | "m/d/y" | "yyyy-mm-dd";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function formatDate(date: Date, format: string): string {
  const d = new Date(date);
  const day = d.getDate().toString().padStart(2, "0");
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const year = d.getFullYear();
  
  switch (format) {
    case "d-m-y":
      return `${day}-${month}-${year}`;
    case "m/d/y":
      return `${month}/${day}/${year}`;
    case "yyyy-mm-dd":
    default:
      return `${year}-${month}-${day}`;
  }
}

function calculateShiftHours(startTime: string, endTime: string, breakMinutes: number): number {
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  
  let totalMinutes = endH * 60 + endM - (startH * 60 + startM);
  
  // Handle overnight shifts
  if (totalMinutes < 0) {
    totalMinutes += 24 * 60;
  }
  
  const workMinutes = totalMinutes - breakMinutes;
  return Math.max(0, workMinutes / 60);
}

// ============================================================================
// EXCEL EXPORT
// ============================================================================

/**
 * Export roster to Excel format
 */
export async function exportRosterToExcel(
  data: RosterExportData,
  options: ExportOptions
): Promise<Buffer> {
  const workbook = XLSX.utils.book_new();
  
  // Sheet 1: Roster Overview
  const overviewData = [
    { "Roster Name": data.roster.name },
    { "Venue": data.roster.venueName },
    { "Period Start": formatDate(data.roster.startDate, options.dateFormat) },
    { "Period End": formatDate(data.roster.endDate, options.dateFormat) },
    { "Total Staff": data.summary.totalStaff },
    { "Total Shifts": data.summary.totalShifts },
    { "Total Hours": formatHours(data.summary.totalHours) },
    { "Total Cost": options.includePayRates && data.summary.totalPay 
      ? formatCurrency(data.summary.totalPay) 
      : "N/A" },
  ];
  
  const overviewSheet = XLSX.utils.json_to_sheet(overviewData);
  XLSX.utils.book_append_sheet(workbook, overviewSheet, "Overview");
  
  // Sheet 2: Shift Details
  const shiftHeaders = [
    "Date",
    "Staff Name",
    "Email",
    "Start Time",
    "End Time",
    "Break (min)",
    "Hours",
    "Position",
    "Notes",
  ];
  
  if (options.includePayRates) {
    shiftHeaders.push("Base Rate", "Base Pay", "OT Hours", "OT Pay", "Late Hours", "Late Pay", "Gross Pay", "Super", "Total Pay");
  }
  
  const shiftRows: (string | number | null)[][] = data.shifts.map((shift) => {
    const row: (string | number | null)[] = [
      formatDate(shift.date, options.dateFormat),
      shift.userName || "Unassigned",
      shift.userEmail || "-",
      shift.startTime,
      shift.endTime,
      shift.breakMinutes,
      calculateShiftHours(shift.startTime, shift.endTime, shift.breakMinutes),
      shift.position || "-",
      shift.notes || "",
    ];
    
    if (options.includePayRates && shift.payBreakdown) {
      row.push(
        shift.payBreakdown.appliedRates.base || null,
        shift.payBreakdown.basePay || null,
        shift.payBreakdown.overtimeHours || null,
        shift.payBreakdown.overtimePay || null,
        shift.payBreakdown.lateHours || null,
        shift.payBreakdown.latePay || null,
        shift.payBreakdown.grossPay || null,
        shift.payBreakdown.superPay || null,
        shift.payBreakdown.totalPay || null
      );
    } else if (options.includePayRates) {
      row.push(null, null, null, null, null, null, null, null, null);
    }
    
    return row;
  });
  
  const shiftSheet = XLSX.utils.aoa_to_sheet([shiftHeaders, ...shiftRows]);
  
  // Set column widths
  shiftSheet["!cols"] = [
    { wch: 12 }, // Date
    { wch: 20 }, // Staff Name
    { wch: 25 }, // Email
    { wch: 10 }, // Start Time
    { wch: 10 }, // End Time
    { wch: 10 }, // Break
    { wch: 8 },  // Hours
    { wch: 15 }, // Position
    { wch: 20 }, // Notes
  ];
  
  XLSX.utils.book_append_sheet(workbook, shiftSheet, "Shifts");
  
  // Sheet 3: Staff Summary (if groupByStaff)
  if (options.groupByStaff) {
    const staffHeaders = [
      "Staff Name",
      "Email",
      "Role",
      "Shifts Count",
      "Total Hours",
    ];
    
    if (options.includePayRates) {
      staffHeaders.push("Total Pay", "Avg Hourly Rate");
    }
    
    const staffRows: (string | number | null)[][] = data.staff.map((staff) => {
      const row: (string | number | null)[] = [
        `${staff.firstName || ""} ${staff.lastName || ""}`.trim(),
        staff.email,
        staff.role,
        staff.shiftsCount,
        formatHours(staff.totalHours),
      ];
      
      if (options.includePayRates) {
        const avgRate = staff.totalHours > 0 && staff.totalPay 
          ? staff.totalPay / staff.totalHours 
          : null;
        row.push(
          staff.totalPay ? formatCurrency(staff.totalPay) : null,
          avgRate ? formatCurrency(avgRate) : null
        );
      }
      
      return row;
    });
    
    const staffSheet = XLSX.utils.aoa_to_sheet([staffHeaders, ...staffRows]);
    XLSX.utils.book_append_sheet(workbook, staffSheet, "Staff Summary");
  }
  
  // Generate buffer
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  return buffer;
}

// ============================================================================
// PDF EXPORT
// ============================================================================

/**
 * Export roster to PDF format
 */
export async function exportRosterToPdf(
  data: RosterExportData,
  options: ExportOptions
): Promise<Buffer> {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  
  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(data.roster.name, margin, margin, { align: "left" });
  
  // Subtitle
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${data.roster.venueName} | ${formatDate(data.roster.startDate, options.dateFormat)} - ${formatDate(data.roster.endDate, options.dateFormat)}`,
    margin,
    margin + 8
  );
  
  // Summary stats
  doc.setFontSize(9);
  const statsY = margin + 15;
  doc.text(`Total Staff: ${data.summary.totalStaff}`, margin, statsY);
  doc.text(`Total Shifts: ${data.summary.totalShifts}`, margin + 50, statsY);
  doc.text(`Total Hours: ${formatHours(data.summary.totalHours)}`, margin + 90, statsY);
  
  if (options.includePayRates && data.summary.totalPay) {
    doc.text(`Total Cost: ${formatCurrency(data.summary.totalPay)}`, margin + 130, statsY);
  }
  
  // Shifts table
  const tableY = statsY + 10;
  
  // Prepare table data
  const headers: string[][] = [["Date", "Staff", "Start", "End", "Break", "Hours", "Position"]];
  if (options.includePayRates) {
    headers[0].push("Pay");
  }
  
  const rows: string[][] = data.shifts.map((shift) => {
    const row = [
      formatDate(shift.date, options.dateFormat),
      shift.userName || "Unassigned",
      formatTime12Hour(shift.startTime),
      formatTime12Hour(shift.endTime),
      `${shift.breakMinutes}m`,
      formatHours(calculateShiftHours(shift.startTime, shift.endTime, shift.breakMinutes)),
      shift.position || "-",
    ];
    
    if (options.includePayRates && shift.payBreakdown) {
      row.push(formatCurrency(shift.payBreakdown.totalPay));
    } else if (options.includePayRates) {
      row.push("-");
    }
    
    return row;
  });
  
  // Simple table rendering without autoTable
  let currentY = tableY;
  const colWidths = [25, 35, 20, 20, 15, 15, 25];
  if (options.includePayRates) {
    colWidths.push(20);
  }
  
  // Header row
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  let x = margin;
  headers[0].forEach((header, i) => {
    doc.text(header, x, currentY);
    x += colWidths[i] || 20;
  });
  currentY += 5;
  
  // Data rows
  doc.setFont("helvetica", "normal");
  rows.forEach((row) => {
    if (currentY > pageHeight - margin - 10) {
      doc.addPage();
      currentY = margin;
    }
    
    x = margin;
    row.forEach((cell, i) => {
      doc.text(String(cell), x, currentY);
      x += colWidths[i] || 20;
    });
    currentY += 4;
  });
  
  // Footer
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "italic");
    doc.text(
      `Generated on ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: "center" }
    );
  }
  
  // Confidentiality notice (if pay rates included)
  if (options.includePayRates) {
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      "CONFIDENTIAL - Pay rate information is for authorized personnel only",
      pageWidth / 2,
      pageHeight - 5,
      { align: "center" }
    );
  }
  
  return Buffer.from(doc.output());
}
