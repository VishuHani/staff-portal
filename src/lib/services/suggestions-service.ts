"use server";

import { requireAuth, canAccess } from "@/lib/rbac/access";
import { prisma } from "@/lib/prisma";
import { computeEffectiveAvailability } from "@/lib/utils/availability";
import {
  startOfDay,
  endOfDay,
  addDays,
  format,
  isWeekend,
  parseISO,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  getDay,
  isWithinInterval,
} from "date-fns";

/**
 * Smart Suggestions Service
 * Analyzes availability patterns and provides actionable insights
 */

export type SuggestionType =
  | "low_coverage"
  | "staffing_gap"
  | "optimize_schedule"
  | "time_off_cluster"
  | "availability_pattern"
  | "weekend_coverage"
  | "recurring_issue";

export type SuggestionPriority = "high" | "medium" | "low";

export interface Suggestion {
  id: string;
  type: SuggestionType;
  priority: SuggestionPriority;
  title: string;
  description: string;
  actionable: boolean;
  action?: {
    label: string;
    link?: string;
    data?: any;
  };
  metadata?: {
    date?: string;
    affectedStaff?: number;
    coveragePercentage?: number;
    venue?: string;
  };
  createdAt: Date;
}

interface SuggestionsFilters {
  venueId?: string;
  startDate?: Date;
  endDate?: Date;
  priority?: SuggestionPriority;
  limit?: number;
}

/**
 * Generate smart suggestions based on availability patterns
 */
