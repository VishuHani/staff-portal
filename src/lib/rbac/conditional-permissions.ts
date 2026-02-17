/**
 * ============================================================================
 * CONDITIONAL PERMISSION SYSTEM
 * ============================================================================
 *
 * This module provides context-based permission evaluation where access
 * depends on dynamic conditions beyond simple role checks.
 *
 * Features:
 * - Venue matching: Only access resources at user's venue
 * - Status checks: Only access resources with certain status
 * - Ownership checks: Only access own records
 * - Time-based conditions: Only access during certain times
 * - Custom conditions: Extensible condition system
 *
 * Usage:
 *   const result = await evaluateConditionalPermission(userId, 'rosters', 'edit', {
 *     venueId: 'venue-123',
 *     status: 'DRAFT',
 *   });
 */

import { prisma } from "@/lib/prisma";
import { isAdmin, hasPermission } from "./permissions";

/**
 * Condition types for permission evaluation
 */
export type ConditionType =
  | "venue_match"      // Resource must be at user's venue
  | "status_in"        // Resource status must be in allowed list
  | "status_not_in"    // Resource status must NOT be in list
  | "own_record"       // User must be the owner/creator
  | "not_own_record"   // User must NOT be the owner (e.g., approve own timeoff)
  | "time_range"       // Current time must be within range
  | "day_of_week"      // Current day must be in allowed list
  | "resource_field"   // Custom field comparison
  | "user_attribute"   // User attribute comparison
  | "venue_role"       // User must have specific role at venue
  | "approval_chain"   // User must be in approval chain
  | "custom";          // Custom condition function

/**
 * Condition definition
 */
export interface ConditionDefinition {
  type: ConditionType;
  value?: unknown;
  field?: string;
  operator?: "eq" | "ne" | "in" | "not_in" | "gt" | "lt" | "gte" | "lte";
}

/**
 * Conditional permission rule
 */
export interface ConditionalPermissionRule {
  resource: string;
  action: string;
  conditions: ConditionDefinition[];
  requireAll?: boolean; // If true, ALL conditions must pass; if false, ANY condition passes
}

/**
 * Permission evaluation context
 */
export interface PermissionEvaluationContext {
  userId: string;
  resource: string;
  action: string;
  resourceId?: string;
  resourceData?: Record<string, unknown>;
  venueId?: string;
}

/**
 * Evaluation result
 */
export interface EvaluationResult {
  allowed: boolean;
  reason?: string;
  failedConditions?: string[];
  passedConditions?: string[];
}

/**
 * Predefined conditional permission rules
 * These are the default rules that apply unless overridden
 */
export const DEFAULT_CONDITIONAL_RULES: ConditionalPermissionRule[] = [
  // Roster editing: Only draft or pending_review rosters can be edited
  {
    resource: "rosters",
    action: "edit",
    conditions: [
      { type: "status_in", value: ["DRAFT", "PENDING_REVIEW"] },
    ],
    requireAll: true,
  },
  // Roster publishing: Only approved rosters can be published
  {
    resource: "rosters",
    action: "publish",
    conditions: [
      { type: "status_in", value: ["APPROVED"] },
    ],
    requireAll: true,
  },
  // Time-off approval: Cannot approve own request
  {
    resource: "timeoff",
    action: "approve",
    conditions: [
      { type: "not_own_record", field: "userId" },
    ],
    requireAll: true,
  },
  // Time-off cancellation: Only pending requests can be cancelled by staff
  {
    resource: "timeoff",
    action: "cancel",
    conditions: [
      { type: "status_in", value: ["PENDING"] },
      { type: "own_record", field: "userId" },
    ],
    requireAll: true,
  },
  // User editing: Managers can only edit users at their venue
  {
    resource: "users",
    action: "edit_team",
    conditions: [
      { type: "venue_match" },
    ],
    requireAll: true,
  },
  // Post moderation: Can only moderate posts in accessible channels
  {
    resource: "posts",
    action: "moderate",
    conditions: [
      { type: "venue_match" },
    ],
    requireAll: true,
  },
];

/**
 * Evaluate conditional permission
 *
 * @param context - Permission evaluation context
 * @returns Evaluation result with details
 */
