"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { computeEffectiveAvailability, type AvailabilityStatus } from "@/lib/utils/availability";
import {
  eachDayOfInterval,
  getDay,
  isWithinInterval,
  startOfDay,
  endOfDay,
  format,
  parseISO,
  addDays,
} from "date-fns";

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface MatrixFilters {
  startDate: Date | string;
  endDate: Date | string;
  venueId?: string;
  roleId?: string;
  timeSlotStart?: string; // "HH:mm" format
  timeSlotEnd?: string; // "HH:mm" format
  searchQuery?: string;
}

export interface CoverageFilters {
  startDate: Date | string;
  endDate: Date | string;
  venueId?: string;
  requiredStaffing?: number;
}

export interface ConflictFilters {
  startDate: Date | string;
  endDate: Date | string;
  venueId?: string;
  severityLevel?: "all" | "critical" | "warning" | "info";
}

export interface GapFilters {
  startDate: Date | string;
  endDate: Date | string;
  venueId?: string;
  minimumStaff?: number;
}

// AvailabilityStatus is now imported from @/lib/utils/availability

interface MatrixData {
  users: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    venues: Array<{ name: string }>;
    profileImage?: string;
  }>;
  dates: string[]; // ISO date strings
  matrix: Record<string, Record<string, AvailabilityStatus>>;
}

interface CoverageData {
  summary: {
    totalStaff: number;
    averageAvailability: number;
    peakAvailability: { date: string; count: number };
    lowAvailability: { date: string; count: number };
  };
  dailyCoverage: Array<{
    date: string;
    availableStaff: number;
    totalStaff: number;
    percentage: number;
    requiredStaff?: number;
    status: "adequate" | "understaffed" | "overstaffed";
  }>;
  heatmap: Record<number, Record<string, number>>; // dayOfWeek -> timeSlot -> count
}

interface Conflict {
  id: string;
  type: "understaffed" | "overlapping_timeoff" | "no_coverage" | "unscheduled";
  severity: "critical" | "warning" | "info";
  date: string;
  description: string;
  affectedUsers?: string[];
  suggestion?: string;
}

