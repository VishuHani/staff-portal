import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Creating General Announcements channel...\n");

  try {
    const channel = await prisma.channel.create({
      data: {
        name: "General Announcements",
        description: "Company-wide announcements and important updates",
        type: "ALL_STAFF",
        icon: "📢",
        color: "#3b82f6",
        archived: false,
      },
    });

    console.log(`✅ Created: ${channel.icon} ${channel.name}`);
    console.log(`   ID: ${channel.id} (CUID format)`);
    console.log(`   Type: ${channel.type}`);
    console.log(`   Color: ${channel.color}`);
    console.log(`   Description: ${channel.description}\n`);

    console.log("✨ Channel created successfully!");
  } catch (error) {
    console.error("❌ Failed to create channel:", error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
