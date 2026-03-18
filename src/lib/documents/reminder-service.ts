import { prisma } from "@/lib/prisma";
import { ReminderType, ReminderStatus } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface ScheduleRemindersInput {
  assignmentId: string;
  dueDate: Date;
  reminderDays: number[]; // Days before due date (e.g., [7, 3, 1, 0])
  reminderType?: ReminderType;
}

export interface ReminderSchedule {
  daysBeforeDue: number;
  scheduledFor: Date;
}

export interface ProcessRemindersResult {
  processed: number;
  sent: number;
  failed: number;
  errors: { reminderId: string; error: string }[];
}

// ============================================================================
// Reminder Scheduling Service
// ============================================================================

/**
 * Schedule reminders for a document assignment
 * Creates reminder records for each day in the reminder schedule
 */
export async function scheduleRemindersForAssignment(
  input: ScheduleRemindersInput
): Promise<{ success: boolean; reminders?: string[]; error?: string }> {
  try {
    const { assignmentId, dueDate, reminderDays, reminderType = "BOTH" } = input;

    // Validate input
    if (!assignmentId) {
      return { success: false, error: "Assignment ID is required" };
    }

    if (!dueDate) {
      return { success: false, error: "Due date is required" };
    }

    if (!reminderDays || reminderDays.length === 0) {
      return { success: false, error: "At least one reminder day is required" };
    }

    // Check if assignment exists
    const assignment = await prisma.documentAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        template: { select: { name: true } },
        bundle: { select: { name: true } },
        user: { select: { id: true, email: true, firstName: true, lastName: true } },
      },
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    // Don't schedule reminders for completed/waived assignments
    if (["COMPLETED", "WAIVED", "EXPIRED"].includes(assignment.status)) {
      return { success: false, error: "Cannot schedule reminders for completed/waived/expired assignments" };
    }

    // Cancel any existing pending reminders for this assignment
    await prisma.documentReminder.updateMany({
      where: {
        assignmentId,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
      },
    });

    // Create reminder schedules
    const reminderSchedules: ReminderSchedule[] = reminderDays
      .sort((a, b) => b - a) // Sort descending (furthest first)
      .map((daysBeforeDue) => {
        const scheduledFor = new Date(dueDate);
        scheduledFor.setDate(scheduledFor.getDate() - daysBeforeDue);
        scheduledFor.setHours(9, 0, 0, 0); // Set to 9 AM

        return {
          daysBeforeDue,
          scheduledFor,
        };
      });

    // Filter out past reminders (but keep today's)
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const validSchedules = reminderSchedules.filter((schedule) => {
      const scheduleDate = new Date(schedule.scheduledFor);
      scheduleDate.setHours(0, 0, 0, 0);
      return scheduleDate >= now;
    });

    // Create reminder records
    const reminderIds: string[] = [];

    for (const schedule of validSchedules) {
      const reminder = await prisma.documentReminder.create({
        data: {
          assignmentId,
          reminderType,
          scheduledFor: schedule.scheduledFor,
          status: "PENDING",
        },
      });
      reminderIds.push(reminder.id);
    }

    return {
      success: true,
      reminders: reminderIds,
    };
  } catch (error) {
    console.error("Error scheduling reminders:", error);
    return { success: false, error: "Failed to schedule reminders" };
  }
}

/**
 * Get pending reminders that are due to be sent
 */
export async function getPendingReminders(): Promise<{
  success: boolean;
  reminders?: any[];
  error?: string;
}> {
  try {
    const now = new Date();

    const reminders = await prisma.documentReminder.findMany({
      where: {
        status: "PENDING",
        scheduledFor: { lte: now },
      },
      include: {
        assignment: {
          include: {
            template: { select: { id: true, name: true } },
            bundle: { select: { id: true, name: true } },
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            venue: { select: { id: true, name: true } },
          },
        },
      },
      take: 100, // Process in batches
    });

    return { success: true, reminders };
  } catch (error) {
    console.error("Error fetching pending reminders:", error);
    return { success: false, error: "Failed to fetch pending reminders" };
  }
}

/**
 * Mark a reminder as sent
 */
