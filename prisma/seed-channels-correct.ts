import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function seedChannels() {
  console.log("🗑️  Deleting existing channels...");
  await prisma.channel.deleteMany({});
  console.log("✅ Existing channels deleted\n");

  console.log("🌱 Seeding channels with proper CUID format...");

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

  for (const channel of channels) {
    const created = await prisma.channel.create({
      data: channel,
    });
    console.log(`✅ Created: "${created.name}" (ID: ${created.id})`);
  }

  console.log("\n✨ Channel seeding completed!");

  // Display all channels
  const allChannels = await prisma.channel.findMany({
    select: {
      id: true,
      name: true,
      icon: true,
      color: true,
      type: true,
    },
  });

  console.log("\n📋 All channels:");
  allChannels.forEach((ch) => {
    console.log(`   ${ch.icon} ${ch.name} (${ch.type}) - ${ch.id}`);
  });
}

seedChannels()
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
