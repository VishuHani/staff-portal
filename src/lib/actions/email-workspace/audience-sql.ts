"use server";

import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import {
  DEFAULT_ALLOWED_AUDIENCE_SOURCES,
  validateAudienceSql,
  type SqlValidationResult,
} from "@/lib/email-workspace/sql-guard";

export interface ValidateAudienceSqlInput {
  sql: string;
}

export interface ValidateAudienceSqlOutput {
  success: boolean;
  validation?: SqlValidationResult;
  error?: string;
}

export async function validateAudienceSqlInput(
  input: ValidateAudienceSqlInput
): Promise<ValidateAudienceSqlOutput> {
  try {
    const user = await requireAuth();

    if (!(await canAccessEmailModule(user.id, "audience"))) {
      return {
        success: false,
        error: "You don't have permission to validate audience SQL.",
      };
    }

    const validation = validateAudienceSql(input.sql, DEFAULT_ALLOWED_AUDIENCE_SOURCES);

    return {
      success: true,
      validation,
    };
  } catch (error) {
    console.error("Error validating audience SQL:", error);
    return {
      success: false,
      error: "Failed to validate audience SQL.",
    };
  }
}
