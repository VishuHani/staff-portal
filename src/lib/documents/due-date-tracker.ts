import { prisma } from "@/lib/prisma";
import { AssignmentStatus } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface OverdueAssignment {
  id: string;
  userId: string | null;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  templateId: string | null;
  template?: {
    id: string;
    name: string;
    category: string;
  } | null;
  bundleId: string | null;
  bundle?: {
    id: string;
    name: string;
    category: string;
  } | null;
  venueId: string;
  venue: {
    id: string;
    name: string;
  };
  dueDate: Date;
  assignedAt: Date;
  status: AssignmentStatus;
  daysOverdue: number;
  escalationLevel: number;
}

export interface OverdueReport {
  venueId: string;
  venueName: string;
  totalOverdue: number;
  byCategory: Record<string, number>;
  byEscalationLevel: Record<string, number>;
  oldestOverdue: Date | null;
  assignments: OverdueAssignment[];
}

export interface DueDateStats {
  total: number;
  pending: number;
  inProgress: number;
  overdue: number;
  dueToday: number;
  dueThisWeek: number;
  dueThisMonth: number;
  completed: number;
  completionRate: number;
}

export interface EscalationRule {
  daysOverdue: number;
  level: number;
  action: "notify_user" | "notify_manager" | "notify_admin" | "auto_escalate";
}

// ============================================================================
// Escalation Configuration
// ============================================================================

const ESCALATION_RULES: EscalationRule[] = [
  { daysOverdue: 0, level: 0, action: "notify_user" }, // Due date
  { daysOverdue: 1, level: 1, action: "notify_user" }, // 1 day overdue
  { daysOverdue: 3, level: 2, action: "notify_manager" }, // 3 days overdue
  { daysOverdue: 7, level: 3, action: "notify_admin" }, // 1 week overdue
  { daysOverdue: 14, level: 4, action: "auto_escalate" }, // 2 weeks overdue
];

// ============================================================================
// Due Date Calculation
// ============================================================================

/**
 * Calculate due date from assignment date and days
 */
export function calculateDueDate(
  assignedAt: Date,
  dueWithinDays: number
): Date {
  const dueDate = new Date(assignedAt);
  dueDate.setDate(dueDate.getDate() + dueWithinDays);
  dueDate.setHours(23, 59, 59, 999); // End of day
  return dueDate;
}

/**
 * Calculate days until due or days overdue
 * Returns negative number if overdue
 */
export function calculateDaysUntilDue(dueDate: Date | null): number | null {
  if (!dueDate) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  return diffDays;
}

/**
 * Get escalation level based on days overdue
 */
export function getEscalationLevel(daysOverdue: number): number {
  let level = 0;
  for (const rule of ESCALATION_RULES) {
    if (daysOverdue >= rule.daysOverdue) {
      level = rule.level;
    }
  }
  return level;
}

/**
 * Get escalation action for a given level
 */
export function getEscalationAction(level: number): EscalationRule["action"] {
  const rule = ESCALATION_RULES.find((r) => r.level === level);
  return rule?.action || "notify_user";
}

// ============================================================================
// Overdue Tracking
// ============================================================================

/**
 * Get all overdue assignments for a venue
 */
