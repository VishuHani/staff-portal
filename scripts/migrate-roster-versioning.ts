/**
 * Migration Script: Parent/Child Rosters to Chain-Based Versioning
 *
 * This script migrates existing rosters that use the parentId/childVersions
 * relationship to the new chain-based versioning system.
 *
 * What it does:
 * 1. Finds all rosters with parent/child relationships
 * 2. Groups them into version chains
 * 3. Assigns chainId, versionNumber, and isActive
 * 4. Updates the database
 *
 * Run with: npx tsx scripts/migrate-roster-versioning.ts
 */

import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

interface RosterWithRelations {
  id: string;
  name: string;
  venueId: string;
  startDate: Date;
  status: string;
  parentId: string | null;
  chainId: string | null;
  versionNumber: number;
  isActive: boolean;
  createdAt: Date;
}

interface VersionChain {
  chainId: string;
  rosters: RosterWithRelations[];
}

function generateChainId(venueId: string, weekStart: Date): string {
  const weekKey = weekStart.toISOString().split("T")[0];
  const hash = crypto.createHash("sha256");
  hash.update(`${venueId}-${weekKey}`);
  return `chain_${hash.digest("hex").substring(0, 16)}`;
}

async function migrateRosterVersioning() {
  console.log("=".repeat(60));
  console.log("Roster Versioning Migration");
  console.log("=".repeat(60));
  console.log("");

  // Step 1: Find all rosters with parent/child relationships
  console.log("Step 1: Finding rosters with parent/child relationships...");

  const rostersWithParent = await prisma.roster.findMany({
    where: {
      OR: [
        { parentId: { not: null } },
        { childVersions: { some: {} } },
      ],
    },
    select: {
      id: true,
      name: true,
      venueId: true,
      startDate: true,
      status: true,
      parentId: true,
      chainId: true,
      versionNumber: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${rostersWithParent.length} rosters with parent/child relationships`);

  if (rostersWithParent.length === 0) {
    console.log("No rosters need migration. Exiting.");
    return;
  }

  // Step 2: Build version chains
  console.log("\nStep 2: Building version chains...");

  const chains = new Map<string, VersionChain>();
  const rosterToChain = new Map<string, string>();

  // First pass: identify root rosters (no parent) and create chains
  for (const roster of rostersWithParent) {
    if (roster.parentId === null) {
      // This is a root roster - create a chain for it
      const chainId = generateChainId(roster.venueId, roster.startDate);
      chains.set(chainId, {
        chainId,
        rosters: [roster],
      });
      rosterToChain.set(roster.id, chainId);
    }
  }

  // Second pass: assign children to their parent's chain
  let changed = true;
  let iterations = 0;
  const maxIterations = 100;

  while (changed && iterations < maxIterations) {
    changed = false;
    iterations++;

    for (const roster of rostersWithParent) {
      if (roster.parentId && !rosterToChain.has(roster.id)) {
        const parentChainId = rosterToChain.get(roster.parentId);
        if (parentChainId) {
          const chain = chains.get(parentChainId);
          if (chain) {
            chain.rosters.push(roster);
            rosterToChain.set(roster.id, parentChainId);
            changed = true;
          }
        }
      }
    }
  }

  // Check for orphaned rosters (have parent but parent not in chain)
  const orphanedRosters = rostersWithParent.filter(r => !rosterToChain.has(r.id));
  if (orphanedRosters.length > 0) {
    console.log(`Warning: ${orphanedRosters.length} rosters have parents that aren't in any chain`);
    // Create chains for orphaned rosters based on their venue/week
    for (const roster of orphanedRosters) {
      const chainId = generateChainId(roster.venueId, roster.startDate);
      if (!chains.has(chainId)) {
        chains.set(chainId, {
          chainId,
          rosters: [roster],
        });
      } else {
        chains.get(chainId)!.rosters.push(roster);
      }
      rosterToChain.set(roster.id, chainId);
    }
  }

  console.log(`Created ${chains.size} version chains`);

  // Step 3: Sort rosters within each chain and assign version numbers
  console.log("\nStep 3: Assigning version numbers...");

  const updates: Array<{
    id: string;
    chainId: string;
    versionNumber: number;
    isActive: boolean;
  }> = [];

  for (const [chainId, chain] of chains) {
    // Sort by createdAt to determine version order
    chain.rosters.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    // Find the latest published roster (if any) to mark as active
    const publishedRosters = chain.rosters.filter(r => r.status === "PUBLISHED");
    const latestPublished = publishedRosters.length > 0
      ? publishedRosters[publishedRosters.length - 1]
      : null;

    // If no published, the latest roster is active
    const activeRoster = latestPublished || chain.rosters[chain.rosters.length - 1];

    chain.rosters.forEach((roster, index) => {
      updates.push({
        id: roster.id,
        chainId,
        versionNumber: index + 1,
        isActive: roster.id === activeRoster.id,
      });
    });

    console.log(`  Chain ${chainId.substring(0, 20)}...: ${chain.rosters.length} versions, active: v${chain.rosters.indexOf(activeRoster) + 1}`);
  }

  // Step 4: Apply updates
  console.log("\nStep 4: Applying updates to database...");

  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    try {
      await prisma.roster.update({
        where: { id: update.id },
        data: {
          chainId: update.chainId,
          versionNumber: update.versionNumber,
          isActive: update.isActive,
        },
      });
      successCount++;
    } catch (error) {
      console.error(`Error updating roster ${update.id}:`, error);
      errorCount++;
    }
  }

  console.log(`\nUpdated ${successCount} rosters successfully`);
  if (errorCount > 0) {
    console.log(`Failed to update ${errorCount} rosters`);
  }

  // Step 5: Update RosterHistory records with chainId
  console.log("\nStep 5: Updating RosterHistory records with chainId...");

  const historyUpdates = await prisma.$executeRaw`
    UPDATE "RosterHistory" h
    SET "chainId" = r."chainId"
    FROM "Roster" r
    WHERE h."rosterId" = r.id
    AND r."chainId" IS NOT NULL
    AND h."chainId" IS NULL
  `;

  console.log(`Updated ${historyUpdates} RosterHistory records`);

  // Step 6: Summary
  console.log("\n" + "=".repeat(60));
  console.log("Migration Summary");
  console.log("=".repeat(60));
  console.log(`Total rosters migrated: ${successCount}`);
  console.log(`Version chains created: ${chains.size}`);
  console.log(`RosterHistory records updated: ${historyUpdates}`);

  // Show chain distribution
  const chainSizes = Array.from(chains.values()).map(c => c.rosters.length);
  console.log(`\nChain size distribution:`);
  console.log(`  Min: ${Math.min(...chainSizes)}`);
  console.log(`  Max: ${Math.max(...chainSizes)}`);
  console.log(`  Average: ${(chainSizes.reduce((a, b) => a + b, 0) / chainSizes.length).toFixed(1)}`);

  console.log("\nMigration complete!");
}

// Also migrate standalone rosters that should have a chain
async function migrateStandaloneRosters() {
  console.log("\n" + "=".repeat(60));
  console.log("Migrating Standalone Rosters");
  console.log("=".repeat(60));

  // Find rosters without chainId
  const standaloneRosters = await prisma.roster.findMany({
    where: {
      chainId: null,
      parentId: null,
    },
    select: {
      id: true,
      venueId: true,
      startDate: true,
    },
  });

  console.log(`Found ${standaloneRosters.length} standalone rosters without chainId`);

  if (standaloneRosters.length === 0) {
    return;
  }

  let updated = 0;
  for (const roster of standaloneRosters) {
    const chainId = generateChainId(roster.venueId, roster.startDate);

    await prisma.roster.update({
      where: { id: roster.id },
      data: {
        chainId,
        versionNumber: 1,
        isActive: true,
      },
    });
    updated++;
  }

  console.log(`Updated ${updated} standalone rosters with chainId`);
}

async function main() {
  try {
    await migrateRosterVersioning();
    await migrateStandaloneRosters();
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
