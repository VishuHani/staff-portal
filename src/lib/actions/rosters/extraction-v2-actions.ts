"use server";

/**
 * Roster Extraction V2 Server Actions
 * Multi-phase extraction with deep understanding
 * 
 * This is a separate implementation from the original extraction-actions.ts
 * to allow parallel testing without affecting the current system.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { uploadRosterFile, downloadRosterFile, deleteRosterFile } from "@/lib/storage/rosters";
import {
  extractRosterFromImageV2,
  getExtractionContextV2,
} from "@/lib/services/roster-extraction-v2-service";
import {
  confirmExtractionInputSchema,
  type ConfirmExtractionInput,
  type RosterExtractionResult,
} from "@/lib/schemas/rosters/extraction";
import { addDays, format, parseISO } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type ExtractionV2ActionResult =
  | { success: true; extraction: RosterExtractionResult; isV2: true }
  | { success: false; error: string };

export type ConfirmActionResult =
  | { success: true; rosterId: string }
  | { success: false; error: string };

// In-memory storage for extraction sessions (would use Redis in production)
const extractionSessionsV2 = new Map<string, RosterExtractionResult>();

// ============================================================================
// UPLOAD & EXTRACT ACTION (V2)
// ============================================================================

/**
 * Upload a roster file and extract data using V2 multi-phase extraction
 */
export async function uploadAndExtractRosterV2(
  formData: FormData
): Promise<ExtractionV2ActionResult> {
  const user = await requireAuth();

  // Check permission
  const canManageRosters = await hasPermission(user.id, "rosters", "create");
  if (!canManageRosters) {
    return { success: false, error: "You don't have permission to manage rosters" };
  }

  try {
    // Get form data
    const file = formData.get("file") as File | null;
    const venueId = formData.get("venueId") as string | null;

    if (!file) {
      return { success: false, error: "No file provided" };
    }

    if (!venueId) {
      return { success: false, error: "No venue selected" };
    }

    // Check if user is admin - admins have access to all venues
    const isAdmin = user.role.name === "ADMIN";

    // Verify venue access (admins can access all venues)
    const venue = await prisma.venue.findFirst({
      where: {
        id: venueId,
        ...(isAdmin
          ? {} // Admins can access any venue
          : {
              userVenues: { some: { userId: user.id } },
            }),
      },
    });

    if (!venue) {
      return { success: false, error: "Venue not found or access denied" };
    }

    // Determine file type
    const fileName = file.name.toLowerCase();
    let fileType: "excel" | "csv" | "image";

    if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      fileType = "excel";
    } else if (fileName.endsWith(".csv")) {
      fileType = "csv";
    } else if (
      fileName.endsWith(".png") ||
      fileName.endsWith(".jpg") ||
      fileName.endsWith(".jpeg") ||
      fileName.endsWith(".webp")
    ) {
      fileType = "image";
    } else {
      return { success: false, error: "Unsupported file type. Please upload Excel, CSV, or image files." };
    }

    console.log(`[V2] Processing ${fileType} file: ${file.name}`);

    // For images, use V2 multi-phase extraction
    if (fileType === "image") {
      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();

      // Get extraction context (venue staff)
      const context = await getExtractionContextV2(venueId);

      // Extract using V2 multi-phase approach
      const extraction = await extractRosterFromImageV2(arrayBuffer, file.name, context);

      // Upload file to storage for reference
      const uploadFormData = new FormData();
      uploadFormData.append("file", file);
      uploadFormData.append("venueId", venueId);

      const uploadResult = await uploadRosterFile(venueId, file);

      if ("error" in uploadResult) {
        console.warn("[V2] File upload failed, but extraction succeeded:", uploadResult.error);
      } else {
        extraction.fileUrl = uploadResult.url;
      }

      // Store extraction session
      extractionSessionsV2.set(extraction.id, extraction);

      console.log("[V2] Roster file uploaded and extracted:", {
        fileName: file.name,
        fileType,
        venueId,
        shiftsExtracted: extraction.shifts.length,
        matchedStaff: extraction.matchedCount,
        unmatchedStaff: extraction.unmatchedCount,
        phasesCompleted: extraction.metadata?.phasesCompleted,
        processingTimeMs: extraction.metadata?.processingTimeMs,
      });

      return { success: true, extraction, isV2: true };
    }

    // For Excel/CSV, fall back to V1 extraction for now
    // (V2 is primarily designed for image extraction improvements)
    return { success: false, error: "Excel/CSV extraction not yet supported in V2. Please use the standard upload." };

  } catch (error) {
    console.error("[V2] Roster extraction error:", error);
    return { success: false, error: "Failed to extract roster data" };
  }
}

// ============================================================================
// GET EXTRACTION
// ============================================================================

/**
 * Get extraction by ID
 */
