/**
 * Feature flags and rollout controls for V3 roster extraction
 * 
 * This module provides:
 * - Feature flag configuration
 * - Rollout percentage controls
 * - Venue/user targeting
 * - Fallback to legacy extraction path
 */

// ============================================================================
// TYPES
// ============================================================================

export type FeatureFlagStatus = "enabled" | "disabled" | "partial";

export interface ExtractionFeatureFlags {
  /** Master switch for V3 extraction */
  v3ExtractionEnabled: boolean;
  /** Percentage of users to receive V3 (0-100) */
  v3RolloutPercentage: number;
  /** Specific venues to enable V3 for (overrides percentage) */
  v3EnabledVenues: string[];
  /** Specific venues to disable V3 for (overrides enabled list) */
  v3DisabledVenues: string[];
  /** Enable V3 for specific user roles only */
  v3EnabledRoles: string[];
  /** Use legacy extraction as fallback on V3 errors */
  fallbackToLegacy: boolean;
  /** Log all feature flag decisions for debugging */
  debugLogging: boolean;
}

export interface FeatureFlagContext {
  userId: string;
  venueId: string;
  userRole: string;
}

export interface FeatureFlagResult {
  useV3: boolean;
  reason: string;
  fallbackAvailable: boolean;
}

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default feature flag configuration
 * In production, this would be loaded from a database or feature flag service
 */
let featureFlags: ExtractionFeatureFlags = {
  v3ExtractionEnabled: true,
  v3RolloutPercentage: 100, // 100% rollout
  v3EnabledVenues: [], // Empty = all venues
  v3DisabledVenues: [], // Empty = no venues disabled
  v3EnabledRoles: [], // Empty = all roles
  fallbackToLegacy: true,
  debugLogging: process.env.NODE_ENV === "development",
};

// ============================================================================
// FEATURE FLAG ACCESS
// ============================================================================

/**
 * Get current feature flag configuration
 */
export function getFeatureFlags(): ExtractionFeatureFlags {
  return { ...featureFlags };
}

/**
 * Update feature flag configuration
 * In production, this would persist to a database
 */
export function updateFeatureFlags(
  updates: Partial<ExtractionFeatureFlags>
): void {
  featureFlags = {
    ...featureFlags,
    ...updates,
  };

  if (featureFlags.debugLogging) {
    console.log("[FeatureFlags] Updated configuration:", featureFlags);
  }
}

/**
 * Reset feature flags to defaults
 */
export function resetFeatureFlags(): void {
  featureFlags = {
    v3ExtractionEnabled: true,
    v3RolloutPercentage: 100,
    v3EnabledVenues: [],
    v3DisabledVenues: [],
    v3EnabledRoles: [],
    fallbackToLegacy: true,
    debugLogging: process.env.NODE_ENV === "development",
  };
}

// ============================================================================
// FEATURE FLAG EVALUATION
// ============================================================================

/**
 * Determine if V3 extraction should be used for a given context
 */
export function shouldUseV3Extraction(
  context: FeatureFlagContext
): FeatureFlagResult {
  const flags = getFeatureFlags();

  // Master switch check
  if (!flags.v3ExtractionEnabled) {
    return {
      useV3: false,
      reason: "V3 extraction is globally disabled",
      fallbackAvailable: flags.fallbackToLegacy,
    };
  }

  // Disabled venues check (highest priority)
  if (flags.v3DisabledVenues.includes(context.venueId)) {
    return {
      useV3: false,
      reason: `Venue ${context.venueId} is in the disabled list`,
      fallbackAvailable: flags.fallbackToLegacy,
    };
  }

  // Enabled venues check (overrides percentage)
  if (
    flags.v3EnabledVenues.length > 0 &&
    flags.v3EnabledVenues.includes(context.venueId)
  ) {
    logDecision(context, true, "Venue is in the enabled list");
    return {
      useV3: true,
      reason: "Venue is in the V3 enabled list",
      fallbackAvailable: flags.fallbackToLegacy,
    };
  }

  // Role-based check
  if (
    flags.v3EnabledRoles.length > 0 &&
    !flags.v3EnabledRoles.includes(context.userRole)
  ) {
    return {
      useV3: false,
      reason: `Role ${context.userRole} is not in the enabled roles list`,
      fallbackAvailable: flags.fallbackToLegacy,
    };
  }

  // Percentage rollout check
  const userHash = hashString(`${context.userId}:${context.venueId}`);
  const userPercentage = (userHash % 100) + 1; // 1-100

  if (userPercentage <= flags.v3RolloutPercentage) {
    logDecision(context, true, `User in rollout (${userPercentage} <= ${flags.v3RolloutPercentage})`);
    return {
      useV3: true,
      reason: `User selected in ${flags.v3RolloutPercentage}% rollout`,
      fallbackAvailable: flags.fallbackToLegacy,
    };
  }

  return {
    useV3: false,
    reason: `User not selected in rollout (${userPercentage} > ${flags.v3RolloutPercentage})`,
    fallbackAvailable: flags.fallbackToLegacy,
  };
}

/**
 * Check if fallback to legacy is available
 */
export function isFallbackAvailable(): boolean {
  return getFeatureFlags().fallbackToLegacy;
}

