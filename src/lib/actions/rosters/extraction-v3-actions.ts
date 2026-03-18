"use server";

/**
 * Roster Extraction V3 Server Actions
 * 
 * Server actions for the V3 extraction system with:
 * - Transaction-safe confirm pipeline
 * - Idempotency key enforcement
 * - Duplicate roster prevention
 * - Snapshot audit trail
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { RosterStatus } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  extractRosterFromImageV3,
  getExtractionContextV3,
  matchStaffToUsers,
  type ExtractionResultV3,
} from "@/lib/services/roster-extraction-v3-service";
import type { ExtractedShift } from "@/lib/services/extraction-validator";
import {
  generateIdempotencyKey,
  checkIdempotencyKey,
  storeIdempotencyRecord,
  buildAuditSnapshot,
  findExistingRosterForWeek,
  createRosterWithIdempotency,
} from "@/lib/rosters/extraction-idempotency";
import type { MatchStrategy } from "@/lib/rosters/staff-matching-engine";

// ============================================================================
// TYPES
// ============================================================================

interface UploadResult {
  success: boolean;
  extraction?: ExtractionResultV3;
  matchedShifts?: Array<{
    shift: ExtractedShift;
    matchedUserId: string | null;
    matchConfidence: number;
    matchStrategy?: MatchStrategy;
    matchReason?: string;
    matchAlternatives?: Array<{ userId: string; confidence: number; staffName: string }>;
    requiresConfirmation?: boolean;
  }>;
  error?: string;
}

interface ConfirmResult {
  success: boolean;
  rosterId?: string;
  duplicateRosterId?: string;
  idempotencyKey?: string;
  auditId?: string;
  isDuplicate?: boolean;
  error?: string;
}

interface ConfirmPayload {
  venueId: string;
  weekStart: string;
  idempotencyKey?: string;
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
}

// Re-export generateIdempotencyKey for use in client components
export { generateIdempotencyKey };

// ============================================================================
// UPLOAD AND EXTRACT
// ============================================================================

/**
 * Upload an image and extract roster data using V3
 */
export async function uploadAndExtractRosterV3(
  formData: FormData
): Promise<UploadResult> {
  try {
    const user = await requireAuth();
    const file = formData.get("file") as File;
    const venueId = formData.get("venueId") as string;

    if (!file || !venueId) {
      return { success: false, error: "Missing file or venue ID" };
    }

    console.log(`[V3] Processing image file: ${file.name}`);

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Get extraction context
    const context = await getExtractionContextV3(venueId);

    // Extract roster data
    const result = await extractRosterFromImageV3(buffer, file.name, context);

    if (!result.success || !result.data) {
      return {
        success: false,
        error: result.error || "Failed to extract roster data",
      };
    }

    // Match staff to users
    const matchedShifts = matchStaffToUsers(result.data.shifts, context.venueStaff);

    console.log(`[V3] Roster file uploaded and extracted:`, {
      fileName: file.name,
      venueId,
      shiftsExtracted: result.data.shifts.length,
      confidence: result.validation?.confidence,
      processingTimeMs: result.metadata.processingTimeMs,
    });

    return {
      success: true,
      extraction: result,
      matchedShifts: matchedShifts.map((shift) => ({
        shift: {
          date: shift.date,
          day: shift.day,
          role: shift.role,
          staff_name: shift.staff_name,
          start_time: shift.start_time,
          end_time: shift.end_time,
          break: shift.break,
          raw_cell: shift.raw_cell,
        },
        matchedUserId: shift.matchedUserId,
        matchConfidence: shift.matchConfidence,
        matchStrategy: shift.matchStrategy as MatchStrategy | undefined,
        matchReason: shift.matchReason,
        matchAlternatives: shift.matchAlternatives,
        requiresConfirmation: shift.requiresConfirmation,
      })),
    };
  } catch (error) {
    console.error("[V3] Upload and extract error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// CONFIRM AND CREATE ROSTER
// ============================================================================

/**
 * Confirm extraction and create roster with idempotency protection
 */
export async function confirmExtractionAndCreateRosterV3(data: {
  venueId: string;
  weekStart: string;
  idempotencyKey?: string;
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
}): Promise<ConfirmResult> {
  try {
    const user = await requireAuth();

    // Generate or use provided idempotency key
    const idempotencyKey = data.idempotencyKey || generateIdempotencyKey();

    // Calculate end date (6 days after start)
    const startDate = new Date(data.weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // Guardrail: Check for existing roster for same venue/week
    const existingRoster = await findExistingRosterForWeek(data.venueId, startDate, endDate);
    if (existingRoster) {
      return {
        success: false,
        duplicateRosterId: existingRoster.id,
        error: `A roster already exists for this venue and week (${existingRoster.name}).`,
      };
    }

    // Guardrail: Validate shift times before create
    for (const [index, shift] of data.shifts.entries()) {
      const [sh, sm] = shift.start_time.split(":").map(Number);
      const [eh, em] = shift.end_time.split(":").map(Number);
      if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) {
        return {
          success: false,
          error: `Invalid shift time format at row ${index + 1}`,
        };
      }
      const startMinutes = sh * 60 + sm;
      const endMinutes = eh * 60 + em;
      if (endMinutes <= startMinutes) {
        return {
          success: false,
          error: `Invalid shift time order at row ${index + 1}: end time must be after start time`,
        };
      }
    }

    // Build audit snapshot
    const snapshot = buildAuditSnapshot({
      venueId: data.venueId,
      weekStart: data.weekStart,
      shifts: data.shifts,
      extractionMetadata: data.extractionMetadata,
      userId: user.id,
    });

    // Create roster with idempotency protection
    const result = await createRosterWithIdempotency(
      idempotencyKey,
      {
        name: `Roster Week of ${startDate.toLocaleDateString()}`,
        venueId: data.venueId,
        startDate,
        endDate,
        createdBy: user.id,
      },
      data.shifts.map((shift) => ({
        userId: shift.matchedUserId,
        date: new Date(shift.date),
        startTime: shift.start_time,
        endTime: shift.end_time,
        position: shift.role,
        notes: shift.break ? "Break included" : undefined,
        originalName: shift.staff_name,
      })),
      snapshot
    );

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    console.log(`[V3] Roster created:`, {
      rosterId: result.rosterId,
      venueId: data.venueId,
      idempotencyKey,
      isDuplicate: result.isDuplicate,
      shiftCount: data.shifts.length,
    });

    revalidatePath("/manage/rosters");

    return {
      success: true,
      rosterId: result.rosterId,
      idempotencyKey,
      isDuplicate: result.isDuplicate,
    };
  } catch (error) {
    console.error("[V3] Confirm and create error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================================
// GET MATCHABLE STAFF
// ============================================================================

/**
 * Get staff that can be matched for a venue
 */
export async function getMatchableStaffV3(venueId: string): Promise<{
  success: boolean;
  staff: Array<{ id: string; name: string; email: string }>;
  error?: string;
}> {
  try {
    await requireAuth();

    const staff = await prisma.user.findMany({
      where: {
        venues: {
          some: {
            venueId,
          },
        },
        active: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    return {
      success: true,
      staff: staff.map((s) => ({
        id: s.id,
        name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
        email: s.email,
      })),
    };
  } catch (error) {
    console.error("[V3] Get matchable staff error:", error);
    return {
      success: false,
      staff: [],
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
