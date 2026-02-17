"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac/access";
import { startOfDay, subDays, format, subWeeks, startOfWeek, endOfWeek, eachDayOfInterval } from "date-fns";

/**
 * Calculate system health based on multiple metrics
 * Returns: { score: 0-100, status: "Good" | "Fair" | "Poor", metrics: {...} }
 */
async function calculateSystemHealth() {
  const today = new Date();
  const last24Hours = subDays(today, 1);
  const last7Days = subDays(today, 7);

  try {
    // 1. Check for failed actions in audit logs (errors)
    const failedActions = await prisma.auditLog.count({
      where: {
        createdAt: { gte: last24Hours },
        actionType: { in: ["ERROR", "FAILED", "CONFLICT_RESOLUTION_FAILED"] },
      },
    });

    // 2. Check pending time-off requests older than 7 days (backlog)
    const oldPendingRequests = await prisma.timeOffRequest.count({
      where: {
        status: "PENDING",
        createdAt: { lte: last7Days },
      },
    });

    // 3. Check for roster conflicts
    const rosterConflicts = await prisma.rosterShift.count({
      where: {
        hasConflict: true,
        date: { gte: today },
      },
    });

    // 4. Check user activity (active engagement)
    const activeUsersLast24h = await prisma.auditLog.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: last24Hours },
      },
    });

    // 5. Check for unpublished rosters in the past (missed schedules)
    const missedRosters = await prisma.roster.count({
      where: {
        status: "DRAFT",
        endDate: { lt: today },
      },
    });

    // Calculate health score (0-100)
    let healthScore = 100;

    // Deduct for failed actions (up to 20 points)
    healthScore -= Math.min(20, failedActions * 5);

    // Deduct for old pending requests (up to 15 points)
    healthScore -= Math.min(15, oldPendingRequests * 3);

    // Deduct for roster conflicts (up to 25 points)
    healthScore -= Math.min(25, rosterConflicts * 5);

    // Deduct for missed rosters (up to 20 points)
    healthScore -= Math.min(20, missedRosters * 10);

    // Bonus for active users (up to 10 points back if engagement is high)
    const totalUsers = await prisma.user.count({ where: { active: true } });
    const engagementRate = totalUsers > 0 ? (activeUsersLast24h.length / totalUsers) * 100 : 0;
    if (engagementRate > 50) {
      healthScore += 10;
    } else if (engagementRate > 25) {
      healthScore += 5;
    }

    // Clamp score between 0 and 100
    healthScore = Math.max(0, Math.min(100, healthScore));

    const status = healthScore >= 80 ? "Good" : healthScore >= 50 ? "Fair" : "Poor";

    return {
      score: healthScore,
      status,
      metrics: {
        failedActions,
        oldPendingRequests,
        rosterConflicts,
        missedRosters,
        activeUsersLast24h: activeUsersLast24h.length,
        engagementRate: Math.round(engagementRate),
      },
    };
  } catch (error) {
    console.error("Error calculating system health:", error);
    return { score: 50, status: "Fair", metrics: {} };
  }
}

/**
 * Get admin global stats
 */