/**
 * Check if debug logging is enabled
 */
export function isDebugLoggingEnabled(): boolean {
  return getFeatureFlags().debugLogging;
}

// ============================================================================
// ROLLOUT HELPERS
// ============================================================================

/**
 * Hash a string to a number (deterministic)
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Log a feature flag decision for debugging
 */
function logDecision(
  context: FeatureFlagContext,
  useV3: boolean,
  reason: string
): void {
  if (featureFlags.debugLogging) {
    console.log("[FeatureFlags] Decision:", {
      userId: context.userId.slice(0, 8) + "...",
      venueId: context.venueId.slice(0, 8) + "...",
      userRole: context.userRole,
      useV3,
      reason,
    });
  }
}

// ============================================================================
// ROLLOUT MANAGEMENT
// ============================================================================

/**
 * Gradually increase rollout percentage
 */
export function increaseRollout(increment: number = 10): number {
  const newPercentage = Math.min(
    100,
    featureFlags.v3RolloutPercentage + increment
  );
  updateFeatureFlags({ v3RolloutPercentage: newPercentage });
  return newPercentage;
}

/**
 * Gradually decrease rollout percentage
 */
export function decreaseRollout(decrement: number = 10): number {
  const newPercentage = Math.max(
    0,
    featureFlags.v3RolloutPercentage - decrement
  );
  updateFeatureFlags({ v3RolloutPercentage: newPercentage });
  return newPercentage;
}

/**
 * Enable V3 for a specific venue
 */
export function enableV3ForVenue(venueId: string): void {
  const enabled = [...featureFlags.v3EnabledVenues];
  if (!enabled.includes(venueId)) {
    enabled.push(venueId);
    updateFeatureFlags({ v3EnabledVenues: enabled });
  }

  // Remove from disabled list if present
  const disabled = featureFlags.v3DisabledVenues.filter((v) => v !== venueId);
  if (disabled.length !== featureFlags.v3DisabledVenues.length) {
    updateFeatureFlags({ v3DisabledVenues: disabled });
  }
}

/**
 * Disable V3 for a specific venue
 */
export function disableV3ForVenue(venueId: string): void {
  const disabled = [...featureFlags.v3DisabledVenues];
  if (!disabled.includes(venueId)) {
    disabled.push(venueId);
    updateFeatureFlags({ v3DisabledVenues: disabled });
  }

  // Remove from enabled list if present
  const enabled = featureFlags.v3EnabledVenues.filter((v) => v !== venueId);
  if (enabled.length !== featureFlags.v3EnabledVenues.length) {
    updateFeatureFlags({ v3EnabledVenues: enabled });
  }
}

/**
 * Enable V3 for a specific role
 */
export function enableV3ForRole(role: string): void {
  const enabled = [...featureFlags.v3EnabledRoles];
  if (!enabled.includes(role)) {
    enabled.push(role);
    updateFeatureFlags({ v3EnabledRoles: enabled });
  }
}

/**
 * Disable V3 for a specific role
 */
export function disableV3ForRole(role: string): void {
  const enabled = featureFlags.v3EnabledRoles.filter((r) => r !== role);
  if (enabled.length !== featureFlags.v3EnabledRoles.length) {
    updateFeatureFlags({ v3EnabledRoles: enabled });
  }
}

// ============================================================================
// ENVIRONMENT-BASED CONFIGURATION
// ============================================================================

/**
 * Load feature flags from environment variables
 */
export function loadFeatureFlagsFromEnv(): void {
  const envFlags: Partial<ExtractionFeatureFlags> = {};

  if (process.env.V3_EXTRACTION_ENABLED !== undefined) {
    envFlags.v3ExtractionEnabled = process.env.V3_EXTRACTION_ENABLED === "true";
  }

  if (process.env.V3_ROLLOUT_PERCENTAGE !== undefined) {
    const percentage = parseInt(process.env.V3_ROLLOUT_PERCENTAGE, 10);
    if (!Number.isNaN(percentage) && percentage >= 0 && percentage <= 100) {
      envFlags.v3RolloutPercentage = percentage;
    }
  }

  if (process.env.V3_FALLBACK_TO_LEGACY !== undefined) {
    envFlags.fallbackToLegacy = process.env.V3_FALLBACK_TO_LEGACY === "true";
  }

  if (process.env.V3_DEBUG_LOGGING !== undefined) {
    envFlags.debugLogging = process.env.V3_DEBUG_LOGGING === "true";
  }

  if (Object.keys(envFlags).length > 0) {
    updateFeatureFlags(envFlags);
    console.log("[FeatureFlags] Loaded from environment:", envFlags);
  }
}

// Initialize from environment on module load
if (typeof process !== "undefined" && process.env) {
  loadFeatureFlagsFromEnv();
}

// ============================================================================
// EXPORTS
// ============================================================================

export const FEATURE_FLAGS = {
  /** Feature flag key for V3 extraction */
  V3_EXTRACTION: "v3_extraction",
  /** Feature flag key for V3 preview */
  V3_PREVIEW: "v3_preview",
  /** Feature flag key for V3 matching engine */
  V3_MATCHING: "v3_matching",
  /** Feature flag key for V3 validation */
  V3_VALIDATION: "v3_validation",
} as const;
