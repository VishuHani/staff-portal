"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import {
  eachDayOfInterval,
  format,
  parseISO,
  startOfDay,
  endOfDay,
  isWithinInterval,
} from "date-fns";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface TimeOffReportFilters {
  startDate: Date | string;
  endDate: Date | string;
  venueIds?: string[];
  roleIds?: string[];
  status?: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "all";
  searchQuery?: string;
}

export interface TimeOffRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userRole: string;
  userVenues: string[];
  profileImage?: string;
  startDate: string;
  endDate: string;
  type: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reason?: string;
  notes?: string;
  reviewerName?: string;
}

export interface DailyCoverageImpact {
  date: string;
  totalStaff: number;
  staffOff: number;
  percentage: number;
  hasConflict: boolean;
  severity: "none" | "low" | "medium" | "high" | "critical";
  requests: TimeOffRequest[];
}

export interface ConflictAlert {
  id: string;
  date: string;
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  staffOffCount: number;
  totalStaff: number;
  percentage: number;
  affectedRequests: string[];
}

export interface TimeOffReportData {
  requests: TimeOffRequest[];
  dailyCoverage: DailyCoverageImpact[];
  conflicts: ConflictAlert[];
  summary: {
    totalRequests: number;
    byStatus: {
      pending: number;
      approved: number;
      rejected: number;
      cancelled: number;
    };
    averageImpact: number;
    peakImpactDate: string;
    peakImpactPercentage: number;
  };
}

// ============================================================================
// MAIN SERVER ACTION
// ============================================================================

/**
 * Get time-off report with coverage impact analysis
 */
