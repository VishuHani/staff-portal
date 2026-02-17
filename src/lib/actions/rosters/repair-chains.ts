"use server";

import { prisma } from "@/lib/prisma";
import { RosterStatus } from "@prisma/client";
import { requireAuth } from "@/lib/rbac/access";
import { isAdmin } from "@/lib/rbac/permissions";

interface RepairResult {
  success: boolean;
  error?: string;
  repaired?: number;
  details?: Array<{
    chainId: string;
    activeVersionId: string;
    versionNumber: number;
    fixedCount: number;
  }>;
}

/**
 * Repairs corrupted isActive flags in roster chains.
 *
 * For each chain, ensures only the highest published version has isActive=true.
 * This fixes data integrity issues where multiple versions incorrectly have isActive=true.
 *
 * @returns RepairResult with count of repaired chains and details
 */
export async function repairChainActiveFlags(): Promise<RepairResult> {
  try {
    // Only admins can run this repair
    const user = await requireAuth();
    if (!(await isAdmin(user.id))) {
      return { success: false, error: "Only admins can run this repair" };
    }

    // Get all unique chainIds
    const chainsWithMultiple = await prisma.roster.groupBy({
      by: ["chainId"],
      where: { chainId: { not: null } },
      _count: { id: true },
    });

    const repairedChains: RepairResult["details"] = [];

    for (const chain of chainsWithMultiple) {
      const chainId = chain.chainId;
      if (!chainId) continue;

      // Find the version that SHOULD be active (highest versionNumber with status=PUBLISHED)
      const shouldBeActive = await prisma.roster.findFirst({
        where: { chainId, status: RosterStatus.PUBLISHED },
        orderBy: { versionNumber: "desc" },
        select: { id: true, versionNumber: true },
      });

      if (!shouldBeActive) {
        // No published version in chain - set all to isActive=false
        await prisma.roster.updateMany({
          where: { chainId },
          data: { isActive: false },
        });
        continue;
      }

      // Count how many are incorrectly active
      const incorrectlyActive = await prisma.roster.count({
        where: {
          chainId,
          isActive: true,
          id: { not: shouldBeActive.id },
        },
      });

      if (incorrectlyActive === 0) {
        // Check if the correct one is already active
        const correctOne = await prisma.roster.findUnique({
          where: { id: shouldBeActive.id },
          select: { isActive: true },
        });
        if (correctOne?.isActive) {
          // Already correct
          continue;
        }
      }

      // Fix: Set ALL versions in chain to isActive=false, then set only the correct one to true
      await prisma.$transaction([
        prisma.roster.updateMany({
          where: { chainId },
          data: { isActive: false },
        }),
        prisma.roster.update({
          where: { id: shouldBeActive.id },
          data: { isActive: true },
        }),
      ]);

      repairedChains.push({
        chainId,
        activeVersionId: shouldBeActive.id,
        versionNumber: shouldBeActive.versionNumber,
        fixedCount: incorrectlyActive + 1,
      });
    }

    return {
      success: true,
      repaired: repairedChains.length,
      details: repairedChains,
    };
  } catch (error) {
    console.error("Error repairing chain active flags:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to repair chains",
    };
  }
}

/**
 * Gets a diagnostic report of chain integrity issues.
 *
 * @returns List of chains with multiple active versions
 */
export async function diagnoseChainIntegrity(): Promise<{
  success: boolean;
  error?: string;
  issues?: Array<{
    chainId: string;
    activeCount: number;
    versions: Array<{
      id: string;
      versionNumber: number;
      status: string;
      isActive: boolean;
    }>;
  }>;
}> {
  try {
    const user = await requireAuth();
    if (!(await isAdmin(user.id))) {
      return { success: false, error: "Only admins can diagnose chain integrity" };
    }

    // Find chains with issues
    const chains = await prisma.roster.groupBy({
      by: ["chainId"],
      where: { chainId: { not: null } },
      _count: { id: true },
    });

    const issues: Array<{
      chainId: string;
      activeCount: number;
      versions: Array<{
        id: string;
        versionNumber: number;
        status: string;
        isActive: boolean;
      }>;
    }> = [];

    for (const chain of chains) {
      const chainId = chain.chainId;
      if (!chainId) continue;

      // Get all versions in this chain
      const versions = await prisma.roster.findMany({
        where: { chainId },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          isActive: true,
        },
        orderBy: { versionNumber: "desc" },
      });

      // Count active versions
      const activeCount = versions.filter((v) => v.isActive).length;

      // If more than one is active, or if none are active but there's a published version
      const hasPublished = versions.some((v) => v.status === RosterStatus.PUBLISHED);
      if (activeCount > 1 || (activeCount === 0 && hasPublished)) {
        issues.push({
          chainId,
          activeCount,
          versions: versions.map((v) => ({
            id: v.id,
            versionNumber: v.versionNumber,
            status: v.status,
            isActive: v.isActive,
          })),
        });
      }
    }

    return {
      success: true,
      issues,
    };
  } catch (error) {
    console.error("Error diagnosing chain integrity:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to diagnose chains",
    };
  }
}
