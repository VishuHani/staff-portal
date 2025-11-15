"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { startOfWeek, endOfWeek, addWeeks, eachDayOfInterval, format, startOfDay, endOfDay } from "date-fns";

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

    // Calculate hours available this week
    const thisWeekAvailability = await prisma.availability.findMany({
      where: {
        userId: user.id,
        isAvailable: true,
        dayOfWeek: {
          gte: weekStart.getDay(),
          lte: weekEnd.getDay(),
        },
      },
    });

    let hoursThisWeek = 0;
    thisWeekAvailability.forEach((avail) => {
      if (avail.startTime && avail.endTime) {
        const [startHour, startMin] = avail.startTime.split(":").map(Number);
        const [endHour, endMin] = avail.endTime.split(":").map(Number);
        hoursThisWeek += endHour - startHour + (endMin - startMin) / 60;
      }
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
        hoursThisWeek: Math.round(hoursThisWeek),
        upcomingTimeOff,
        pendingRequests,
        unreadMessages,
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
 * Get personal availability trends (last 4 weeks)
 */
export async function getAvailabilityTrends() {
  const user = await requireAuth();

  try {
    const today = new Date();
    const trends = [];

    // Go back 4 weeks
    for (let i = 3; i >= 0; i--) {
      const weekStart = startOfWeek(addWeeks(today, -i), { weekStartsOn: 0 });
      const weekEnd = endOfWeek(addWeeks(today, -i), { weekStartsOn: 0 });

      // Get availability for this week
      const weekAvailability = await prisma.availability.findMany({
        where: {
          userId: user.id,
          isAvailable: true,
        },
      });

      // Calculate total hours for the week
      let totalHours = 0;
      weekAvailability.forEach((avail) => {
        if (avail.startTime && avail.endTime) {
          const [startHour, startMin] = avail.startTime.split(":").map(Number);
          const [endHour, endMin] = avail.endTime.split(":").map(Number);
          totalHours += endHour - startHour + (endMin - startMin) / 60;
        }
      });

      trends.push({
        week: format(weekStart, "MMM d"),
        hours: Math.round(totalHours),
      });
    }

    return { success: true, trends };
  } catch (error) {
    console.error("Error fetching availability trends:", error);
    return { error: "Failed to fetch availability trends" };
  }
}

/**
 * Get all staff dashboard data at once
 */
export async function getStaffDashboardData() {
  const [weeklySummary, kpis, activity, trends] = await Promise.all([
    getWeeklyAvailabilitySummary(),
    getStaffKPIs(),
    getRecentActivity(),
    getAvailabilityTrends(),
  ]);

  return {
    success: true,
    data: {
      weeklySummary: weeklySummary.success ? weeklySummary.summary : [],
      kpis: kpis.success ? kpis.kpis : null,
      recentActivity: activity.success ? activity.notifications : [],
      trends: trends.success ? trends.trends : [],
    },
  };
}
