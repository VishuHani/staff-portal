"use server";

/**
 * Roster Extraction Server Actions
 * Handles file upload, AI extraction, and roster creation from extracted data
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";
import { uploadRosterFile, downloadRosterFile, deleteRosterFile } from "@/lib/storage/rosters";
import {
  extractRosterFromFile,
  getExtractionContext,
} from "@/lib/services/roster-extraction-service";
import {
  startExtractionInputSchema,
  confirmExtractionInputSchema,
  updateColumnMappingsInputSchema,
  type StartExtractionInput,
  type ConfirmExtractionInput,
  type UpdateColumnMappingsInput,
  type RosterExtractionResult,
  type ColumnMapping,
  type RosterFileSource,
} from "@/lib/schemas/rosters/extraction";
import { addDays, format, parseISO } from "date-fns";

// ============================================================================
// TYPES
// ============================================================================

export type ExtractionActionResult =
  | { success: true; extraction: RosterExtractionResult }
  | { success: false; error: string };

export type ConfirmActionResult =
  | { success: true; rosterId: string }
  | { success: false; error: string };

export type DuplicateCheckResult =
  | {
      success: true;
      hasDuplicate: false;
    }
  | {
      success: true;
      hasDuplicate: true;
      existingRoster: {
        id: string;
        name: string;
        versionNumber: number;
        status: string;
        shiftCount: number;
        createdAt: Date;
        createdByName: string | null;
        chainId: string | null;
      };
      nextVersionNumber: number;
    }
  | { success: false; error: string };

// In-memory storage for extraction sessions (would use Redis in production)
const extractionSessions = new Map<string, RosterExtractionResult>();

// ============================================================================
// UPLOAD & EXTRACT ACTION
// ============================================================================

/**
 * Upload a roster file and extract data
 */
export async function uploadAndExtractRoster(
  formData: FormData
): Promise<ExtractionActionResult> {
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

    // Verify venue access
    const venue = await prisma.venue.findFirst({
      where: {
        id: venueId,
        OR: [
          { userVenues: { some: { userId: user.id } } },
          { id: { not: undefined } }, // Admin access
        ],
      },
    });

    if (!venue) {
      return { success: false, error: "Venue not found or access denied" };
    }

    // Upload file to storage
    const uploadResult = await uploadRosterFile(venueId, file);

    if ("error" in uploadResult) {
      return { success: false, error: uploadResult.error };
    }

    // Download file for processing
    const downloadResult = await downloadRosterFile(uploadResult.url);

    if ("error" in downloadResult) {
      // Cleanup uploaded file
      await deleteRosterFile(uploadResult.url);
      return { success: false, error: downloadResult.error };
    }

    // Get extraction context (venue staff)
    const context = await getExtractionContext(venueId);

    // Extract data from file
    const extraction = await extractRosterFromFile(
      downloadResult.data,
      uploadResult.fileName,
      uploadResult.fileType as RosterFileSource,
      context
    );

    // Update extraction with file URL
    extraction.fileUrl = uploadResult.url;

    // Store extraction session
    extractionSessions.set(extraction.id, extraction);

    console.log("Roster file uploaded and extracted:", {
      fileName: uploadResult.fileName,
      fileType: uploadResult.fileType,
      venueId,
      shiftsExtracted: extraction.shifts.length,
      matchedStaff: extraction.matchedCount,
      unmatchedStaff: extraction.unmatchedCount,
    });

    return { success: true, extraction };
  } catch (error) {
    console.error("Roster extraction error:", error);
    return { success: false, error: "Failed to extract roster data" };
  }
}

/**
 * Start extraction from an already uploaded file URL
 */
export async function startExtraction(
  input: StartExtractionInput
): Promise<ExtractionActionResult> {
  const user = await requireAuth();

  // Validate input
  const validated = startExtractionInputSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
  }

  const { venueId, fileUrl, fileName, fileType } = validated.data;

  // Check permission
  const canManageRosters = await hasPermission(user.id, "rosters", "create");
  if (!canManageRosters) {
    return { success: false, error: "You don't have permission to manage rosters" };
  }

  try {
    // Download file for processing
    const downloadResult = await downloadRosterFile(fileUrl);

    if ("error" in downloadResult) {
      return { success: false, error: downloadResult.error };
    }

    // Get extraction context
    const context = await getExtractionContext(venueId);

    // Extract data
    const extraction = await extractRosterFromFile(
      downloadResult.data,
      fileName,
      fileType,
      context
    );

    extraction.fileUrl = fileUrl;

    // Store extraction session
    extractionSessions.set(extraction.id, extraction);

    return { success: true, extraction };
  } catch (error) {
    console.error("Extraction error:", error);
    return { success: false, error: "Failed to extract roster data" };
  }
}

// ============================================================================
// COLUMN MAPPING ACTIONS
// ============================================================================

/**
 * Update column mappings for an extraction
 */
