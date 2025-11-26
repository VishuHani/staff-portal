// ============================================================================
// Standardized Action Result Types (Phase 3 Security - Nov 2025)
// ============================================================================

/**
 * Error codes for standardized error responses
 * Use these codes to identify error types consistently across the application
 */
export type ActionErrorCode =
  | "UNAUTHORIZED"           // User not authenticated
  | "FORBIDDEN"              // User lacks permission
  | "NOT_FOUND"              // Resource not found
  | "VALIDATION_ERROR"       // Input validation failed
  | "CONFLICT"               // Resource conflict (duplicate, etc.)
  | "RATE_LIMITED"           // Too many requests
  | "DATABASE_ERROR"         // Database operation failed
  | "EXTERNAL_SERVICE_ERROR" // Third-party service failed
  | "INTERNAL_ERROR";        // Unexpected server error

/**
 * Success result type with optional data
 */
export type ActionSuccess<T = void> = T extends void
  ? { success: true }
  : { success: true; data: T };

/**
 * Error result type with standardized structure
 */
export type ActionError = {
  success: false;
  error: string;
  code?: ActionErrorCode;
  details?: Record<string, string[]>; // Field-level validation errors
};

/**
 * Discriminated union for action results
 * Use this type for all server action return types
 *
 * @example
 * // For actions that return data:
 * async function getUser(id: string): Promise<ActionResult<User>> {
 *   const user = await prisma.user.findUnique({ where: { id } });
 *   if (!user) return actionError("User not found", "NOT_FOUND");
 *   return actionSuccess(user);
 * }
 *
 * // For actions that don't return data:
 * async function deleteUser(id: string): Promise<ActionResult> {
 *   await prisma.user.delete({ where: { id } });
 *   return actionSuccess();
 * }
 */
export type ActionResult<T = void> = ActionSuccess<T> | ActionError;

/**
 * Helper to create a success result
 */
export function actionSuccess(): ActionSuccess<void>;
export function actionSuccess<T>(data: T): ActionSuccess<T>;
export function actionSuccess<T>(data?: T): ActionSuccess<T> | ActionSuccess<void> {
  if (data === undefined) {
    return { success: true };
  }
  return { success: true, data };
}

/**
 * Helper to create an error result
 */
export function actionError(
  error: string,
  code?: ActionErrorCode,
  details?: Record<string, string[]>
): ActionError {
  return {
    success: false,
    error,
    ...(code && { code }),
    ...(details && { details }),
  };
}

/**
 * Type guard to check if result is an error
 */
export function isActionError<T>(result: ActionResult<T>): result is ActionError {
  return !result.success;
}

/**
 * Type guard to check if result is a success
 */
export function isActionSuccess<T>(result: ActionResult<T>): result is ActionSuccess<T> {
  return result.success;
}

// ============================================================================
// Core Types
// ============================================================================

export type UserRole = "ADMIN" | "MANAGER" | "STAFF";

export type TimeOffStatus = "PENDING" | "APPROVED" | "REJECTED";

export type TimeOffType = "VACATION" | "SICK" | "PERSONAL" | "OTHER";

export type ChannelType = "ALL_STAFF" | "MANAGERS" | "CUSTOM";

export type ConversationType = "ONE_ON_ONE" | "GROUP";

// Permission Types
export type PermissionResource =
  | "availability"
  | "time_off"
  | "posts"
  | "messages"
  | "admin"
  | "users"
  | "roles";

export type PermissionAction =
  | "view_own"
  | "edit_own"
  | "view_team"
  | "edit_team"
  | "create"
  | "approve"
  | "moderate"
  | "manage";
