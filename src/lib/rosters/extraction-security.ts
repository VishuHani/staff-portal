/**
 * Permission and safety checks for roster extraction
 * 
 * This module provides:
 * - Venue isolation checks
 * - Permission verification
 * - PII-safe prompt construction
 * - Secure storage lifecycle for uploaded files
 */

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionPermissionResult {
  allowed: boolean;
  reason?: string;
  userId?: string;
  venueId?: string;
  userRole?: string;
}

export interface VenueIsolationCheck {
  isIsolated: boolean;
  userHasAccess: boolean;
  venueExists: boolean;
}

export interface FileStorageConfig {
  bucket: string;
  path: string;
  maxAgeDays: number;
  deleteAfterProcessing: boolean;
}

// ============================================================================
// PERMISSION CHECKS
// ============================================================================

/**
 * Check if user has permission to extract rosters for a venue
 */
export async function checkExtractionPermission(
  venueId: string
): Promise<ExtractionPermissionResult> {
  try {
    const user = await requireAuth();

    // Check if user has roster create permission
    const canCreateRoster = await hasPermission(user.id, "rosters", "create", venueId);
    if (!canCreateRoster) {
      return {
        allowed: false,
        reason: "You do not have permission to create rosters.",
        userId: user.id,
      };
    }

    // Check venue access
    const venueAccess = await checkVenueAccess(user.id, venueId);
    if (!venueAccess.hasAccess) {
      return {
        allowed: false,
        reason: venueAccess.reason || "You do not have access to this venue.",
        userId: user.id,
        venueId,
      };
    }

    return {
      allowed: true,
      userId: user.id,
      venueId,
      userRole: user.role?.name,
    };
  } catch (error) {
    return {
      allowed: false,
      reason: "Authentication required.",
    };
  }
}

/**
 * Check if user has access to a specific venue
 */
export async function checkVenueAccess(
  userId: string,
  venueId: string
): Promise<{ hasAccess: boolean; reason?: string }> {
  // Get user with venues
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      roleId: true,
      role: {
        select: { name: true },
      },
      venues: {
        select: { venueId: true },
      },
    },
  });

  if (!user) {
    return { hasAccess: false, reason: "User not found." };
  }

  // System admins have access to all venues
  if (user.role?.name === "SYSTEM_ADMIN") {
    return { hasAccess: true };
  }

  // Check if user is assigned to this venue
  const userVenue = user.venues.find((v) => v.venueId === venueId);
  if (!userVenue) {
    return {
      hasAccess: false,
      reason: "You are not assigned to this venue.",
    };
  }

  return { hasAccess: true };
}

/**
 * Verify venue isolation for data access
 */
export async function verifyVenueIsolation(
  userId: string,
  venueId: string
): Promise<VenueIsolationCheck> {
  // Check venue exists
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
    select: { id: true },
  });

  if (!venue) {
    return {
      isIsolated: false,
      userHasAccess: false,
      venueExists: false,
    };
  }

  // Check user access
  const accessCheck = await checkVenueAccess(userId, venueId);

  return {
    isIsolated: true,
    userHasAccess: accessCheck.hasAccess,
    venueExists: true,
  };
}

// ============================================================================
// PII-SAFE PROMPTS
// ============================================================================

/**
 * Sanitize staff data for AI prompts
 * Removes or masks PII before sending to external AI services
 */
export function sanitizeStaffDataForPrompt(
  staff: Array<{ id: string; firstName: string | null; lastName: string | null; email: string }>
): Array<{ id: string; name: string; emailDomain: string }> {
  return staff.map((s) => ({
    id: s.id,
    name: `${s.firstName || ""} ${s.lastName || ""}`.trim(),
    // Only include email domain, not full email
    emailDomain: s.email.includes("@") ? s.email.split("@")[1] : "",
  }));
}

/**
 * Build a PII-safe extraction context for AI prompts
 */
export function buildPIISafeExtractionContext(params: {
  venueName: string;
  staff: Array<{ id: string; name: string; emailDomain: string }>;
  positions: Array<{ id: string; name: string }>;
}): string {
  const { venueName, staff, positions } = params;

  // Build staff list without full emails
  const staffList = staff
    .map((s, idx) => `${idx + 1}. ${s.name} (ID: ${s.id.slice(0, 8)}...)`)
    .join("\n");

  // Build positions list
  const positionsList = positions
    .map((p, idx) => `${idx + 1}. ${p.name}`)
    .join("\n");

  return `
VENUE: ${venueName}

STAFF MEMBERS:
${staffList}

POSITIONS:
${positionsList}

IMPORTANT: Match staff names from the roster image to the staff list above.
Use exact name matching when possible. If a name is not found, note it as "unmatched".
Do not invent or hallucinate staff members that are not in the list.
`.trim();
}

/**
 * Mask sensitive information in extraction results
 */