export async function getExtractionV2(
  extractionId: string
): Promise<ExtractionV2ActionResult> {
  await requireAuth();

  const extraction = extractionSessionsV2.get(extractionId);
  if (!extraction) {
    return { success: false, error: "Extraction session not found" };
  }

  return { success: true, extraction, isV2: true };
}

// ============================================================================
// MANUAL STAFF MATCHING
// ============================================================================

/**
 * Manually match a staff member to an extraction entry
 */
export async function manualStaffMatchV2(
  extractionId: string,
  extractedName: string,
  userId: string
): Promise<ExtractionV2ActionResult> {
  const user = await requireAuth();

  // Check permission
  const canManageRosters = await hasPermission(user.id, "rosters", "create");
  if (!canManageRosters) {
    return { success: false, error: "You don't have permission to manage rosters" };
  }

  // Get extraction
  const extraction = extractionSessionsV2.get(extractionId);
  if (!extraction) {
    return { success: false, error: "Extraction session not found" };
  }

  try {
    // Get user details
    const matchedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!matchedUser) {
      return { success: false, error: "User not found" };
    }

    const matchedName = `${matchedUser.firstName || ""} ${matchedUser.lastName || ""}`.trim();

    // Update staff matches
    const existingMatchIndex = extraction.staffMatches.findIndex(
      (m) => m.extractedName.toLowerCase() === extractedName.toLowerCase()
    );

    if (existingMatchIndex >= 0) {
      extraction.staffMatches[existingMatchIndex] = {
        ...extraction.staffMatches[existingMatchIndex],
        matchedUserId: userId,
        matchedUserName: matchedName,
        matchedUserEmail: matchedUser.email,
        confidence: 100,
        matchType: "exact_name",
      };
    } else {
      extraction.staffMatches.push({
        extractedName,
        extractedEmail: null,
        matchedUserId: userId,
        matchedUserName: matchedName,
        matchedUserEmail: matchedUser.email,
        confidence: 100,
        matchType: "exact_name",
      });
    }

    // Update shifts with new match
    extraction.shifts = extraction.shifts.map((shift) => {
      if (shift.staffName?.toLowerCase() === extractedName.toLowerCase()) {
        return {
          ...shift,
          matched: true,
          matchedUserId: userId,
        };
      }
      return shift;
    });

    // Recalculate match counts
    extraction.matchedCount = extraction.staffMatches.filter(
      (m) => m.matchedUserId !== null
    ).length;
    extraction.unmatchedCount = extraction.staffMatches.filter(
      (m) => m.matchedUserId === null
    ).length;

    // Update session
    extractionSessionsV2.set(extractionId, extraction);

    return { success: true, extraction, isV2: true };
  } catch (error) {
    console.error("[V2] Manual staff match error:", error);
    return { success: false, error: "Failed to match staff member" };
  }
}

// ============================================================================
// CONFIRM & CREATE ROSTER
// ============================================================================

/**
 * Confirm extraction and create roster with shifts
 * This is identical to V1 - the confirmation flow remains the same
 */