export async function getAdminGlobalStats() {
  await requireAdmin();

  try {
    const today = new Date();
    const last30Days = subDays(today, 30);

    // Total active staff
    const totalActiveStaff = await prisma.user.count({
      where: { active: true },
    });

    // Total inactive staff
    const totalInactiveStaff = await prisma.user.count({
      where: { active: false },
    });

    // Calculate multi-venue average coverage
    const venues = await prisma.venue.findMany({
      where: { active: true },
      select: { id: true },
    });

    let totalCoverage = 0;
    for (const venue of venues) {
      const venueUsers = await prisma.userVenue.count({
        where: {
          venueId: venue.id,
          user: { active: true },
        },
      });

      const todayAvailable = await prisma.availability.count({
        where: {
          dayOfWeek: today.getDay(),
          isAvailable: true,
          user: {
            venues: {
              some: { venueId: venue.id },
            },
          },
        },
      });

      if (venueUsers > 0) {
        totalCoverage += (todayAvailable / venueUsers) * 100;
      }
    }

    const avgCoverage = venues.length > 0 ? Math.round(totalCoverage / venues.length) : 0;

    // System health - now using comprehensive calculation
    const healthData = await calculateSystemHealth();
    const systemHealth = healthData.status;

    // Pending actions
    const pendingTimeOff = await prisma.timeOffRequest.count({
      where: { status: "PENDING" },
    });

    // Real conflicts count from RosterShift
    const conflictsCount = await prisma.rosterShift.count({
      where: {
        hasConflict: true,
        date: { gte: today },
      },
    });

    const pendingActions = pendingTimeOff + conflictsCount;

    // Active users today
    const todayStart = startOfDay(today);
    const activeUsersToday = await prisma.auditLog.groupBy({
      by: ["userId"],
      where: {
        createdAt: { gte: todayStart },
      },
    });

    return {
      success: true,
      stats: {
        totalActiveStaff,
        totalInactiveStaff,
        multiVenueCoverage: avgCoverage,
        systemHealth,
        healthScore: healthData.score,
        healthMetrics: healthData.metrics,
        pendingActions,
        pendingTimeOff,
        conflictsCount,
        activeUsersToday: activeUsersToday.length,
      },
    };
  } catch (error) {
    console.error("Error fetching admin global stats:", error);
    return { error: "Failed to fetch global stats" };
  }
}

/**
 * Get cross-venue comparison
 */
export async function getVenueCoverageComparison() {
  await requireAdmin();

  try {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });

    const venues = await prisma.venue.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
      },
      take: 10, // Limit to 10 venues for chart readability
    });

    const comparison = [];

    for (const venue of venues) {
      const venueUsers = await prisma.user.findMany({
        where: {
          active: true,
          venues: {
            some: { venueId: venue.id },
          },
        },
        select: { id: true },
      });

      const venueUserIds = venueUsers.map((u) => u.id);
      const totalStaff = venueUserIds.length;

      if (totalStaff === 0) continue;

      // Today's coverage
      const todayAvailable = await prisma.availability.count({
        where: {
          userId: { in: venueUserIds },
          dayOfWeek: today.getDay(),
          isAvailable: true,
        },
      });

      const todayCoverage = Math.round((todayAvailable / totalStaff) * 100);

      // Week average
      let weekTotal = 0;
      for (let i = 0; i < 7; i++) {
        const dayAvailable = await prisma.availability.count({
          where: {
            userId: { in: venueUserIds },
            dayOfWeek: i,
            isAvailable: true,
          },
        });
        weekTotal += dayAvailable;
      }
      const weekAvg = Math.round((weekTotal / (7 * totalStaff)) * 100);

      comparison.push({
        venue: venue.name,
        today: todayCoverage,
        weekAvg,
        monthAvg: weekAvg, // Simplified - using week avg
      });
    }

    return { success: true, comparison };
  } catch (error) {
    console.error("Error fetching venue coverage comparison:", error);
    return { error: "Failed to fetch venue coverage comparison" };
  }
}

/**
 * Get user activity heatmap (last 7 days, by hour)
 */
export async function getUserActivityStats() {
  await requireAdmin();

  try {
    const today = new Date();
    const last7Days = subDays(today, 7);

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        createdAt: { gte: last7Days },
      },
      select: {
        createdAt: true,
      },
    });

    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    const heatmapData = [];

    for (const day of daysOfWeek) {
      for (const hour of hours) {
        const count = auditLogs.filter((log) => {
          const logDay = format(log.createdAt, "EEE");
          const logHour = log.createdAt.getHours();
          return logDay === day && logHour === hour;
        }).length;

        heatmapData.push({
          x: hour,
          y: day,
          value: count,
          label: `${day} ${hour}:00 - ${count} actions`,
        });
      }
    }

    return {
      success: true,
      heatmap: {
        data: heatmapData,
        xLabels: hours,
        yLabels: daysOfWeek,
      },
    };
  } catch (error) {
    console.error("Error fetching user activity stats:", error);
    return { error: "Failed to fetch user activity stats" };
  }
}

/**
 * Get action distribution (last 30 days)
 */
export async function getActionDistribution() {
  await requireAdmin();

  try {
    const last30Days = subDays(new Date(), 30);

    const actions = await prisma.auditLog.groupBy({
      by: ["actionType"],
      where: {
        createdAt: { gte: last30Days },
      },
      _count: true,
    });

    const distribution = actions.map((action) => ({
      name: action.actionType,
      value: action._count,
    }));

    return { success: true, distribution };
  } catch (error) {
    console.error("Error fetching action distribution:", error);
    return { error: "Failed to fetch action distribution" };
  }
}

