/**
 * Performance protections and payload limits for roster extraction
 * 
 * This module provides:
 * - Payload size limits
 * - Shift count limits
 * - Rate limiting configuration
 * - Background job options
 * - Progress event streaming
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum file size for image uploads (10MB) */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/** Maximum file size for Excel/CSV uploads (5MB) */
export const MAX_SPREADSHEET_SIZE_BYTES = 5 * 1024 * 1024;

/** Maximum number of shifts that can be extracted in a single request */
export const MAX_SHIFTS_PER_EXTRACTION = 500;

/** Maximum number of unique staff members in a single extraction */
export const MAX_STAFF_PER_EXTRACTION = 100;

/** Maximum image dimensions for processing */
export const MAX_IMAGE_DIMENSION = 4096;

/** Minimum image dimensions for processing */
export const MIN_IMAGE_DIMENSION = 100;

/** Timeout for AI extraction (in milliseconds) */
export const EXTRACTION_TIMEOUT_MS = 120000; // 2 minutes

/** Maximum retries for extraction */
export const MAX_EXTRACTION_RETRIES = 2;

/** Delay between retries (in milliseconds) */
export const RETRY_DELAY_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface ExtractionLimits {
  maxFileSizeBytes: number;
  maxShiftsPerExtraction: number;
  maxStaffPerExtraction: number;
  maxImageDimension: number;
  minImageDimension: number;
  extractionTimeoutMs: number;
  maxRetries: number;
}

export interface FileValidationResult {
  valid: boolean;
  error?: string;
  warning?: string;
  fileSizeBytes: number;
  fileType: "image" | "excel" | "csv" | "unknown";
}

export interface ExtractionPayloadLimits {
  maxShifts: number;
  maxStaff: number;
  maxFileSize: number;
}

export interface BackgroundJobConfig {
  enabled: boolean;
  pollingIntervalMs: number;
  timeoutMs: number;
  onProgress?: (progress: ProgressEvent) => void;
}

export interface ProgressEvent {
  stage: ExtractionStage;
  progress: number; // 0-100
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export type ExtractionStage =
  | "uploading"
  | "preprocessing"
  | "extracting"
  | "matching"
  | "validating"
  | "complete"
  | "error";

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Validate file size and type
 */
export function validateFile(
  file: File,
  options: { maxFileSizeBytes?: number } = {}
): FileValidationResult {
  const maxFileSize = options.maxFileSizeBytes || MAX_FILE_SIZE_BYTES;
  const fileSizeBytes = file.size;

  // Determine file type
  let fileType: FileValidationResult["fileType"] = "unknown";
  if (file.type.startsWith("image/")) {
    fileType = "image";
  } else if (
    file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    file.type === "application/vnd.ms-excel" ||
    file.name.endsWith(".xlsx") ||
    file.name.endsWith(".xls")
  ) {
    fileType = "excel";
  } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
    fileType = "csv";
  }

  // Check file type support
  if (fileType === "unknown") {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || "unknown"}. Please upload an image (PNG, JPG) or spreadsheet (XLSX, CSV).`,
      fileSizeBytes,
      fileType,
    };
  }

  // Check file size
  const maxSize = fileType === "image" ? MAX_FILE_SIZE_BYTES : MAX_SPREADSHEET_SIZE_BYTES;
  if (fileSizeBytes > maxSize) {
    return {
      valid: false,
      error: `File size (${formatFileSize(fileSizeBytes)}) exceeds maximum allowed (${formatFileSize(maxSize)}).`,
      fileSizeBytes,
      fileType,
    };
  }

  // Warning for large files
  let warning: string | undefined;
  if (fileSizeBytes > maxSize * 0.8) {
    warning = `Large file detected (${formatFileSize(fileSizeBytes)}). Processing may take longer.`;
  }

  return {
    valid: true,
    warning,
    fileSizeBytes,
    fileType,
  };
}

/**
 * Validate image dimensions
 */
export function validateImageDimensions(
  width: number,
  height: number
): { valid: boolean; error?: string } {
  if (width < MIN_IMAGE_DIMENSION || height < MIN_IMAGE_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) are too small. Minimum: ${MIN_IMAGE_DIMENSION}x${MIN_IMAGE_DIMENSION}px.`,
    };
  }

  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
    return {
      valid: false,
      error: `Image dimensions (${width}x${height}) are too large. Maximum: ${MAX_IMAGE_DIMENSION}x${MAX_IMAGE_DIMENSION}px.`,
    };
  }

  return { valid: true };
}

// ============================================================================
// PAYLOAD LIMITS
// ============================================================================

/**
 * Check if extraction payload is within limits
 */
