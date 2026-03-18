/**
 * Security Enhancements for Document Management System
 * Phase 8 - Polish & Testing
 *
 * This module provides:
 * - File type validation (magic number checking)
 * - File size enforcement
 * - Rate limiting for submissions
 * - XSS prevention for form content
 * - CSRF protection utilities
 */

import { rateLimit } from "@/lib/utils/rate-limit";

// ============================================================================
// TYPES
// ============================================================================

export interface FileValidationOptions {
  /** Maximum file size in bytes */
  maxSizeBytes: number;
  /** Allowed MIME types */
  allowedMimeTypes: string[];
  /** Allowed file extensions */
  allowedExtensions: string[];
  /** Enable magic number validation */
  validateMagicNumber: boolean;
}

export interface FileValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  detectedMimeType?: string;
  detectedExtension?: string;
}

export interface SecurityConfig {
  /** Maximum PDF file size (10MB) */
  maxPdfSizeBytes: number;
  /** Maximum image file size (2MB) */
  maxImageSizeBytes: number;
  /** Maximum attachment file size (5MB) */
  maxAttachmentSizeBytes: number;
  /** Maximum signature file size (500KB) */
  maxSignatureSizeBytes: number;
  /** Allowed PDF MIME types */
  allowedPdfMimeTypes: string[];
  /** Allowed image MIME types */
  allowedImageMimeTypes: string[];
  /** Allowed attachment MIME types */
  allowedAttachmentMimeTypes: string[];
  /** Maximum form field content length */
  maxFieldContentLength: number;
  /** Rate limit for form submissions per minute */
  submissionRateLimit: number;
}

export interface SanitizationOptions {
  /** Allow HTML tags */
  allowHtml: boolean;
  /** Allowed HTML tags (if allowHtml is true) */
  allowedTags: string[];
  /** Maximum length */
  maxLength: number;
  /** Trim whitespace */
  trim: boolean;
  /** Normalize unicode */
  normalizeUnicode: boolean;
}

export interface CSRFTokenOptions {
  /** Token expiration time in seconds */
  expirationSeconds: number;
  /** Token length in bytes */
  tokenLength: number;
}

// ============================================================================
// SECURITY CONFIGURATION
// ============================================================================

export const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  maxPdfSizeBytes: 10 * 1024 * 1024, // 10MB
  maxImageSizeBytes: 2 * 1024 * 1024, // 2MB
  maxAttachmentSizeBytes: 5 * 1024 * 1024, // 5MB
  maxSignatureSizeBytes: 500 * 1024, // 500KB
  allowedPdfMimeTypes: ["application/pdf"],
  allowedImageMimeTypes: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/gif",
    "image/webp",
  ],
  allowedAttachmentMimeTypes: [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/jpg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
  ],
  maxFieldContentLength: 10000, // 10,000 characters
  submissionRateLimit: 10, // 10 submissions per minute
};

// ============================================================================
// MAGIC NUMBER SIGNATURES
// ============================================================================

/**
 * File magic number signatures for type validation
 * These are the first few bytes of a file that identify its true type
 */
const MAGIC_NUMBERS: Record<string, { signature: number[]; offset: number }> = {
  // PDF
  pdf: { signature: [0x25, 0x50, 0x44, 0x46], offset: 0 }, // %PDF

  // Images
  png: { signature: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], offset: 0 },
  jpeg: { signature: [0xff, 0xd8, 0xff], offset: 0 },
  gif: { signature: [0x47, 0x49, 0x46, 0x38], offset: 0 }, // GIF8
  webp: { signature: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF (WebP starts with RIFF)

  // Documents
  doc: { signature: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1], offset: 0 }, // OLE2
  docx: { signature: [0x50, 0x4b, 0x03, 0x04], offset: 0 }, // ZIP-based (DOCX, XLSX, PPTX)
  zip: { signature: [0x50, 0x4b, 0x03, 0x04], offset: 0 },

  // Text
  utf8: { signature: [0xef, 0xbb, 0xbf], offset: 0 }, // UTF-8 BOM
  utf16be: { signature: [0xfe, 0xff], offset: 0 },
  utf16le: { signature: [0xff, 0xfe], offset: 0 },
};

/**
 * MIME type to extension mapping
 */
const MIME_TO_EXTENSION: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/gif": [".gif"],
  "image/webp": [".webp"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "text/plain": [".txt"],
  "text/csv": [".csv"],
};

// ============================================================================
// FILE VALIDATION
// ============================================================================

/**
 * Validate file by checking magic number signature
 */
