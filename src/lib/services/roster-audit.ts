/**
 * Roster Audit Service
 *
 * Unified audit logging for all roster operations.
 * Provides comprehensive tracking of changes, snapshots for restoration,
 * and cross-version audit trails.
 */

import { prisma } from "@/lib/prisma";
import { RosterStatus, Prisma } from "@prisma/client";
import { getShiftSnapshot, type ShiftSnapshot } from "./version-chain";

// ============================================================================
// AUDIT ACTION TYPES
// ============================================================================

export type AuditAction =
  // Chain/Version Actions
  | "CHAIN_CREATED"
  | "VERSION_CREATED"
  | "VERSION_ACTIVATED"
  | "VERSION_SUPERSEDED"
  // Roster Actions
  | "ROSTER_CREATED"
  | "ROSTER_UPDATED"
  | "ROSTER_DELETED"
  // Shift Actions
  | "SHIFTS_IMPORTED"
  | "SHIFT_ADDED"
  | "SHIFT_REMOVED"
  | "SHIFT_UPDATED"
  | "SHIFTS_BULK_UPDATE"
  // Status Actions
  | "STATUS_DRAFT"
  | "STATUS_PENDING_REVIEW"
  | "STATUS_APPROVED"
  | "STATUS_PUBLISHED"
  | "STATUS_ARCHIVED"
  // Merge/Rollback Actions
  | "ROLLBACK_STARTED"
  | "ROLLBACK_COMPLETE"
  | "MERGE_STARTED"
  | "MERGE_COMPLETE"
  // Conflict Actions
  | "CONFLICTS_DETECTED"
  | "CONFLICT_RESOLVED";

// ============================================================================
// TYPES
// ============================================================================

export interface AuditEntry {
  id: string;
  rosterId: string;
  chainId: string | null;
  revision: number;
  action: AuditAction;
  changes: Record<string, unknown>;
  snapshot: ShiftSnapshot[] | null;
  metadata: Record<string, unknown> | null;
  performedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  performedAt: Date;
}

export interface AuditLogOptions {
  includeSnapshots?: boolean;
  limit?: number;
  actions?: AuditAction[];
}

export interface RecordAuditInput {
  rosterId: string;
  action: AuditAction;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  includeSnapshot?: boolean;
  performedBy: string;
}

// ============================================================================
// RECORD AUDIT
// ============================================================================

/**
 * Record an audit entry for a roster operation.
 * Automatically captures roster state and chain info.
 */