export async function updateColumnMappings(
  input: UpdateColumnMappingsInput
): Promise<ExtractionActionResult> {
  await requireAuth();

  // Validate input
  const validated = updateColumnMappingsInputSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
  }

  const { extractionId, mappings } = validated.data;

  // Get stored extraction
  const extraction = extractionSessions.get(extractionId);
  if (!extraction) {
    return { success: false, error: "Extraction session not found. Please re-upload the file." };
  }

  try {
    // Update column mappings
    extraction.detectedColumns = mappings as ColumnMapping[];

    // Update session
    extractionSessions.set(extractionId, extraction);

    return { success: true, extraction };
  } catch (error) {
    console.error("Column mapping update error:", error);
    return { success: false, error: "Failed to update column mappings" };
  }
}

/**
 * Get extraction by ID
 */
export async function getExtraction(
  extractionId: string
): Promise<ExtractionActionResult> {
  await requireAuth();

  const extraction = extractionSessions.get(extractionId);
  if (!extraction) {
    return { success: false, error: "Extraction session not found" };
  }

  return { success: true, extraction };
}

// ============================================================================
// DUPLICATE CHECK
// ============================================================================

/**
 * Check if a roster already exists for the given venue and week
 */
export async function checkForDuplicateRoster(
  venueId: string,
  weekStart: string
): Promise<DuplicateCheckResult> {
  await requireAuth();

  try {
    const startDate = parseISO(weekStart);

    // Find existing roster for this venue and week (look for the active one first)
    const existingRoster = await prisma.roster.findFirst({
      where: {
        venueId,
        startDate,
      },
      orderBy: [
        { isActive: "desc" },
        { versionNumber: "desc" },
      ],
      include: {
        _count: {
          select: { shifts: true },
        },
        createdByUser: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!existingRoster) {
      return { success: true, hasDuplicate: false };
    }

    // Calculate next version number
    let nextVersionNumber = existingRoster.versionNumber + 1;

    // If there's a chain, get the max version number in the chain
    if (existingRoster.chainId) {
      const maxVersion = await prisma.roster.aggregate({
        where: { chainId: existingRoster.chainId },
        _max: { versionNumber: true },
      });
      nextVersionNumber = (maxVersion._max.versionNumber || 0) + 1;
    }

    const createdByName = existingRoster.createdByUser
      ? `${existingRoster.createdByUser.firstName || ""} ${existingRoster.createdByUser.lastName || ""}`.trim() || null
      : null;

    return {
      success: true,
      hasDuplicate: true,
      existingRoster: {
        id: existingRoster.id,
        name: existingRoster.name,
        versionNumber: existingRoster.versionNumber,
        status: existingRoster.status,
        shiftCount: existingRoster._count.shifts,
        createdAt: existingRoster.createdAt,
        createdByName,
        chainId: existingRoster.chainId,
      },
      nextVersionNumber,
    };
  } catch (error) {
    console.error("Duplicate check error:", error);
    return { success: false, error: "Failed to check for existing roster" };
  }
}

// ============================================================================
// CONFIRM & CREATE ROSTER
// ============================================================================

/**
 * Confirm extraction and create roster with shifts
 */
export async function confirmExtractionAndCreateRoster(
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
    const extraction = extractionSessions.get(extractionId);
    if (!extraction) {
      return { success: false, error: "Extraction session expired. Please re-upload the file." };
    }

    // Verify venue access
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
    });

    if (!venue) {
      return { success: false, error: "Venue not found" };
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
              userId: shift.matchedUserId,
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
            source: "file_upload",
            fileName: extraction.fileName,
            shiftsCreated: shifts.filter((s) => s.matchedUserId).length,
            unmatchedEntries: unmatchedStaff?.length || 0,
          },
        },
      });

      return newRoster;
    });

    // Cleanup extraction session
    extractionSessions.delete(extractionId);

    // Revalidate pages
    revalidatePath("/system/rosters");
    revalidatePath("/manage/rosters");
    revalidatePath(`/system/rosters/${roster.id}`);

    return { success: true, rosterId: roster.id };
  } catch (error) {
    console.error("Roster creation error:", error);
    return { success: false, error: "Failed to create roster" };
  }
}

/**
 * Cancel extraction and cleanup
 */
export async function cancelExtraction(
  extractionId: string
): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  const extraction = extractionSessions.get(extractionId);

  if (extraction) {
    // Delete uploaded file
    if (extraction.fileUrl) {
      await deleteRosterFile(extraction.fileUrl);
    }

    // Remove session
    extractionSessions.delete(extractionId);
  }

  return { success: true };
}

// ============================================================================
// MANUAL STAFF MATCHING
// ============================================================================

/**
 * Manually match a staff member to an extraction entry
 */
export async function manualStaffMatch(
  extractionId: string,
  extractedName: string,
  userId: string
): Promise<ExtractionActionResult> {
  const user = await requireAuth();

  // Check permission
  const canManageRosters = await hasPermission(user.id, "rosters", "create");
  if (!canManageRosters) {
    return { success: false, error: "You don't have permission to manage rosters" };
  }

  // Get extraction
  const extraction = extractionSessions.get(extractionId);
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
    extractionSessions.set(extractionId, extraction);

    return { success: true, extraction };
  } catch (error) {
    console.error("Manual staff match error:", error);
    return { success: false, error: "Failed to match staff member" };
  }
}

/**
 * Get staff members for manual matching dropdown
 */
export async function getMatchableStaff(
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
    console.error("Get matchable staff error:", error);
    return { success: false, error: "Failed to fetch staff members" };
  }
}
