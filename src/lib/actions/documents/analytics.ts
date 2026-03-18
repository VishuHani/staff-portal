"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";
import { AssignmentStatus, AuditAction, ResourceType } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface DocumentAnalyticsSummary {
  totalDocuments: number;
  activeDocuments: number;
  totalAssignments: number;
  completedAssignments: number;
  pendingAssignments: number;
  inProgressAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null; // in days
  recentlyCompleted: number; // Last 7 days
  upcomingDeadlines: number; // Next 7 days
}

export interface CompletionTrendData {
  date: string;
  assigned: number;
  completed: number;
  pending: number;
}

export interface CategoryBreakdownData {
  category: string;
  count: number;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  [key: string]: string | number;
}

export interface TopDocumentData {
  templateId: string;
  templateName: string;
  category: string;
  documentType: string;
  totalAssignments: number;
  completedAssignments: number;
  completionRate: number;
  averageCompletionTime: number | null;
}

export interface StrugglingDocumentData {
  templateId: string;
  templateName: string;
  category: string;
  documentType: string;
  totalAssignments: number;
  pendingAssignments: number;
  overdueAssignments: number;
  completionRate: number;
  frequentlyIncomplete: boolean;
}

export interface UserComplianceReport {
  userId: string;
  userName: string;
  userEmail: string;
  totalAssigned: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
  complianceRate: number;
  averageCompletionTime: number | null;
}

export interface DocumentTypeBreakdown {
  documentType: string;
  count: number;
  completionRate: number;
}

// ============================================================================
// Permission Check Helper
// ============================================================================

async function checkDocumentPermission(
  userId: string,
  action: string,
  venueId?: string
): Promise<boolean> {
  return hasPermission(userId, "documents", action as any, venueId);
}

// ============================================================================
// Main Analytics Functions
// ============================================================================

/**
 * Get overall document analytics for a venue
 */
export async function getDocumentAnalytics(
  venueId: string | "all"
): Promise<{ success: boolean; data?: DocumentAnalyticsSummary; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    // Admins have access to all venues
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    // Build where clause based on venue selection
    const venueFilter = venueId === "all" ? {} : { venueId };

    // Get total documents
    const totalDocuments = await prisma.documentTemplate.count({
      where: venueFilter,
    });

    const activeDocuments = await prisma.documentTemplate.count({
      where: { ...venueFilter, isActive: true },
    });

    // Get all assignments
    const assignments = await prisma.documentAssignment.findMany({
      where: venueFilter,
      select: {
        id: true,
        status: true,
        assignedAt: true,
        dueDate: true,
        completedAt: true,
      },
    });

    const totalAssignments = assignments.length;
    const completedAssignments = assignments.filter((a) => a.status === "COMPLETED").length;
    const pendingAssignments = assignments.filter((a) => a.status === "PENDING").length;
    const inProgressAssignments = assignments.filter((a) => a.status === "IN_PROGRESS").length;
    
    const overdueAssignments = assignments.filter(
      (a) =>
        ["PENDING", "IN_PROGRESS"].includes(a.status) &&
        a.dueDate &&
        new Date(a.dueDate) < now
    ).length;

    const completionRate = totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0;

    // Calculate average completion time
    const completedWithTimes = assignments.filter(
      (a) => a.status === "COMPLETED" && a.completedAt
    );
    const averageCompletionTime = completedWithTimes.length > 0
      ? Math.round(
          completedWithTimes.reduce((sum, a) => {
            const assigned = new Date(a.assignedAt).getTime();
            const completed = new Date(a.completedAt!).getTime();
            return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
          }, 0) / completedWithTimes.length
        )
      : null;

    // Recently completed (last 7 days)
    const recentlyCompleted = assignments.filter(
      (a) => a.completedAt && new Date(a.completedAt) >= sevenDaysAgo
    ).length;

    // Upcoming deadlines (next 7 days)
    const upcomingDeadlines = assignments.filter(
      (a) =>
        ["PENDING", "IN_PROGRESS"].includes(a.status) &&
        a.dueDate &&
        new Date(a.dueDate) >= now &&
        new Date(a.dueDate) <= sevenDaysFromNow
    ).length;

    const data: DocumentAnalyticsSummary = {
      totalDocuments,
      activeDocuments,
      totalAssignments,
      completedAssignments,
      pendingAssignments,
      inProgressAssignments,
      overdueAssignments,
      completionRate,
      averageCompletionTime,
      recentlyCompleted,
      upcomingDeadlines,
    };

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching document analytics:", error);
    return { success: false, error: "Failed to fetch analytics" };
  }
}

/**
 * Get completion trend for the last N days
 */
