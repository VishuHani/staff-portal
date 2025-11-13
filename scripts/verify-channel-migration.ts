/**
 * Verify Channel Members Migration
 */

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import path from "path";

config({ path: path.join(process.cwd(), ".env.local") });

const prisma = new PrismaClient();

async function main() {
  console.log("🔍 Verifying Channel Members Migration...\n");

  // Check all channels have createdBy
  const channelsWithoutCreator = await prisma.channel.count({
    where: { createdBy: null },
  });
  console.log(`✓ Channels without creator: ${channelsWithoutCreator} (should be 0)`);

  // Check channel member counts
  const channels = await prisma.channel.findMany({
    select: {
      id: true,
      name: true,
      memberCount: true,
      _count: {
        select: { members: true },
      },
    },
  });

  console.log("\n📊 Channel Member Counts:");
  let mismatchFound = false;
  for (const channel of channels) {
    const actualCount = channel._count.members;
    const storedCount = channel.memberCount;
    const match = actualCount === storedCount ? "✓" : "✗";

    console.log(`  ${match} ${channel.name}: stored=${storedCount}, actual=${actualCount}`);

    if (actualCount !== storedCount) {
      mismatchFound = true;
    }
  }

  if (mismatchFound) {
    console.log("\n⚠️  Mismatch found! Fixing...");
    for (const channel of channels) {
      await prisma.channel.update({
        where: { id: channel.id },
        data: { memberCount: channel._count.members },
      });
    }
    console.log("✓ Fixed all mismatches");
  } else {
    console.log("\n✓ All member counts match!");
  }

  // Check for duplicate memberships
  const duplicateCheck = await prisma.$queryRaw<Array<{ channelId: string; userId: string; count: bigint }>>`
    SELECT "channelId", "userId", COUNT(*) as count
    FROM "channel_members"
    GROUP BY "channelId", "userId"
    HAVING COUNT(*) > 1
  `;

  console.log(`\n✓ Duplicate memberships: ${duplicateCheck.length} (should be 0)`);

  // Summary stats
  const totalChannels = await prisma.channel.count();
  const totalMembers = await prisma.channelMember.count();
  const avgMembersPerChannel = (totalMembers / totalChannels).toFixed(1);

  console.log("\n" + "=".repeat(60));
  console.log("📈 Summary Statistics:");
  console.log(`  • Total channels: ${totalChannels}`);
  console.log(`  • Total memberships: ${totalMembers}`);
  console.log(`  • Avg members per channel: ${avgMembersPerChannel}`);

  // Check addedVia distribution
  const addedViaStats = await prisma.channelMember.groupBy({
    by: ["addedVia"],
    _count: true,
  });

  console.log("\n📍 Added Via Distribution:");
  addedViaStats.forEach((stat) => {
    console.log(`  • ${stat.addedVia || "null"}: ${stat._count}`);
  });

  // Sample some channel memberships
  console.log("\n🔍 Sample Channel Memberships:");
  const sampleChannel = channels[0];
  const sampleMembers = await prisma.channelMember.findMany({
    where: { channelId: sampleChannel.id },
    include: {
      user: {
        select: { firstName: true, lastName: true, email: true },
      },
      addedByUser: {
        select: { firstName: true, lastName: true },
      },
    },
    take: 3,
  });

  console.log(`\n  Channel: ${sampleChannel.name}`);
  sampleMembers.forEach((member) => {
    console.log(
      `    - ${member.user.firstName} ${member.user.lastName} (added by ${member.addedByUser.firstName} ${member.addedByUser.lastName})`
    );
  });

  console.log("\n" + "=".repeat(60));
  console.log("✅ Verification Complete!\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