export function checkExtractionLimits(
  shifts: unknown[],
  staff: unknown[]
): { withinLimits: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check shift count
  if (shifts.length > MAX_SHIFTS_PER_EXTRACTION) {
    errors.push(
      `Too many shifts (${shifts.length}). Maximum allowed: ${MAX_SHIFTS_PER_EXTRACTION}.`
    );
  } else if (shifts.length > MAX_SHIFTS_PER_EXTRACTION * 0.8) {
    warnings.push(
      `Large number of shifts (${shifts.length}). Processing may take longer.`
    );
  }

  // Check staff count
  if (staff.length > MAX_STAFF_PER_EXTRACTION) {
    errors.push(
      `Too many unique staff members (${staff.length}). Maximum allowed: ${MAX_STAFF_PER_EXTRACTION}.`
    );
  }

  return {
    withinLimits: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Get default extraction limits
 */
export function getDefaultLimits(): ExtractionLimits {
  return {
    maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
    maxShiftsPerExtraction: MAX_SHIFTS_PER_EXTRACTION,
    maxStaffPerExtraction: MAX_STAFF_PER_EXTRACTION,
    maxImageDimension: MAX_IMAGE_DIMENSION,
    minImageDimension: MIN_IMAGE_DIMENSION,
    extractionTimeoutMs: EXTRACTION_TIMEOUT_MS,
    maxRetries: MAX_EXTRACTION_RETRIES,
  };
}

// ============================================================================
// BACKGROUND JOB
// ============================================================================

/**
 * Create a background job configuration
 */
export function createBackgroundJobConfig(
  options: Partial<BackgroundJobConfig> = {}
): BackgroundJobConfig {
  return {
    enabled: options.enabled ?? false,
    pollingIntervalMs: options.pollingIntervalMs ?? 2000,
    timeoutMs: options.timeoutMs ?? EXTRACTION_TIMEOUT_MS,
    onProgress: options.onProgress,
  };
}

/**
 * Simulate progress events for optimistic UI
 * This provides visual feedback while waiting for actual progress
 */
export function createOptimisticProgressEmitter(
  onProgress: (event: ProgressEvent) => void
): {
  start: () => void;
  advance: (stage: ExtractionStage, progress: number, message: string) => void;
  complete: () => void;
  error: (message: string) => void;
} {
  let currentStage: ExtractionStage = "uploading";

  return {
    start: () => {
      currentStage = "uploading";
      onProgress({
        stage: "uploading",
        progress: 0,
        message: "Starting upload...",
        timestamp: new Date(),
      });
    },

    advance: (stage, progress, message) => {
      currentStage = stage;
      onProgress({
        stage,
        progress: Math.min(100, Math.max(0, progress)),
        message,
        timestamp: new Date(),
      });
    },

    complete: () => {
      onProgress({
        stage: "complete",
        progress: 100,
        message: "Extraction complete!",
        timestamp: new Date(),
      });
    },

    error: (message) => {
      onProgress({
        stage: "error",
        progress: 0,
        message,
        timestamp: new Date(),
      });
    },
  };
}

/**
 * Create a progress timeline for optimistic UI updates
 */
export function createProgressTimeline(): Array<{
  stage: ExtractionStage;
  progress: number;
  message: string;
  delayMs: number;
}> {
  return [
    { stage: "uploading", progress: 5, message: "Uploading file...", delayMs: 0 },
    { stage: "uploading", progress: 15, message: "File received", delayMs: 500 },
    { stage: "preprocessing", progress: 20, message: "Preprocessing image...", delayMs: 1000 },
    { stage: "preprocessing", progress: 30, message: "Enhancing image quality...", delayMs: 2000 },
    { stage: "extracting", progress: 40, message: "Starting AI extraction...", delayMs: 3000 },
    { stage: "extracting", progress: 50, message: "Analyzing roster structure...", delayMs: 5000 },
    { stage: "extracting", progress: 60, message: "Extracting shift data...", delayMs: 10000 },
    { stage: "extracting", progress: 70, message: "Processing staff names...", delayMs: 15000 },
    { stage: "matching", progress: 80, message: "Matching staff to users...", delayMs: 20000 },
    { stage: "validating", progress: 90, message: "Validating extraction...", delayMs: 25000 },
    { stage: "complete", progress: 100, message: "Extraction complete!", delayMs: 30000 },
  ];
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Estimate processing time based on file size and shift count
 */
export function estimateProcessingTime(
  fileSizeBytes: number,
  estimatedShiftCount: number
): number {
  // Base time: 10 seconds
  let estimatedMs = 10000;

  // Add time for file size (1 second per MB)
  estimatedMs += (fileSizeBytes / (1024 * 1024)) * 1000;

  // Add time for shifts (100ms per shift)
  estimatedMs += estimatedShiftCount * 100;

  // Cap at 2 minutes
  return Math.min(estimatedMs, EXTRACTION_TIMEOUT_MS);
}

/**
 * Check if extraction should use background processing
 */
export function shouldUseBackgroundProcessing(
  fileSizeBytes: number,
  estimatedShiftCount: number
): boolean {
  // Use background processing for large files or many shifts
  const estimatedTime = estimateProcessingTime(fileSizeBytes, estimatedShiftCount);
  return estimatedTime > 30000; // More than 30 seconds
}