export async function getTimeOffReport(filters: TimeOffReportFilters) {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team reports" };
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

    // Build user query for filtering
    const userWhere: any = {
      id: { in: sharedVenueUserIds },
      active: true,
    };

    // Role filtering
    if (filters.roleIds && filters.roleIds.length > 0) {
      userWhere.roleId = { in: filters.roleIds };
    }

    // Venue filtering
    if (filters.venueIds && filters.venueIds.length > 0) {
      userWhere.venues = {
        some: {
          venueId: { in: filters.venueIds },
        },
      };
    }

    // Search filtering
    if (filters.searchQuery) {
      const searchTerm = filters.searchQuery.trim();
      const searchWords = searchTerm.split(/\s+/);

      if (searchWords.length > 1) {
        userWhere.AND = searchWords.map(word => ({
          OR: [
            { firstName: { contains: word, mode: "insensitive" } },
            { lastName: { contains: word, mode: "insensitive" } },
            { email: { contains: word, mode: "insensitive" } },
          ],
        }));
      } else {
        userWhere.OR = [
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
        ];
      }
    }

    // Get filtered users
    const filteredUsers = await prisma.user.findMany({
      where: userWhere,
      select: { id: true },
    });

    const filteredUserIds = filteredUsers.map(u => u.id);

    // Build time-off request query
    const requestWhere: any = {
      userId: { in: filteredUserIds },
      OR: [
        {
          AND: [
            { startDate: { lte: endDate } },
            { endDate: { gte: startDate } },
          ],
        },
      ],
    };

    // Status filtering
    if (filters.status && filters.status !== "all") {
      requestWhere.status = filters.status;
    }

    // Fetch time-off requests
    const timeOffRequests = await prisma.timeOffRequest.findMany({
      where: requestWhere,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            profileImage: true,
            role: {
              select: {
                name: true,
              },
            },
            venues: {
              include: {
                venue: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: [
        { startDate: "asc" },
        { status: "asc" },
      ],
    });

    // Get all staff for coverage calculation
    const allStaff = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });

    const totalStaff = allStaff.length;

    // Transform requests
    const requests: TimeOffRequest[] = timeOffRequests.map((req) => ({
      id: req.id,
      userId: req.user.id,
      userName: req.user.firstName && req.user.lastName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email,
      userEmail: req.user.email,
      userRole: req.user.role.name,
      userVenues: req.user.venues.map(uv => uv.venue.name),
      profileImage: req.user.profileImage || undefined,
      startDate: req.startDate.toISOString(),
      endDate: req.endDate.toISOString(),
      type: req.type,
      status: req.status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED",
      reason: req.reason || undefined,
      notes: req.notes || undefined,
      reviewerName: req.reviewer
        ? req.reviewer.firstName && req.reviewer.lastName
          ? `${req.reviewer.firstName} ${req.reviewer.lastName}`
          : req.reviewer.email
        : undefined,
    }));

    // Generate date range
    const dates = eachDayOfInterval({ start: startDate, end: endDate });

    // Calculate daily coverage impact
    const dailyCoverage: DailyCoverageImpact[] = dates.map((date) => {
      const dateStr = format(date, "yyyy-MM-dd");

      // Find requests that overlap this date
      const requestsToday = timeOffRequests.filter((req) => {
        const reqStart = startOfDay(new Date(req.startDate));
        const reqEnd = endOfDay(new Date(req.endDate));
        return isWithinInterval(date, { start: reqStart, end: reqEnd });
      });

      const staffOff = requestsToday.length;
      const percentage = totalStaff > 0 ? (staffOff / totalStaff) * 100 : 0;

      // Determine severity
      let severity: "none" | "low" | "medium" | "high" | "critical" = "none";
      let hasConflict = false;

      if (percentage >= 70) {
        severity = "critical";
        hasConflict = true;
      } else if (percentage >= 50) {
        severity = "high";
        hasConflict = true;
      } else if (percentage >= 30) {
        severity = "medium";
        hasConflict = true;
      } else if (percentage >= 15) {
        severity = "low";
        hasConflict = false;
      }

      return {
        date: dateStr,
        totalStaff,
        staffOff,
        percentage: Math.round(percentage * 10) / 10,
        hasConflict,
        severity,
        requests: requestsToday.map(req => ({
          id: req.id,
          userId: req.user.id,
          userName: req.user.firstName && req.user.lastName
            ? `${req.user.firstName} ${req.user.lastName}`
            : req.user.email,
          userEmail: req.user.email,
          userRole: req.user.role.name,
          userVenues: req.user.venues.map(uv => uv.venue.name),
          profileImage: req.user.profileImage || undefined,
          startDate: req.startDate.toISOString(),
          endDate: req.endDate.toISOString(),
          type: req.type,
          status: req.status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED",
          reason: req.reason || undefined,
          notes: req.notes || undefined,
          reviewerName: req.reviewer
            ? req.reviewer.firstName && req.reviewer.lastName
              ? `${req.reviewer.firstName} ${req.reviewer.lastName}`
              : req.reviewer.email
            : undefined,
        })),
      };
    });

    // Generate conflict alerts
    const conflicts: ConflictAlert[] = [];

    for (const coverage of dailyCoverage) {
      if (coverage.hasConflict) {
        let alertSeverity: "critical" | "warning" | "info" = "info";
        let title = "";
        let description = "";

        if (coverage.severity === "critical") {
          alertSeverity = "critical";
          title = "Critical Coverage Issue";
          description = `${coverage.staffOff} of ${coverage.totalStaff} staff (${coverage.percentage}%) are off on ${format(parseISO(coverage.date), "EEEE, MMMM d")}`;
        } else if (coverage.severity === "high") {
          alertSeverity = "critical";
          title = "High Time-Off Impact";
          description = `${coverage.staffOff} of ${coverage.totalStaff} staff (${coverage.percentage}%) are off on ${format(parseISO(coverage.date), "EEEE, MMMM d")}`;
        } else if (coverage.severity === "medium") {
          alertSeverity = "warning";
          title = "Moderate Time-Off Impact";
          description = `${coverage.staffOff} of ${coverage.totalStaff} staff (${coverage.percentage}%) are off on ${format(parseISO(coverage.date), "EEEE, MMMM d")}`;
        }

        if (title) {
          conflicts.push({
            id: `conflict-${coverage.date}`,
            date: coverage.date,
            severity: alertSeverity,
            title,
            description,
            staffOffCount: coverage.staffOff,
            totalStaff: coverage.totalStaff,
            percentage: coverage.percentage,
            affectedRequests: coverage.requests.map(r => r.id),
          });
        }
      }
    }

    // Sort conflicts by severity and date
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    conflicts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.date.localeCompare(b.date);
    });

    // Calculate summary statistics
    const byStatus = {
      pending: requests.filter(r => r.status === "PENDING").length,
      approved: requests.filter(r => r.status === "APPROVED").length,
      rejected: requests.filter(r => r.status === "REJECTED").length,
      cancelled: requests.filter(r => r.status === "CANCELLED").length,
    };

    const coveragePercentages = dailyCoverage.map(d => d.percentage);
    const averageImpact = coveragePercentages.length > 0
      ? coveragePercentages.reduce((sum, p) => sum + p, 0) / coveragePercentages.length
      : 0;

    const peakCoverage = dailyCoverage.reduce((max, d) =>
      d.percentage > max.percentage ? d : max
    , dailyCoverage[0] || { date: "", percentage: 0 });

    const reportData: TimeOffReportData = {
      requests,
      dailyCoverage,
      conflicts,
      summary: {
        totalRequests: requests.length,
        byStatus,
        averageImpact: Math.round(averageImpact * 10) / 10,
        peakImpactDate: peakCoverage.date,
        peakImpactPercentage: peakCoverage.percentage,
      },
    };

    return { success: true, data: reportData };
  } catch (error) {
    console.error("Error generating time-off report:", error);
    return { error: "Failed to generate time-off report" };
  }
}
