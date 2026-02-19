"use server";

/**
 * Roster Extraction V3 Server Actions
 * 
 * Server actions for the V3 extraction system.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { RosterStatus } from "@prisma/client";
import {
  extractRosterFromImageV3,
  getExtractionContextV3,
  matchStaffToUsers,
  type ExtractionResultV3,
} from "@/lib/services/roster-extraction-v3-service";
import type { ExtractedShift } from "@/lib/services/extraction-validator";

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
  }>;
  error?: string;
}

interface ConfirmResult {
  success: boolean;
  rosterId?: string;
  error?: string;
}

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
 * Confirm extraction and create roster
 */
export async function confirmExtractionAndCreateRosterV3(data: {
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
}): Promise<ConfirmResult> {
  try {
    const user = await requireAuth();

    // Calculate end date (6 days after start)
    const startDate = new Date(data.weekStart);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);

    // Create roster
    const roster = await prisma.roster.create({
      data: {
        name: `Roster Week of ${startDate.toLocaleDateString()}`,
        venueId: data.venueId,
        startDate,
        endDate,
        status: RosterStatus.DRAFT,
        createdBy: user.id,
        shifts: {
          create: data.shifts.map((shift) => ({
            date: new Date(shift.date),
            startTime: shift.start_time,
            endTime: shift.end_time,
            userId: shift.matchedUserId,
            position: shift.role,
            notes: shift.break ? "Break included" : undefined,
            originalName: shift.staff_name,
          })),
        },
      },
      include: {
        shifts: true,
      },
    });

    console.log(`[V3] Roster created:`, {
      rosterId: roster.id,
      venueId: data.venueId,
      shiftCount: roster.shifts?.length || 0,
    });

    revalidatePath("/manage/rosters");

    return {
      success: true,
      rosterId: roster.id,
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
