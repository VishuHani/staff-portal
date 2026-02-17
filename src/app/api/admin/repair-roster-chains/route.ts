import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth";
import { repairChainActiveFlags, diagnoseChainIntegrity } from "@/lib/actions/rosters";

/**
 * GET /api/admin/repair-roster-chains
 * Diagnose chain integrity issues (shows chains with multiple active versions)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role.name !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await diagnoseChainIntegrity();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      issueCount: result.issues?.length || 0,
      issues: result.issues,
    });
  } catch (error) {
    console.error("Error diagnosing chain integrity:", error);
    return NextResponse.json(
      { error: "Failed to diagnose chain integrity" },
      { status: 500 }
    );
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
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const result = await repairChainActiveFlags();

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      repairedCount: result.repaired,
      details: result.details,
      message: result.repaired
        ? `Repaired ${result.repaired} chain(s) with corrupted isActive flags`
        : "No chains needed repair - all chains are healthy",
    });
  } catch (error) {
    console.error("Error repairing chain active flags:", error);
    return NextResponse.json(
      { error: "Failed to repair chains" },
      { status: 500 }
    );
  }
}
