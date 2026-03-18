"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import {
  calculateShiftPayBreakdownWithSuper,
  getEffectiveSuperConfig,
  type ShiftPayInput,
  type StaffPayRates,
  type SuperConfig,
  type DailyPaySummary,
  formatCurrency,
  formatHours,
} from "@/lib/utils/pay-calculator";
import { Decimal } from "@prisma/client/runtime/library";
import type { VenuePayConfig, RosterShift, User, Roster, Venue } from "@prisma/client";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subWeeks,
  subMonths,
  format,
  parseISO,
} from "date-fns";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface RosterPayReportFilters {
  startDate: Date | string;
  endDate: Date | string;
  venueId?: string;
  venueIds?: string[];
  staffId?: string;
  staffIds?: string[];
  groupBy: "day" | "week" | "staff" | "venue";
}

export interface RosterPayReportData {
  summary: {
    totalHours: number;
    basePay: number;
    overtimePay: number;
    latePay: number;
    grossPay: number;
    superPay: number;
    totalCost: number;
    shiftCount: number;
    staffCount: number;
  };
  breakdown: DailyPaySummary[] | StaffPaySummary[] | WeeklyBreakdown[];
}

export interface WeeklyBreakdown {
  weekStart: string;
  weekEnd: string;
  totalHours: number;
  basePay: number;
  overtimePay: number;
  latePay: number;
  grossPay: number;
  superPay: number;
  totalCost: number;
  shiftCount: number;
  staffCount: number;
}

export interface StaffPaySummary {
  staffId: string;
  staffName: string;
  email: string;
  position: string;
  totalHours: number;
  basePay: number;
  overtimePay: number;
  latePay: number;
  grossPay: number;
  superPay: number;
  totalCost: number;
  superEnabled: boolean;
  superRate: number;
  shiftCount: number;
}

export interface CostAnalysisReport {
  byDate: DailyPaySummary[];
  byStaff: StaffPaySummary[];
  byPosition: PositionCostBreakdown[];
  summary: RosterPayReportData["summary"];
}

export interface PositionCostBreakdown {
  positionId: string;
  positionName: string;
  positionColor: string;
  staffCount: number;
  totalHours: number;
  basePay: number;
  overtimePay: number;
  latePay: number;
  grossPay: number;
  superPay: number;
  totalCost: number;
  shiftCount: number;
}

export interface PayTrendData {
  period: string;
  grossPay: number;
  superPay: number;
  totalCost: number;
  hours: number;
}

// Extended types for includes
type ShiftWithUserAndRoster = RosterShift & {
  user: (User & { 
    superEnabled: boolean | null;
    customSuperRate: Decimal | null;
  }) | null;
  roster: Roster & {
    venue: Venue & {
      payConfig: VenuePayConfig | null;
    };
  };
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function toNumber(value: Decimal | number | null | unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return value;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    return (value as Decimal).toNumber();
  }
  return null;
}

function getVenueConfigSuper(venueConfig: VenuePayConfig | null): { superEnabled: boolean; superRate: number } {
  if (!venueConfig) {
    return { superEnabled: true, superRate: 0.115 };
  }
  return {
    superEnabled: (venueConfig as any).superEnabled ?? true,
    superRate: toNumber((venueConfig as any).superRate) ?? 0.115,
  };
}

function getUserSuperSettings(user: User & { superEnabled?: boolean | null; customSuperRate?: Decimal | null }): {
  superEnabled: boolean | null;
  customSuperRate: Decimal | null;
} {
  return {
    superEnabled: (user as any).superEnabled ?? null,
    customSuperRate: (user as any).customSuperRate ?? null,
  };
}

// ============================================================================
// MAIN SERVER ACTIONS
// ============================================================================

/**
 * Get comprehensive roster pay report
 */
