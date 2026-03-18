"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";
import { AuditAction, ResourceType } from "@prisma/client";

// ============================================================================
// Types
// ============================================================================

export interface DocumentAuditLog {
  id: string;
  resourceType: string;
  resourceId: string;
  action: string;
  description: string | null;
  userId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  oldValue: any;
  newValue: any;
  changes: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  submissionId: string | null;
}

export interface AuditLogFilters {
  startDate?: Date;
  endDate?: Date;
  action?: AuditAction;
  resourceType?: ResourceType;
  userId?: string;
  resourceId?: string;
}

export interface AuditLogPagination {
  page: number;
  pageSize: number;
}

export interface AuditLogListResult {
  success: boolean;
  data?: {
    logs: DocumentAuditLog[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  error?: string;
}

export interface AuditStats {
  totalLogs: number;
  logsToday: number;
  logsThisWeek: number;
  logsThisMonth: number;
  actionBreakdown: { action: string; count: number }[];
  resourceTypeBreakdown: { resourceType: string; count: number }[];
  topUsers: { userId: string; userName: string; count: number }[];
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
// Audit Log Server Actions
// ============================================================================

/**
 * Get document audit logs with filters and pagination
 */
export async function getDocumentAuditLogs(
  venueId: string | "all",
  filters?: AuditLogFilters,
  pagination?: AuditLogPagination
): Promise<AuditLogListResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view audit logs" };
      }
    }

    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;

    // Build where clause
    const where: any = {};

    if (filters?.startDate) {
      where.createdAt = { ...where.createdAt, gte: filters.startDate };
    }
    if (filters?.endDate) {
      where.createdAt = { ...where.createdAt, lte: filters.endDate };
    }
    if (filters?.action) {
      where.action = filters.action;
    }
    if (filters?.resourceType) {
      where.resourceType = filters.resourceType;
    }
    if (filters?.userId) {
      where.userId = filters.userId;
    }
    if (filters?.resourceId) {
      where.resourceId = filters.resourceId;
    }

    // For "all venues", don't filter by venue resources
    if (venueId === "all") {
      // Get total count
      const total = await prisma.documentAuditLog.count({ where });

      // Get logs
      const logs = await prisma.documentAuditLog.findMany({
        where,
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
        skip: (page - 1) * pageSize,
        take: pageSize,
      });

      // Format logs
      const formattedLogs: DocumentAuditLog[] = logs.map((log) => ({
        id: log.id,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        action: log.action,
        description: log.description,
        userId: log.userId,
        user: log.user
          ? {
              id: log.user.id,
              name: `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email,
              email: log.user.email,
            }
          : null,
        oldValue: log.oldValue,
        newValue: log.newValue,
        changes: log.changes,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
        submissionId: log.submissionId,
      }));

      return {
        success: true,
        data: {
          logs: formattedLogs,
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        },
      };
    }

    // Get venue's template IDs and assignment IDs for filtering
    const [templateIds, assignmentIds] = await Promise.all([
      prisma.documentTemplate.findMany({
        where: { venueId },
        select: { id: true },
      }),
      prisma.documentAssignment.findMany({
        where: { venueId },
        select: { id: true },
      }),
    ]);

    const templateIdSet = new Set(templateIds.map((t) => t.id));
    const assignmentIdSet = new Set(assignmentIds.map((a) => a.id));

    // Get total count
    const total = await prisma.documentAuditLog.count({ where });

    // Get logs
    const logs = await prisma.documentAuditLog.findMany({
      where,
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
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    // Filter to only include venue's resources
    const filteredLogs = logs.filter((log) => {
      if (log.resourceType === "TEMPLATE") {
        return templateIdSet.has(log.resourceId);
      }
      if (log.resourceType === "ASSIGNMENT") {
        return assignmentIdSet.has(log.resourceId);
      }
      // For submissions, check if the related assignment belongs to the venue
      return true; // We'll filter submissions differently
    });

    // Format logs
    const formattedLogs: DocumentAuditLog[] = filteredLogs.map((log) => ({
      id: log.id,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      action: log.action,
      description: log.description,
      userId: log.userId,
      user: log.user
        ? {
            id: log.user.id,
            name: `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email,
            email: log.user.email,
          }
        : null,
      oldValue: log.oldValue,
      newValue: log.newValue,
      changes: log.changes,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      submissionId: log.submissionId,
    }));

    return {
      success: true,
      data: {
        logs: formattedLogs,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  } catch (error) {
    console.error("Error fetching document audit logs:", error);
    return { success: false, error: "Failed to fetch audit logs" };
  }
}

/**
 * Get details for a single audit log entry
 */
export async function getAuditLogDetails(
  logId: string,
  venueId: string | "all"
): Promise<{ success: boolean; data?: DocumentAuditLog; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view audit logs" };
      }
    }

