"use server";

/**
 * Roster Export Actions
 * 
 * Server actions for exporting rosters to Excel and PDF formats.
 * Pay rate information is only included for users with appropriate permissions.
 */

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { exportRosterToExcel, exportRosterToPdf } from "@/lib/services/roster-export-service";
import {
  calculateShiftPayBreakdownWithSuper,
  calculateShiftHours,
  type ShiftPayInput,
  type StaffPayRates,
  type VenuePayConfig as PayVenuePayConfig,
  type ShiftPayBreakdownWithSuper,
} from "@/lib/utils/pay-calculator";
import type { RosterExportData, ExportOptions } from "@/lib/services/roster-export-service";

/**
 * Check if user can view pay rates (admin or manager)
 */
async function canViewPayRates(venueId: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;

  const userWithData = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      role: true,
      venuePermissions: {
        where: { venueId },
        include: { permission: true },
      },
    },
  });

  if (!userWithData) return false;

  // Admin can always view pay rates
  if (userWithData.role.name === "ADMIN") return true;

  // Check for view_sensitive permission on users resource
  const hasSensitivePermission = userWithData.venuePermissions.some(
    (p) => p.permission.resource === "users" && p.permission.action === "view_sensitive"
  );

  return hasSensitivePermission;
}

/**
 * Get roster data for export
 */
async function getRosterExportData(rosterId: string, includePayRates: boolean): Promise<RosterExportData | null> {
  const roster = await prisma.roster.findUnique({
    where: { id: rosterId },
    include: {
      venue: true,
      shifts: {
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              weekdayRate: true,
              saturdayRate: true,
              sundayRate: true,
              publicHolidayRate: true,
              overtimeRate: true,
              lateRate: true,
            },
          },
        },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
      },
    },
  });

  if (!roster) return null;

  // Get venue pay config
  const venuePayConfig = await prisma.venuePayConfig.findUnique({
    where: { venueId: roster.venueId },
  });

  // Convert to pay calculator format
  const payConfig: PayVenuePayConfig | null = venuePayConfig ? {
    defaultWeekdayRate: venuePayConfig.defaultWeekdayRate,
    defaultSaturdayRate: venuePayConfig.defaultSaturdayRate,
    defaultSundayRate: venuePayConfig.defaultSundayRate,
    defaultPublicHolidayRate: venuePayConfig.defaultPublicHolidayRate,
    defaultOvertimeRate: venuePayConfig.defaultOvertimeRate,
    defaultLateRate: venuePayConfig.defaultLateRate,
    overtimeThresholdHours: venuePayConfig.overtimeThresholdHours,
    overtimeMultiplier: venuePayConfig.overtimeMultiplier,
    lateStartHour: venuePayConfig.lateStartHour,
    autoCalculateBreaks: venuePayConfig.autoCalculateBreaks,
    breakThresholdHours: venuePayConfig.breakThresholdHours,
    defaultBreakMinutes: venuePayConfig.defaultBreakMinutes,
    publicHolidayRegion: venuePayConfig.publicHolidayRegion,
    customPublicHolidays: venuePayConfig.customPublicHolidays as string[] | null,
    // Superannuation settings
    superRate: (venuePayConfig as any).superRate ?? null,
    superEnabled: (venuePayConfig as any).superEnabled ?? true,
  } : null;

  // Process shifts
  const shifts = roster.shifts.map((shift) => {
    let payBreakdown: ShiftPayBreakdownWithSuper | null = null;

    if (includePayRates && shift.user) {
      const staffRates: StaffPayRates = {
        weekdayRate: shift.user.weekdayRate ?? payConfig?.defaultWeekdayRate ?? null,
        saturdayRate: shift.user.saturdayRate ?? payConfig?.defaultSaturdayRate ?? null,
        sundayRate: shift.user.sundayRate ?? payConfig?.defaultSundayRate ?? null,
        publicHolidayRate: shift.user.publicHolidayRate ?? payConfig?.defaultPublicHolidayRate ?? null,
        overtimeRate: shift.user.overtimeRate ?? payConfig?.defaultOvertimeRate ?? null,
        lateRate: shift.user.lateRate ?? payConfig?.defaultLateRate ?? null,
      };

      const shiftInput: ShiftPayInput = {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
      };

      payBreakdown = calculateShiftPayBreakdownWithSuper(shiftInput, staffRates, payConfig);
    }

    return {
      id: shift.id,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      position: shift.position,
      notes: shift.notes,
      userId: shift.userId,
      userName: shift.user ? `${shift.user.firstName} ${shift.user.lastName}`.trim() : null,
      userEmail: shift.user?.email ?? null,
      payBreakdown,
    };
  });

  // Calculate staff summaries
  const staffMap = new Map<string, {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
    totalHours: number;
    totalPay: number;
    shiftsCount: number;
  }>();

  for (const shift of shifts) {
    if (!shift.userId || !shift.userName) continue;

    const hours = calculateShiftHours(shift.startTime, shift.endTime, shift.breakMinutes);
    const pay = shift.payBreakdown?.totalPay ?? 0;

    const existing = staffMap.get(shift.userId);
    if (existing) {
      existing.totalHours += hours;
      existing.totalPay += pay;
      existing.shiftsCount += 1;
    } else {
      staffMap.set(shift.userId, {
        id: shift.userId,
        firstName: null,
        lastName: null,
        email: shift.userEmail ?? "",
        role: "Staff",
        totalHours: hours,
        totalPay: pay,
        shiftsCount: 1,
      });
    }
  }

  const staff = Array.from(staffMap.values());

  // Calculate summary
  const totalHours = shifts.reduce((sum: number, s) => sum + calculateShiftHours(s.startTime, s.endTime, s.breakMinutes), 0);
  const totalPay = includePayRates ? shifts.reduce((sum: number, s) => sum + (s.payBreakdown?.totalPay ?? 0), 0) : null;

  return {
    roster: {
      id: roster.id,
      name: roster.name,
      description: roster.description,
      venueId: roster.venueId,
      venueName: roster.venue.name,
      startDate: roster.startDate,
      endDate: roster.endDate,
      status: roster.status,
      createdAt: roster.createdAt,
    },
    shifts,
    staff,
    summary: {
      totalStaff: staff.length,
      totalShifts: shifts.length,
      totalHours,
      totalPay,
      dateRange: {
        start: roster.startDate,
        end: roster.endDate,
      },
    },
  };
}

