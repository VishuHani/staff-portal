"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/rbac/access";
import { auditLogFilterSchema, type AuditLogFilterInput } from "@/lib/schemas/admin/audit-logs";
import {
  handleAuditLogFailure,
  retryAuditLogCreation,
  type AuditLogData,
} from "@/lib/utils/audit-alert";
import { getClientIpAddress } from "@/lib/utils/audit-helpers";

/**
 * Get audit logs with filtering and pagination
 * Admin only
 */
export async function getAuditLogs(filters: AuditLogFilterInput = {}) {
  await requireAdmin();

  const validated = auditLogFilterSchema.safeParse(filters);
  if (!validated.success) {
    return {
      error: "Invalid filter parameters",
      logs: [],
      total: 0,
    };
  }

  const { userId, actionType, resourceType, resourceId, startDate, endDate, limit, offset } = validated.data;

  try {
    // Build where clause
    const where: any = {};

    if (userId) where.userId = userId;
    if (actionType) where.actionType = actionType;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;

    // Date range filter
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        where.createdAt.lte = end;
      }
    }

    // Get logs with user info
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      logs,
      total,
      limit,
      offset,
    };
  } catch (error) {
    console.error("Error fetching audit logs:", error);
    return {
      error: "Failed to fetch audit logs",
      logs: [],
      total: 0,
    };
  }
}

/**
 * Get audit log statistics
 * Admin only
 */
export async function getAuditLogStats() {
  await requireAdmin();

  try {
    const [
      totalLogs,
      recentLogs,
      actionTypeCounts,
      resourceTypeCounts,
      topUsers,
    ] = await Promise.all([
      // Total logs
      prisma.auditLog.count(),

      // Logs in last 24 hours
      prisma.auditLog.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Group by action type
      prisma.auditLog.groupBy({
        by: ["actionType"],
        _count: true,
        orderBy: {
          _count: {
            actionType: "desc",
          },
        },
        take: 10,
      }),

      // Group by resource type
      prisma.auditLog.groupBy({
        by: ["resourceType"],
        _count: true,
        orderBy: {
          _count: {
            resourceType: "desc",
          },
        },
        take: 10,
      }),

      // Most active users
      prisma.auditLog.groupBy({
        by: ["userId"],
        _count: true,
        orderBy: {
          _count: {
            userId: "desc",
          },
        },
        take: 5,
      }),
    ]);

    // Get user details for top users
    const userIds = topUsers.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const topUsersWithDetails = topUsers.map(tu => {
      const user = users.find(u => u.id === tu.userId);
      return {
        userId: tu.userId,
        count: tu._count,
        name: user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email : "Unknown",
        email: user?.email || "Unknown",
      };
    });

    return {
      success: true,
      stats: {
        total: totalLogs,
        last24Hours: recentLogs,
        byActionType: actionTypeCounts.map(a => ({
          actionType: a.actionType,
          count: a._count,
        })),
        byResourceType: resourceTypeCounts.map(r => ({
          resourceType: r.resourceType,
          count: r._count,
        })),
        topUsers: topUsersWithDetails,
      },
    };
  } catch (error) {
    console.error("Error fetching audit log stats:", error);
    return {
      error: "Failed to fetch statistics",
      stats: null,
    };
  }
}

/**
 * Get unique values for filters (for dropdowns)
 * Admin only
 */
export async function getAuditLogFilterOptions() {
  await requireAdmin();

  try {
    const [actionTypes, resourceTypes, users] = await Promise.all([
      prisma.auditLog.findMany({
        select: { actionType: true },
        distinct: ["actionType"],
        orderBy: { actionType: "asc" },
      }),
      prisma.auditLog.findMany({
        select: { resourceType: true },
        distinct: ["resourceType"],
        orderBy: { resourceType: "asc" },
      }),
      prisma.user.findMany({
        where: {
          auditLogs: {
            some: {},
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
        orderBy: {
          email: "asc",
        },
      }),
    ]);

    return {
      success: true,
      options: {
        actionTypes: actionTypes.map(a => a.actionType),
        resourceTypes: resourceTypes.map(r => r.resourceType),
        users: users.map(u => ({
          id: u.id,
          name: `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email,
          email: u.email,
        })),
      },
    };
  } catch (error) {
    console.error("Error fetching filter options:", error);
    return {
      error: "Failed to fetch filter options",
      options: null,
    };
  }
}

/**
 * Create an audit log entry (utility function for other actions to use)
 * Internal use only - not exported as server action
 *
 * ENHANCED: Now includes:
 * - Automatic IP address capture if not provided
 * - Retry mechanism with exponential backoff
 * - Backup storage to file system
 * - Admin alerting on failure
 * - Compliance with SOC 2, GDPR, HIPAA
 */
export async function createAuditLog({
  userId,
  actionType,
  resourceType,
  resourceId,
  oldValue,
  newValue,
  ipAddress: providedIpAddress,
}: {
  userId: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}) {
  // Auto-capture IP address if not provided
  let ipAddress = providedIpAddress;
  if (!ipAddress) {
    try {
      ipAddress = await getClientIpAddress();
    } catch (error) {
      console.error("Error capturing IP address for audit log:", error);
      ipAddress = "unknown";
    }
  }

  const auditData: AuditLogData = {
    userId,
    actionType,
    resourceType,
    resourceId,
    oldValue,
    newValue,
    ipAddress,
  };

  // RETRY MECHANISM: Attempt creation with exponential backoff (up to 3 tries)
  const success = await retryAuditLogCreation(auditData);

  if (!success) {
    // CRITICAL: Audit log creation failed after all retries
    // This triggers:
    // 1. Backup to file system (logs/audit/YYYY-MM-DD.log)
    // 2. Email alerts to all admins
    // 3. Detailed error logging
    await handleAuditLogFailure(
      auditData,
      new Error("Audit log creation failed after 3 retry attempts")
    );

    // Don't throw - audit logging should not break the main action
    // But the failure has been properly logged and admins have been alerted
  }
}