interface StaffingGap {
  date: string;
  availableStaff: number;
  requiredStaff: number;
  gap: number;
  affectedTimeSlots?: string[];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Helper functions (checkTimeSlotOverlap, computeEffectiveAvailability)
// are now imported from @/lib/utils/availability

/**
 * Convert time string (HH:mm) to minutes since midnight
 * Used for coverage heatmap calculations
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// ============================================================================
// MAIN SERVER ACTIONS
// ============================================================================

/**
 * Get availability matrix for staff scheduling
 * Returns a grid of users × dates with availability status
 */
export async function getAvailabilityMatrix(filters: MatrixFilters) {
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

    // Build query
    const where: any = {
      id: { in: sharedVenueUserIds },
      active: true,
    };

    // Role filtering: Support both multi-select (roleIds) and single (roleId)
    if (filters.roleIds && filters.roleIds.length > 0) {
      where.roleId = { in: filters.roleIds };
    } else if (filters.roleId) {
      where.roleId = filters.roleId;
    }

    // Venue filtering: Support both multi-select (venueIds) and single (venueId)
    if (filters.venueIds && filters.venueIds.length > 0) {
      where.venues = {
        some: {
          venueId: { in: filters.venueIds },
        },
      };
    } else if (filters.venueId) {
      where.venues = {
        some: {
          venueId: filters.venueId,
        },
      };
    }

    if (filters.searchQuery) {
      const searchTerm = filters.searchQuery.trim();
      const searchWords = searchTerm.split(/\s+/); // Split by whitespace

      if (searchWords.length > 1) {
        // Multi-word search: Check if all words match (can be in any field)
        where.AND = searchWords.map(word => ({
          OR: [
            { firstName: { contains: word, mode: "insensitive" } },
            { lastName: { contains: word, mode: "insensitive" } },
            { email: { contains: word, mode: "insensitive" } },
          ],
        }));
      } else {
        // Single word search: Check any field
        where.OR = [
          { firstName: { contains: searchTerm, mode: "insensitive" } },
          { lastName: { contains: searchTerm, mode: "insensitive" } },
          { email: { contains: searchTerm, mode: "insensitive" } },
        ];
      }
    }

    // Fetch users with their availability and time-off
    const users = await prisma.user.findMany({
      where,
      include: {
        role: {
          select: { name: true },
        },
        venues: {
          include: {
            venue: {
              select: { name: true },
            },
          },
        },
        availability: true,
        timeOffRequests: {
          where: {
            status: "APPROVED",
            OR: [
              {
                AND: [
                  { startDate: { lte: endDate } },
                  { endDate: { gte: startDate } },
                ],
              },
            ],
          },
        },
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    // Generate date range
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const dateStrings = dates.map((d) => d.toISOString());

    // Build matrix
    const matrix: Record<string, Record<string, AvailabilityStatus>> = {};
    const timeSlotFilter = filters.timeSlotStart && filters.timeSlotEnd
      ? { start: filters.timeSlotStart, end: filters.timeSlotEnd }
      : undefined;

    for (const u of users) {
      matrix[u.id] = computeEffectiveAvailability(
        u,
        startDate,
        endDate,
        timeSlotFilter
      );
    }

    // Transform users for response
    const userData = users.map((u) => ({
      id: u.id,
      name: u.firstName && u.lastName
        ? `${u.firstName} ${u.lastName}`
        : u.email,
      email: u.email,
      role: u.role.name,
      venues: u.venues.map((uv) => ({ name: uv.venue.name })),
      profileImage: u.profileImage || undefined,
    }));

    const response: MatrixData = {
      users: userData,
      dates: dateStrings,
      matrix,
    };

    return { success: true, data: response };
  } catch (error) {
    console.error("Error generating availability matrix:", error);
    return { error: "Failed to generate availability matrix" };
  }
}

/**
 * Get coverage analysis showing staffing levels over time
 */
export async function getCoverageAnalysis(filters: CoverageFilters) {
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

    // Build query
    const where: any = {
      id: { in: sharedVenueUserIds },
      active: true,
    };

    // Venue filtering: Support both multi-select (venueIds) and single (venueId)
    if (filters.venueIds && filters.venueIds.length > 0) {
      where.venues = {
        some: {
          venueId: { in: filters.venueIds },
        },
      };
    } else if (filters.venueId) {
      where.venues = {
        some: {
          venueId: filters.venueId,
        },
      };
    }

    // Fetch users
    const users = await prisma.user.findMany({
      where,
      include: {
        availability: true,
        timeOffRequests: {
          where: {
            status: "APPROVED",
            OR: [
              {
                AND: [
                  { startDate: { lte: endDate } },
                  { endDate: { gte: startDate } },
                ],
              },
            ],
          },
        },
      },
    });

    const totalStaff = users.length;
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const requiredStaff = filters.requiredStaffing || 0;

    // Calculate daily coverage
    const dailyCoverage = dates.map((date) => {
      const dateStr = date.toISOString();
      const dayOfWeek = getDay(date);

      let availableCount = 0;

      for (const u of users) {
        const availability = computeEffectiveAvailability(
          u,
          date,
          date,
          undefined
        );
        if (availability[dateStr]?.available) {
          availableCount++;
        }
      }

      const percentage = totalStaff > 0 ? (availableCount / totalStaff) * 100 : 0;

      let status: "adequate" | "understaffed" | "overstaffed" = "adequate";
      if (requiredStaff > 0) {
        if (availableCount < requiredStaff) {
          status = "understaffed";
        } else if (availableCount > requiredStaff * 1.5) {
          status = "overstaffed";
        }
      }

      return {
        date: dateStr,
        availableStaff: availableCount,
        totalStaff,
        percentage,
        requiredStaff: requiredStaff > 0 ? requiredStaff : undefined,
        status,
      };
    });

    // Calculate summary stats
    const availabilityCounts = dailyCoverage.map((d) => d.availableStaff);
    const avgAvailability =
      availabilityCounts.reduce((a, b) => a + b, 0) / availabilityCounts.length;
    const maxAvailability = Math.max(...availabilityCounts);
    const minAvailability = Math.min(...availabilityCounts);

    const peakDay = dailyCoverage.find((d) => d.availableStaff === maxAvailability);
    const lowDay = dailyCoverage.find((d) => d.availableStaff === minAvailability);

    // Generate heatmap (day of week × hour)
    const heatmap: Record<number, Record<string, number>> = {};
    for (let dow = 0; dow < 7; dow++) {
      heatmap[dow] = {};
      for (let hour = 0; hour < 24; hour++) {
        const timeSlot = `${hour.toString().padStart(2, "0")}:00`;
        let count = 0;

        for (const u of users) {
          const recurring = u.availability.find((a) => a.dayOfWeek === dow);
          if (recurring && recurring.isAvailable) {
            if (recurring.isAllDay) {
              count++;
            } else if (recurring.startTime && recurring.endTime) {
              const hourInRange =
                timeToMinutes(recurring.startTime) <= hour * 60 &&
                timeToMinutes(recurring.endTime) > hour * 60;
              if (hourInRange) {
                count++;
              }
            }
          }
        }

        heatmap[dow][timeSlot] = count;
      }
    }

    const response: CoverageData = {
      summary: {
        totalStaff,
        averageAvailability: Math.round(avgAvailability * 10) / 10,
        peakAvailability: {
          date: peakDay?.date || "",
          count: maxAvailability,
        },
        lowAvailability: {
          date: lowDay?.date || "",
          count: minAvailability,
        },
      },
      dailyCoverage,
      heatmap,
    };

    return { success: true, data: response };
  } catch (error) {
    console.error("Error generating coverage analysis:", error);
    return { error: "Failed to generate coverage analysis" };
  }
}

/**
 * Detect availability conflicts and scheduling issues
 */
export async function getAvailabilityConflicts(filters: ConflictFilters) {
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

    // Build query
    const where: any = {
      id: { in: sharedVenueUserIds },
      active: true,
    };

    // Venue filtering: Support both multi-select (venueIds) and single (venueId)
    if (filters.venueIds && filters.venueIds.length > 0) {
      where.venues = {
        some: {
          venueId: { in: filters.venueIds },
        },
      };
    } else if (filters.venueId) {
      where.venues = {
        some: {
          venueId: filters.venueId,
        },
      };
    }

    // Fetch users
    const users = await prisma.user.findMany({
      where,
      include: {
        availability: true,
        timeOffRequests: {
          where: {
            status: "APPROVED",
            OR: [
              {
                AND: [
                  { startDate: { lte: endDate } },
                  { endDate: { gte: startDate } },
                ],
              },
            ],
          },
        },
      },
    });

    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const conflicts: Conflict[] = [];

    // Check each date for conflicts
    for (const date of dates) {
      const dateStr = date.toISOString();
      const dayOfWeek = getDay(date);

      let availableCount = 0;
      const unavailableUsers: string[] = [];
      const unscheduledUsers: string[] = [];

      for (const u of users) {
        const availability = computeEffectiveAvailability(u, date, date, undefined);
        const status = availability[dateStr];

        if (status?.available) {
          availableCount++;
        } else {
          if (status?.reason === "Not Available") {
            unscheduledUsers.push(u.id);
          } else {
            unavailableUsers.push(u.id);
          }
        }
      }

      // Critical: No coverage
      if (availableCount === 0) {
        conflicts.push({
          id: `no-coverage-${dateStr}`,
          type: "no_coverage",
          severity: "critical",
          date: dateStr,
          description: `No staff available on ${format(date, "MMM dd, yyyy")}`,
          affectedUsers: unavailableUsers,
          suggestion: "Contact staff to adjust availability or approve time-off differently",
        });
      }
      // Warning: Low coverage
      else if (availableCount < 3 && users.length >= 5) {
        conflicts.push({
          id: `understaffed-${dateStr}`,
          type: "understaffed",
          severity: "warning",
          date: dateStr,
          description: `Only ${availableCount} staff available on ${format(date, "MMM dd, yyyy")}`,
          affectedUsers: unavailableUsers,
          suggestion: `Consider reaching out to ${unscheduledUsers.length} unscheduled staff members`,
        });
      }

      // Info: Many unscheduled
      if (unscheduledUsers.length > users.length * 0.3) {
        conflicts.push({
          id: `unscheduled-${dateStr}`,
          type: "unscheduled",
          severity: "info",
          date: dateStr,
          description: `${unscheduledUsers.length} staff have not set availability for ${format(date, "MMM dd, yyyy")}`,
          affectedUsers: unscheduledUsers,
          suggestion: "Remind staff to update their availability schedules",
        });
      }
    }

    // Check for overlapping time-off requests (same user, overlapping dates)
    for (const u of users) {
      const approvedRequests = u.timeOffRequests.filter((to) => to.status === "APPROVED");

      for (let i = 0; i < approvedRequests.length; i++) {
        for (let j = i + 1; j < approvedRequests.length; j++) {
          const r1 = approvedRequests[i];
          const r2 = approvedRequests[j];

          const overlaps =
            (r1.startDate <= r2.endDate && r1.endDate >= r2.startDate) ||
            (r2.startDate <= r1.endDate && r2.endDate >= r1.startDate);

          if (overlaps) {
            conflicts.push({
              id: `overlap-${u.id}-${r1.id}-${r2.id}`,
              type: "overlapping_timeoff",
              severity: "warning",
              date: r1.startDate.toISOString(),
              description: `Overlapping time-off requests for user ${u.email}`,
              affectedUsers: [u.id],
              suggestion: "Review and adjust time-off requests to remove overlap",
            });
          }
        }
      }
    }

    // Filter by severity if requested
    let filteredConflicts = conflicts;
    if (filters.severityLevel && filters.severityLevel !== "all") {
      filteredConflicts = conflicts.filter(
        (c) => c.severity === filters.severityLevel
      );
    }

    // Sort by severity and date
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    filteredConflicts.sort((a, b) => {
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      if (severityDiff !== 0) return severityDiff;
      return a.date.localeCompare(b.date);
    });

    return { success: true, conflicts: filteredConflicts };
  } catch (error) {
    console.error("Error detecting conflicts:", error);
    return { error: "Failed to detect availability conflicts" };
  }
}

/**
 * Identify staffing gaps where coverage falls below requirements
 */
export async function getStaffingGaps(filters: GapFilters) {
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

    const minimumStaff = filters.minimumStaff || 3;

    // Get venue-filtered users
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Build query
    const where: any = {
      id: { in: sharedVenueUserIds },
      active: true,
    };

    // Venue filtering: Support both multi-select (venueIds) and single (venueId)
    if (filters.venueIds && filters.venueIds.length > 0) {
      where.venues = {
        some: {
          venueId: { in: filters.venueIds },
        },
      };
    } else if (filters.venueId) {
      where.venues = {
        some: {
          venueId: filters.venueId,
        },
      };
    }

    // Fetch users
    const users = await prisma.user.findMany({
      where,
      include: {
        availability: true,
        timeOffRequests: {
          where: {
            status: "APPROVED",
            OR: [
              {
                AND: [
                  { startDate: { lte: endDate } },
                  { endDate: { gte: startDate } },
                ],
              },
            ],
          },
        },
      },
    });

    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    const gaps: StaffingGap[] = [];

    // Check each date for gaps
    for (const date of dates) {
      const dateStr = date.toISOString();
      const dayOfWeek = getDay(date);

      let availableCount = 0;

      for (const u of users) {
        const availability = computeEffectiveAvailability(u, date, date, undefined);
        if (availability[dateStr]?.available) {
          availableCount++;
        }
      }

      // Found a gap
      if (availableCount < minimumStaff) {
        gaps.push({
          date: dateStr,
          availableStaff: availableCount,
          requiredStaff: minimumStaff,
          gap: minimumStaff - availableCount,
        });
      }
    }

    return { success: true, gaps };
  } catch (error) {
    console.error("Error identifying staffing gaps:", error);
    return { error: "Failed to identify staffing gaps" };
  }
}

