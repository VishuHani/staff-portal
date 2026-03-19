import { getCurrentUser } from "@/lib/actions/auth";
import { repairChainActiveFlags, diagnoseChainIntegrity } from "@/lib/actions/rosters";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

/**
 * GET /api/admin/repair-roster-chains
 * Diagnose chain integrity issues (shows chains with multiple active versions)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role.name !== "ADMIN") {
      return apiError("Unauthorized", 403);
    }

    const result = await diagnoseChainIntegrity();

    if (!result.success) {
      return apiError(result.error || "Failed to diagnose chain integrity");
    }

    return apiSuccess({
      issueCount: result.issues?.length || 0,
      issues: result.issues,
    });
  } catch (error) {
    console.error("Error diagnosing chain integrity:", error);
    return apiError("Failed to diagnose chain integrity");
  }
}

/**
 * POST /api/admin/repair-roster-chains
 * Repair corrupted isActive flags in roster chains
 */
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role.name !== "ADMIN") {
      return apiError("Unauthorized", 403);
    }

    const result = await repairChainActiveFlags();

    if (!result.success) {
      return apiError(result.error || "Failed to repair chains");
    }

    return apiSuccess({
      repairedCount: result.repaired,
      details: result.details,
      message: result.repaired
        ? `Repaired ${result.repaired} chain(s) with corrupted isActive flags`
        : "No chains needed repair - all chains are healthy",
    });
  } catch (error) {
    console.error("Error repairing chain active flags:", error);
    return apiError("Failed to repair chains");
  }
}
