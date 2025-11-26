/**
 * Centralized Configuration - Phase 4 Code Quality (Nov 2025)
 *
 * This file centralizes all configuration values including:
 * - Environment variables with validation
 * - Application constants
 * - Feature flags
 * - Limits and thresholds
 *
 * Usage:
 * ```ts
 * import { config } from "@/lib/config";
 * const url = config.supabase.url;
 * const maxFileSize = config.limits.maxFileSize;
 * ```
 */

// ============================================================================
// Environment Variable Helpers
// ============================================================================

/**
 * Get required environment variable or throw
 */
function getRequired(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get optional environment variable with default
 */
function getOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Get boolean environment variable
 */
function getBoolean(key: string, defaultValue: boolean): boolean {
  const value = process.env[key];
  if (!value) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

/**
 * Get numeric environment variable
 */
function getNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// ============================================================================
// Environment Configuration
// ============================================================================

/**
 * Environment-based configuration
 * These values come from environment variables
 */
export const env = {
  /** Current environment */
  nodeEnv: getOptional("NODE_ENV", "development"),

  /** Is production environment */
  isProduction: process.env.NODE_ENV === "production",

  /** Is development environment */
  isDevelopment: process.env.NODE_ENV !== "production",

  // Supabase
  supabase: {
    url: getOptional("NEXT_PUBLIC_SUPABASE_URL", ""),
    anonKey: getOptional("NEXT_PUBLIC_SUPABASE_ANON_KEY", ""),
    serviceRoleKey: getOptional("SUPABASE_SERVICE_ROLE_KEY", ""),
  },

  // App URLs
  app: {
    url: getOptional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  },

  // Email (Brevo)
  email: {
    apiKey: getOptional("BREVO_API_KEY", ""),
    senderEmail: getOptional("BREVO_SENDER_EMAIL", "noreply@example.com"),
    senderName: getOptional("BREVO_SENDER_NAME", "Staff Portal"),
    adminAlertEmail: getOptional("ADMIN_ALERT_EMAIL", ""),
  },

  // AI Services
  ai: {
    openaiApiKey: getOptional("OPENAI_API_KEY", ""),
  },

  // Rate Limiting (Upstash)
  rateLimit: {
    redisUrl: getOptional("UPSTASH_REDIS_REST_URL", ""),
    redisToken: getOptional("UPSTASH_REDIS_REST_TOKEN", ""),
  },
} as const;

// ============================================================================
// Application Constants
// ============================================================================

/**
 * Application-wide constants
 * These are fixed values that don't change based on environment
 */
export const constants = {
  // App Info
  appName: "Staff Portal",
  appVersion: "0.1.0",

  // Pagination defaults
  pagination: {
    defaultLimit: 50,
    maxLimit: 100,
    defaultOffset: 0,
  },

  // Content limits
  content: {
    maxPostLength: 2000,
    maxCommentLength: 500,
    maxMessageLength: 2000,
    maxConversationNameLength: 100,
    maxMediaFiles: 4,
    maxParticipants: 50,
  },

  // File upload limits
  files: {
    maxFileSize: 5 * 1024 * 1024, // 5MB
    maxUserStorage: 100 * 1024 * 1024, // 100MB
    allowedImageTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    allowedVideoTypes: ["video/mp4", "video/webm"],
  },

  // Rate limiting thresholds
  rateLimiting: {
    login: {
      maxAttempts: 5,
      windowMinutes: 15,
    },
    signup: {
      maxAttempts: 3,
      windowMinutes: 60,
    },
    passwordReset: {
      maxAttempts: 3,
      windowMinutes: 60,
    },
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelayMs: 100,
    backoffMultiplier: 2,
  },

  // Cache durations (in seconds)
  cache: {
    reportCache: 300, // 5 minutes
    notificationDebounce: 300, // 5 minutes
    messageEditWindow: 900, // 15 minutes
  },

  // Business defaults
  business: {
    defaultBusinessHoursStart: "08:00",
    defaultBusinessHoursEnd: "22:00",
    defaultOperatingDays: [1, 2, 3, 4, 5], // Mon-Fri
    suggestionLimit: 10,
  },

  // Roles
  roles: {
    admin: "ADMIN",
    manager: "MANAGER",
    staff: "STAFF",
  } as const,

  // Channel types
  channelTypes: {
    general: "GENERAL",
    announcements: "ANNOUNCEMENTS",
    social: "SOCIAL",
  } as const,

  // Time-off statuses
  timeOffStatuses: {
    pending: "PENDING",
    approved: "APPROVED",
    rejected: "REJECTED",
  } as const,

  // Time-off types
  timeOffTypes: {
    vacation: "VACATION",
    sick: "SICK",
    personal: "PERSONAL",
    other: "OTHER",
  } as const,
} as const;

// ============================================================================
// Feature Flags
// ============================================================================

/**
 * Feature flags for gradual rollout
 */
export const features = {
  /** AI-powered suggestions enabled */
  aiSuggestions: getBoolean("FEATURE_AI_SUGGESTIONS", true),

  /** Email notifications enabled */
  emailNotifications: getBoolean("FEATURE_EMAIL_NOTIFICATIONS", true),

  /** Rate limiting enabled */
  rateLimiting: getBoolean("FEATURE_RATE_LIMITING", true),

  /** Audit log file backup enabled */
  auditLogBackup: getBoolean("FEATURE_AUDIT_BACKUP", true),

  /** Real-time updates enabled (placeholder for Supabase Realtime) */
  realTimeUpdates: getBoolean("FEATURE_REALTIME", false),
} as const;

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate required configuration on startup
 * Call this in your app initialization
 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required Supabase config
  if (!env.supabase.url) {
    errors.push("NEXT_PUBLIC_SUPABASE_URL is required");
  }
  if (!env.supabase.anonKey) {
    errors.push("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }

  // Warn about optional but recommended config
  if (!env.email.apiKey && env.isProduction) {
    console.warn("⚠️ BREVO_API_KEY not set - email notifications disabled");
  }
  if (!env.ai.openaiApiKey && features.aiSuggestions) {
    console.warn("⚠️ OPENAI_API_KEY not set - AI features disabled");
  }
  if (!env.rateLimit.redisUrl && env.isProduction) {
    console.warn("⚠️ UPSTASH_REDIS_REST_URL not set - using in-memory rate limiting");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// Combined Config Export
// ============================================================================

/**
 * Main configuration object
 * Use this for accessing all configuration
 */
export const config = {
  env,
  constants,
  features,
  validate: validateConfig,
} as const;

// Type exports for external use
export type Config = typeof config;
export type Env = typeof env;
export type Constants = typeof constants;
export type Features = typeof features;