export async function confirmExtractionAndCreateRosterV2(
  input: ConfirmExtractionInput
): Promise<ConfirmActionResult> {
  const user = await requireAuth();

  // Validate input
  const validated = confirmExtractionInputSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
  }

  const {
    extractionId,
    venueId,
    weekStart,
    shifts,
    unmatchedStaff,
    createAsNewVersion,
    existingRosterId,
    chainId: providedChainId,
    versionNumber: providedVersionNumber,
  } = validated.data;

  // Check permission
  const canManageRosters = await hasPermission(user.id, "rosters", "create");
  if (!canManageRosters) {
    return { success: false, error: "You don't have permission to manage rosters" };
  }

  try {
    // Get extraction session
    const extraction = extractionSessionsV2.get(extractionId);
    if (!extraction) {
      return { success: false, error: "Extraction session expired. Please re-upload the file." };
    }

    // Check if user is admin - admins have access to all venues
    const isAdmin = user.role.name === "ADMIN";

    // Verify venue access (admins can access all venues)
    const venue = await prisma.venue.findFirst({
      where: {
        id: venueId,
        ...(isAdmin
          ? {} // Admins can access any venue
          : {
              userVenues: { some: { userId: user.id } },
            }),
      },
    });

    if (!venue) {
      return { success: false, error: "Venue not found or access denied" };
    }

    // Calculate week dates
    const startDate = parseISO(weekStart);
    const endDate = addDays(startDate, 6);

    // Check for existing roster for this week
    const existingRoster = await prisma.roster.findFirst({
      where: {
        venueId,
        startDate,
      },
      orderBy: [
        { isActive: "desc" },
        { versionNumber: "desc" },
      ],
    });

    // If roster exists and not creating as new version, return error
    if (existingRoster && !createAsNewVersion) {
      return {
        success: false,
        error: `A roster already exists for week of ${format(startDate, "MMM d, yyyy")}`,
      };
    }

    // Determine version info
    let chainId = providedChainId;
    let versionNumber = providedVersionNumber || 1;
    let parentId: string | null = null;

    if (createAsNewVersion && existingRoster) {
      // Use existing chain or create new one
      chainId = existingRoster.chainId || crypto.randomUUID();
      parentId = existingRoster.id;

      // If we need to calculate version number
      if (!providedVersionNumber) {
        const maxVersion = await prisma.roster.aggregate({
          where: chainId ? { chainId } : { id: existingRoster.id },
          _max: { versionNumber: true },
        });
        versionNumber = (maxVersion._max.versionNumber || 0) + 1;
      }
    }

    // Create roster with shifts in a transaction
    const roster = await prisma.$transaction(async (tx) => {
      // If creating new version, mark previous versions as inactive
      if (createAsNewVersion && existingRoster) {
        await tx.roster.updateMany({
          where: {
            venueId,
            startDate,
            isActive: true,
          },
          data: {
            isActive: false,
          },
        });

        // Also update the chain ID on the existing roster if it didn't have one
        if (!existingRoster.chainId && chainId) {
          await tx.roster.update({
            where: { id: existingRoster.id },
            data: { chainId },
          });
        }
      }

      // Create roster
      const newRoster = await tx.roster.create({
        data: {
          name: `Week of ${format(startDate, "MMM d, yyyy")}${versionNumber > 1 ? ` (v${versionNumber})` : ""}`,
          venueId,
          startDate,
          endDate,
          status: "DRAFT",
          createdBy: user.id,
          sourceFileUrl: extraction.fileUrl || undefined,
          sourceFileName: extraction.fileName || undefined,
          sourceFileType: extraction.fileType || undefined,
          // Version chain fields
          chainId: chainId || undefined,
          versionNumber,
          parentId,
          isActive: true,
        },
      });

      // Create shifts for matched staff
      const shiftPromises = shifts
        .filter((shift) => shift.matchedUserId)
        .map((shift) =>
          tx.rosterShift.create({
            data: {
              rosterId: newRoster.id,
              userId: shift.matchedUserId!,
              date: parseISO(shift.date),
              startTime: shift.startTime,
              endTime: shift.endTime,
              position: shift.position || null,
              notes: shift.notes || null,
              originalName: shift.staffName,
            },
          })
        );

      await Promise.all(shiftPromises);

      // Create unmatched roster entries if any
      if (unmatchedStaff && unmatchedStaff.length > 0) {
        const unmatchedPromises = unmatchedStaff.map((staff) =>
          tx.unmatchedRosterEntry.create({
            data: {
              rosterId: newRoster.id,
              originalName: staff.name,
            },
          })
        );

        await Promise.all(unmatchedPromises);
      }

      // Create history entry
      await tx.rosterHistory.create({
        data: {
          rosterId: newRoster.id,
          version: 1,
          action: "CREATED",
          performedBy: user.id,
          changes: {
            source: "file_upload_v2",
            fileName: extraction.fileName,
            shiftsCreated: shifts.filter((s) => s.matchedUserId).length,
            unmatchedEntries: unmatchedStaff?.length || 0,
            extractionVersion: "v2",
            phasesCompleted: extraction.metadata?.phasesCompleted,
          },
        },
      });

      return newRoster;
    });

    // Cleanup extraction session
    extractionSessionsV2.delete(extractionId);

    // Revalidate pages
    revalidatePath("/system/rosters");
    revalidatePath("/manage/rosters");
    revalidatePath(`/system/rosters/${roster.id}`);
    revalidatePath(`/manage/rosters/${roster.id}`);

    return { success: true, rosterId: roster.id };
  } catch (error) {
    console.error("[V2] Roster creation error:", error);
    return { success: false, error: "Failed to create roster" };
  }
}

// ============================================================================
// CANCEL EXTRACTION
// ============================================================================

/**
 * Cancel extraction and cleanup
 */
export async function cancelExtractionV2(
  extractionId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const extraction = extractionSessionsV2.get(extractionId);

  if (extraction) {
    // Delete uploaded file
    if (extraction.fileUrl) {
      await deleteRosterFile(extraction.fileUrl);
    }

    // Remove session
    extractionSessionsV2.delete(extractionId);
  }

  return { success: true };
}

// ============================================================================
// GET MATCHABLE STAFF
// ============================================================================

/**
 * Get staff members for manual matching dropdown
 */
export async function getMatchableStaffV2(
  venueId: string
): Promise<
  | { success: true; staff: Array<{ id: string; name: string; email: string }> }
  | { success: false; error: string }
> {
  await requireAuth();

  try {
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
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return {
      success: true,
      staff: staff.map((s) => ({
        id: s.id,
        name: `${s.firstName || ""} ${s.lastName || ""}`.trim() || s.email,
        email: s.email,
      })),
    };
  } catch (error) {
    console.error("[V2] Get matchable staff error:", error);
    return { success: false, error: "Failed to fetch staff members" };
  }
}