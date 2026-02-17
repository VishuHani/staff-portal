/**
 * Roster File Utilities - Client-Safe
 * These utilities can be used in both client and server components
 */

// Allowed file types and their MIME types
export const ALLOWED_FILE_TYPES = {
  excel: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
  ] as string[],
  csv: ["text/csv", "application/csv", "text/plain"] as string[],
  image: ["image/jpeg", "image/jpg", "image/png", "image/webp"] as string[],
};

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const ROSTER_BUCKET = "roster-uploads";

export type RosterFileType = "excel" | "csv" | "image";

export interface RosterFileValidation {
  valid: boolean;
  fileType?: RosterFileType;
  error?: string;
}

/**
 * Validate roster file type and size
 */
export function validateRosterFile(file: File): RosterFileValidation {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    };
  }

  // Determine file type
  const mimeType = file.type.toLowerCase();

  if (ALLOWED_FILE_TYPES.excel.includes(mimeType)) {
    return { valid: true, fileType: "excel" };
  }

  if (ALLOWED_FILE_TYPES.csv.includes(mimeType)) {
    return { valid: true, fileType: "csv" };
  }

  if (ALLOWED_FILE_TYPES.image.includes(mimeType)) {
    return { valid: true, fileType: "image" };
  }

  // Check by extension as fallback
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xls") {
    return { valid: true, fileType: "excel" };
  }
  if (extension === "csv") {
    return { valid: true, fileType: "csv" };
  }
  if (["jpg", "jpeg", "png", "webp"].includes(extension || "")) {
    return { valid: true, fileType: "image" };
  }

  return {
    valid: false,
    error: "Unsupported file type. Please upload Excel (.xlsx, .xls), CSV (.csv), or Image (.jpg, .png, .webp) files.",
  };
}

/**
 * Generate unique filename for roster uploads
 */
export function generateRosterFilename(
  venueId: string,
  fileType: RosterFileType,
  originalName: string
): string {
  const timestamp = Date.now();
  const extension = originalName.split(".").pop() || "";
  const sanitizedName = originalName
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, "_") // Sanitize
    .substring(0, 50); // Limit length

  return `${venueId}/${timestamp}-${sanitizedName}.${extension}`;
}