export async function getCompletionTrend(
  venueId: string | "all",
  days: number = 30
): Promise<{ success: boolean; data?: CompletionTrendData[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Build where clause based on venue selection
    const venueFilter = venueId === "all" ? {} : { venueId };

    // Get assignments in date range
    const assignments = await prisma.documentAssignment.findMany({
      where: {
        ...venueFilter,
        OR: [
          { assignedAt: { gte: startDate } },
          { completedAt: { gte: startDate } },
        ],
      },
      select: {
        assignedAt: true,
        completedAt: true,
        status: true,
      },
    });

    // Initialize trend map with all dates
    const trendMap = new Map<string, { assigned: number; completed: number; pending: number }>();
    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      trendMap.set(dateStr, { assigned: 0, completed: 0, pending: 0 });
    }

    // Populate data
    for (const assignment of assignments) {
      const assignedDate = new Date(assignment.assignedAt).toISOString().split("T")[0];
      if (trendMap.has(assignedDate)) {
        trendMap.get(assignedDate)!.assigned++;
      }

      if (assignment.completedAt) {
        const completedDate = new Date(assignment.completedAt).toISOString().split("T")[0];
        if (trendMap.has(completedDate)) {
          trendMap.get(completedDate)!.completed++;
        }
      }

      if (assignment.status === "PENDING") {
        const pendingDate = new Date(assignment.assignedAt).toISOString().split("T")[0];
        if (trendMap.has(pendingDate)) {
          trendMap.get(pendingDate)!.pending++;
        }
      }
    }

    const data: CompletionTrendData[] = Array.from(trendMap.entries())
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching completion trend:", error);
    return { success: false, error: "Failed to fetch completion trend" };
  }
}

/**
 * Get document breakdown by category
 */
export async function getCategoryBreakdown(
  venueId: string | "all"
): Promise<{ success: boolean; data?: CategoryBreakdownData[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    // Build where clause based on venue selection
    const venueFilter = venueId === "all" ? {} : { venueId };

    // Get templates with their assignments
    const templates = await prisma.documentTemplate.findMany({
      where: venueFilter,
      select: {
        id: true,
        category: true,
        _count: {
          select: { assignments: true },
        },
        assignments: {
          select: { status: true },
        },
      },
    });

    // Aggregate by category
    const categoryMap = new Map<string, { count: number; totalAssignments: number; completedAssignments: number }>();

    for (const template of templates) {
      const category = template.category || "GENERAL";
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { count: 0, totalAssignments: 0, completedAssignments: 0 });
      }

      const cat = categoryMap.get(category)!;
      cat.count++;
      cat.totalAssignments += template._count.assignments;
      cat.completedAssignments += template.assignments.filter((a) => a.status === "COMPLETED").length;
    }

    const data: CategoryBreakdownData[] = Array.from(categoryMap.entries()).map(
      ([category, stats]) => ({
        category,
        count: stats.count,
        totalAssignments: stats.totalAssignments,
        completedAssignments: stats.completedAssignments,
        completionRate:
          stats.totalAssignments > 0
            ? Math.round((stats.completedAssignments / stats.totalAssignments) * 100)
            : 0,
      })
    );

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching category breakdown:", error);
    return { success: false, error: "Failed to fetch category breakdown" };
  }
}

/**
 * Get top performing documents
 */
export async function getTopDocuments(
  venueId: string | "all",
  limit: number = 10
): Promise<{ success: boolean; data?: TopDocumentData[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    // Build where clause based on venue selection
    const venueFilter = venueId === "all" ? {} : { venueId };

    // Get templates with assignments
    const templates = await prisma.documentTemplate.findMany({
      where: { ...venueFilter, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        documentType: true,
        assignments: {
          select: {
            status: true,
            assignedAt: true,
            completedAt: true,
          },
        },
      },
    });

    // Calculate metrics for each template
    const documentMetrics: TopDocumentData[] = templates.map((template) => {
      const totalAssignments = template.assignments.length;
      const completedAssignments = template.assignments.filter((a) => a.status === "COMPLETED").length;
      const completionRate = totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

      // Calculate average completion time
      const completedWithTimes = template.assignments.filter(
        (a) => a.status === "COMPLETED" && a.completedAt
      );
      const averageCompletionTime = completedWithTimes.length > 0
        ? Math.round(
            completedWithTimes.reduce((sum, a) => {
              const assigned = new Date(a.assignedAt).getTime();
              const completed = new Date(a.completedAt!).getTime();
              return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
            }, 0) / completedWithTimes.length
          )
        : null;

      return {
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        documentType: template.documentType,
        totalAssignments,
        completedAssignments,
        completionRate,
        averageCompletionTime,
      };
    });

    // Sort by completion rate and filter for documents with assignments
    const data = documentMetrics
      .filter((d) => d.totalAssignments > 0)
      .sort((a, b) => b.completionRate - a.completionRate)
      .slice(0, limit);

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching top documents:", error);
    return { success: false, error: "Failed to fetch top documents" };
  }
}

