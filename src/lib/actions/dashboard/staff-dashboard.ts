"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, format, startOfDay, endOfDay, subWeeks } from "date-fns";

/**
 * Get weekly availability summary for the next 7 days
 */
export async function getWeeklyAvailabilitySummary() {
  const user = await requireAuth();

  try {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    // Get user's availability
    const availability = await prisma.availability.findMany({
      where: { userId: user.id },
    });

    // Get approved time-off for the week
    const timeOff = await prisma.timeOffRequest.findMany({
      where: {
        userId: user.id,
        status: "APPROVED",
        OR: [
          {
            startDate: { lte: weekEnd },
            endDate: { gte: weekStart },
          },
        ],
      },
      select: {
        startDate: true,
        endDate: true,
        type: true,
      },
    });

    // Map days to availability status
    const weekSummary = days.map((day) => {
      const dayOfWeek = day.getDay();
      const dayAvailability = availability.find((a) => a.dayOfWeek === dayOfWeek);

      // Check if there's time-off for this day
      const hasTimeOff = timeOff.some(
        (to) => day >= startOfDay(to.startDate) && day <= endOfDay(to.endDate)
      );

      let status: "available" | "unavailable" | "partial" | "time-off" = "unavailable";
      let hours = 0;

      if (hasTimeOff) {
        status = "time-off";
      } else if (dayAvailability?.isAvailable) {
        status = "available";
        if (dayAvailability.startTime && dayAvailability.endTime) {
          const [startHour, startMin] = dayAvailability.startTime.split(":").map(Number);
          const [endHour, endMin] = dayAvailability.endTime.split(":").map(Number);
          hours = endHour - startHour + (endMin - startMin) / 60;
        }
      }

      return {
        date: format(day, "yyyy-MM-dd"),
        dayName: format(day, "EEE"),
        dayOfWeek,
        status,
        hours,
        isToday: format(day, "yyyy-MM-dd") === format(today, "yyyy-MM-dd"),
      };
    });

    return { success: true, summary: weekSummary };
  } catch (error) {
    console.error("Error fetching weekly availability summary:", error);
    return { error: "Failed to fetch weekly availability summary" };
  }
}

/**
 * Get staff KPI stats
 */
export async function getStaffKPIs() {
  const user = await requireAuth();

  try {
    const today = new Date();
    const weekStart = startOfWeek(today, { weekStartsOn: 0 });
    const weekEnd = endOfWeek(today, { weekStartsOn: 0 });
    const next30Days = new Date(today);
    next30Days.setDate(next30Days.getDate() + 30);

    // Calculate hours SCHEDULED this week (from RosterShift, not availability)
    const scheduledShifts = await prisma.rosterShift.findMany({
      where: {
        userId: user.id,
        date: {
          gte: weekStart,
          lte: weekEnd,
        },
        roster: {
          status: "PUBLISHED",
        },
      },
      select: {
        startTime: true,
        endTime: true,
        breakMinutes: true,
      },
    });

    let hoursThisWeek = 0;
    scheduledShifts.forEach((shift) => {
      const [startHour, startMin] = shift.startTime.split(":").map(Number);
      const [endHour, endMin] = shift.endTime.split(":").map(Number);
      const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin) - (shift.breakMinutes || 0);
      hoursThisWeek += totalMinutes / 60;
    });

    // Get upcoming approved time-off
    const upcomingTimeOff = await prisma.timeOffRequest.count({
      where: {
        userId: user.id,
        status: "APPROVED",
        startDate: {
          gte: today,
          lte: next30Days,
        },
      },
    });

    // Get pending time-off requests
    const pendingRequests = await prisma.timeOffRequest.count({
      where: {
        userId: user.id,
        status: "PENDING",
      },
    });

    // Get unread messages count
    // Find conversations where user is a participant
    const userConversations = await prisma.conversationParticipant.findMany({
      where: { userId: user.id },
      select: { conversationId: true },
    });

    const conversationIds = userConversations.map((cp) => cp.conversationId);

    // Count messages in those conversations that user hasn't read
    const unreadMessages = await prisma.message.count({
      where: {
        conversationId: { in: conversationIds },
        senderId: { not: user.id }, // Not sent by user
        NOT: {
          readBy: { has: user.id }, // User ID not in readBy array
        },
      },
    });

    return {
      success: true,
      kpis: {
        hoursThisWeek: Math.round(hoursThisWeek * 10) / 10,
        upcomingTimeOff,
        pendingRequests,
        unreadMessages,
        shiftsThisWeek: scheduledShifts.length,
      },
    };
  } catch (error) {
    console.error("Error fetching staff KPIs:", error);
    return { error: "Failed to fetch KPIs" };
  }
}