export async function evaluateConditionalPermission(
  context: PermissionEvaluationContext
): Promise<EvaluationResult> {
  const { userId, resource, action, resourceId, resourceData, venueId } = context;

  try {
    // Admin bypasses all conditional checks
    if (await isAdmin(userId)) {
      return {
        allowed: true,
        passedConditions: ["admin_bypass"],
      };
    }

    // First check base permission
    const hasBasePermission = await hasPermission(userId, resource as any, action as any, venueId);
    if (!hasBasePermission) {
      return {
        allowed: false,
        reason: `No base permission for ${resource}:${action}`,
        failedConditions: ["base_permission"],
      };
    }

    // Get applicable rules
    const rules = await getApplicableRules(userId, resource, action);

    // If no rules, permission is granted based on base permission
    if (rules.length === 0) {
      return {
        allowed: true,
        passedConditions: ["no_conditional_rules"],
      };
    }

    // Fetch resource data if needed and not provided
    let data = resourceData;
    if (!data && resourceId) {
      data = await fetchResourceData(resource, resourceId);
    }

    // Evaluate each rule
    const results: EvaluationResult[] = [];

    for (const rule of rules) {
      const result = await evaluateRule(rule, userId, data, venueId);
      results.push(result);
    }

    // If ANY rule passes, permission is granted
    const anyPassed = results.some((r) => r.allowed);

    // Aggregate results
    const allFailedConditions = results.flatMap((r) => r.failedConditions || []);
    const allPassedConditions = results.flatMap((r) => r.passedConditions || []);

    return {
      allowed: anyPassed,
      reason: anyPassed
        ? undefined
        : `Conditions not met: ${allFailedConditions.join(", ")}`,
      failedConditions: anyPassed ? undefined : allFailedConditions,
      passedConditions: anyPassed ? allPassedConditions : undefined,
    };
  } catch (error) {
    console.error("Error evaluating conditional permission:", error);
    return {
      allowed: false,
      reason: "Error evaluating permissions",
      failedConditions: ["evaluation_error"],
    };
  }
}

/**
 * Get applicable conditional permission rules
 *
 * @param userId - User ID
 * @param resource - Resource name
 * @param action - Action name
 * @returns Array of applicable rules
 */
async function getApplicableRules(
  userId: string,
  resource: string,
  action: string
): Promise<ConditionalPermissionRule[]> {
  // Get user's role for database lookup
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleId: true },
  });

  if (!user) {
    return [];
  }

  // Get database-stored conditional permissions
  const dbRules = await prisma.conditionalPermission.findMany({
    where: {
      roleId: user.roleId,
      resource,
      action,
    },
  });

  // Convert database rules to our format
  const customRules: ConditionalPermissionRule[] = dbRules.map((rule) => ({
    resource: rule.resource,
    action: rule.action,
    conditions: rule.conditions as unknown as ConditionDefinition[],
    requireAll: true,
  }));

  // Merge with default rules (custom rules take precedence)
  const defaultRules = DEFAULT_CONDITIONAL_RULES.filter(
    (r) => r.resource === resource && r.action === action
  );

  return [...customRules, ...defaultRules];
}

/**
 * Evaluate a single rule
 *
 * @param rule - Rule to evaluate
 * @param userId - User ID
 * @param resourceData - Resource data
 * @param venueId - Venue ID
 * @returns Evaluation result
 */
async function evaluateRule(
  rule: ConditionalPermissionRule,
  userId: string,
  resourceData?: Record<string, unknown>,
  venueId?: string
): Promise<EvaluationResult> {
  const passedConditions: string[] = [];
  const failedConditions: string[] = [];

  for (const condition of rule.conditions) {
    const result = await evaluateCondition(condition, userId, resourceData, venueId);

    if (result.passed) {
      passedConditions.push(condition.type);
    } else {
      failedConditions.push(condition.type);
    }
  }

  const allPassed = failedConditions.length === 0;
  const anyPassed = passedConditions.length > 0;

  // If requireAll is true, all conditions must pass
  // If requireAll is false, any condition passing is enough
  const allowed = rule.requireAll ? allPassed : anyPassed;

  return {
    allowed,
    reason: allowed ? undefined : `Failed conditions: ${failedConditions.join(", ")}`,
    passedConditions: allowed ? passedConditions : undefined,
    failedConditions: allowed ? undefined : failedConditions,
  };
}

