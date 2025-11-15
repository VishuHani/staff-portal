"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, canAccess } from "@/lib/rbac/access";
import { getSharedVenueUsers } from "@/lib/utils/venue";
import { startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, format, startOfDay, endOfDay, addDays } from "date-fns";
import { generateSchedulingSuggestions } from "@/lib/actions/ai/suggestions";

/**
 * Get manager hero stats
 */
export async function getManagerHeroStats() {
  const user = await requireAuth();
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team stats" };
  }

  try {
    const today = new Date();
    const next7Days = addDays(today, 7);
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Get total active staff
    const totalActiveStaff = await prisma.user.count({
      where: {
        id: { in: sharedVenueUserIds },
        active: true,
      },
    });

    // Calculate staff available today
    const todayDayOfWeek = today.getDay();
    const availableToday = await prisma.availability.count({
      where: {
        userId: { in: sharedVenueUserIds },
        dayOfWeek: todayDayOfWeek,
        isAvailable: true,
      },
    });

    // Get pending approvals
    const pendingApprovals = await prisma.timeOffRequest.count({
      where: {
        userId: { in: sharedVenueUserIds },
        status: "PENDING",
      },
    });

    // Get upcoming absences (next 7 days)
    const upcomingAbsences = await prisma.timeOffRequest.count({
      where: {
        userId: { in: sharedVenueUserIds },
        status: "APPROVED",
        startDate: {
          gte: today,
          lte: next7Days,
        },
      },
    });

    // Calculate coverage percentage
    const coveragePercentage = totalActiveStaff > 0
      ? Math.round((availableToday / totalActiveStaff) * 100)
      : 0;

    return {
      success: true,
      stats: {
        coverageToday: coveragePercentage,
        availableStaff: availableToday,
        totalStaff: totalActiveStaff,
        pendingApprovals,
        upcomingAbsences,
      },
    };
  } catch (error) {
    console.error("Error fetching manager hero stats:", error);
    return { error: "Failed to fetch hero stats" };
  }
}

/**
 * Get team coverage heatmap data for next 7 days
 */
export async function getTeamCoverageHeatmap() {
  const user = await requireAuth();
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team coverage" };
  }

  try {
    const today = new Date();
    const next7Days = eachDayOfInterval({ start: today, end: addDays(today, 6) });
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    // Time slots (simplified: morning, afternoon, evening)
    const timeSlots = ["Morning", "Afternoon", "Evening"];

    const heatmapData = [];

    for (const day of next7Days) {
      const dayOfWeek = day.getDay();
      const dayLabel = format(day, "EEE M/d");

      for (const timeSlot of timeSlots) {
        // Get staff available for this day
        const availableStaff = await prisma.availability.count({
          where: {
            userId: { in: sharedVenueUserIds },
            dayOfWeek,
            isAvailable: true,
          },
        });

        // Get staff on time-off for this day
        const onTimeOff = await prisma.timeOffRequest.count({
          where: {
            userId: { in: sharedVenueUserIds },
            status: "APPROVED",
            startDate: { lte: day },
            endDate: { gte: day },
          },
        });

        const netAvailable = Math.max(0, availableStaff - onTimeOff);

        heatmapData.push({
          x: dayLabel,
          y: timeSlot,
          value: netAvailable,
          label: `${dayLabel} ${timeSlot}: ${netAvailable} staff available`,
        });
      }
    }

    const xLabels = next7Days.map((day) => format(day, "EEE M/d"));
    const yLabels = timeSlots;

    return {
      success: true,
      heatmap: {
        data: heatmapData,
        xLabels,
        yLabels,
      },
    };
  } catch (error) {
    console.error("Error fetching team coverage heatmap:", error);
    return { error: "Failed to fetch coverage heatmap" };
  }
}

/**
 * Get team availability pie chart data
 */