export async function generateSuggestions(
  filters?: SuggestionsFilters
): Promise<{ success: boolean; data?: Suggestion[]; error?: string }> {
  try {
    const user = await requireAuth();
    const hasAccess = await canAccess("reports", "view_team");

    if (!hasAccess) {
      return { success: false, error: "Insufficient permissions" };
    }

    const startDate = filters?.startDate || new Date();
    const endDate = filters?.endDate || addDays(startDate, 30);
    const limit = filters?.limit || 10;

    // Fetch staff and availability data
    const whereClause: any = {
      active: true,
      role: { isNot: { name: "ADMIN" } },
    };

    if (filters?.venueId) {
      whereClause.venues = {
        some: { venueId: filters.venueId },
      };
    }

    const staff = await prisma.user.findMany({
      where: whereClause,
      include: {
        availability: true,
        timeOffRequests: {
          where: {
            status: "APPROVED",
            OR: [
              { startDate: { gte: startDate, lte: endDate } },
              { endDate: { gte: startDate, lte: endDate } },
              {
                AND: [
                  { startDate: { lte: startDate } },
                  { endDate: { gte: endDate } },
                ],
              },
            ],
          },
        },
        venues: {
          include: { venue: true },
        },
      },
    });

    const suggestions: Suggestion[] = [];

    // Analyze patterns and generate suggestions
    await analyzeLowCoverage(staff, startDate, endDate, suggestions);
    await analyzeTimeOffClusters(staff, startDate, endDate, suggestions);
    await analyzeWeekendCoverage(staff, startDate, endDate, suggestions);
    await analyzeAvailabilityPatterns(staff, startDate, endDate, suggestions);
    await analyzeRecurringIssues(staff, startDate, endDate, suggestions);

    // Filter by priority if specified
    let filteredSuggestions = suggestions;
    if (filters?.priority) {
      filteredSuggestions = suggestions.filter(
        (s) => s.priority === filters.priority
      );
    }

    // Sort by priority (high -> medium -> low) and limit
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    filteredSuggestions.sort(
      (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
    );

    return {
      success: true,
      data: filteredSuggestions.slice(0, limit),
    };
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return {
      success: false,
      error: "Failed to generate suggestions",
    };
  }
}

/**
 * Analyze low coverage days
 */
async function analyzeLowCoverage(
  staff: any[],
  startDate: Date,
  endDate: Date,
  suggestions: Suggestion[]
) {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  for (const date of dates) {
    const dateStr = format(date, "yyyy-MM-dd");
    let availableCount = 0;
    const totalCount = staff.length;

    for (const staffMember of staff) {
      const availability = computeEffectiveAvailability(
        staffMember,
        date,
        date
      );
      if (availability[dateStr]?.available) {
        availableCount++;
      }
    }

    const coveragePercentage =
      totalCount > 0 ? (availableCount / totalCount) * 100 : 0;

    // Critical: Less than 30% coverage
    if (coveragePercentage < 30 && coveragePercentage > 0) {
      suggestions.push({
        id: `low-coverage-${dateStr}`,
        type: "low_coverage",
        priority: "high",
        title: `Critical Low Coverage on ${format(date, "MMM d")}`,
        description: `Only ${availableCount} out of ${totalCount} staff (${Math.round(coveragePercentage)}%) are available. Consider rescheduling or requesting additional coverage.`,
        actionable: true,
        action: {
          label: "View Day Details",
          link: `/admin/reports/calendar?date=${dateStr}`,
        },
        metadata: {
          date: dateStr,
          affectedStaff: totalCount - availableCount,
          coveragePercentage,
        },
        createdAt: new Date(),
      });
    }
    // Warning: 30-50% coverage
    else if (coveragePercentage >= 30 && coveragePercentage < 50) {
      suggestions.push({
        id: `low-coverage-${dateStr}`,
        type: "low_coverage",
        priority: "medium",
        title: `Low Coverage on ${format(date, "MMM d")}`,
        description: `${availableCount} out of ${totalCount} staff (${Math.round(coveragePercentage)}%) available. May need backup planning.`,
        actionable: true,
        action: {
          label: "View Calendar",
          link: `/admin/reports/calendar?date=${dateStr}`,
        },
        metadata: {
          date: dateStr,
          affectedStaff: totalCount - availableCount,
          coveragePercentage,
        },
        createdAt: new Date(),
      });
    }
    // No coverage at all
    else if (coveragePercentage === 0) {
      suggestions.push({
        id: `no-coverage-${dateStr}`,
        type: "staffing_gap",
        priority: "high",
        title: `No Staff Available on ${format(date, "MMM d")}`,
        description: `Critical staffing gap! All ${totalCount} staff members are unavailable. Immediate action required.`,
        actionable: true,
        action: {
          label: "View Conflicts",
          link: `/admin/reports/conflicts?date=${dateStr}`,
        },
        metadata: {
          date: dateStr,
          affectedStaff: totalCount,
          coveragePercentage: 0,
        },
        createdAt: new Date(),
      });
    }
  }
}

/**
 * Analyze time-off request clusters
 */
async function analyzeTimeOffClusters(
  staff: any[],
  startDate: Date,
  endDate: Date,
  suggestions: Suggestion[]
) {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  for (const date of dates) {
    const dateStr = format(date, "yyyy-MM-dd");
    let timeOffCount = 0;

    for (const staffMember of staff) {
      const hasTimeOff = staffMember.timeOffRequests?.some((request: any) => {
        const start = startOfDay(request.startDate);
        const end = endOfDay(request.endDate);
        return date >= start && date <= end;
      });

      if (hasTimeOff) {
        timeOffCount++;
      }
    }

    const percentage = staff.length > 0 ? (timeOffCount / staff.length) * 100 : 0;

    // Alert if more than 30% of staff have time off on the same day
    if (percentage > 30) {
      suggestions.push({
        id: `time-off-cluster-${dateStr}`,
        type: "time_off_cluster",
        priority: percentage > 50 ? "high" : "medium",
        title: `High Time-Off Requests on ${format(date, "MMM d")}`,
        description: `${timeOffCount} staff members (${Math.round(percentage)}%) have approved time-off requests. This may impact operations.`,
        actionable: true,
        action: {
          label: "Review Time-Off Requests",
          link: `/admin/time-off?date=${dateStr}`,
        },
        metadata: {
          date: dateStr,
          affectedStaff: timeOffCount,
          coveragePercentage: 100 - percentage,
        },
        createdAt: new Date(),
      });
    }
  }
}

/**
 * Analyze weekend coverage patterns
 */
async function analyzeWeekendCoverage(
  staff: any[],
  startDate: Date,
  endDate: Date,
  suggestions: Suggestion[]
) {
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  const weekends = dates.filter((d) => isWeekend(d));

  const weekendCoverage: { date: Date; available: number }[] = [];

  for (const date of weekends) {
    const dateStr = format(date, "yyyy-MM-dd");
    let availableCount = 0;

    for (const staffMember of staff) {
      const availability = computeEffectiveAvailability(
        staffMember,
        date,
        date
      );
      if (availability[dateStr]?.available) {
        availableCount++;
      }
    }

    weekendCoverage.push({ date, available: availableCount });
  }

  // Calculate average weekend coverage
  const avgWeekendCoverage =
    weekendCoverage.length > 0
      ? weekendCoverage.reduce((sum, wc) => sum + wc.available, 0) /
        weekendCoverage.length
      : 0;

  const avgPercentage = staff.length > 0 ? (avgWeekendCoverage / staff.length) * 100 : 0;

  // Suggest if weekend coverage is consistently low
  if (avgPercentage < 50 && weekendCoverage.length > 0) {
    suggestions.push({
      id: `weekend-coverage-pattern`,
      type: "weekend_coverage",
      priority: avgPercentage < 30 ? "high" : "medium",
      title: "Low Weekend Coverage Pattern Detected",
      description: `Average weekend coverage is ${Math.round(avgPercentage)}% (${Math.round(avgWeekendCoverage)} staff). Consider scheduling weekend shifts or offering incentives.`,
      actionable: true,
      action: {
        label: "View Availability Matrix",
        link: "/admin/reports/availability-matrix",
      },
      metadata: {
        coveragePercentage: avgPercentage,
        affectedStaff: staff.length - Math.round(avgWeekendCoverage),
      },
      createdAt: new Date(),
    });
  }
}

/**
 * Analyze availability patterns for optimization opportunities
 */
async function analyzeAvailabilityPatterns(
  staff: any[],
  startDate: Date,
  endDate: Date,
  suggestions: Suggestion[]
) {
  // Find staff with limited availability
  const limitedAvailabilityStaff = staff.filter((s) => {
    const dates = eachDayOfInterval({ start: startDate, end: endDate });
    let availableDays = 0;

    for (const date of dates) {
      const dateStr = format(date, "yyyy-MM-dd");
      const availability = computeEffectiveAvailability(s, date, date);
      if (availability[dateStr]?.available) {
        availableDays++;
      }
    }

    const availabilityPercentage =
      dates.length > 0 ? (availableDays / dates.length) * 100 : 0;
    return availabilityPercentage < 40; // Less than 40% available
  });

  if (limitedAvailabilityStaff.length > 0) {
    suggestions.push({
      id: "limited-availability-pattern",
      type: "availability_pattern",
      priority: "low",
      title: `${limitedAvailabilityStaff.length} Staff with Limited Availability`,
      description: `Some staff members have limited availability (less than 40%). Consider discussing schedule flexibility or hiring additional part-time staff.`,
      actionable: true,
      action: {
        label: "View Staff Availability",
        link: "/admin/reports/availability-matrix",
      },
      metadata: {
        affectedStaff: limitedAvailabilityStaff.length,
      },
      createdAt: new Date(),
    });
  }

  // Find days with excellent coverage that could be optimized
  const dates = eachDayOfInterval({ start: startDate, end: endDate });
  const overStaffedDays: string[] = [];

  for (const date of dates) {
    const dateStr = format(date, "yyyy-MM-dd");
    let availableCount = 0;

    for (const staffMember of staff) {
      const availability = computeEffectiveAvailability(
        staffMember,
        date,
        date
      );
      if (availability[dateStr]?.available) {
        availableCount++;
      }
    }

    const coveragePercentage =
      staff.length > 0 ? (availableCount / staff.length) * 100 : 0;

    // Over 90% coverage might be optimization opportunity
    if (coveragePercentage > 90) {
      overStaffedDays.push(format(date, "MMM d"));
    }
  }

  if (overStaffedDays.length > 5) {
    suggestions.push({
      id: "optimize-schedule-pattern",
      type: "optimize_schedule",
      priority: "low",
      title: "Schedule Optimization Opportunity",
      description: `${overStaffedDays.length} days have excellent coverage (>90%). Consider allowing flexible time-off or rotating schedules to improve work-life balance.`,
      actionable: true,
      action: {
        label: "View Coverage Report",
        link: "/admin/reports/coverage",
      },
      metadata: {
        affectedStaff: overStaffedDays.length,
      },
      createdAt: new Date(),
    });
  }
}

/**
 * Analyze recurring issues (same day each week, patterns)
 */
async function analyzeRecurringIssues(
  staff: any[],
  startDate: Date,
  endDate: Date,
  suggestions: Suggestion[]
) {
  const dayOfWeekCoverage: { [key: string]: number[] } = {
    Sunday: [],
    Monday: [],
    Tuesday: [],
    Wednesday: [],
    Thursday: [],
    Friday: [],
    Saturday: [],
  };

  const dates = eachDayOfInterval({ start: startDate, end: endDate });

  for (const date of dates) {
    const dayName = format(date, "EEEE");
    const dateStr = format(date, "yyyy-MM-dd");
    let availableCount = 0;

    for (const staffMember of staff) {
      const availability = computeEffectiveAvailability(
        staffMember,
        date,
        date
      );
      if (availability[dateStr]?.available) {
        availableCount++;
      }
    }

    const percentage = staff.length > 0 ? (availableCount / staff.length) * 100 : 0;
    dayOfWeekCoverage[dayName].push(percentage);
  }

  // Find days of week with consistently low coverage
  for (const [dayName, percentages] of Object.entries(dayOfWeekCoverage)) {
    if (percentages.length < 2) continue; // Need at least 2 occurrences

    const avgCoverage =
      percentages.reduce((sum, p) => sum + p, 0) / percentages.length;

    if (avgCoverage < 50) {
      suggestions.push({
        id: `recurring-${dayName.toLowerCase()}`,
        type: "recurring_issue",
        priority: avgCoverage < 30 ? "high" : "medium",
        title: `Recurring Low Coverage on ${dayName}s`,
        description: `${dayName}s consistently have low coverage (${Math.round(avgCoverage)}% average). Consider addressing this recurring pattern.`,
        actionable: true,
        action: {
          label: "Review Availability",
          link: "/admin/reports/availability-matrix",
        },
        metadata: {
          coveragePercentage: avgCoverage,
        },
        createdAt: new Date(),
      });
    }
  }
}

/**
 * Get suggestion statistics
 */
export async function getSuggestionStats(): Promise<{
  success: boolean;
  data?: {
    total: number;
    byPriority: { high: number; medium: number; low: number };
    byType: { [key in SuggestionType]?: number };
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const hasAccess = await canAccess("reports", "view_team");

    if (!hasAccess) {
      return { success: false, error: "Insufficient permissions" };
    }

    const result = await generateSuggestions({ limit: 100 });

    if (!result.success || !result.data) {
      return { success: false, error: result.error };
    }

    const suggestions = result.data;

    const byPriority = {
      high: suggestions.filter((s) => s.priority === "high").length,
      medium: suggestions.filter((s) => s.priority === "medium").length,
      low: suggestions.filter((s) => s.priority === "low").length,
    };

    const byType = suggestions.reduce((acc, s) => {
      acc[s.type] = (acc[s.type] || 0) + 1;
      return acc;
    }, {} as { [key in SuggestionType]?: number });

    return {
      success: true,
      data: {
        total: suggestions.length,
        byPriority,
        byType,
      },
    };
  } catch (error) {
    console.error("Error getting suggestion stats:", error);
    return {
      success: false,
      error: "Failed to get suggestion statistics",
    };
  }
}