export async function recordAudit(
  input: RecordAuditInput
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  try {
    // Get current roster state
    const roster = await prisma.roster.findUnique({
      where: { id: input.rosterId },
      select: {
        chainId: true,
        revision: true,
        versionNumber: true,
        status: true,
      },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    // Optionally capture shift snapshot
    let snapshot: ShiftSnapshot[] | null = null;
    if (input.includeSnapshot) {
      snapshot = await getShiftSnapshot(input.rosterId);
    }

    // Increment revision
    const newRevision = roster.revision + 1;

    // Create audit entry and update roster revision in transaction
    const [auditEntry] = await prisma.$transaction([
      prisma.rosterHistory.create({
        data: {
          rosterId: input.rosterId,
          chainId: roster.chainId,
          version: newRevision,
          action: input.action,
          changes: input.changes ? JSON.parse(JSON.stringify(input.changes)) : null,
          snapshot: snapshot ? JSON.parse(JSON.stringify(snapshot)) : null,
          metadata: input.metadata
            ? JSON.parse(JSON.stringify({
                ...input.metadata,
                versionNumber: roster.versionNumber,
                status: roster.status,
              }))
            : { versionNumber: roster.versionNumber, status: roster.status },
          performedBy: input.performedBy,
        },
      }),
      prisma.roster.update({
        where: { id: input.rosterId },
        data: { revision: newRevision },
      }),
    ]);

    return { success: true, auditId: auditEntry.id };
  } catch (error) {
    console.error("Error recording audit:", error);
    return { success: false, error: "Failed to record audit" };
  }
}

/**
 * Record audit without incrementing revision (for read-only events).
 */
export async function recordAuditEvent(
  input: Omit<RecordAuditInput, "includeSnapshot">
): Promise<{ success: boolean; auditId?: string; error?: string }> {
  try {
    const roster = await prisma.roster.findUnique({
      where: { id: input.rosterId },
      select: { chainId: true, revision: true, versionNumber: true, status: true },
    });

    if (!roster) {
      return { success: false, error: "Roster not found" };
    }

    const auditEntry = await prisma.rosterHistory.create({
      data: {
        rosterId: input.rosterId,
        chainId: roster.chainId,
        version: roster.revision,
        action: input.action,
        changes: input.changes ? JSON.parse(JSON.stringify(input.changes)) : null,
        metadata: input.metadata
          ? JSON.parse(JSON.stringify({
              ...input.metadata,
              versionNumber: roster.versionNumber,
              status: roster.status,
            }))
          : null,
        performedBy: input.performedBy,
      },
    });

    return { success: true, auditId: auditEntry.id };
  } catch (error) {
    console.error("Error recording audit event:", error);
    return { success: false, error: "Failed to record audit event" };
  }
}

// ============================================================================
// QUERY AUDIT LOG
// ============================================================================

/**
 * Get audit log for a specific roster.
 */
export async function getAuditLog(
  rosterId: string,
  options: AuditLogOptions = {}
): Promise<AuditEntry[]> {
  const where: {
    rosterId: string;
    action?: { in: string[] };
  } = {
    rosterId,
  };

  if (options.actions && options.actions.length > 0) {
    where.action = { in: options.actions };
  }

  const entries = await prisma.rosterHistory.findMany({
    where,
    include: {
      performedByUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { performedAt: "desc" },
    take: options.limit || 100,
  });

  return entries.map((entry) => ({
    id: entry.id,
    rosterId: entry.rosterId,
    chainId: entry.chainId,
    revision: entry.version,
    action: entry.action as AuditAction,
    changes: (entry.changes as Record<string, unknown>) || {},
    snapshot: options.includeSnapshots
      ? (entry.snapshot as ShiftSnapshot[] | null)
      : null,
    metadata: (entry.metadata as Record<string, unknown>) || null,
    performedBy: entry.performedByUser,
    performedAt: entry.performedAt,
  }));
}

/**
 * Get audit log for an entire version chain.
 * Returns entries from all versions in the chain, sorted by time.
 */
export async function getChainAuditLog(
  chainId: string,
  options: AuditLogOptions = {}
): Promise<AuditEntry[]> {
  const where: {
    chainId: string;
    action?: { in: string[] };
  } = {
    chainId,
  };

  if (options.actions && options.actions.length > 0) {
    where.action = { in: options.actions };
  }

  const entries = await prisma.rosterHistory.findMany({
    where,
    include: {
      performedByUser: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
      roster: {
        select: { name: true, versionNumber: true },
      },
    },
    orderBy: { performedAt: "desc" },
    take: options.limit || 200,
  });

  return entries.map((entry) => ({
    id: entry.id,
    rosterId: entry.rosterId,
    chainId: entry.chainId,
    revision: entry.version,
    action: entry.action as AuditAction,
    changes: (entry.changes as Record<string, unknown>) || {},
    snapshot: options.includeSnapshots
      ? (entry.snapshot as ShiftSnapshot[] | null)
      : null,
    metadata: {
      ...((entry.metadata as Record<string, unknown>) || {}),
      rosterName: entry.roster.name,
      versionNumber: entry.roster.versionNumber,
    },
    performedBy: entry.performedByUser,
    performedAt: entry.performedAt,
  }));
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get the snapshot from a specific audit entry (for rollback).
 */
export async function getAuditSnapshot(
  auditId: string
): Promise<ShiftSnapshot[] | null> {
  const entry = await prisma.rosterHistory.findUnique({
    where: { id: auditId },
    select: { snapshot: true },
  });

  return (entry?.snapshot as unknown as ShiftSnapshot[]) || null;
}

/**
 * Get the most recent snapshot for a roster.
 */
export async function getLatestSnapshot(
  rosterId: string
): Promise<{ auditId: string; snapshot: ShiftSnapshot[]; revision: number } | null> {
  const entry = await prisma.rosterHistory.findFirst({
    where: {
      rosterId,
      snapshot: { not: Prisma.JsonNull },
    },
    orderBy: { performedAt: "desc" },
    select: { id: true, snapshot: true, version: true },
  });

  if (!entry || !entry.snapshot) return null;

  return {
    auditId: entry.id,
    snapshot: entry.snapshot as unknown as ShiftSnapshot[],
    revision: entry.version,
  };
}

/**
 * Get audit entries that can be used for rollback (have snapshots).
 */
export async function getRollbackPoints(
  rosterId: string,
  limit: number = 10
): Promise<
  Array<{
    auditId: string;
    revision: number;
    action: AuditAction;
    performedAt: Date;
    performedBy: string;
    shiftCount: number;
  }>
> {
  const entries = await prisma.rosterHistory.findMany({
    where: {
      rosterId,
      snapshot: { not: Prisma.JsonNull },
    },
    orderBy: { performedAt: "desc" },
    take: limit,
    include: {
      performedByUser: {
        select: { firstName: true, lastName: true },
      },
    },
  });

  return entries.map((entry) => ({
    auditId: entry.id,
    revision: entry.version,
    action: entry.action as AuditAction,
    performedAt: entry.performedAt,
    performedBy: `${entry.performedByUser.firstName || ""} ${entry.performedByUser.lastName || ""}`.trim(),
    shiftCount: Array.isArray(entry.snapshot) ? entry.snapshot.length : 0,
  }));
}

// ============================================================================
// ACTION LABELS
// ============================================================================

/**
 * Human-readable labels for audit actions.
 */
export const AUDIT_ACTION_LABELS: Record<
  AuditAction,
  { label: string; color: string; icon: string }
> = {
  // Chain/Version
  CHAIN_CREATED: { label: "Chain Created", color: "green", icon: "GitBranch" },
  VERSION_CREATED: { label: "Version Created", color: "blue", icon: "GitBranch" },
  VERSION_ACTIVATED: { label: "Version Activated", color: "green", icon: "CheckCircle" },
  VERSION_SUPERSEDED: { label: "Version Superseded", color: "gray", icon: "Archive" },
  // Roster
  ROSTER_CREATED: { label: "Roster Created", color: "green", icon: "FileText" },
  ROSTER_UPDATED: { label: "Roster Updated", color: "blue", icon: "FileEdit" },
  ROSTER_DELETED: { label: "Roster Deleted", color: "red", icon: "Trash2" },
  // Shifts
  SHIFTS_IMPORTED: { label: "Shifts Imported", color: "purple", icon: "Upload" },
  SHIFT_ADDED: { label: "Shift Added", color: "green", icon: "Plus" },
  SHIFT_REMOVED: { label: "Shift Removed", color: "red", icon: "Minus" },
  SHIFT_UPDATED: { label: "Shift Updated", color: "amber", icon: "Edit" },
  SHIFTS_BULK_UPDATE: { label: "Bulk Update", color: "purple", icon: "Layers" },
  // Status
  STATUS_DRAFT: { label: "Set to Draft", color: "gray", icon: "FileEdit" },
  STATUS_PENDING_REVIEW: { label: "Pending Review", color: "amber", icon: "Clock" },
  STATUS_APPROVED: { label: "Approved", color: "green", icon: "CheckCircle" },
  STATUS_PUBLISHED: { label: "Published", color: "cyan", icon: "Send" },
  STATUS_ARCHIVED: { label: "Archived", color: "gray", icon: "Archive" },
  // Merge/Rollback
  ROLLBACK_STARTED: { label: "Rollback Started", color: "orange", icon: "RotateCcw" },
  ROLLBACK_COMPLETE: { label: "Rollback Complete", color: "orange", icon: "RotateCcw" },
  MERGE_STARTED: { label: "Merge Started", color: "violet", icon: "GitMerge" },
  MERGE_COMPLETE: { label: "Merge Complete", color: "violet", icon: "GitMerge" },
  // Conflicts
  CONFLICTS_DETECTED: { label: "Conflicts Detected", color: "red", icon: "AlertTriangle" },
  CONFLICT_RESOLVED: { label: "Conflict Resolved", color: "green", icon: "CheckCircle" },
};

/**
 * Get display info for an audit action.
 */
export function getAuditActionInfo(action: AuditAction): {
  label: string;
  color: string;
  icon: string;
} {
  return (
    AUDIT_ACTION_LABELS[action] || {
      label: action,
      color: "gray",
      icon: "Circle",
    }
  );
}