/**
 * Evaluate a single condition
 *
 * @param condition - Condition to evaluate
 * @param userId - User ID
 * @param resourceData - Resource data
 * @param venueId - Venue ID
 * @returns Whether condition passed
 */
async function evaluateCondition(
  condition: ConditionDefinition,
  userId: string,
  resourceData?: Record<string, unknown>,
  venueId?: string
): Promise<{ passed: boolean; reason?: string }> {
  try {
    switch (condition.type) {
      case "venue_match": {
        if (!venueId || !resourceData) {
          return { passed: false, reason: "Missing venue context" };
        }

        // Get user's venues
        const userVenues = await prisma.userVenue.findMany({
          where: { userId },
          select: { venueId: true },
        });
        const userVenueIds = userVenues.map((uv) => uv.venueId);

        // Check if resource venue matches user's venue
        const resourceVenueId = resourceData.venueId as string | undefined;
        const matches = resourceVenueId && userVenueIds.includes(resourceVenueId);

        return {
          passed: matches || false,
          reason: matches ? undefined : "Resource not at user's venue",
        };
      }

      case "status_in": {
        if (!resourceData || !condition.value) {
          return { passed: false, reason: "Missing status data" };
        }

        const allowedStatuses = condition.value as string[];
        const resourceStatus = resourceData.status as string | undefined;
        const matches = resourceStatus && allowedStatuses.includes(resourceStatus);

        return {
          passed: matches || false,
          reason: matches ? undefined : `Status ${resourceStatus} not in allowed list`,
        };
      }

      case "status_not_in": {
        if (!resourceData || !condition.value) {
          return { passed: false, reason: "Missing status data" };
        }

        const disallowedStatuses = condition.value as string[];
        const resourceStatus = resourceData.status as string | undefined;
        const matches = resourceStatus && !disallowedStatuses.includes(resourceStatus);

        return {
          passed: matches || false,
          reason: matches ? undefined : `Status ${resourceStatus} is disallowed`,
        };
      }

      case "own_record": {
        if (!resourceData || !condition.field) {
          return { passed: false, reason: "Missing ownership data" };
        }

        const ownerField = condition.field;
        const ownerId = resourceData[ownerField] as string | undefined;
        const isOwn = ownerId === userId;

        return {
          passed: isOwn,
          reason: isOwn ? undefined : "Not own record",
        };
      }

      case "not_own_record": {
        if (!resourceData || !condition.field) {
          return { passed: false, reason: "Missing ownership data" };
        }

        const ownerField = condition.field;
        const ownerId = resourceData[ownerField] as string | undefined;
        const isNotOwn = ownerId !== userId;

        return {
          passed: isNotOwn,
          reason: isNotOwn ? undefined : "Cannot perform action on own record",
        };
      }

      case "resource_field": {
        if (!resourceData || !condition.field) {
          return { passed: false, reason: "Missing field data" };
        }

        const fieldValue = resourceData[condition.field];
        const operator = condition.operator || "eq";
        const targetValue = condition.value;

        const matches = compareValues(fieldValue, operator, targetValue);

        return {
          passed: matches,
          reason: matches ? undefined : `Field ${condition.field} comparison failed`,
        };
      }

      case "user_attribute": {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { [condition.field || "id"]: true },
        });

        if (!user) {
          return { passed: false, reason: "User not found" };
        }

        const fieldValue = user[condition.field || "id"];
        const operator = condition.operator || "eq";
        const matches = compareValues(fieldValue, operator, condition.value);

        return {
          passed: matches,
          reason: matches ? undefined : `User attribute ${condition.field} check failed`,
        };
      }

      case "venue_role": {
        if (!venueId) {
          return { passed: false, reason: "Missing venue context" };
        }

        // Check if user has specific role at venue
        const venuePermission = await prisma.userVenuePermission.findFirst({
          where: {
            userId,
            venueId,
            permission: {
              resource: condition.value as string,
            },
          },
        });

        return {
          passed: !!venuePermission,
          reason: venuePermission ? undefined : "No venue-specific role",
        };
      }

      case "time_range":
      case "day_of_week": {
        // These are handled by TimeBasedAccess module
        // Import and use that module for time-based checks
        const { checkTimeBasedAccess } = await import("@/lib/rbac/time-based-access");
        const result = await checkTimeBasedAccess(userId, condition);

        return result;
      }

      case "custom": {
        // Custom conditions would be implemented as needed
        return { passed: true, reason: "Custom condition not implemented" };
      }

      default:
        return { passed: false, reason: `Unknown condition type: ${condition.type}` };
    }
  } catch (error) {
    console.error("Error evaluating condition:", error);
    return { passed: false, reason: "Condition evaluation error" };
  }
}