/**
 * Get initial data for reports dashboard (stats summary)
 */
export async function getReportsDashboardData() {
  const user = await requireAuth();

  // Check permission
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team reports" };
  }

  try {
    // Get venue-filtered users
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const [totalStaff, activeStaff, pendingTimeOff, upcomingTimeOff] = await Promise.all([
      prisma.user.count({
        where: {
          id: { in: sharedVenueUserIds },
        },
      }),
      prisma.user.count({
        where: {
          id: { in: sharedVenueUserIds },
          active: true,
        },
      }),
      prisma.timeOffRequest.count({
        where: {
          userId: { in: sharedVenueUserIds },
          status: "PENDING",
        },
      }),
      prisma.timeOffRequest.count({
        where: {
          userId: { in: sharedVenueUserIds },
          status: "APPROVED",
          startDate: {
            gte: new Date(),
          },
        },
      }),
    ]);

    return {
      success: true,
      stats: {
        totalStaff,
        activeStaff,
        pendingTimeOff,
        upcomingTimeOff,
      },
    };
  } catch (error) {
    console.error("Error fetching dashboard data:", error);
    return { error: "Failed to fetch dashboard data" };
  }
}

/**
 * Get scheduling conflicts report
 * Detects various types of conflicts like understaffing, overlapping time-off, etc.
 */