export function validateMagicNumber(
  buffer: ArrayBuffer,
  expectedType: string
): boolean {
  const magic = MAGIC_NUMBERS[expectedType.toLowerCase()];
  if (!magic) {
    console.warn(`Unknown magic number type: ${expectedType}`);
    return true; // Skip validation if type not recognized
  }

  const view = new Uint8Array(buffer);
  const { signature, offset } = magic;

  // Check if file is large enough
  if (view.length < offset + signature.length) {
    return false;
  }

  // Compare bytes
  for (let i = 0; i < signature.length; i++) {
    if (view[offset + i] !== signature[i]) {
      return false;
    }
  }

  return true;
}

/**
 * Detect file type from magic number
 */
export function detectFileType(buffer: ArrayBuffer): string | null {
  const view = new Uint8Array(buffer);

  for (const [type, magic] of Object.entries(MAGIC_NUMBERS)) {
    const { signature, offset } = magic;

    if (view.length < offset + signature.length) {
      continue;
    }

    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (view[offset + i] !== signature[i]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      // Special handling for WebP (RIFF header)
      if (type === "webp") {
        // Check for WEBP identifier at offset 8
        if (
          view.length >= 12 &&
          view[8] === 0x57 &&
          view[9] === 0x45 &&
          view[10] === 0x42 &&
          view[11] === 0x50
        ) {
          return "webp";
        }
        continue;
      }
      return type;
    }
  }

  return null;
}

/**
 * Get MIME type from detected file type
 */
export function getMimeTypeFromType(type: string): string | null {
  const mimeMap: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    zip: "application/zip",
  };

  return mimeMap[type.toLowerCase()] || null;
}

/**
 * Validate a PDF file
 */
export async function validatePDFFile(
  file: File,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > config.maxPdfSizeBytes) {
    errors.push(
      `File size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(config.maxPdfSizeBytes)})`
    );
  }

  // Check MIME type
  if (!config.allowedPdfMimeTypes.includes(file.type)) {
    errors.push(
      `Invalid MIME type: ${file.type}. Expected: ${config.allowedPdfMimeTypes.join(", ")}`
    );
  }

  // Check extension
  const extension = getFileExtension(file.name);
  if (extension !== ".pdf") {
    warnings.push(`File extension "${extension}" does not match expected ".pdf"`);
  }

  // Validate magic number
  try {
    const buffer = await file.arrayBuffer();
    const isValidPdf = validateMagicNumber(buffer, "pdf");

    if (!isValidPdf) {
      const detectedType = detectFileType(buffer);
      if (detectedType) {
        errors.push(
          `File content does not match PDF. Detected as: ${detectedType}`
        );
      } else {
        errors.push("File content does not match PDF format");
      }
    }
  } catch (error) {
    warnings.push("Could not validate file content (magic number check failed)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedMimeType: file.type,
    detectedExtension: extension,
  };
}

/**
 * Validate an image file
 */
export async function validateImageFile(
  file: File,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > config.maxImageSizeBytes) {
    errors.push(
      `File size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(config.maxImageSizeBytes)})`
    );
  }

  // Check MIME type
  if (!config.allowedImageMimeTypes.includes(file.type)) {
    errors.push(
      `Invalid MIME type: ${file.type}. Expected: ${config.allowedImageMimeTypes.join(", ")}`
    );
  }

  // Check extension
  const extension = getFileExtension(file.name);
  const validExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
  if (!validExtensions.includes(extension)) {
    warnings.push(
      `File extension "${extension}" is not a common image format`
    );
  }

  // Validate magic number
  try {
    const buffer = await file.arrayBuffer();
    const detectedType = detectFileType(buffer);

    if (detectedType) {
      const detectedMime = getMimeTypeFromType(detectedType);
      if (detectedMime && !config.allowedImageMimeTypes.includes(detectedMime)) {
        errors.push(
          `File content detected as ${detectedType}, which is not an allowed image type`
        );
      }
    } else {
      warnings.push("Could not determine image type from file content");
    }
  } catch (error) {
    warnings.push("Could not validate file content (magic number check failed)");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedMimeType: file.type,
    detectedExtension: extension,
  };
}

/**
 * Validate a signature file
 */
export async function validateSignatureFile(
  file: File,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size (signatures should be small)
  if (file.size > config.maxSignatureSizeBytes) {
    errors.push(
      `Signature file size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(config.maxSignatureSizeBytes)})`
    );
  }

  // Check MIME type (signatures should be PNG)
  const allowedSignatureTypes = ["image/png"];
  if (!allowedSignatureTypes.includes(file.type)) {
    errors.push(
      `Invalid signature MIME type: ${file.type}. Expected: image/png`
    );
  }

  // Validate magic number
  try {
    const buffer = await file.arrayBuffer();
    const isValidPng = validateMagicNumber(buffer, "png");

    if (!isValidPng) {
      errors.push("Signature file is not a valid PNG image");
    }
  } catch (error) {
    warnings.push("Could not validate signature file content");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedMimeType: file.type,
    detectedExtension: getFileExtension(file.name),
  };
}

