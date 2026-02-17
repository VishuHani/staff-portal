"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";

/**
 * Audit Log Action Types
 */
type AuditActionType =
  | "CHANNEL_MEMBERS_ADDED"
  | "CHANNEL_MEMBERS_REMOVED"
  | "CHANNEL_MEMBER_ROLE_UPDATED"
  | "CHANNEL_CREATED"
  | "CHANNEL_UPDATED"
  | "CHANNEL_DELETED"
  | "CHANNEL_ARCHIVED"
  | "CHANNEL_RESTORED";

/**
 * Audit Log Data
 */
interface AuditLogData {
  actionType: AuditActionType;
  resourceType: string;
  resourceId: string;
  oldValue?: string;
  newValue?: string;
}

/**
 * Create an audit log entry
 *
 * @param data - Audit log data
 * @returns Promise<void>
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    const user = await requireAuth();

    // Write to database
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: data.actionType,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        oldValue: data.oldValue,
        newValue: data.newValue,
      },
    });
  } catch (error) {
    // Audit logging should not break the main operation
    console.error("[AUDIT LOG ERROR]", error);
  }
}
