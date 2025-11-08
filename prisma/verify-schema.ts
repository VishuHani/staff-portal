import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function verifySchema() {
  console.log("🔍 Verifying database schema...\n");

  try {
    // Test 1: Query channels with all new fields
    console.log("✅ Test 1: Querying channels with new fields (color, icon, description, archived)");
    const channels = await prisma.channel.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        icon: true,
        color: true,
        archived: true,
        archivedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    console.log(`   Found ${channels.length} channels:`);
    channels.forEach((channel) => {
      console.log(`   - ${channel.icon} ${channel.name} (${channel.type}) - Color: ${channel.color}`);
    });
    console.log("");

    // Test 2: Filter by archived field
    console.log("✅ Test 2: Filtering channels by archived field");
    const activeChannels = await prisma.channel.findMany({
      where: { archived: false },
    });
    console.log(`   Found ${activeChannels.length} active (non-archived) channels\n`);

    // Test 3: Check if posts table has edited and editedAt fields
    console.log("✅ Test 3: Checking posts table for edited and editedAt fields");
    const posts = await prisma.post.findMany({
      select: {
        id: true,
        content: true,
        edited: true,
        editedAt: true,
      },
      take: 1,
    });
    console.log(`   Posts table has edited and editedAt fields ✓\n`);

    // Test 4: Check if comments table has edited and editedAt fields
    console.log("✅ Test 4: Checking comments table for edited and editedAt fields");
    const comments = await prisma.comment.findMany({
      select: {
        id: true,
        content: true,
        edited: true,
        editedAt: true,
      },
      take: 1,
    });
    console.log(`   Comments table has edited and editedAt fields ✓\n`);

    console.log("🎉 All schema verification tests passed!");
    console.log("✨ Database schema is properly synced with Prisma schema!");
  } catch (error: any) {
    console.error("❌ Schema verification failed:", error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    process.exit(1);
  }
}

verifySchema()
  .catch((error) => {
    console.error("❌ Verification script failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