export async function getTeamAvailabilityDistribution() {
  const user = await requireAuth();
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team availability" };
  }

  try {
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    const today = new Date();
    const todayDayOfWeek = today.getDay();

    // Get availability breakdown
    const available = await prisma.availability.count({
      where: {
        userId: { in: sharedVenueUserIds },
        dayOfWeek: todayDayOfWeek,
        isAvailable: true,
        isAllDay: true,
      },
    });

    const partialAvailable = await prisma.availability.count({
      where: {
        userId: { in: sharedVenueUserIds },
        dayOfWeek: todayDayOfWeek,
        isAvailable: true,
        isAllDay: false,
      },
    });

    const onLeave = await prisma.timeOffRequest.count({
      where: {
        userId: { in: sharedVenueUserIds },
        status: "APPROVED",
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    const totalStaff = sharedVenueUserIds.length;
    const unavailable = totalStaff - available - partialAvailable - onLeave;

    const distribution = [
      { name: "Available", value: available },
      { name: "Partial", value: partialAvailable },
      { name: "On Leave", value: onLeave },
      { name: "Unavailable", value: Math.max(0, unavailable) },
    ];

    return { success: true, distribution };
  } catch (error) {
    console.error("Error fetching team availability distribution:", error);
    return { error: "Failed to fetch availability distribution" };
  }
}

/**
 * Get coverage trend data (last 8 weeks)
 */
export async function getCoverageTrend() {
  const user = await requireAuth();
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view coverage trends" };
  }

  try {
    const today = new Date();
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);
    const totalStaff = sharedVenueUserIds.length;

    const trends = [];

    for (let i = 7; i >= 0; i--) {
      const weekStart = startOfWeek(addWeeks(today, -i), { weekStartsOn: 0 });
      const weekLabel = format(weekStart, "MMM d");

      // Calculate average coverage for the week
      let weeklyAvailability = 0;
      const daysInWeek = 7;

      for (let day = 0; day < daysInWeek; day++) {
        const available = await prisma.availability.count({
          where: {
            userId: { in: sharedVenueUserIds },
            dayOfWeek: day,
            isAvailable: true,
          },
        });
        weeklyAvailability += available;
      }

      const avgCoverage = totalStaff > 0
        ? Math.round((weeklyAvailability / (daysInWeek * totalStaff)) * 100)
        : 0;

      trends.push({
        week: weekLabel,
        coverage: avgCoverage,
        target: 80, // Target coverage line
      });
    }

    return { success: true, trends };
  } catch (error) {
    console.error("Error fetching coverage trend:", error);
    return { error: "Failed to fetch coverage trend" };
  }
}

/**
 * Get AI insights for manager
 */
export async function getManagerAIInsights() {
  const user = await requireAuth();
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view AI insights" };
  }

  try {
    // Get AI suggestions
    const suggestionsResult = await generateSchedulingSuggestions();

    if (!suggestionsResult.success || !suggestionsResult.suggestions) {
      return { success: true, insights: [] };
    }

    // Transform suggestions to insights format
    const insights = suggestionsResult.suggestions.slice(0, 5).map((suggestion) => ({
      id: suggestion.id,
      type: suggestion.type,
      message: suggestion.message,
      priority: suggestion.priority,
      actionUrl: suggestion.actionUrl || "/admin/reports/coverage",
    }));

    return { success: true, insights };
  } catch (error) {
    console.error("Error fetching manager AI insights:", error);
    return { error: "Failed to fetch AI insights" };
  }
}

/**
 * Get team snapshot (top 10 staff members)
 */
export async function getTeamSnapshot() {
  const user = await requireAuth();
  const hasAccess = await canAccess("reports", "view_team");
  if (!hasAccess) {
    return { error: "You don't have permission to view team snapshot" };
  }

  try {
    const today = new Date();
    const next30Days = addDays(today, 30);
    const sharedVenueUserIds = await getSharedVenueUsers(user.id);

    const teamMembers = await prisma.user.findMany({
      where: {
        id: { in: sharedVenueUserIds },
        active: true,
      },
      take: 10,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: {
          select: {
            name: true,
          },
        },
        availability: {
          where: {
            dayOfWeek: today.getDay(),
          },
          select: {
            isAvailable: true,
            startTime: true,
            endTime: true,
          },
        },
        timeOffRequests: {
          where: {
            status: "APPROVED",
            startDate: {
              gte: today,
              lte: next30Days,
            },
          },
          orderBy: {
            startDate: "asc",
          },
          take: 1,
          select: {
            startDate: true,
            endDate: true,
          },
        },
      },
    });

    const snapshot = teamMembers.map((member) => {
      const todayAvail = member.availability[0];
      let hoursToday = 0;

      if (todayAvail?.isAvailable && todayAvail.startTime && todayAvail.endTime) {
        const [startHour, startMin] = todayAvail.startTime.split(":").map(Number);
        const [endHour, endMin] = todayAvail.endTime.split(":").map(Number);
        hoursToday = endHour - startHour + (endMin - startMin) / 60;
      }

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`,
        role: member.role.name,
        status: todayAvail?.isAvailable ? "Available" : "Unavailable",
        hoursToday: Math.round(hoursToday),
        nextTimeOff: member.timeOffRequests[0]
          ? format(member.timeOffRequests[0].startDate, "MMM d")
          : "None",
      };
    });

    return { success: true, snapshot };
  } catch (error) {
    console.error("Error fetching team snapshot:", error);
    return { error: "Failed to fetch team snapshot" };
  }
}

/**
 * Get all manager dashboard data at once
 */
export async function getManagerDashboardData() {
  const [heroStats, heatmap, distribution, trend, insights, snapshot] = await Promise.all([
    getManagerHeroStats(),
    getTeamCoverageHeatmap(),
    getTeamAvailabilityDistribution(),
    getCoverageTrend(),
    getManagerAIInsights(),
    getTeamSnapshot(),
  ]);

  return {
    success: true,
    data: {
      heroStats: heroStats.success ? heroStats.stats : null,
      heatmap: heatmap.success ? heatmap.heatmap : null,
      distribution: distribution.success ? distribution.distribution : [],
      trend: trend.success ? trend.trends : [],
      insights: insights.success ? insights.insights : [],
      snapshot: snapshot.success ? snapshot.snapshot : [],
    },
  };
}