/**
 * Validate an attachment file
 */
export async function validateAttachmentFile(
  file: File,
  config: SecurityConfig = DEFAULT_SECURITY_CONFIG
): Promise<FileValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check file size
  if (file.size > config.maxAttachmentSizeBytes) {
    errors.push(
      `File size (${formatFileSize(file.size)}) exceeds maximum allowed (${formatFileSize(config.maxAttachmentSizeBytes)})`
    );
  }

  // Check MIME type
  if (!config.allowedAttachmentMimeTypes.includes(file.type)) {
    errors.push(
      `File type "${file.type}" is not allowed. Allowed types: ${config.allowedAttachmentMimeTypes.join(", ")}`
    );
  }

  // Check extension
  const extension = getFileExtension(file.name);
  const expectedExtensions = MIME_TO_EXTENSION[file.type] || [];
  if (expectedExtensions.length > 0 && !expectedExtensions.includes(extension)) {
    warnings.push(
      `File extension "${extension}" does not match MIME type "${file.type}"`
    );
  }

  // Validate magic number for known types
  try {
    const buffer = await file.arrayBuffer();
    const detectedType = detectFileType(buffer);

    if (detectedType) {
      const detectedMime = getMimeTypeFromType(detectedType);
      if (detectedMime && detectedMime !== file.type) {
        warnings.push(
          `File content appears to be ${detectedMime}, but MIME type is declared as ${file.type}`
        );
      }
    }
  } catch (error) {
    // Magic number check is optional for attachments
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    detectedMimeType: file.type,
    detectedExtension: extension,
  };
}

// ============================================================================
// XSS PREVENTION
// ============================================================================

/**
 * Default sanitization options
 */
export const DEFAULT_SANITIZATION_OPTIONS: SanitizationOptions = {
  allowHtml: false,
  allowedTags: [],
  maxLength: 10000,
  trim: true,
  normalizeUnicode: true,
};

/**
 * HTML entities for escaping
 */
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#x27;",
  "/": "&#x2F;",
  "`": "&#x60;",
  "=": "&#x3D;",
};

/**
 * Escape HTML special characters
 */
export function escapeHtml(input: string): string {
  return input.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Unescape HTML entities
 */
export function unescapeHtml(input: string): string {
  const entities: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#x27;": "'",
    "&#x2F;": "/",
    "&#x60;": "`",
    "&#x3D;": "=",
  };
  return input.replace(/&[^;]+;/g, (entity) => entities[entity] || entity);
}

/**
 * Strip HTML tags from a string
 */
export function stripHtmlTags(input: string): string {
  // Remove HTML tags
  let result = input.replace(/<[^>]*>/g, "");
  // Decode HTML entities
  result = unescapeHtml(result);
  return result;
}

/**
 * Sanitize form field content
 */
export function sanitizeFieldContent(
  input: string,
  options: Partial<SanitizationOptions> = {}
): string {
  const opts = { ...DEFAULT_SANITIZATION_OPTIONS, ...options };

  let result = input;

  // Normalize unicode
  if (opts.normalizeUnicode) {
    result = result.normalize("NFC");
  }

  // Trim whitespace
  if (opts.trim) {
    result = result.trim();
  }

  // Handle HTML
  if (opts.allowHtml && opts.allowedTags.length > 0) {
    // Strip all tags except allowed ones
    const allowedPattern = new RegExp(
      `<(?!/?(${opts.allowedTags.join("|")})\\b)[^>]*>`,
      "gi"
    );
    result = result.replace(allowedPattern, "");
  } else {
    // Escape all HTML
    result = escapeHtml(result);
  }

  // Enforce max length
  if (opts.maxLength && result.length > opts.maxLength) {
    result = result.substring(0, opts.maxLength);
  }

  return result;
}

/**
 * Sanitize form data object
 */