/**
 * Get documents that need attention (low completion rate)
 */
export async function getStrugglingDocuments(
  venueId: string | "all",
  limit: number = 10
): Promise<{ success: boolean; data?: StrugglingDocumentData[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    const now = new Date();

    // Build where clause based on venue selection
    const venueFilter = venueId === "all" ? {} : { venueId };

    // Get templates with assignments
    const templates = await prisma.documentTemplate.findMany({
      where: { ...venueFilter, isActive: true },
      select: {
        id: true,
        name: true,
        category: true,
        documentType: true,
        assignments: {
          select: {
            status: true,
            dueDate: true,
          },
        },
      },
    });

    // Calculate metrics for each template
    const documentMetrics: StrugglingDocumentData[] = templates.map((template) => {
      const totalAssignments = template.assignments.length;
      const pendingAssignments = template.assignments.filter((a) => a.status === "PENDING").length;
      const completedAssignments = template.assignments.filter((a) => a.status === "COMPLETED").length;
      const overdueAssignments = template.assignments.filter(
        (a) =>
          ["PENDING", "IN_PROGRESS"].includes(a.status) &&
          a.dueDate &&
          new Date(a.dueDate) < now
      ).length;
      const completionRate = totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

      return {
        templateId: template.id,
        templateName: template.name,
        category: template.category,
        documentType: template.documentType,
        totalAssignments,
        pendingAssignments,
        overdueAssignments,
        completionRate,
        frequentlyIncomplete: completionRate < 50,
      };
    });

    // Sort by completion rate (ascending) and filter for documents with assignments
    const data = documentMetrics
      .filter((d) => d.totalAssignments > 0 && (d.completionRate < 70 || d.overdueAssignments > 0))
      .sort((a, b) => a.completionRate - b.completionRate)
      .slice(0, limit);

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching struggling documents:", error);
    return { success: false, error: "Failed to fetch struggling documents" };
  }
}

/**
 * Get user compliance report
 */
export async function getUserComplianceReport(
  venueId: string | "all",
  options?: {
    userId?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ success: boolean; data?: UserComplianceReport[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    const now = new Date();

    // Build where clause for users
    const userWhere: any = {};
    if (options?.userId) {
      userWhere.id = options.userId;
    }

    // Build where clause for assignments based on venue selection
    const assignmentWhere = venueId === "all" ? {} : { venueId };

    // Get users with their assignments
    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        documentAssignmentsNew: {
          where: assignmentWhere,
          select: {
            status: true,
            dueDate: true,
            assignedAt: true,
            completedAt: true,
          },
        },
      },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    });

    // Calculate compliance for each user
    const data: UserComplianceReport[] = users.map((u) => {
      const totalAssigned = u.documentAssignmentsNew.length;
      const completed = u.documentAssignmentsNew.filter((a) => a.status === "COMPLETED").length;
      const inProgress = u.documentAssignmentsNew.filter((a) => a.status === "IN_PROGRESS").length;
      const pending = u.documentAssignmentsNew.filter((a) => a.status === "PENDING").length;
      const overdue = u.documentAssignmentsNew.filter(
        (a) =>
          ["PENDING", "IN_PROGRESS"].includes(a.status) &&
          a.dueDate &&
          new Date(a.dueDate) < now
      ).length;

      const complianceRate = totalAssigned > 0
        ? Math.round((completed / totalAssigned) * 100)
        : 100;

      // Calculate average completion time
      const completedWithTimes = u.documentAssignmentsNew.filter(
        (a) => a.status === "COMPLETED" && a.completedAt
      );
      const averageCompletionTime = completedWithTimes.length > 0
        ? Math.round(
            completedWithTimes.reduce((sum, a) => {
              const assigned = new Date(a.assignedAt).getTime();
              const completed = new Date(a.completedAt!).getTime();
              return sum + (completed - assigned) / (1000 * 60 * 60 * 24);
            }, 0) / completedWithTimes.length
          )
        : null;

      return {
        userId: u.id,
        userName: u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email,
        userEmail: u.email,
        totalAssigned,
        completed,
        inProgress,
        pending,
        overdue,
        complianceRate,
        averageCompletionTime,
      };
    });

    // Sort by compliance rate (ascending) to show struggling users first
    data.sort((a, b) => a.complianceRate - b.complianceRate);

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching user compliance report:", error);
    return { success: false, error: "Failed to fetch user compliance report" };
  }
}

