/**
 * Data Migration Script: Channel Members
 *
 * This script migrates from the old ChannelVenue system to the new ChannelMember system.
 *
 * Steps:
 * 1. Get first admin user (for createdBy field on existing channels)
 * 2. Update all existing channels with createdBy
 * 3. Create ChannelMember records from existing ChannelVenue relationships
 * 4. Calculate and set memberCount for each channel
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env.local") });

const prisma = new PrismaClient({
  log: ["error", "warn"],
});

async function main() {
  console.log("🔄 Starting Channel Members Migration...\n");

  // Step 1: Get first admin user
  console.log("Step 1: Finding admin user for channel creator...");
  const adminRole = await prisma.role.findUnique({
    where: { name: "ADMIN" },
  });

  if (!adminRole) {
    throw new Error("ADMIN role not found!");
  }

  const adminUser = await prisma.user.findFirst({
    where: { roleId: adminRole.id, active: true },
  });

  if (!adminUser) {
    throw new Error("No active admin user found!");
  }

  console.log(`✓ Using admin user: ${adminUser.email} (${adminUser.id})\n`);

  // Step 2: Update existing channels with createdBy
  console.log("Step 2: Updating existing channels with createdBy...");
  const existingChannels = await prisma.channel.findMany({
    where: { createdBy: null }, // Only update channels without a creator
  });

  if (existingChannels.length > 0) {
    await prisma.channel.updateMany({
      where: { createdBy: null },
      data: { createdBy: adminUser.id },
    });
    console.log(`✓ Updated ${existingChannels.length} channels with creator\n`);
  } else {
    console.log(`✓ All channels already have a creator\n`);
  }

  // Step 3: Get all channels for member migration
  console.log("Step 3: Fetching existing channels for member migration...");
  const channels = await prisma.channel.findMany({
    include: {
      venues: {
        include: {
          venue: {
            include: {
              users: {
                where: { active: true },
                select: { id: true, email: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
    },
  });

  console.log(`✓ Found ${channels.length} channels\n`);

  // Step 4: Migrate each channel
  console.log("Step 4: Creating ChannelMember records...");
  let totalMembersCreated = 0;

  for (const channel of channels) {
    console.log(`\n  Processing: ${channel.name}`);

    // Collect all unique users from all venues assigned to this channel
    const userIds = new Set<string>();
    for (const channelVenue of channel.venues) {
      for (const user of channelVenue.venue.users) {
        userIds.add(user.id);
      }
    }

    console.log(`    Found ${userIds.size} unique users across ${channel.venues.length} venues`);

    // Create ChannelMember records for each user
    let membersCreated = 0;
    for (const userId of userIds) {
      try {
        await prisma.channelMember.upsert({
          where: {
            channelId_userId: {
              channelId: channel.id,
              userId: userId,
            },
          },
          update: {}, // No update needed if exists
          create: {
            channelId: channel.id,
            userId: userId,
            role: "MEMBER",
            addedBy: adminUser.id,
            addedVia: "migration_from_venue",
          },
        });
        membersCreated++;
      } catch (error) {
        console.error(`      ✗ Failed to add user ${userId}:`, error);
      }
    }

    console.log(`    ✓ Created ${membersCreated} channel members`);

    // Update channel's memberCount
    await prisma.channel.update({
      where: { id: channel.id },
      data: { memberCount: membersCreated },
    });

    totalMembersCreated += membersCreated;
  }

  console.log(`\n✓ Total members created: ${totalMembersCreated}`);

  // Step 5: Summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 Migration Complete!\n");
  console.log("Summary:");
  console.log(`  • Channels processed: ${channels.length}`);
  console.log(`  • Members created: ${totalMembersCreated}`);
  console.log(`  • All channels assigned to admin: ${adminUser.email}`);
  console.log("\nNext steps:");
  console.log("  1. Verify channel membership in the app");
  console.log("  2. Check that users can see their channels");
  console.log("  3. ChannelVenue table can be deprecated (keep for now)");
  console.log("=".repeat(60) + "\n");
}

main()
  .catch((e) => {
    console.error("\n❌ Migration failed:");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