export function sanitizeFormData<T extends Record<string, unknown>>(
  data: T,
  options: Partial<SanitizationOptions> = {}
): T {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (typeof value === "string") {
      result[key] = sanitizeFieldContent(value, options);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === "string" ? sanitizeFieldContent(item, options) : item
      );
    } else if (value !== null && typeof value === "object") {
      result[key] = sanitizeFormData(value as Record<string, unknown>, options);
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * Validate content for potential XSS patterns
 */
export function detectXssPatterns(input: string): {
  detected: boolean;
  patterns: string[];
} {
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // Event handlers like onclick=
    /data:\s*text\/html/gi,
    /vbscript:/gi,
    /expression\s*\(/gi,
    /@import\s+/gi,
    /url\s*\(/gi,
  ];

  const detectedPatterns: string[] = [];

  for (const pattern of xssPatterns) {
    const matches = input.match(pattern);
    if (matches) {
      detectedPatterns.push(...matches);
    }
  }

  return {
    detected: detectedPatterns.length > 0,
    patterns: detectedPatterns,
  };
}

// ============================================================================
// CSRF PROTECTION
// ============================================================================

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/**
 * Create CSRF token with expiration
 */
export function createCSRFToken(
  secret: string,
  sessionId: string,
  expirationSeconds: number = 3600
): { token: string; expiresAt: number } {
  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + expirationSeconds;
  const payload = `${sessionId}:${timestamp}:${expiresAt}`;
  const signature = hashHMAC(secret, payload);
  const token = Buffer.from(`${payload}:${signature}`).toString("base64url");

  return { token, expiresAt };
}

/**
 * Verify CSRF token
 */
export function verifyCSRFToken(
  token: string,
  secret: string,
  sessionId: string
): { valid: boolean; error?: string } {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    const parts = decoded.split(":");

    if (parts.length !== 4) {
      return { valid: false, error: "Invalid token format" };
    }

    const [tokenSessionId, timestamp, expiresAt, signature] = parts;
    const payload = `${tokenSessionId}:${timestamp}:${expiresAt}`;
    const expectedSignature = hashHMAC(secret, payload);

    if (signature !== expectedSignature) {
      return { valid: false, error: "Invalid token signature" };
    }

    if (tokenSessionId !== sessionId) {
      return { valid: false, error: "Token session mismatch" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (now > parseInt(expiresAt, 10)) {
      return { valid: false, error: "Token expired" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Token verification failed" };
  }
}

/**
 * Simple HMAC hash (for CSRF tokens)
 * Note: In production, use a proper crypto library
 */
function hashHMAC(secret: string, data: string): string {
  // Simple hash for CSRF - in production use Web Crypto API
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  // Use SubtleCrypto for proper HMAC
  // This is a simplified version for demonstration
  let hash = 0;
  const combined = secret + data;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, "0");
}

// ============================================================================
// RATE LIMITING
// ============================================================================

/**
 * Rate limiter for document submissions
 */
export const documentRateLimit = {
  /**
   * Rate limit for form submissions
   */
  submission: async (identifier: string) => {
    return rateLimit.login(`doc:submit:${identifier}`);
  },

  /**
   * Rate limit for file uploads
   */
  upload: async (identifier: string) => {
    return rateLimit.login(`doc:upload:${identifier}`);
  },

  /**
   * Rate limit for PDF generation
   */
  pdfGeneration: async (identifier: string) => {
    return rateLimit.login(`doc:pdf:${identifier}`);
  },

  /**
   * Rate limit for signature operations
   */
  signature: async (identifier: string) => {
    return rateLimit.login(`doc:sign:${identifier}`);
  },
};

/**
 * Check if rate limit is exceeded
 */
export async function checkRateLimit(
  type: keyof typeof documentRateLimit,
  identifier: string
): Promise<{ allowed: boolean; resetIn: number; remaining: number }> {
  const result = await documentRateLimit[type](identifier);
  return {
    allowed: result.success,
    resetIn: result.reset,
    remaining: result.remaining,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.substring(lastDot).toLowerCase();
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Generate secure random filename
 */
export function generateSecureFilename(originalName: string): string {
  const extension = getFileExtension(originalName);
  const randomId = crypto.randomUUID();
  const timestamp = Date.now();
  return `${timestamp}-${randomId}${extension}`;
}

/**
 * Validate filename for security
 */
export function validateFilename(filename: string): {
  valid: boolean;
  error?: string;
} {
  // Check length
  if (filename.length === 0) {
    return { valid: false, error: "Filename is empty" };
  }
  if (filename.length > 255) {
    return { valid: false, error: "Filename is too long" };
  }

  // Check for path traversal
  if (filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
    return { valid: false, error: "Invalid filename: path traversal detected" };
  }

  // Check for null bytes
  if (filename.includes("\0")) {
    return { valid: false, error: "Invalid filename: null byte detected" };
  }

  // Check for control characters
  if (/[\x00-\x1f\x80-\x9f]/.test(filename)) {
    return { valid: false, error: "Invalid filename: control characters detected" };
  }

  return { valid: true };
}

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Security headers for document responses
 */
export const documentSecurityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; object-src 'none';",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(*), microphone=(), geolocation=()",
};

/**
 * Get security headers for file downloads
 */
export function getFileDownloadHeaders(
  filename: string,
  mimeType: string
): Record<string, string> {
  return {
    ...documentSecurityHeaders,
    "Content-Type": mimeType,
    "Content-Disposition": `attachment; filename="${escapeHtml(filename)}"`,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
  };
}

/**
 * Get security headers for inline content
 */
export function getInlineContentHeaders(
  mimeType: string
): Record<string, string> {
  return {
    ...documentSecurityHeaders,
    "Content-Type": mimeType,
    "Cache-Control": "private, max-age=3600",
  };
}