export async function getConflictsReport(filters: any & { includeAIResolutions?: boolean }) {
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

    const severityLevel = filters.severityLevel || "all";

    // Get venue-filtered users
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Build query
    const where: any = {
      id: { in: sharedVenueUserIds },
      active: true,
    };

    // Venue filtering: Support both multi-select (venueIds) and single (venueId)
    if (filters.venueIds && filters.venueIds.length > 0) {
      where.venues = {
        some: {
          venueId: { in: filters.venueIds },
        },
      };
    } else if (filters.venueId) {
      where.venues = {
        some: {
          venueId: filters.venueId,
        },
      };
    }

    // Fetch data needed for conflict detection
    const [users, timeOffRequests] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: {
            select: { name: true },
          },
          venues: {
            include: {
              venue: {
                select: { id: true, name: true },
              },
            },
          },
          availability: true,
        },
      }),
      prisma.timeOffRequest.findMany({
        where: {
          userId: { in: sharedVenueUserIds },
          status: "APPROVED",
          OR: [
            {
              AND: [
                { startDate: { lte: endDate } },
                { endDate: { gte: startDate } },
              ],
            },
          ],
        },
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    // Detect conflicts
    const conflicts: any[] = [];

    // Generate date range for analysis
    const dates: Date[] = [];
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      dates.push(new Date(currentDate));
      currentDate = addDays(currentDate, 1);
    }

    // Track conflicts by type
    const conflictStats = {
      total: 0,
      critical: 0,
      warning: 0,
      info: 0,
      byType: {
        understaffing: 0,
        noAvailability: 0,
        limitedCoverage: 0,
        overlappingTimeOff: 0,
      },
    };

    // Analyze each date
    for (const date of dates) {
      const dateStr = format(date, "yyyy-MM-dd");
      const dayOfWeek = format(date, "EEEE");

      // Check for time-off on this date
      const timeOffToday = timeOffRequests.filter((request) => {
        const reqStart = new Date(request.startDate);
        const reqEnd = new Date(request.endDate);
        return date >= reqStart && date <= reqEnd;
      });

      // Count available staff using computeEffectiveAvailability
      let availableCount = 0;
      const unavailableStaff: any[] = [];
      const affectedVenues: Set<string> = new Set();

      for (const staffUser of users) {
        const availability = computeEffectiveAvailability(staffUser, date, date);
        const status = availability[dateStr];

        // Collect venue information from staff
        if (staffUser.venues && staffUser.venues.length > 0) {
          staffUser.venues.forEach((uv: any) => {
            if (uv.venue && uv.venue.name) {
              affectedVenues.add(uv.venue.name);
            }
          });
        }

        if (status && status.available) {
          availableCount++;
        } else {
          unavailableStaff.push({
            id: staffUser.id,
            name: `${staffUser.firstName || ""} ${staffUser.lastName || ""}`.trim() || staffUser.email,
            reason: status?.reason || "Not available",
          });
        }
      }

      const totalStaff = users.length;
      const coveragePercentage = totalStaff > 0 ? (availableCount / totalStaff) * 100 : 0;
      const venueList = Array.from(affectedVenues);

      // Conflict detection logic
      // 1. Critical: No staff available
      if (availableCount === 0 && totalStaff > 0) {
        conflicts.push({
          id: `no-staff-${dateStr}`,
          type: "noAvailability",
          severity: "critical",
          date: dateStr,
          dayOfWeek,
          title: "No Staff Available",
          description: `No staff members are available on ${format(date, "EEEE, MMMM d")}`,
          venues: venueList,
          details: {
            totalStaff,
            availableStaff: 0,
            unavailableStaff,
          },
        });
        conflictStats.critical++;
        conflictStats.byType.noAvailability++;
      }
      // 2. Critical: Less than 30% coverage
      else if (coveragePercentage < 30 && totalStaff > 0) {
        conflicts.push({
          id: `critical-understaffing-${dateStr}`,
          type: "understaffing",
          severity: "critical",
          date: dateStr,
          dayOfWeek,
          title: "Critical Understaffing",
          description: `Only ${availableCount} of ${totalStaff} staff available (${Math.round(coveragePercentage)}%)`,
          venues: venueList,
          details: {
            totalStaff,
            availableStaff: availableCount,
            coveragePercentage: Math.round(coveragePercentage),
            unavailableStaff,
          },
        });
        conflictStats.critical++;
        conflictStats.byType.understaffing++;
      }
      // 3. Warning: 30-50% coverage
      else if (coveragePercentage < 50 && totalStaff > 0) {
        conflicts.push({
          id: `warning-understaffing-${dateStr}`,
          type: "understaffing",
          severity: "warning",
          date: dateStr,
          dayOfWeek,
          title: "Low Staffing Levels",
          description: `${availableCount} of ${totalStaff} staff available (${Math.round(coveragePercentage)}%)`,
          venues: venueList,
          details: {
            totalStaff,
            availableStaff: availableCount,
            coveragePercentage: Math.round(coveragePercentage),
            unavailableStaff,
          },
        });
        conflictStats.warning++;
        conflictStats.byType.understaffing++;
      }
      // 4. Info: 50-70% coverage
      else if (coveragePercentage < 70 && totalStaff > 0) {
        conflicts.push({
          id: `limited-coverage-${dateStr}`,
          type: "limitedCoverage",
          severity: "info",
          date: dateStr,
          dayOfWeek,
          title: "Limited Coverage",
          description: `${availableCount} of ${totalStaff} staff available (${Math.round(coveragePercentage)}%)`,
          venues: venueList,
          details: {
            totalStaff,
            availableStaff: availableCount,
            coveragePercentage: Math.round(coveragePercentage),
            unavailableStaff,
          },
        });
        conflictStats.info++;
        conflictStats.byType.limitedCoverage++;
      }

      // 5. Check for multiple time-off on same day (warning)
      if (timeOffToday.length >= 3) {
        conflicts.push({
          id: `overlapping-timeoff-${dateStr}`,
          type: "overlappingTimeOff",
          severity: "warning",
          date: dateStr,
          dayOfWeek,
          title: "Multiple Time-Off Requests",
          description: `${timeOffToday.length} staff members have approved time-off`,
          venues: venueList,
          details: {
            timeOffCount: timeOffToday.length,
            staff: timeOffToday.map((req) => ({
              id: req.user.id,
              name: `${req.user.firstName || ""} ${req.user.lastName || ""}`.trim() || req.user.email,
              startDate: format(new Date(req.startDate), "MMM d"),
              endDate: format(new Date(req.endDate), "MMM d"),
            })),
          },
        });
        conflictStats.warning++;
        conflictStats.byType.overlappingTimeOff++;
      }
    }

    // Update total stats
    conflictStats.total = conflicts.length;

    // Filter by severity if requested
    let filteredConflicts = conflicts;
    if (severityLevel !== "all") {
      filteredConflicts = conflicts.filter((c) => c.severity === severityLevel);
    }

    // Sort by date and severity
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    filteredConflicts.sort((a, b) => {
      if (a.date !== b.date) {
        return a.date.localeCompare(b.date);
      }
      return severityOrder[a.severity as keyof typeof severityOrder] - severityOrder[b.severity as keyof typeof severityOrder];
    });

    // Auto-generate AI resolutions if requested (only for critical and warning conflicts)
    if (filters.includeAIResolutions && filteredConflicts.length > 0) {
      try {
        // Import the AI conflict detection module
        const { generateConflictResolutions } = await import("@/lib/actions/ai/conflict-detection");

        // Generate resolutions for critical and warning conflicts (limit to first 3)
        const conflictsNeedingResolutions = filteredConflicts
          .filter((c) => c.severity === "critical" || c.severity === "warning")
          .slice(0, 3);

        // Generate resolutions in parallel
        const resolutionPromises = conflictsNeedingResolutions.map(async (conflict) => {
          try {
            const result = await generateConflictResolutions(conflict);
            if (result.success && result.resolutions) {
              conflict.resolutions = result.resolutions;
            }
          } catch (error) {
            console.error(`Failed to generate resolutions for conflict ${conflict.id}:`, error);
            // Continue even if one fails
          }
        });

        await Promise.all(resolutionPromises);
      } catch (error) {
        console.error("Error auto-generating AI resolutions:", error);
        // Don't fail the whole report if AI generation fails
      }
    }

    return {
      success: true,
      data: {
        conflicts: filteredConflicts,
        stats: conflictStats,
        dateRange: {
          start: format(startDate, "yyyy-MM-dd"),
          end: format(endDate, "yyyy-MM-dd"),
        },
      },
    };
  } catch (error) {
    console.error("Error fetching conflicts:", error);
    return { error: "Failed to fetch conflicts report" };
  }
}