/**
 * Get role distribution with active and inactive counts
 */
export async function getRoleDistribution() {
  await requireAdmin();

  try {
    // Get all roles with their users
    const roles = await prisma.role.findMany({
      select: {
        name: true,
        users: {
          select: {
            active: true,
          },
        },
      },
    });

    const distribution = roles.map((role) => {
      const activeCount = role.users.filter((u) => u.active).length;
      const inactiveCount = role.users.filter((u) => !u.active).length;

      return {
        name: role.name,
        active: activeCount,
        inactive: inactiveCount,
        total: role.users.length,
      };
    });

    return { success: true, distribution };
  } catch (error) {
    console.error("Error fetching role distribution:", error);
    return { error: "Failed to fetch role distribution" };
  }
}

/**
 * Get approval turnaround time metrics (last 12 weeks)
 */
export async function getApprovalMetrics() {
  await requireAdmin();

  try {
    const today = new Date();
    const metrics = [];

    for (let i = 11; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const approvedRequests = await prisma.timeOffRequest.findMany({
        where: {
          status: { in: ["APPROVED", "REJECTED"] },
          reviewedAt: {
            gte: weekStart,
            lt: weekEnd,
          },
        },
        select: {
          createdAt: true,
          reviewedAt: true,
        },
      });

      let totalDays = 0;
      approvedRequests.forEach((req) => {
        if (req.reviewedAt) {
          const diffMs = req.reviewedAt.getTime() - req.createdAt.getTime();
          const diffDays = diffMs / (1000 * 60 * 60 * 24);
          totalDays += diffDays;
        }
      });

      const avgDays = approvedRequests.length > 0
        ? totalDays / approvedRequests.length
        : 0;

      metrics.push({
        week: format(weekStart, "MMM d"),
        avgDays: Math.round(avgDays * 10) / 10, // Round to 1 decimal
        target: 2, // Target: 2 days
      });
    }

    return { success: true, metrics };
  } catch (error) {
    console.error("Error fetching approval metrics:", error);
    return { error: "Failed to fetch approval metrics" };
  }
}

/**
 * Get recent audit logs (last 20)
 */
export async function getRecentAuditLogs() {
  await requireAdmin();

  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        actionType: true,
        resourceType: true,
        resourceId: true,
        createdAt: true,
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            profileImage: true,
          },
        },
      },
    });

    const formattedLogs = logs.map((log) => ({
      id: log.id,
      action: log.actionType,
      resource: log.resourceType,
      description: `${log.actionType} on ${log.resourceType}${log.resourceId ? ` (ID: ${log.resourceId})` : ''}`,
      timestamp: log.createdAt,
      user: {
        name: `${log.user.firstName} ${log.user.lastName}`,
        email: log.user.email,
        avatar: log.user.profileImage,
      },
    }));

    return { success: true, logs: formattedLogs };
  } catch (error) {
    console.error("Error fetching recent audit logs:", error);
    return { error: "Failed to fetch recent audit logs" };
  }
}

/**
 * Get all admin dashboard data at once
 */
export async function getAdminDashboardData() {
  const [globalStats, venueComparison, activityHeatmap, actionDist, roleDist, approvalMetrics, auditLogs] =
    await Promise.all([
      getAdminGlobalStats(),
      getVenueCoverageComparison(),
      getUserActivityStats(),
      getActionDistribution(),
      getRoleDistribution(),
      getApprovalMetrics(),
      getRecentAuditLogs(),
    ]);

  return {
    success: true,
    data: {
      globalStats: globalStats.success ? globalStats.stats : null,
      venueComparison: venueComparison.success ? venueComparison.comparison : [],
      activityHeatmap: activityHeatmap.success ? activityHeatmap.heatmap : null,
      actionDistribution: actionDist.success ? actionDist.distribution : [],
      roleDistribution: roleDist.success ? roleDist.distribution : [],
      approvalMetrics: approvalMetrics.success ? approvalMetrics.metrics : [],
      auditLogs: auditLogs.success ? auditLogs.logs : [],
    },
  };
}