export async function getOverdueAssignments(
  venueId: string
): Promise<{ success: boolean; data?: OverdueAssignment[]; error?: string }> {
  try {
    const now = new Date();

    const assignments = await prisma.documentAssignment.findMany({
      where: {
        venueId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        template: {
          select: { id: true, name: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        venue: {
          select: { id: true, name: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const overdueAssignments: OverdueAssignment[] = assignments.map((a) => {
      const daysOverdue = Math.abs(calculateDaysUntilDue(a.dueDate) || 0);
      return {
        id: a.id,
        userId: a.userId,
        user: a.user,
        templateId: a.templateId,
        template: a.template,
        bundleId: a.bundleId,
        bundle: a.bundle,
        venueId: a.venueId,
        venue: a.venue,
        dueDate: a.dueDate!,
        assignedAt: a.assignedAt,
        status: a.status,
        daysOverdue,
        escalationLevel: getEscalationLevel(daysOverdue),
      };
    });

    return { success: true, data: overdueAssignments };
  } catch (error) {
    console.error("Error fetching overdue assignments:", error);
    return { success: false, error: "Failed to fetch overdue assignments" };
  }
}

/**
 * Get overdue assignments for a specific user
 */
export async function getUserOverdueAssignments(
  userId: string
): Promise<{ success: boolean; data?: OverdueAssignment[]; error?: string }> {
  try {
    const now = new Date();

    const assignments = await prisma.documentAssignment.findMany({
      where: {
        userId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        template: {
          select: { id: true, name: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        venue: {
          select: { id: true, name: true },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const overdueAssignments: OverdueAssignment[] = assignments.map((a) => {
      const daysOverdue = Math.abs(calculateDaysUntilDue(a.dueDate) || 0);
      return {
        id: a.id,
        userId: a.userId,
        user: a.user,
        templateId: a.templateId,
        template: a.template,
        bundleId: a.bundleId,
        bundle: a.bundle,
        venueId: a.venueId,
        venue: a.venue,
        dueDate: a.dueDate!,
        assignedAt: a.assignedAt,
        status: a.status,
        daysOverdue,
        escalationLevel: getEscalationLevel(daysOverdue),
      };
    });

    return { success: true, data: overdueAssignments };
  } catch (error) {
    console.error("Error fetching user overdue assignments:", error);
    return { success: false, error: "Failed to fetch overdue assignments" };
  }
}

/**
 * Generate overdue report for a venue
 */
export async function generateOverdueReport(
  venueId: string
): Promise<{ success: boolean; data?: OverdueReport; error?: string }> {
  try {
    const { success, data: assignments, error } = await getOverdueAssignments(venueId);

    if (!success || !assignments) {
      return { success: false, error };
    }

    // Get venue info
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, name: true },
    });

    if (!venue) {
      return { success: false, error: "Venue not found" };
    }

    // Calculate statistics
    const byCategory: Record<string, number> = {};
    const byEscalationLevel: Record<string, number> = {
      "0": 0,
      "1": 0,
      "2": 0,
      "3": 0,
      "4": 0,
    };

    let oldestOverdue: Date | null = null;

    for (const assignment of assignments) {
      // By category
      const category = assignment.template?.category || assignment.bundle?.category || "GENERAL";
      byCategory[category] = (byCategory[category] || 0) + 1;

      // By escalation level
      const level = assignment.escalationLevel.toString();
      byEscalationLevel[level] = (byEscalationLevel[level] || 0) + 1;

      // Oldest overdue
      if (!oldestOverdue || assignment.dueDate < oldestOverdue) {
        oldestOverdue = assignment.dueDate;
      }
    }

    const report: OverdueReport = {
      venueId,
      venueName: venue.name,
      totalOverdue: assignments.length,
      byCategory,
      byEscalationLevel,
      oldestOverdue,
      assignments,
    };

    return { success: true, data: report };
  } catch (error) {
    console.error("Error generating overdue report:", error);
    return { success: false, error: "Failed to generate overdue report" };
  }
}

// ============================================================================
// Due Date Statistics
// ============================================================================

/**
 * Get due date statistics for a venue
 */
export async function getDueDateStats(
  venueId: string
): Promise<{ success: boolean; data?: DueDateStats; error?: string }> {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthEnd = new Date(now);
    monthEnd.setDate(monthEnd.getDate() + 30);

    const [
      total,
      pending,
      inProgress,
      overdue,
      dueToday,
      dueThisWeek,
      dueThisMonth,
      completed,
    ] = await Promise.all([
      prisma.documentAssignment.count({ where: { venueId } }),
      prisma.documentAssignment.count({
        where: { venueId, status: "PENDING" },
      }),
      prisma.documentAssignment.count({
        where: { venueId, status: "IN_PROGRESS" },
      }),
      prisma.documentAssignment.count({
        where: {
          venueId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lt: now },
        },
      }),
      prisma.documentAssignment.count({
        where: {
          venueId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.documentAssignment.count({
        where: {
          venueId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { gte: todayStart, lte: weekEnd },
        },
      }),
      prisma.documentAssignment.count({
        where: {
          venueId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { gte: todayStart, lte: monthEnd },
        },
      }),
      prisma.documentAssignment.count({
        where: { venueId, status: "COMPLETED" },
      }),
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      success: true,
      data: {
        total,
        pending,
        inProgress,
        overdue,
        dueToday,
        dueThisWeek,
        dueThisMonth,
        completed,
        completionRate,
      },
    };
  } catch (error) {
    console.error("Error fetching due date stats:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

/**
 * Get due date statistics for a user
 */
export async function getUserDueDateStats(
  userId: string
): Promise<{ success: boolean; data?: DueDateStats; error?: string }> {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthEnd = new Date(now);
    monthEnd.setDate(monthEnd.getDate() + 30);

    const [
      total,
      pending,
      inProgress,
      overdue,
      dueToday,
      dueThisWeek,
      dueThisMonth,
      completed,
    ] = await Promise.all([
      prisma.documentAssignment.count({ where: { userId } }),
      prisma.documentAssignment.count({
        where: { userId, status: "PENDING" },
      }),
      prisma.documentAssignment.count({
        where: { userId, status: "IN_PROGRESS" },
      }),
      prisma.documentAssignment.count({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lt: now },
        },
      }),
      prisma.documentAssignment.count({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      prisma.documentAssignment.count({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { gte: todayStart, lte: weekEnd },
        },
      }),
      prisma.documentAssignment.count({
        where: {
          userId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { gte: todayStart, lte: monthEnd },
        },
      }),
      prisma.documentAssignment.count({
        where: { userId, status: "COMPLETED" },
      }),
    ]);

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      success: true,
      data: {
        total,
        pending,
        inProgress,
        overdue,
        dueToday,
        dueThisWeek,
        dueThisMonth,
        completed,
        completionRate,
      },
    };
  } catch (error) {
    console.error("Error fetching user due date stats:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

// ============================================================================
// Escalation Processing
// ============================================================================

/**
 * Process escalations for overdue assignments
 * Should be called by a cron job
 */
export async function processEscalations(): Promise<{
  success: boolean;
  processed?: number;
  errors?: string[];
}> {
  try {
    const now = new Date();
    const errors: string[] = [];
    let processed = 0;

    // Get all overdue assignments
    const overdueAssignments = await prisma.documentAssignment.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        template: { select: { id: true, name: true } },
        bundle: { select: { id: true, name: true } },
        venue: { select: { id: true, name: true } },
      },
    });

    for (const assignment of overdueAssignments) {
      try {
        const daysOverdue = Math.abs(calculateDaysUntilDue(assignment.dueDate) || 0);
        const escalationLevel = getEscalationLevel(daysOverdue);
        const action = getEscalationAction(escalationLevel);

        // Check if we've already escalated to this level
        // This would require tracking escalation history
        // For now, we'll just log the escalation

        console.log(`[Escalation] Assignment ${assignment.id} - Level ${escalationLevel} - Action: ${action}`);

        // In a real implementation, you would:
        // 1. Check if escalation already recorded
        // 2. Send appropriate notifications based on action
        // 3. Record the escalation

        processed++;
      } catch (error: any) {
        errors.push(`Assignment ${assignment.id}: ${error.message}`);
      }
    }

    return {
      success: true,
      processed,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error: any) {
    console.error("Error processing escalations:", error);
    return {
      success: false,
      errors: [error.message],
    };
  }
}

// ============================================================================
// Assignment Expiration
// ============================================================================

/**
 * Mark expired assignments
 * Assignments can expire if they have an expiration date
 */
export async function processExpiredAssignments(): Promise<{
  success: boolean;
  expired?: number;
  error?: string;
}> {
  try {
    const now = new Date();

    // For now, we don't have an expiration date field
    // This could be added in the future for time-limited assignments

    // Alternative: Mark very overdue assignments as expired
    // e.g., 30+ days overdue
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await prisma.documentAssignment.updateMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        dueDate: { lt: thirtyDaysAgo },
      },
      data: {
        status: "EXPIRED",
      },
    });

    return {
      success: true,
      expired: result.count,
    };
  } catch (error: any) {
    console.error("Error processing expired assignments:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if an assignment is overdue
 */
export function isAssignmentOverdue(dueDate: Date | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

/**
 * Get due date status text
 */
export function getDueDateStatusText(dueDate: Date | null): string {
  if (!dueDate) return "No due date";

  const days = calculateDaysUntilDue(dueDate);

  if (days === null) return "No due date";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `Due in ${days} days`;
}

/**
 * Get due date status color
 */
export function getDueDateStatusColor(dueDate: Date | null): "default" | "warning" | "danger" | "success" {
  if (!dueDate) return "default";

  const days = calculateDaysUntilDue(dueDate);

  if (days === null) return "default";
  if (days < 0) return "danger";
  if (days <= 1) return "warning";
  if (days <= 3) return "warning";
  return "default";
}