/**
 * Get recent activity (last 5 notifications)
 */
export async function getRecentActivity() {
  const user = await requireAuth();

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        message: true,
        readAt: true,
        createdAt: true,
      },
    });

    return { success: true, notifications };
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    return { error: "Failed to fetch recent activity" };
  }
}

/**
 * Get personal scheduled hours trends (last 4 weeks)
 * Uses RosterShift for actual scheduled hours, not availability patterns
 */
export async function getScheduledHoursTrends() {
  const user = await requireAuth();

  try {
    const today = new Date();
    const trends = [];

    // Go back 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(subWeeks(today, i), { weekStartsOn: 0 });
      const weekEnd = endOfWeek(subWeeks(today, i), { weekStartsOn: 0 });

      // Get scheduled shifts for this week
      const weekShifts = await prisma.rosterShift.findMany({
        where: {
          userId: user.id,
          date: {
            gte: weekStart,
            lte: weekEnd,
          },
          roster: {
            status: "PUBLISHED",
          },
        },
        select: {
          startTime: true,
          endTime: true,
          breakMinutes: true,
        },
      });

      // Calculate total scheduled hours for the week
      let totalHours = 0;
      weekShifts.forEach((shift) => {
        const [startHour, startMin] = shift.startTime.split(":").map(Number);
        const [endHour, endMin] = shift.endTime.split(":").map(Number);
        const totalMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin) - (shift.breakMinutes || 0);
        totalHours += totalMinutes / 60;
      });

      trends.push({
        week: format(weekStart, "MMM d"),
        hours: Math.round(totalHours * 10) / 10,
        shifts: weekShifts.length,
      });
    }

    return { success: true, trends };
  } catch (error) {
    console.error("Error fetching scheduled hours trends:", error);
    return { error: "Failed to fetch scheduled hours trends" };
  }
}

/**
 * Get upcoming shifts for the next 7 days
 */
export async function getUpcomingShifts() {
  const user = await requireAuth();

  try {
    const today = new Date();
    const next7Days = new Date(today);
    next7Days.setDate(next7Days.getDate() + 7);

    const shifts = await prisma.rosterShift.findMany({
      where: {
        userId: user.id,
        date: {
          gte: startOfDay(today),
          lte: next7Days,
        },
        roster: {
          status: "PUBLISHED",
        },
      },
      include: {
        roster: {
          select: {
            id: true,
            name: true,
            venue: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        date: "asc",
      },
      take: 10,
    });

    const formattedShifts = shifts.map((shift) => ({
      id: shift.id,
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      position: shift.position,
      notes: shift.notes,
      roster: {
        id: shift.roster.id,
        name: shift.roster.name,
        venue: shift.roster.venue,
      },
    }));

    return { success: true, shifts: formattedShifts };
  } catch (error) {
    console.error("Error fetching upcoming shifts:", error);
    return { error: "Failed to fetch upcoming shifts" };
  }
}

/**
 * Get all staff dashboard data at once
 */
export async function getStaffDashboardData() {
  const [weeklySummary, kpis, activity, trends, upcomingShifts] = await Promise.all([
    getWeeklyAvailabilitySummary(),
    getStaffKPIs(),
    getRecentActivity(),
    getScheduledHoursTrends(),
    getUpcomingShifts(),
  ]);

  return {
    success: true,
    data: {
      weeklySummary: weeklySummary.success ? weeklySummary.summary : [],
      kpis: kpis.success ? kpis.kpis : null,
      recentActivity: activity.success ? activity.notifications : [],
      trends: trends.success ? trends.trends : [],
      upcomingShifts: upcomingShifts.success ? upcomingShifts.shifts : [],
    },
  };
}