/**
 * Get document type breakdown
 */
export async function getDocumentTypeBreakdown(
  venueId: string | "all"
): Promise<{ success: boolean; data?: DocumentTypeBreakdown[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    // Build where clause based on venue selection
    const venueFilter = venueId === "all" ? {} : { venueId };

    // Get templates grouped by document type
    const templates = await prisma.documentTemplate.findMany({
      where: venueFilter,
      select: {
        documentType: true,
        assignments: {
          select: { status: true },
        },
      },
    });

    // Aggregate by document type
    const typeMap = new Map<string, { count: number; completed: number; total: number }>();

    for (const template of templates) {
      const docType = template.documentType;
      if (!typeMap.has(docType)) {
        typeMap.set(docType, { count: 0, completed: 0, total: 0 });
      }

      const type = typeMap.get(docType)!;
      type.count++;
      type.total += template.assignments.length;
      type.completed += template.assignments.filter((a) => a.status === "COMPLETED").length;
    }

    const data: DocumentTypeBreakdown[] = Array.from(typeMap.entries()).map(
      ([documentType, stats]) => ({
        documentType,
        count: stats.count,
        completionRate:
          stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
      })
    );

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching document type breakdown:", error);
    return { success: false, error: "Failed to fetch document type breakdown" };
  }
}

/**
 * Get recent activity for documents
 */
export async function getRecentDocumentActivity(
  venueId: string | "all",
  limit: number = 20
): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    action: string;
    resourceType: string;
    description: string | null;
    createdAt: Date;
    user: { id: string; name: string; email: string };
  }>;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view analytics" };
      }
    }

    // Get recent audit logs for documents
    const auditLogs = await prisma.documentAuditLog.findMany({
      where: {
        OR: [
          {
            resourceType: "TEMPLATE",
          },
          {
            resourceType: "ASSIGNMENT",
          },
          {
            resourceType: "SUBMISSION",
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
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // For "all venues", return all logs without filtering
    if (venueId === "all") {
      const data = auditLogs.map((log) => ({
        id: log.id,
        action: log.action,
        resourceType: log.resourceType,
        description: log.description,
        createdAt: log.createdAt,
        user: {
          id: log.user?.id || "system",
          name: log.user
            ? `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email
            : "System",
          email: log.user?.email || "system",
        },
      }));

      return { success: true, data };
    }

    // Get venue's templates to filter
    const venueTemplateIds = await prisma.documentTemplate.findMany({
      where: { venueId },
      select: { id: true },
    });
    const templateIdSet = new Set(venueTemplateIds.map((t) => t.id));

    // Get venue's assignments to filter
    const venueAssignments = await prisma.documentAssignment.findMany({
      where: { venueId },
      select: { id: true },
    });
    const assignmentIdSet = new Set(venueAssignments.map((a) => a.id));

    // Filter audit logs to only include venue's resources
    const filteredLogs = auditLogs.filter((log) => {
      if (log.resourceType === "TEMPLATE") {
        return templateIdSet.has(log.resourceId);
      }
      if (log.resourceType === "ASSIGNMENT") {
        return assignmentIdSet.has(log.resourceId);
      }
      return true; // Include submissions as they're linked to assignments
    });

    const data = filteredLogs.map((log) => ({
      id: log.id,
      action: log.action,
      resourceType: log.resourceType,
      description: log.description,
      createdAt: log.createdAt,
      user: {
        id: log.user?.id || "system",
        name: log.user
          ? `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email
          : "System",
        email: log.user?.email || "system",
      },
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching recent document activity:", error);
    return { success: false, error: "Failed to fetch recent activity" };
  }
}

/**
 * Get pending tasks for current user
 */
export async function getPendingTasksForUser(): Promise<{
  success: boolean;
  data?: Array<{
    id: string;
    templateName: string;
    documentType: string;
    dueDate: Date | null;
    status: string;
    assignedAt: Date;
  }>;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const assignments = await prisma.documentAssignment.findMany({
      where: {
        userId: user.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
      include: {
        template: {
          select: {
            name: true,
            documentType: true,
          },
        },
        bundle: {
          select: {
            name: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });

    const data = assignments.map((a) => ({
      id: a.id,
      templateName: a.template?.name || a.bundle?.name || "Unknown",
      documentType: a.template?.documentType || "BUNDLE",
      dueDate: a.dueDate,
      status: a.status,
      assignedAt: a.assignedAt,
    }));

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching pending tasks:", error);
    return { success: false, error: "Failed to fetch pending tasks" };
  }
}
