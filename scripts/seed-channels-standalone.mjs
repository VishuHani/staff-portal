/**
 * Standalone script to create channels with proper CUID IDs
 * Run with: node scripts/seed-channels-standalone.mjs
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const channels = [
  {
    name: "General Announcements",
    description: "Company-wide announcements and important updates",
    type: "ALL_STAFF",
    icon: "📢",
    color: "#3b82f6",
    archived: false,
  },
  {
    name: "Team Updates",
    description: "Updates and news from different teams",
    type: "ALL_STAFF",
    icon: "👥",
    color: "#10b981",
    archived: false,
  },
  {
    name: "Social",
    description: "Casual conversations, celebrations, and fun",
    type: "ALL_STAFF",
    icon: "🎉",
    color: "#f59e0b",
    archived: false,
  },
  {
    name: "Help & Questions",
    description: "Ask questions and get help from the team",
    type: "ALL_STAFF",
    icon: "❓",
    color: "#8b5cf6",
    archived: false,
  },
  {
    name: "Managers Only",
    description: "Private channel for management discussions",
    type: "MANAGERS",
    icon: "🔒",
    color: "#ef4444",
    archived: false,
  },
];

async function main() {
  console.log("🌱 Creating channels with proper CUID IDs...\n");

  for (const channelData of channels) {
    try {
      const channel = await prisma.channel.create({
        data: channelData,
      });
      console.log(`✅ Created: ${channel.icon} ${channel.name} (ID: ${channel.id})`);
    } catch (error) {
      console.log(`❌ Failed to create "${channelData.name}":`, error.message);
    }
  }

  console.log("\n✨ Channel creation completed!");

  // Display all channels
  const allChannels = await prisma.channel.findMany({
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
      type: true,
    },
    orderBy: { createdAt: "asc" },
  });

  console.log("\n📋 All channels in database:");
  allChannels.forEach((ch) => {
    console.log(`   ${ch.icon} ${ch.name} (${ch.type})`);
    console.log(`      ID: ${ch.id}`);
    console.log(`      Color: ${ch.color}\n`);
  });

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("❌ Script failed:", error);
  prisma.$disconnect();
  process.exit(1);
});