export async function markReminderSent(
  reminderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.documentReminder.update({
      where: { id: reminderId },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error marking reminder as sent:", error);
    return { success: false, error: "Failed to mark reminder as sent" };
  }
}

/**
 * Mark a reminder as failed
 */
export async function markReminderFailed(
  reminderId: string,
  errorMessage?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.documentReminder.update({
      where: { id: reminderId },
      data: {
        status: "FAILED",
      },
    });

    // Log the error
    console.error(`Reminder ${reminderId} failed:`, errorMessage);

    return { success: true };
  } catch (error) {
    console.error("Error marking reminder as failed:", error);
    return { success: false, error: "Failed to mark reminder as failed" };
  }
}

/**
 * Cancel all pending reminders for an assignment
 */
export async function cancelRemindersForAssignment(
  assignmentId: string
): Promise<{ success: boolean; cancelledCount?: number; error?: string }> {
  try {
    const result = await prisma.documentReminder.updateMany({
      where: {
        assignmentId,
        status: "PENDING",
      },
      data: {
        status: "CANCELLED",
      },
    });

    return {
      success: true,
      cancelledCount: result.count,
    };
  } catch (error) {
    console.error("Error cancelling reminders:", error);
    return { success: false, error: "Failed to cancel reminders" };
  }
}

/**
 * Reschedule reminders when due date changes
 */
export async function rescheduleReminders(
  assignmentId: string,
  newDueDate: Date,
  reminderDays: number[],
  reminderType: ReminderType = "BOTH"
): Promise<{ success: boolean; reminders?: string[]; error?: string }> {
  try {
    // Cancel existing reminders
    await cancelRemindersForAssignment(assignmentId);

    // Schedule new reminders
    return scheduleRemindersForAssignment({
      assignmentId,
      dueDate: newDueDate,
      reminderDays,
      reminderType,
    });
  } catch (error) {
    console.error("Error rescheduling reminders:", error);
    return { success: false, error: "Failed to reschedule reminders" };
  }
}

/**
 * Get reminder statistics for a venue
 */
export async function getReminderStats(
  venueId: string
): Promise<{
  success: boolean;
  data?: {
    pending: number;
    sent: number;
    failed: number;
    cancelled: number;
    overdue: number;
  };
  error?: string;
}> {
  try {
    const now = new Date();

    const [pending, sent, failed, cancelled, overdue] = await Promise.all([
      prisma.documentReminder.count({
        where: {
          assignment: { venueId },
          status: "PENDING",
        },
      }),
      prisma.documentReminder.count({
        where: {
          assignment: { venueId },
          status: "SENT",
        },
      }),
      prisma.documentReminder.count({
        where: {
          assignment: { venueId },
          status: "FAILED",
        },
      }),
      prisma.documentReminder.count({
        where: {
          assignment: { venueId },
          status: "CANCELLED",
        },
      }),
      prisma.documentReminder.count({
        where: {
          assignment: {
            venueId,
            status: { in: ["PENDING", "IN_PROGRESS"] },
            dueDate: { lt: now },
          },
        },
      }),
    ]);

    return {
      success: true,
      data: { pending, sent, failed, cancelled, overdue },
    };
  } catch (error) {
    console.error("Error fetching reminder stats:", error);
    return { success: false, error: "Failed to fetch reminder statistics" };
  }
}

/**
 * Get upcoming reminders for a user
 */
export async function getUpcomingRemindersForUser(
  userId: string,
  days: number = 7
): Promise<{
  success: boolean;
  reminders?: any[];
  error?: string;
}> {
  try {
    const now = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + days);

    const reminders = await prisma.documentReminder.findMany({
      where: {
        assignment: { userId },
        status: "PENDING",
        scheduledFor: {
          gte: now,
          lte: endDate,
        },
      },
      include: {
        assignment: {
          include: {
            template: { select: { id: true, name: true } },
            bundle: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { scheduledFor: "asc" },
    });

    return { success: true, reminders };
  } catch (error) {
    console.error("Error fetching upcoming reminders:", error);
    return { success: false, error: "Failed to fetch upcoming reminders" };
  }
}

/**
 * Clean up old reminders (sent/failed/cancelled older than X days)
 */
export async function cleanupOldReminders(
  daysOld: number = 30
): Promise<{ success: boolean; deletedCount?: number; error?: string }> {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await prisma.documentReminder.deleteMany({
      where: {
        status: { in: ["SENT", "FAILED", "CANCELLED"] },
        createdAt: { lt: cutoffDate },
      },
    });

    return {
      success: true,
      deletedCount: result.count,
    };
  } catch (error) {
    console.error("Error cleaning up old reminders:", error);
    return { success: false, error: "Failed to cleanup old reminders" };
  }
}