export function maskSensitiveData(
  data: Record<string, unknown>,
  fieldsToMask: string[] = ["email", "phone", "address"]
): Record<string, unknown> {
  const masked: Record<string, unknown> = { ...data };

  for (const field of fieldsToMask) {
    if (field in masked && typeof masked[field] === "string") {
      const value = masked[field] as string;
      if (field === "email" && value.includes("@")) {
        const [local, domain] = value.split("@");
        masked[field] = `${local.slice(0, 2)}***@${domain}`;
      } else if (field === "phone") {
        masked[field] = value.slice(0, 4) + "***" + value.slice(-3);
      } else {
        masked[field] = "***MASKED***";
      }
    }
  }

  return masked;
}

// ============================================================================
// SECURE FILE STORAGE
// ============================================================================

/**
 * Get storage configuration for roster files
 */
export function getFileStorageConfig(
  venueId: string,
  fileType: "image" | "excel" | "csv"
): FileStorageConfig {
  const bucket = "roster-uploads";
  const path = `${venueId}/${fileType}`;

  // Different retention policies based on file type
  const maxAgeDays = fileType === "image" ? 7 : 30;

  return {
    bucket,
    path,
    maxAgeDays,
    deleteAfterProcessing: fileType === "image",
  };
}

/**
 * Generate a secure file path for storage
 */
export function generateSecureFilePath(
  venueId: string,
  originalFileName: string,
  userId: string
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  const sanitized = originalFileName.replace(/[^a-zA-Z0-9.-]/g, "_");

  return `${venueId}/${timestamp}-${randomSuffix}-${sanitized}`;
}

/**
 * Check if a file path is within allowed storage boundaries
 */
export function isPathAllowed(
  filePath: string,
  venueId: string
): { allowed: boolean; reason?: string } {
  // Path must start with the venue ID
  if (!filePath.startsWith(`${venueId}/`)) {
    return {
      allowed: false,
      reason: "File path is outside allowed venue directory.",
    };
  }

  // Check for path traversal attempts
  if (filePath.includes("..") || filePath.includes("//")) {
    return {
      allowed: false,
      reason: "Invalid file path detected.",
    };
  }

  return { allowed: true };
}

// ============================================================================
// AUDIT TRAIL
// ============================================================================

/**
 * Log file access for audit purposes
 */
export async function logFileAccess(params: {
  userId: string;
  venueId: string;
  filePath: string;
  action: "upload" | "download" | "delete";
  success: boolean;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        userId: params.userId,
        actionType: `FILE_${params.action.toUpperCase()}`,
        resourceType: "RosterFile",
        resourceId: params.filePath,
        newValue: JSON.stringify({
          venueId: params.venueId,
          success: params.success,
          timestamp: new Date().toISOString(),
          ...params.metadata,
        }),
      },
    });
  } catch (error) {
    console.error("Failed to log file access:", error);
  }
}

/**
 * Log extraction attempt for audit purposes
 */
export async function logExtractionAttempt(params: {
  userId: string;
  venueId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  success: boolean;
  shiftCount?: number;
  confidence?: number;
  errorMessage?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        id: crypto.randomUUID(),
        userId: params.userId,
        actionType: params.success ? "EXTRACTION_SUCCESS" : "EXTRACTION_FAILED",
        resourceType: "RosterExtraction",
        resourceId: params.venueId,
        newValue: JSON.stringify({
          fileName: params.fileName,
          fileSize: params.fileSize,
          fileType: params.fileType,
          shiftCount: params.shiftCount,
          confidence: params.confidence,
          errorMessage: params.errorMessage,
          timestamp: new Date().toISOString(),
        }),
      },
    });
  } catch (error) {
    console.error("Failed to log extraction attempt:", error);
  }
}

// ============================================================================
// RATE LIMITING
// ============================================================================

const extractionAttempts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if user has exceeded extraction rate limit
 */
export function checkExtractionRateLimit(
  userId: string,
  maxAttempts: number = 10,
  windowMs: number = 60000
): { allowed: boolean; remainingAttempts: number; resetInMs: number } {
  const now = Date.now();
  const record = extractionAttempts.get(userId);

  if (!record || now > record.resetAt) {
    // Start new window
    extractionAttempts.set(userId, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remainingAttempts: maxAttempts - 1,
      resetInMs: windowMs,
    };
  }

  if (record.count >= maxAttempts) {
    return {
      allowed: false,
      remainingAttempts: 0,
      resetInMs: record.resetAt - now,
    };
  }

  // Increment count
  record.count++;
  extractionAttempts.set(userId, record);

  return {
    allowed: true,
    remainingAttempts: maxAttempts - record.count,
    resetInMs: record.resetAt - now,
  };
}

/**
 * Clear rate limit for a user (for testing or admin override)
 */
export function clearExtractionRateLimit(userId: string): void {
  extractionAttempts.delete(userId);
}
