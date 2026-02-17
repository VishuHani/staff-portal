/**
 * RBAC Module - Ultra-Granular Permission System
 *
 * This module provides comprehensive access control with:
 * - Resource-level permissions
 * - Action-level permissions
 * - Field-level permissions
 * - Conditional permissions
 * - Time-based access
 * - Venue-scoped permissions
 */

// Core permissions
export * from "./permissions";

// Access helpers (canAccess, requireAuth, etc.)
// Note: access.ts already re-exports from advanced-permissions.ts
export * from "./access";

// Field-level permissions (new enhanced version)
export {
  getAccessibleFields,
  filterAccessibleFields,
  isSensitiveField,
  validateFieldAccess,
  getFieldPermissionSummary,
  type FieldPermissionContext,
} from "./field-permissions";

// Conditional permissions (new enhanced version)
export {
  evaluateConditionalPermission,
  createConditionalPermissionRule,
  deleteConditionalPermissionRule,
  getRoleConditionalRules,
  type ConditionType,
  type ConditionDefinition,
  type ConditionalPermissionRule,
  type PermissionEvaluationContext,
  type EvaluationResult,
} from "./conditional-permissions";

// Time-based access (new enhanced version)
export {
  checkTimeBasedAccess,
  createTimeBasedAccessRule,
  deleteTimeBasedAccessRule,
  getRoleTimeBasedRules,
  getAccessStatus,
  type TimeBasedAccessRule,
  type TimeCheckResult,
} from "./time-based-access";