    const log = await prisma.documentAuditLog.findUnique({
      where: { id: logId },
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
    });

    if (!log) {
      return { success: false, error: "Audit log not found" };
    }

    // For "all venues", skip venue verification
    if (venueId !== "all") {
      // Verify the log belongs to the venue
      if (log.resourceType === "TEMPLATE") {
        const template = await prisma.documentTemplate.findFirst({
          where: { id: log.resourceId, venueId },
        });
        if (!template) {
          return { success: false, error: "Audit log not found" };
        }
      } else if (log.resourceType === "ASSIGNMENT") {
        const assignment = await prisma.documentAssignment.findFirst({
          where: { id: log.resourceId, venueId },
        });
        if (!assignment) {
          return { success: false, error: "Audit log not found" };
        }
      }
    }

    const formattedLog: DocumentAuditLog = {
      id: log.id,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      action: log.action,
      description: log.description,
      userId: log.userId,
      user: log.user
        ? {
            id: log.user.id,
            name: `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email,
            email: log.user.email,
          }
        : null,
      oldValue: log.oldValue,
      newValue: log.newValue,
      changes: log.changes,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      submissionId: log.submissionId,
    };

    return { success: true, data: formattedLog };
  } catch (error) {
    console.error("Error fetching audit log details:", error);
    return { success: false, error: "Failed to fetch audit log details" };
  }
}

/**
 * Export audit logs to CSV format
 */
export async function exportAuditLogs(
  venueId: string | "all",
  filters?: AuditLogFilters
): Promise<{ success: boolean; data?: string; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasExportPermission = await checkDocumentPermission(user.id, "export", venueId);
      if (!hasExportPermission) {
        return { success: false, error: "You don't have permission to export audit logs" };
      }
    }

    // Get all matching logs (no pagination)
    const result = await getDocumentAuditLogs(venueId, filters, { page: 1, pageSize: 10000 });

    if (!result.success || !result.data) {
      return { success: false, error: result.error || "Failed to fetch audit logs" };
    }

    const logs = result.data.logs;

    // Generate CSV
    const headers = [
      "ID",
      "Date",
      "Time",
      "Action",
      "Resource Type",
      "Resource ID",
      "User",
      "User Email",
      "Description",
      "IP Address",
      "Old Value",
      "New Value",
    ];

    const rows = logs.map((log) => [
      log.id,
      new Date(log.createdAt).toISOString().split("T")[0],
      new Date(log.createdAt).toISOString().split("T")[1].split(".")[0],
      log.action,
      log.resourceType,
      log.resourceId,
      log.user?.name || "System",
      log.user?.email || "",
      log.description || "",
      log.ipAddress || "",
      log.oldValue ? JSON.stringify(log.oldValue) : "",
      log.newValue ? JSON.stringify(log.newValue) : "",
    ]);

    // Escape CSV fields
    const escapeCSV = (field: string) => {
      if (field.includes(",") || field.includes('"') || field.includes("\n")) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");

    return { success: true, data: csv };
  } catch (error) {
    console.error("Error exporting audit logs:", error);
    return { success: false, error: "Failed to export audit logs" };
  }
}

/**
 * Get audit statistics for dashboard
 */
export async function getAuditStats(
  venueId: string | "all"
): Promise<{ success: boolean; data?: AuditStats; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // For "all" venues, skip venue-specific permission check
    if (venueId !== "all") {
      const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view audit statistics" };
      }
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const monthAgo = new Date(today);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // For "all venues", get all audit logs without venue filtering
    if (venueId === "all") {
      // Get counts for different time periods
      const [totalLogs, logsToday, logsThisWeek, logsThisMonth] = await Promise.all([
        prisma.documentAuditLog.count(),
        prisma.documentAuditLog.count({
          where: { createdAt: { gte: today } },
        }),
        prisma.documentAuditLog.count({
          where: { createdAt: { gte: weekAgo } },
        }),
        prisma.documentAuditLog.count({
          where: { createdAt: { gte: monthAgo } },
        }),
      ]);

      // Get action breakdown
      const actionBreakdownRaw = await prisma.documentAuditLog.groupBy({
        by: ["action"],
        _count: { action: true },
      });

      const actionBreakdown = actionBreakdownRaw.map((item) => ({
        action: item.action,
        count: item._count.action,
      }));

      // Get resource type breakdown
      const resourceTypeBreakdownRaw = await prisma.documentAuditLog.groupBy({
        by: ["resourceType"],
        _count: { resourceType: true },
      });

      const resourceTypeBreakdown = resourceTypeBreakdownRaw.map((item) => ({
        resourceType: item.resourceType,
        count: item._count.resourceType,
      }));

      // Get top users
      const topUsersRaw = await prisma.documentAuditLog.groupBy({
        by: ["userId"],
        where: { userId: { not: null } },
        _count: { userId: true },
        orderBy: { _count: { userId: "desc" } },
        take: 5,
      });

      // Get user details for top users
      const userIds = topUsersRaw.map((u) => u.userId).filter(Boolean) as string[];
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, firstName: true, lastName: true, email: true },
      });

      const userMap = new Map(users.map((u) => [u.id, u]));

      const topUsers = topUsersRaw.map((item) => {
        const u = userMap.get(item.userId!);
        return {
          userId: item.userId!,
          userName: u
            ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email
            : "Unknown",
          count: item._count.userId,
        };
      });

      const data: AuditStats = {
        totalLogs,
        logsToday,
        logsThisWeek,
        logsThisMonth,
        actionBreakdown,
        resourceTypeBreakdown,
        topUsers,
      };

      return { success: true, data };
    }

    // Get venue's resource IDs
    const [templateIds, assignmentIds] = await Promise.all([
      prisma.documentTemplate.findMany({
        where: { venueId },
        select: { id: true },
      }),
      prisma.documentAssignment.findMany({
        where: { venueId },
        select: { id: true },
      }),
    ]);

    const resourceIds = [
      ...templateIds.map((t) => t.id),
      ...assignmentIds.map((a) => a.id),
    ];

    // Get counts for different time periods
    const [totalLogs, logsToday, logsThisWeek, logsThisMonth] = await Promise.all([
      prisma.documentAuditLog.count({
        where: { resourceId: { in: resourceIds } },
      }),
      prisma.documentAuditLog.count({
        where: {
          resourceId: { in: resourceIds },
          createdAt: { gte: today },
        },
      }),
      prisma.documentAuditLog.count({
        where: {
          resourceId: { in: resourceIds },
          createdAt: { gte: weekAgo },
        },
      }),
      prisma.documentAuditLog.count({
        where: {
          resourceId: { in: resourceIds },
          createdAt: { gte: monthAgo },
        },
      }),
    ]);

    // Get action breakdown
    const actionBreakdownRaw = await prisma.documentAuditLog.groupBy({
      by: ["action"],
      where: { resourceId: { in: resourceIds } },
      _count: { action: true },
    });

    const actionBreakdown = actionBreakdownRaw.map((item) => ({
      action: item.action,
      count: item._count.action,
    }));

    // Get resource type breakdown
    const resourceTypeBreakdownRaw = await prisma.documentAuditLog.groupBy({
      by: ["resourceType"],
      where: { resourceId: { in: resourceIds } },
      _count: { resourceType: true },
    });

    const resourceTypeBreakdown = resourceTypeBreakdownRaw.map((item) => ({
      resourceType: item.resourceType,
      count: item._count.resourceType,
    }));

    // Get top users
    const topUsersRaw = await prisma.documentAuditLog.groupBy({
      by: ["userId"],
      where: {
        resourceId: { in: resourceIds },
        userId: { not: null },
      },
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 5,
    });

    // Get user details for top users
    const userIds = topUsersRaw.map((u) => u.userId).filter(Boolean) as string[];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));

    const topUsers = topUsersRaw.map((item) => {
      const u = userMap.get(item.userId!);
      return {
        userId: item.userId!,
        userName: u
          ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email
          : "Unknown",
        count: item._count.userId,
      };
    });

    const data: AuditStats = {
      totalLogs,
      logsToday,
      logsThisWeek,
      logsThisMonth,
      actionBreakdown,
      resourceTypeBreakdown,
      topUsers,
    };

    return { success: true, data };
  } catch (error) {
    console.error("Error fetching audit stats:", error);
    return { success: false, error: "Failed to fetch audit statistics" };
  }
}

/**
 * Create an audit log entry (for internal use)
 */
export async function createDocumentAuditLog(params: {
  resourceType: ResourceType;
  resourceId: string;
  action: AuditAction;
  description?: string;
  oldValue?: any;
  newValue?: any;
  changes?: any;
  submissionId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();

    await prisma.documentAuditLog.create({
      data: {
        resourceType: params.resourceType,
        resourceId: params.resourceId,
        action: params.action,
        description: params.description,
        userId: user?.id || null,
        oldValue: params.oldValue,
        newValue: params.newValue,
        changes: params.changes,
        submissionId: params.submissionId,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating audit log:", error);
    return { success: false, error: "Failed to create audit log" };
  }
}

/**
 * Get audit logs for a specific resource
 */
export async function getResourceAuditHistory(
  resourceType: ResourceType,
  resourceId: string,
  venueId: string,
  limit: number = 50
): Promise<{
  success: boolean;
  data?: DocumentAuditLog[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const hasReadPermission = await checkDocumentPermission(user.id, "read", venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view audit logs" };
    }

    // Verify resource belongs to venue
    if (resourceType === "TEMPLATE") {
      const template = await prisma.documentTemplate.findFirst({
        where: { id: resourceId, venueId },
      });
      if (!template) {
        return { success: false, error: "Resource not found" };
      }
    } else if (resourceType === "ASSIGNMENT") {
      const assignment = await prisma.documentAssignment.findFirst({
        where: { id: resourceId, venueId },
      });
      if (!assignment) {
        return { success: false, error: "Resource not found" };
      }
    }

    const logs = await prisma.documentAuditLog.findMany({
      where: {
        resourceType,
        resourceId,
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

    const formattedLogs: DocumentAuditLog[] = logs.map((log) => ({
      id: log.id,
      resourceType: log.resourceType,
      resourceId: log.resourceId,
      action: log.action,
      description: log.description,
      userId: log.userId,
      user: log.user
        ? {
            id: log.user.id,
            name: `${log.user.firstName || ""} ${log.user.lastName || ""}`.trim() || log.user.email,
            email: log.user.email,
          }
        : null,
      oldValue: log.oldValue,
      newValue: log.newValue,
      changes: log.changes,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
      submissionId: log.submissionId,
    }));

    return { success: true, data: formattedLogs };
  } catch (error) {
    console.error("Error fetching resource audit history:", error);
    return { success: false, error: "Failed to fetch audit history" };
  }
}