/**
 * Compare values using operator
 */
function compareValues(
  fieldValue: unknown,
  operator: string,
  targetValue: unknown
): boolean {
  switch (operator) {
    case "eq":
      return fieldValue === targetValue;
    case "ne":
      return fieldValue !== targetValue;
    case "in":
      return Array.isArray(targetValue) && targetValue.includes(fieldValue as string);
    case "not_in":
      return Array.isArray(targetValue) && !targetValue.includes(fieldValue as string);
    case "gt":
      return typeof fieldValue === "number" && typeof targetValue === "number" && fieldValue > targetValue;
    case "lt":
      return typeof fieldValue === "number" && typeof targetValue === "number" && fieldValue < targetValue;
    case "gte":
      return typeof fieldValue === "number" && typeof targetValue === "number" && fieldValue >= targetValue;
    case "lte":
      return typeof fieldValue === "number" && typeof targetValue === "number" && fieldValue <= targetValue;
    default:
      return false;
  }
}

/**
 * Fetch resource data from database
 *
 * @param resource - Resource type
 * @param resourceId - Resource ID
 * @returns Resource data
 */
async function fetchResourceData(
  resource: string,
  resourceId: string
): Promise<Record<string, unknown> | undefined> {
  try {
    switch (resource) {
      case "rosters":
        return await prisma.roster.findUnique({
          where: { id: resourceId },
          select: {
            id: true,
            status: true,
            venueId: true,
            createdBy: true,
          },
        }) as unknown as Record<string, unknown>;

      case "timeoff":
        return await prisma.timeOffRequest.findUnique({
          where: { id: resourceId },
          select: {
            id: true,
            status: true,
            userId: true,
            reviewedBy: true,
          },
        }) as unknown as Record<string, unknown>;

      case "users":
        return await prisma.user.findUnique({
          where: { id: resourceId },
          select: {
            id: true,
            venueId: true,
            roleId: true,
            active: true,
          },
        }) as unknown as Record<string, unknown>;

      case "posts":
        return await prisma.post.findUnique({
          where: { id: resourceId },
          select: {
            id: true,
            authorId: true,
            channelId: true,
          },
        }) as unknown as Record<string, unknown>;

      default:
        return undefined;
    }
  } catch (error) {
    console.error(`Error fetching ${resource} data:`, error);
    return undefined;
  }
}

/**
 * Create a conditional permission rule
 *
 * @param roleId - Role ID
 * @param rule - Rule to create
 * @returns Created rule
 */
export async function createConditionalPermissionRule(
  roleId: string,
  rule: ConditionalPermissionRule
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.conditionalPermission.create({
      data: {
        roleId,
        resource: rule.resource,
        action: rule.action,
        conditions: rule.conditions as any,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error creating conditional permission:", error);
    return { success: false, error: "Failed to create conditional permission" };
  }
}

/**
 * Delete a conditional permission rule
 *
 * @param ruleId - Rule ID to delete
 * @returns Success status
 */
export async function deleteConditionalPermissionRule(
  ruleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await prisma.conditionalPermission.delete({
      where: { id: ruleId },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting conditional permission:", error);
    return { success: false, error: "Failed to delete conditional permission" };
  }
}

/**
 * Get all conditional permission rules for a role
 *
 * @param roleId - Role ID
 * @returns Array of rules
 */
export async function getRoleConditionalRules(
  roleId: string
): Promise<ConditionalPermissionRule[]> {
  try {
    const rules = await prisma.conditionalPermission.findMany({
      where: { roleId },
    });

    return rules.map((rule) => ({
      resource: rule.resource,
      action: rule.action,
      conditions: rule.conditions as unknown as ConditionDefinition[],
      requireAll: true,
    }));
  } catch (error) {
    console.error("Error getting conditional rules:", error);
    return [];
  }
}