export async function getRosterPayReport(filters: RosterPayReportFilters) {
  const user = await requireAuth();
  
  // Check permission - only managers/admins can view pay reports
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view pay reports" };
  }
  
  try {
    // Parse dates
    const startDate = typeof filters.startDate === "string"
      ? parseISO(filters.startDate)
      : filters.startDate;
    const endDate = typeof filters.endDate === "string"
      ? parseISO(filters.endDate)
      : filters.endDate;
    
    // Get venue-filtered users
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    
    // Build roster query to get rosters for the date range
    const rosterWhere: any = {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };
    
    // Venue filtering for rosters
    if (filters.venueIds && filters.venueIds.length > 0) {
      rosterWhere.venueId = { in: filters.venueIds };
    } else if (filters.venueId) {
      rosterWhere.venueId = filters.venueId;
    }
    
    // Fetch rosters
    const rosters = await prisma.roster.findMany({
      where: rosterWhere,
      select: {
        id: true,
        venueId: true,
        venue: {
          select: {
            id: true,
            name: true,
            payConfig: true,
          },
        },
      },
    });
    
    // Get venue pay configs
    const venuePayConfigs = new Map<string, any>();
    for (const roster of rosters) {
      if (roster.venue?.payConfig && !venuePayConfigs.has(roster.venueId)) {
        venuePayConfigs.set(roster.venueId, roster.venue.payConfig);
      }
    }
    
    // Build shift query
    const shiftWhere: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
      rosterId: { in: rosters.map(r => r.id) },
      userId: { not: null },
    };
    
    // Staff filtering
    if (filters.staffIds && filters.staffIds.length > 0) {
      shiftWhere.userId = { in: filters.staffIds };
    } else if (filters.staffId) {
      shiftWhere.userId = filters.staffId;
    } else {
      shiftWhere.userId = { in: sharedVenueUserIds };
    }
    
    // Fetch shifts with raw query to include custom fields
    const shifts = await prisma.$queryRaw<Array<{
      id: string;
      date: Date;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      position: string | null;
      userId: string | null;
      rosterId: string;
      // User fields
      userFirstName: string | null;
      userLastName: string | null;
      userEmail: string;
      userWeekdayRate: Decimal | null;
      userSaturdayRate: Decimal | null;
      userSundayRate: Decimal | null;
      userSuperEnabled: boolean | null;
      userCustomSuperRate: Decimal | null;
      // Roster fields
      rosterVenueId: string;
    }>>`
      SELECT 
        rs.id, rs.date, rs."startTime", rs."endTime", rs."breakMinutes", rs.position, rs."userId", rs."rosterId",
        u."firstName" as "userFirstName", u."lastName" as "userLastName", u.email as "userEmail",
        u."weekdayRate" as "userWeekdayRate", u."saturdayRate" as "userSaturdayRate", u."sundayRate" as "userSundayRate",
        u."superEnabled" as "userSuperEnabled", u."customSuperRate" as "userCustomSuperRate",
        r."venueId" as "rosterVenueId"
      FROM "roster_shifts" rs
      JOIN "rosters" r ON rs."rosterId" = r.id
      LEFT JOIN "users" u ON rs."userId" = u.id
      WHERE rs.date >= ${startDate.toISOString()}::timestamp
        AND rs.date <= ${endDate.toISOString()}::timestamp
        AND rs."userId" IS NOT NULL
        AND r.id IN (${rosters.map(r => `'${r.id}'`).join(',')})
        ${filters.staffIds?.length ? `AND rs."userId" IN (${filters.staffIds.map(id => `'${id}'`).join(',')})` : ''}
        ${filters.staffId ? `AND rs."userId" = '${filters.staffId}'` : ''}
        ${!filters.staffId && !filters.staffIds?.length ? `AND rs."userId" IN (${sharedVenueUserIds.map(id => `'${id}'`).join(',')})` : ''}
    `;
    
    if (shifts.length === 0) {
      return {
        success: true,
        data: {
          summary: {
            totalHours: 0,
            basePay: 0,
            overtimePay: 0,
            latePay: 0,
            grossPay: 0,
            superPay: 0,
            totalCost: 0,
            shiftCount: 0,
            staffCount: 0,
          },
          breakdown: [],
        },
      };
    }
    
    // Calculate pay for each shift
    let totalHours = 0;
    let basePay = 0;
    let overtimePay = 0;
    let latePay = 0;
    let grossPay = 0;
    let superPay = 0;
    
    const dailyMap = new Map<string, DailyPaySummary>();
    const staffMap = new Map<string, StaffPaySummary>();
    const weekMap = new Map<string, WeeklyBreakdown>();
    const uniqueStaff = new Set<string>();
    
    for (const shift of shifts) {
      if (!shift.userId) continue;
      
      const venueConfigRaw = venuePayConfigs.get(shift.rosterVenueId);
      if (!venueConfigRaw) continue;
      
      const venueSuper = getVenueConfigSuper(venueConfigRaw);
      
      const staffRates: StaffPayRates = {
        weekdayRate: shift.userWeekdayRate,
        saturdayRate: shift.userSaturdayRate,
        sundayRate: shift.userSundayRate,
      };
      
      const superConfig = getEffectiveSuperConfig(
        shift.userSuperEnabled,
        shift.userCustomSuperRate,
        venueSuper.superEnabled,
        venueSuper.superRate
      );
      
      const shiftInput: ShiftPayInput = {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes || 0,
      };
      
      const breakdown = calculateShiftPayBreakdownWithSuper(
        shiftInput,
        staffRates,
        venueConfigRaw as any,
        undefined,
        superConfig
      );
      
      if (!breakdown) continue;
      
      uniqueStaff.add(shift.userId);
      
      // Accumulate totals
      totalHours += breakdown.totalHours;
      basePay += breakdown.basePay;
      overtimePay += breakdown.overtimePay;
      latePay += breakdown.latePay;
      grossPay += breakdown.grossPay;
      superPay += breakdown.superPay;
      
      // Daily breakdown
      const dateKey = format(shift.date, "yyyy-MM-dd");
      const existingDay = dailyMap.get(dateKey) || {
        date: shift.date,
        dateKey,
        totalHours: 0,
        basePay: 0,
        overtimePay: 0,
        latePay: 0,
        grossPay: 0,
        superPay: 0,
        totalCost: 0,
        shiftCount: 0,
      };
      
      existingDay.totalHours += breakdown.totalHours;
      existingDay.basePay += breakdown.basePay;
      existingDay.overtimePay += breakdown.overtimePay;
      existingDay.latePay += breakdown.latePay;
      existingDay.grossPay += breakdown.grossPay;
      existingDay.superPay += breakdown.superPay;
      existingDay.totalCost += breakdown.totalCost;
      existingDay.shiftCount++;
      
      dailyMap.set(dateKey, existingDay);
      
      // Staff breakdown
      const staffName = `${shift.userFirstName || ""} ${shift.userLastName || ""}`.trim() || shift.userEmail;
      const existingStaff = staffMap.get(shift.userId) || {
        staffId: shift.userId,
        staffName,
        email: shift.userEmail,
        position: shift.position || "Unknown",
        totalHours: 0,
        basePay: 0,
        overtimePay: 0,
        latePay: 0,
        grossPay: 0,
        superPay: 0,
        totalCost: 0,
        superEnabled: superConfig.enabled,
        superRate: superConfig.rate,
        shiftCount: 0,
      };
      
      existingStaff.totalHours += breakdown.totalHours;
      existingStaff.basePay += breakdown.basePay;
      existingStaff.overtimePay += breakdown.overtimePay;
      existingStaff.latePay += breakdown.latePay;
      existingStaff.grossPay += breakdown.grossPay;
      existingStaff.superPay += breakdown.superPay;
      existingStaff.totalCost += breakdown.totalCost;
      existingStaff.shiftCount++;
      
      staffMap.set(shift.userId, existingStaff);
      
      // Weekly breakdown
      const weekStart = format(startOfWeek(shift.date, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekEnd = format(endOfWeek(shift.date, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const weekKey = `${weekStart}_${weekEnd}`;
      
      const existingWeek = weekMap.get(weekKey) || {
        weekStart,
        weekEnd,
        totalHours: 0,
        basePay: 0,
        overtimePay: 0,
        latePay: 0,
        grossPay: 0,
        superPay: 0,
        totalCost: 0,
        shiftCount: 0,
        staffCount: 0,
      };
      
      existingWeek.totalHours += breakdown.totalHours;
      existingWeek.basePay += breakdown.basePay;
      existingWeek.overtimePay += breakdown.overtimePay;
      existingWeek.latePay += breakdown.latePay;
      existingWeek.grossPay += breakdown.grossPay;
      existingWeek.superPay += breakdown.superPay;
      existingWeek.totalCost += breakdown.totalCost;
      existingWeek.shiftCount++;
      
      weekMap.set(weekKey, existingWeek);
    }
    
    // Update staff counts in weekly breakdown
    for (const [weekKey, weekData] of weekMap.entries()) {
      const [weekStartStr] = weekKey.split("_");
      const weekShifts = shifts.filter(s => {
        const shiftWeekStart = format(startOfWeek(s.date, { weekStartsOn: 1 }), "yyyy-MM-dd");
        return shiftWeekStart === weekStartStr && s.userId;
      });
      weekData.staffCount = new Set(weekShifts.map(s => s.userId)).size;
    }
    
    // Build response based on groupBy
    let breakdown: any[];
    switch (filters.groupBy) {
      case "day":
        breakdown = Array.from(dailyMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
        break;
      case "week":
        breakdown = Array.from(weekMap.values()).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
        break;
      case "staff":
        breakdown = Array.from(staffMap.values()).sort((a, b) => a.staffName.localeCompare(b.staffName));
        break;
      default:
        breakdown = Array.from(dailyMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    }
    
    const response: RosterPayReportData = {
      summary: {
        totalHours,
        basePay: Math.round(basePay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        latePay: Math.round(latePay * 100) / 100,
        grossPay: Math.round(grossPay * 100) / 100,
        superPay: Math.round(superPay * 100) / 100,
        totalCost: Math.round((grossPay + superPay) * 100) / 100,
        shiftCount: shifts.length,
        staffCount: uniqueStaff.size,
      },
      breakdown,
    };
    
    return { success: true, data: response };
  } catch (error) {
    console.error("Error generating roster pay report:", error);
    return { error: "Failed to generate pay report" };
  }
}

/**
 * Get detailed cost analysis with breakdowns by date, staff, and position
 */
export async function getCostAnalysisReport(filters: RosterPayReportFilters) {
  const user = await requireAuth();
  
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view cost reports" };
  }
  
  try {
    const startDate = typeof filters.startDate === "string"
      ? parseISO(filters.startDate)
      : filters.startDate;
    const endDate = typeof filters.endDate === "string"
      ? parseISO(filters.endDate)
      : filters.endDate;
    
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    
    // Build roster query
    const rosterWhere: any = {
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };
    
    if (filters.venueIds && filters.venueIds.length > 0) {
      rosterWhere.venueId = { in: filters.venueIds };
    } else if (filters.venueId) {
      rosterWhere.venueId = filters.venueId;
    }
    
    const rosters = await prisma.roster.findMany({
      where: rosterWhere,
      select: {
        id: true,
        venueId: true,
        venue: {
          select: {
            payConfig: true,
          },
        },
      },
    });
    
    // Get venue pay configs
    const venuePayConfigs = new Map<string, any>();
    for (const roster of rosters) {
      if (roster.venue?.payConfig && !venuePayConfigs.has(roster.venueId)) {
        venuePayConfigs.set(roster.venueId, roster.venue.payConfig);
      }
    }
    
    // Build shift query
    const shiftWhere: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
      rosterId: { in: rosters.map(r => r.id) },
      userId: { not: null },
    };
    
    if (filters.staffIds && filters.staffIds.length > 0) {
      shiftWhere.userId = { in: filters.staffIds };
    } else if (filters.staffId) {
      shiftWhere.userId = filters.staffId;
    } else {
      shiftWhere.userId = { in: sharedVenueUserIds };
    }
    
    // Fetch shifts
    const shifts = await prisma.$queryRaw<Array<{
      id: string;
      date: Date;
      startTime: string;
      endTime: string;
      breakMinutes: number;
      position: string | null;
      userId: string | null;
      rosterId: string;
      userFirstName: string | null;
      userLastName: string | null;
      userEmail: string;
      userWeekdayRate: Decimal | null;
      userSaturdayRate: Decimal | null;
      userSundayRate: Decimal | null;
      userSuperEnabled: boolean | null;
      userCustomSuperRate: Decimal | null;
      rosterVenueId: string;
    }>>`
      SELECT 
        rs.id, rs.date, rs."startTime", rs."endTime", rs."breakMinutes", rs.position, rs."userId", rs."rosterId",
        u."firstName" as "userFirstName", u."lastName" as "userLastName", u.email as "userEmail",
        u."weekdayRate" as "userWeekdayRate", u."saturdayRate" as "userSaturdayRate", u."sundayRate" as "userSundayRate",
        u."superEnabled" as "userSuperEnabled", u."customSuperRate" as "userCustomSuperRate",
        r."venueId" as "rosterVenueId"
      FROM "roster_shifts" rs
      JOIN "rosters" r ON rs."rosterId" = r.id
      LEFT JOIN "users" u ON rs."userId" = u.id
      WHERE rs.date >= ${startDate.toISOString()}::timestamp
        AND rs.date <= ${endDate.toISOString()}::timestamp
        AND rs."userId" IS NOT NULL
        AND r.id IN (${rosters.map(r => `'${r.id}'`).join(',')})
    `;
    
    if (shifts.length === 0) {
      return {
        success: true,
        data: {
          byDate: [],
          byStaff: [],
          byPosition: [],
          summary: {
            totalHours: 0,
            basePay: 0,
            overtimePay: 0,
            latePay: 0,
            grossPay: 0,
            superPay: 0,
            totalCost: 0,
            shiftCount: 0,
            staffCount: 0,
          },
        },
      };
    }
    
    // Calculate all breakdowns
    let totalHours = 0;
    let basePay = 0;
    let overtimePay = 0;
    let latePay = 0;
    let grossPay = 0;
    let superPay = 0;
    
    const dailyMap = new Map<string, DailyPaySummary>();
    const staffMap = new Map<string, StaffPaySummary>();
    const positionMap = new Map<string, PositionCostBreakdown>();
    const uniqueStaff = new Set<string>();
    
    for (const shift of shifts) {
      if (!shift.userId) continue;
      
      const venueConfigRaw = venuePayConfigs.get(shift.rosterVenueId);
      if (!venueConfigRaw) continue;
      
      const venueSuper = getVenueConfigSuper(venueConfigRaw);
      
      const staffRates: StaffPayRates = {
        weekdayRate: shift.userWeekdayRate,
        saturdayRate: shift.userSaturdayRate,
        sundayRate: shift.userSundayRate,
      };
      
      const superConfig = getEffectiveSuperConfig(
        shift.userSuperEnabled,
        shift.userCustomSuperRate,
        venueSuper.superEnabled,
        venueSuper.superRate
      );
      
      const shiftInput: ShiftPayInput = {
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes || 0,
      };
      
      const breakdown = calculateShiftPayBreakdownWithSuper(
        shiftInput,
        staffRates,
        venueConfigRaw as any,
        undefined,
        superConfig
      );
      
      if (!breakdown) continue;
      
      uniqueStaff.add(shift.userId);
      
      totalHours += breakdown.totalHours;
      basePay += breakdown.basePay;
      overtimePay += breakdown.overtimePay;
      latePay += breakdown.latePay;
      grossPay += breakdown.grossPay;
      superPay += breakdown.superPay;
      
      // Daily breakdown
      const dateKey = format(shift.date, "yyyy-MM-dd");
      const existingDay = dailyMap.get(dateKey) || {
        date: shift.date,
        dateKey,
        totalHours: 0,
        basePay: 0,
        overtimePay: 0,
        latePay: 0,
        grossPay: 0,
        superPay: 0,
        totalCost: 0,
        shiftCount: 0,
      };
      
      existingDay.totalHours += breakdown.totalHours;
      existingDay.basePay += breakdown.basePay;
      existingDay.overtimePay += breakdown.overtimePay;
      existingDay.latePay += breakdown.latePay;
      existingDay.grossPay += breakdown.grossPay;
      existingDay.superPay += breakdown.superPay;
      existingDay.totalCost += breakdown.totalCost;
      existingDay.shiftCount++;
      
      dailyMap.set(dateKey, existingDay);
      
      // Staff breakdown
      const staffName = `${shift.userFirstName || ""} ${shift.userLastName || ""}`.trim() || shift.userEmail;
      const existingStaff = staffMap.get(shift.userId) || {
        staffId: shift.userId,
        staffName,
        email: shift.userEmail,
        position: shift.position || "Unknown",
        totalHours: 0,
        basePay: 0,
        overtimePay: 0,
        latePay: 0,
        grossPay: 0,
        superPay: 0,
        totalCost: 0,
        superEnabled: superConfig.enabled,
        superRate: superConfig.rate,
        shiftCount: 0,
      };
      
      existingStaff.totalHours += breakdown.totalHours;
      existingStaff.basePay += breakdown.basePay;
      existingStaff.overtimePay += breakdown.overtimePay;
      existingStaff.latePay += breakdown.latePay;
      existingStaff.grossPay += breakdown.grossPay;
      existingStaff.superPay += breakdown.superPay;
      existingStaff.totalCost += breakdown.totalCost;
      existingStaff.shiftCount++;
      
      staffMap.set(shift.userId, existingStaff);
      
      // Position breakdown
      const positionId = shift.position || "unknown";
      const positionName = shift.position || "Unknown";
      
      const existingPosition = positionMap.get(positionId) || {
        positionId,
        positionName,
        positionColor: "#6B7280",
        staffCount: 0,
        totalHours: 0,
        basePay: 0,
        overtimePay: 0,
        latePay: 0,
        grossPay: 0,
        superPay: 0,
        totalCost: 0,
        shiftCount: 0,
      };
      
      existingPosition.totalHours += breakdown.totalHours;
      existingPosition.basePay += breakdown.basePay;
      existingPosition.overtimePay += breakdown.overtimePay;
      existingPosition.latePay += breakdown.latePay;
      existingPosition.grossPay += breakdown.grossPay;
      existingPosition.superPay += breakdown.superPay;
      existingPosition.totalCost += breakdown.totalCost;
      existingPosition.shiftCount++;
      
      positionMap.set(positionId, existingPosition);
    }
    
    // Update staff counts for positions
    for (const [positionId, positionData] of positionMap.entries()) {
      const positionShifts = shifts.filter(s => (s.position || "unknown") === positionId && s.userId);
      positionData.staffCount = new Set(positionShifts.map(s => s.userId)).size;
    }
    
    const response: CostAnalysisReport = {
      byDate: Array.from(dailyMap.values()).sort((a, b) => a.dateKey.localeCompare(b.dateKey)),
      byStaff: Array.from(staffMap.values()).sort((a, b) => b.totalCost - a.totalCost),
      byPosition: Array.from(positionMap.values()).sort((a, b) => b.totalCost - a.totalCost),
      summary: {
        totalHours,
        basePay: Math.round(basePay * 100) / 100,
        overtimePay: Math.round(overtimePay * 100) / 100,
        latePay: Math.round(latePay * 100) / 100,
        grossPay: Math.round(grossPay * 100) / 100,
        superPay: Math.round(superPay * 100) / 100,
        totalCost: Math.round((grossPay + superPay) * 100) / 100,
        shiftCount: shifts.length,
        staffCount: uniqueStaff.size,
      },
    };
    
    return { success: true, data: response };
  } catch (error) {
    console.error("Error generating cost analysis report:", error);
    return { error: "Failed to generate cost analysis" };
  }
}

/**
 * Get pay trends over time (week by week or month by month)
 */
export async function getPayTrends(period: "week" | "month" = "week", count: number = 8) {
  const user = await requireAuth();
  
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view pay trends" };
  }
  
  try {
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    const trends: PayTrendData[] = [];
    
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
      let start: Date;
      let end: Date;
      let periodLabel: string;
      
      if (period === "week") {
        const weekDate = subWeeks(now, i);
        start = startOfWeek(weekDate, { weekStartsOn: 1 });
        end = endOfWeek(weekDate, { weekStartsOn: 1 });
        periodLabel = format(start, "MMM d");
      } else {
        const monthDate = subMonths(now, i);
        start = startOfMonth(monthDate);
        end = endOfMonth(monthDate);
        periodLabel = format(start, "MMM yyyy");
      }
      
      // Get rosters for this period
      const rosters = await prisma.roster.findMany({
        where: {
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: {
          id: true,
          venueId: true,
          venue: {
            select: {
              payConfig: true,
            },
          },
        },
      });
      
      // Get venue pay configs
      const venuePayConfigs = new Map<string, any>();
      for (const roster of rosters) {
        if (roster.venue?.payConfig && !venuePayConfigs.has(roster.venueId)) {
          venuePayConfigs.set(roster.venueId, roster.venue.payConfig);
        }
      }
      
      // Get shifts for this period
      const shifts = await prisma.$queryRaw<Array<{
        id: string;
        date: Date;
        startTime: string;
        endTime: string;
        breakMinutes: number;
        userId: string | null;
        rosterVenueId: string;
        userWeekdayRate: Decimal | null;
        userSaturdayRate: Decimal | null;
        userSundayRate: Decimal | null;
        userSuperEnabled: boolean | null;
        userCustomSuperRate: Decimal | null;
      }>>`
        SELECT 
          rs.id, rs.date, rs."startTime", rs."endTime", rs."breakMinutes", rs."userId",
          u."weekdayRate" as "userWeekdayRate", u."saturdayRate" as "userSaturdayRate", 
          u."sundayRate" as "userSundayRate", u."superEnabled" as "userSuperEnabled", 
          u."customSuperRate" as "userCustomSuperRate",
          r."venueId" as "rosterVenueId"
        FROM "roster_shifts" rs
        JOIN "rosters" r ON rs."rosterId" = r.id
        LEFT JOIN "users" u ON rs."userId" = u.id
        WHERE rs.date >= ${start.toISOString()}::timestamp
          AND rs.date <= ${end.toISOString()}::timestamp
          AND rs."userId" IS NOT NULL
          AND rs."userId" IN (${sharedVenueUserIds.map(id => `'${id}'`).join(',')})
      `;
      
      let hours = 0;
      let gross = 0;
      let sup = 0;
      
      for (const shift of shifts) {
        if (!shift.userId) continue;
        
        const venueConfigRaw = venuePayConfigs.get(shift.rosterVenueId);
        if (!venueConfigRaw) continue;
        
        const venueSuper = getVenueConfigSuper(venueConfigRaw);
        
        const staffRates: StaffPayRates = {
          weekdayRate: shift.userWeekdayRate,
          saturdayRate: shift.userSaturdayRate,
          sundayRate: shift.userSundayRate,
        };
        
        const superConfig = getEffectiveSuperConfig(
          shift.userSuperEnabled,
          shift.userCustomSuperRate,
          venueSuper.superEnabled,
          venueSuper.superRate
        );
        
        const shiftInput: ShiftPayInput = {
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes || 0,
        };
        
        const breakdown = calculateShiftPayBreakdownWithSuper(
          shiftInput,
          staffRates,
          venueConfigRaw as any,
          undefined,
          superConfig
        );
        
        if (breakdown) {
          hours += breakdown.totalHours;
          gross += breakdown.grossPay;
          sup += breakdown.superPay;
        }
      }
      
      trends.push({
        period: periodLabel,
        grossPay: Math.round(gross * 100) / 100,
        superPay: Math.round(sup * 100) / 100,
        totalCost: Math.round((gross + sup) * 100) / 100,
        hours: Math.round(hours * 100) / 100,
      });
    }
    
    return { success: true, trends };
  } catch (error) {
    console.error("Error fetching pay trends:", error);
    return { error: "Failed to fetch pay trends" };
  }
}

/**
 * Export pay report to CSV/Excel format data
 */
export async function exportPayReportData(filters: RosterPayReportFilters) {
  const user = await requireAuth();
  
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to export pay reports" };
  }
  
  try {
    const reportResult = await getCostAnalysisReport(filters);
    
    if (!reportResult.success || !reportResult.data) {
      return { error: reportResult.error || "Failed to generate report" };
    }
    
    const { data } = reportResult;
    
    // Format for export
    const exportData = {
      summary: {
        "Total Hours": formatHours(data.summary.totalHours),
        "Base Pay": formatCurrency(data.summary.basePay),
        "Overtime Pay": formatCurrency(data.summary.overtimePay),
        "Late Pay": formatCurrency(data.summary.latePay),
        "Gross Pay (Wages)": formatCurrency(data.summary.grossPay),
        "Superannuation": formatCurrency(data.summary.superPay),
        "Total Cost": formatCurrency(data.summary.totalCost),
        "Total Shifts": data.summary.shiftCount,
        "Staff Count": data.summary.staffCount,
      },
      byStaff: data.byStaff.map(s => ({
        "Staff Name": s.staffName,
        "Email": s.email,
        "Position": s.position,
        "Hours": formatHours(s.totalHours),
        "Base Pay": formatCurrency(s.basePay),
        "Overtime Pay": formatCurrency(s.overtimePay),
        "Late Pay": formatCurrency(s.latePay),
        "Gross Pay": formatCurrency(s.grossPay),
        "Super": formatCurrency(s.superPay),
        "Total Cost": formatCurrency(s.totalCost),
        "Shifts": s.shiftCount,
      })),
      byDate: data.byDate.map(d => ({
        "Date": format(d.date, "EEE, MMM d"),
        "Hours": formatHours(d.totalHours),
        "Base Pay": formatCurrency(d.basePay),
        "Overtime Pay": formatCurrency(d.overtimePay),
        "Late Pay": formatCurrency(d.latePay),
        "Gross Pay": formatCurrency(d.grossPay),
        "Super": formatCurrency(d.superPay),
        "Total Cost": formatCurrency(d.totalCost),
        "Shifts": d.shiftCount,
      })),
      byPosition: data.byPosition.map(p => ({
        "Position": p.positionName,
        "Staff Count": p.staffCount,
        "Hours": formatHours(p.totalHours),
        "Base Pay": formatCurrency(p.basePay),
        "Overtime Pay": formatCurrency(p.overtimePay),
        "Late Pay": formatCurrency(p.latePay),
        "Gross Pay": formatCurrency(p.grossPay),
        "Super": formatCurrency(p.superPay),
        "Total Cost": formatCurrency(p.totalCost),
        "Shifts": p.shiftCount,
      })),
    };
    
    return { success: true, data: exportData };
  } catch (error) {
    console.error("Error exporting pay report:", error);
    return { error: "Failed to export pay report" };
  }
}
