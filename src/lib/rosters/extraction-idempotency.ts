/**
 * Idempotency utilities for roster extraction
 * 
 * These are pure utility functions, not server actions.
 * Uses the AuditLog table for idempotency tracking.
 */

import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";

/** Action type for roster creation from extraction */
export const EXTRACTION_ACTION_TYPE = "ROSTER_CREATE_FROM_EXTRACTION";
export const EXTRACTION_RESOURCE_TYPE = "Roster";

/**
 * Generate a new idempotency key for roster creation
 */
export function generateIdempotencyKey(): string {
  return `roster-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

/**
 * Check if an idempotency key has already been used
 * Uses the AuditLog table for idempotency tracking
 */
export async function checkIdempotencyKey(key: string): Promise<{
  exists: boolean;
  rosterId?: string;
}> {
  // Query audit logs for matching idempotency key in newValue JSON
  // We store the idempotency key in the newValue field as JSON
  const existing = await prisma.auditLog.findFirst({
    where: {
      actionType: EXTRACTION_ACTION_TYPE,
      resourceType: EXTRACTION_RESOURCE_TYPE,
    },
    select: {
      resourceId: true,
      newValue: true,
    },
  });

  // Filter in-memory for the idempotency key match
  // (PostgreSQL JSON path queries can be complex, this is safer)
  if (existing?.newValue) {
    try {
      const parsed = JSON.parse(existing.newValue);
      if (parsed.idempotencyKey === key) {
        return {
          exists: true,
          rosterId: existing.resourceId || undefined,
        };
      }
    } catch {
      // Invalid JSON, ignore
    }
  }

  return {
    exists: false,
    rosterId: undefined,
  };
}

/**
 * Store idempotency key with audit record
 * This creates an audit log entry that serves as the idempotency record
 */
export async function storeIdempotencyRecord(
  key: string,
  rosterId: string,
  snapshot: object,
  userId: string,
  ipAddress?: string
): Promise<string> {
  const audit = await prisma.auditLog.create({
    data: {
      id: randomUUID(),
      userId,
      actionType: EXTRACTION_ACTION_TYPE,
      resourceType: EXTRACTION_RESOURCE_TYPE,
      resourceId: rosterId,
      newValue: JSON.stringify({
        idempotencyKey: key,
        snapshot,
        createdAt: new Date().toISOString(),
      }),
      ipAddress,
    },
  });

  return audit.id;
}

/**
 * Build an audit snapshot from extraction data
 */
export function buildAuditSnapshot(params: {
  venueId: string;
  weekStart: string;
  shifts: Array<{
    staff_name: string;
    matchedUserId?: string;
    date: string;
    start_time: string;
    end_time: string;
    role?: string;
    break?: boolean;
  }>;
  extractionMetadata?: {
    confidence: number;
    processingTimeMs: number;
    attemptCount: number;
    fileName: string;
  };
  userId: string;
}): object {
  return {
    version: "1.0",
    timestamp: new Date().toISOString(),
    venueId: params.venueId,
    weekStart: params.weekStart,
    shiftCount: params.shifts.length,
    matchedCount: params.shifts.filter((s) => s.matchedUserId).length,
    unmatchedCount: params.shifts.filter((s) => !s.matchedUserId).length,
    shifts: params.shifts.map((s) => ({
      staffName: s.staff_name,
      matchedUserId: s.matchedUserId || null,
      date: s.date,
      startTime: s.start_time,
      endTime: s.end_time,
      role: s.role || null,
      break: s.break || false,
    })),
    extraction: params.extractionMetadata || null,
    createdBy: params.userId,
  };
}

/**
 * Find existing roster for the same venue and week
 * This provides additional duplicate prevention beyond idempotency keys
 */
export async function findExistingRosterForWeek(
  venueId: string,
  weekStart: Date,
  weekEnd: Date
): Promise<{ id: string; name: string; status: string } | null> {
  const existing = await prisma.roster.findFirst({
    where: {
      venueId,
      startDate: {
        gte: weekStart,
        lte: weekEnd,
      },
      status: {
        in: ["DRAFT", "PENDING_REVIEW", "PUBLISHED"],
      },
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return existing;
}

/**
 * Transaction-safe roster creation with idempotency check
 * Returns the roster ID if successful, or existing roster ID if duplicate
 */
export async function createRosterWithIdempotency(
  idempotencyKey: string,
  rosterData: {
    name: string;
    description?: string;
    venueId: string;
    startDate: Date;
    endDate: Date;
    createdBy: string;
    sourceFileUrl?: string;
    sourceFileName?: string;
    sourceFileType?: string;
  },
  shifts: Array<{
    userId?: string;
    date: Date;
    startTime: string;
    endTime: string;
    breakMinutes?: number;
    position?: string;
    notes?: string;
    originalName?: string;
  }>,
  snapshot: object,
  ipAddress?: string
): Promise<{
  success: boolean;
  rosterId?: string;
  isDuplicate?: boolean;
  error?: string;
}> {
  // Check idempotency key first
  const keyCheck = await checkIdempotencyKey(idempotencyKey);
  if (keyCheck.exists) {
    return {
      success: true,
      rosterId: keyCheck.rosterId,
      isDuplicate: true,
    };
  }

  try {
    // Use a transaction for atomic creation
    const result = await prisma.$transaction(async (tx) => {
      // Create the roster
      const roster = await tx.roster.create({
        data: {
          id: randomUUID(),
          name: rosterData.name,
          description: rosterData.description,
          venueId: rosterData.venueId,
          startDate: rosterData.startDate,
          endDate: rosterData.endDate,
          createdBy: rosterData.createdBy,
          status: "DRAFT",
          sourceFileUrl: rosterData.sourceFileUrl,
          sourceFileName: rosterData.sourceFileName,
          sourceFileType: rosterData.sourceFileType,
        },
      });

      // Create shifts in batches
      if (shifts.length > 0) {
        const shiftData = shifts.map((shift) => ({
          id: randomUUID(),
          rosterId: roster.id,
          userId: shift.userId,
          date: shift.date,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes || 0,
          position: shift.position,
          notes: shift.notes,
          originalName: shift.originalName,
        }));

        // Insert in batches of 100 to avoid query size limits
        const batchSize = 100;
        for (let i = 0; i < shiftData.length; i += batchSize) {
          const batch = shiftData.slice(i, i + batchSize);
          await tx.rosterShift.createMany({ data: batch });
        }
      }

      // Store idempotency record
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          userId: rosterData.createdBy,
          actionType: EXTRACTION_ACTION_TYPE,
          resourceType: EXTRACTION_RESOURCE_TYPE,
          resourceId: roster.id,
          newValue: JSON.stringify({
            idempotencyKey,
            snapshot,
            createdAt: new Date().toISOString(),
          }),
          ipAddress,
        },
      });

      return roster;
    });

    return {
      success: true,
      rosterId: result.id,
      isDuplicate: false,
    };
  } catch (error) {
    console.error("Error creating roster with idempotency:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
