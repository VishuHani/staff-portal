/**
 * Data Migration Script: Assign Existing Channels to All Venues
 *
 * This script assigns all existing channels to all active venues.
 * Run this once after adding the ChannelVenue table.
 *
 * Usage:
 *   DRY_RUN=true npx tsx scripts/migrate-channels-to-venues.ts  (preview changes)
 *   npx tsx scripts/migrate-channels-to-venues.ts               (apply changes)
 */

import { prisma } from "@/lib/prisma";

const DRY_RUN = process.env.DRY_RUN === "true";

async function migrateChannelsToVenues() {
  console.log("🔍 Starting channel-venue migration...\n");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (preview only)" : "LIVE (applying changes)"}\n`);

  try {
    // Get all channels
    const channels = await prisma.channel.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`📋 Found ${channels.length} channels:\n`);
    channels.forEach((channel) => {
      console.log(`   - ${channel.name} (${channel.id})`);
    });
    console.log();

    // Get all active venues (stores)
    const venues = await prisma.venue.findMany({
      where: {
        active: true,
      },
      select: {
        id: true,
        name: true,
        code: true,
      },
    });

    console.log(`🏢 Found ${venues.length} active venues:\n`);
    venues.forEach((venue) => {
      console.log(`   - ${venue.name} (${venue.code})`);
    });
    console.log();

    // Check existing channel-venue assignments
    const existingAssignments = await prisma.channelVenue.findMany({
      select: {
        channelId: true,
        venueId: true,
      },
    });

    console.log(`🔗 Found ${existingAssignments.length} existing channel-venue assignments\n`);

    // Create channel-venue assignments for all combinations
    const assignments = [];
    for (const channel of channels) {
      for (const venue of venues) {
        // Check if assignment already exists
        const exists = existingAssignments.some(
          (a) => a.channelId === channel.id && a.venueId === venue.id
        );

        if (!exists) {
          assignments.push({
            channelId: channel.id,
            venueId: venue.id,
          });
        }
      }
    }

    console.log(`✨ Will create ${assignments.length} new channel-venue assignments:\n`);

    if (assignments.length === 0) {
      console.log("   ✅ All channels are already assigned to all venues!\n");
      return;
    }

    // Group by channel for display
    const assignmentsByChannel = assignments.reduce((acc, assignment) => {
      const channel = channels.find((c) => c.id === assignment.channelId);
      const venue = venues.find((v) => v.id === assignment.venueId);

      if (!channel || !venue) return acc;

      if (!acc[channel.name]) {
        acc[channel.name] = [];
      }
      acc[channel.name].push(venue.name);
      return acc;
    }, {} as Record<string, string[]>);

    Object.entries(assignmentsByChannel).forEach(([channelName, venueNames]) => {
      console.log(`   ${channelName}:`);
      venueNames.forEach((venueName) => {
        console.log(`      → ${venueName}`);
      });
    });
    console.log();

    if (DRY_RUN) {
      console.log("🔍 DRY RUN: No changes applied.");
      console.log("   Run without DRY_RUN=true to apply these changes.\n");
      return;
    }

    // Apply changes
    console.log("💾 Creating channel-venue assignments...\n");

    const result = await prisma.channelVenue.createMany({
      data: assignments,
      skipDuplicates: true,
    });

    console.log(`✅ Successfully created ${result.count} channel-venue assignments!\n`);

    // Verify final state
    const totalAssignments = await prisma.channelVenue.count();
    console.log(`📊 Final state:`);
    console.log(`   - Total channels: ${channels.length}`);
    console.log(`   - Total active venues: ${venues.length}`);
    console.log(`   - Total channel-venue assignments: ${totalAssignments}`);
    console.log(`   - Expected: ${channels.length * venues.length}\n`);

    if (totalAssignments === channels.length * venues.length) {
      console.log("✅ Migration complete! All channels are now assigned to all venues.\n");
    } else {
      console.log("⚠️  Warning: Assignment count doesn't match expected value.\n");
    }
  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run migration
migrateChannelsToVenues()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