/**
 * Export roster to Excel
 */
export async function exportRosterExcel(
  rosterId: string,
  options: Partial<ExportOptions> = {}
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check pay rate access
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { venueId: true },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    const includePayRates = await canViewPayRates(roster.venueId);
    const exportData = await getRosterExportData(rosterId, includePayRates);

    if (!exportData) {
      return { success: false, error: "Failed to get roster data" };
    }

    const exportOptions: ExportOptions = {
      format: "excel",
      includePayRates,
      groupByStaff: options.groupByStaff ?? true,
      includeBreakdown: options.includeBreakdown ?? includePayRates,
      dateFormat: options.dateFormat ?? "d-m-y",
    };

    const buffer = await exportRosterToExcel(exportData, exportOptions);
    const base64 = buffer.toString("base64");

    return { success: true, data: base64 };
  } catch (error) {
    console.error("Error exporting roster to Excel:", error);
    return { success: false, error: "Failed to export roster" };
  }
}

/**
 * Export roster to PDF
 */
export async function exportRosterPdf(
  rosterId: string,
  options: Partial<ExportOptions> = {}
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    // Check pay rate access
    const roster = await prisma.roster.findUnique({
      where: { id: rosterId },
      select: { venueId: true },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    const includePayRates = await canViewPayRates(roster.venueId);
    const exportData = await getRosterExportData(rosterId, includePayRates);

    if (!exportData) {
      return { success: false, error: "Failed to get roster data" };
    }

    const exportOptions: ExportOptions = {
      format: "pdf",
      includePayRates,
      groupByStaff: options.groupByStaff ?? true,
      includeBreakdown: options.includeBreakdown ?? includePayRates,
      dateFormat: options.dateFormat ?? "d-m-y",
    };

    const buffer = await exportRosterToPdf(exportData, exportOptions);
    const base64 = buffer.toString("base64");

    return { success: true, data: base64 };
  } catch (error) {
    console.error("Error exporting roster to PDF:", error);
    return { success: false, error: "Failed to export roster" };
  }
}
