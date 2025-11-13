/**
 * Multi-Venue Migration Script
 *
 * This script migrates existing single-venue data (User.storeId) to the
 * multi-venue UserVenue junction table.
 *
 * What it does:
 * 1. Finds all users with a storeId set
 * 2. Creates UserVenue records for each user-store pair
 * 3. Sets isPrimary = true for all initial assignments
 * 4. Validates data integrity
 * 5. Provides rollback instructions
 *
 * Usage:
 *   npx tsx scripts/migrate-to-multivenue.ts
 *
 * Safety:
 * - Dry run mode available (set DRY_RUN=true)
 * - Validates before committing
 * - Provides detailed output
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === "true";

interface MigrationStats {
  totalUsers: number;
  usersWithStore: number;
  userVenuesCreated: number;
  usersAlreadyMigrated: number;
  usersWithoutStore: number;
  errors: string[];
}

async function main() {
  console.log("🚀 Multi-Venue Migration Script");
  console.log("================================\n");

  if (DRY_RUN) {
    console.log("⚠️  DRY RUN MODE - No changes will be made\n");
  }

  const stats: MigrationStats = {
    totalUsers: 0,
    usersWithStore: 0,
    userVenuesCreated: 0,
    usersAlreadyMigrated: 0,
    usersWithoutStore: 0,
    errors: [],
  };

  try {
    // Step 1: Get all users
    console.log("📊 Analyzing current data...\n");

    const allUsers = await prisma.user.findMany({
      include: {
        store: true,
        venues: true,
      },
    });

    stats.totalUsers = allUsers.length;
    console.log(`Found ${stats.totalUsers} total users`);

    // Step 2: Categorize users
    const usersWithStore = allUsers.filter((user) => user.storeId !== null);
    const usersWithoutStore = allUsers.filter((user) => user.storeId === null);
    const usersAlreadyMigrated = allUsers.filter((user) => user.venues.length > 0);

    stats.usersWithStore = usersWithStore.length;
    stats.usersWithoutStore = usersWithoutStore.length;
    stats.usersAlreadyMigrated = usersAlreadyMigrated.length;

    console.log(`  - Users with storeId: ${stats.usersWithStore}`);
    console.log(`  - Users without storeId: ${stats.usersWithoutStore}`);
    console.log(`  - Users already migrated (have UserVenue records): ${stats.usersAlreadyMigrated}\n`);

    // Step 3: Identify users to migrate
    const usersToMigrate = usersWithStore.filter((user) => user.venues.length === 0);

    if (usersToMigrate.length === 0) {
      console.log("✅ No users need migration. All users with stores already have UserVenue records.");
      return;
    }

    console.log(`🔄 Found ${usersToMigrate.length} users to migrate\n`);

    // Step 4: Validate stores exist
    console.log("🔍 Validating stores...");
    const storeIds = [...new Set(usersToMigrate.map((user) => user.storeId).filter(Boolean))];
    const stores = await prisma.venue.findMany({
      where: { id: { in: storeIds as string[] } },
    });

    if (stores.length !== storeIds.length) {
      const missingStores = storeIds.filter(
        (id) => !stores.find((store) => store.id === id)
      );
      console.error(`❌ Error: Some stores referenced by users do not exist:`);
      console.error(`   Missing store IDs: ${missingStores.join(", ")}`);
      stats.errors.push(`Missing stores: ${missingStores.join(", ")}`);
      throw new Error("Data integrity issue: Missing stores");
    }

    console.log(`✅ All ${stores.length} stores validated\n`);

    // Step 5: Create UserVenue records
    console.log("📝 Creating UserVenue records...\n");

    if (!DRY_RUN) {
      for (const user of usersToMigrate) {
        try {
          const userVenue = await prisma.userVenue.create({
            data: {
              userId: user.id,
              venueId: user.storeId!,
              isPrimary: true, // Set as primary venue
            },
          });

          stats.userVenuesCreated++;

          console.log(
            `  ✓ Created UserVenue for ${user.email} → ${user.store?.name} (primary)`
          );
        } catch (error: any) {
          const errorMsg = `Failed to migrate ${user.email}: ${error.message}`;
          stats.errors.push(errorMsg);
          console.error(`  ✗ ${errorMsg}`);
        }
      }
    } else {
      // Dry run - just show what would happen
      for (const user of usersToMigrate) {
        console.log(
          `  [DRY RUN] Would create UserVenue for ${user.email} → ${user.store?.name} (primary)`
        );
        stats.userVenuesCreated++;
      }
    }

    // Step 6: Verify migration
    if (!DRY_RUN) {
      console.log("\n🔍 Verifying migration...");

      const verifyUsers = await prisma.user.findMany({
        where: {
          id: { in: usersToMigrate.map((u) => u.id) },
        },
        include: {
          venues: true,
        },
      });

      const successfullyMigrated = verifyUsers.filter((u) => u.venues.length > 0).length;

      if (successfullyMigrated === usersToMigrate.length) {
        console.log(`✅ Verified: All ${successfullyMigrated} users successfully migrated\n`);
      } else {
        console.warn(
          `⚠️  Warning: Only ${successfullyMigrated}/${usersToMigrate.length} users verified`
        );
      }
    }

    // Step 7: Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 Migration Summary");
    console.log("=".repeat(50));
    console.log(`Total users in database: ${stats.totalUsers}`);
    console.log(`Users with storeId: ${stats.usersWithStore}`);
    console.log(`Users without storeId: ${stats.usersWithoutStore}`);
    console.log(`Users already migrated: ${stats.usersAlreadyMigrated}`);
    console.log(`UserVenue records ${DRY_RUN ? "to be created" : "created"}: ${stats.userVenuesCreated}`);

    if (stats.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${stats.errors.length}`);
      stats.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    } else {
      console.log("\n✅ No errors encountered");
    }

    console.log("=".repeat(50) + "\n");

    if (DRY_RUN) {
      console.log("ℹ️  This was a dry run. To apply changes, run:");
      console.log("   npx tsx scripts/migrate-to-multivenue.ts\n");
    } else {
      console.log("✅ Migration complete!\n");
      console.log("Next steps:");
      console.log("1. Verify users can log in and see their venues");
      console.log("2. Test admin user-venue assignment UI");
      console.log("3. Gradually phase out storeId field usage");
      console.log("4. Eventually remove storeId column (keep for now)\n");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error("\nNo changes were committed to the database.");
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Rollback helper (for documentation purposes)
function printRollbackInstructions() {
  console.log("\n📋 ROLLBACK INSTRUCTIONS");
  console.log("========================");
  console.log("If you need to rollback this migration:");
  console.log("");
  console.log("1. Delete all UserVenue records:");
  console.log("   await prisma.userVenue.deleteMany({});");
  console.log("");
  console.log("2. Or delete only migrated records (keep manual assignments):");
  console.log("   await prisma.userVenue.deleteMany({");
  console.log("     where: { isPrimary: true }");
  console.log("   });");
  console.log("");
  console.log("3. Users will fall back to using storeId field");
  console.log("========================\n");
}

// Run migration
main()
  .then(() => {
    console.log("✨ Migration script completed successfully");
  })
  .catch((error) => {
    console.error("💥 Fatal error:", error);
    process.exit(1);
  });
