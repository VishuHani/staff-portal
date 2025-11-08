/**
 * Script to create default channels using server actions
 * Run this with: npx tsx scripts/create-channels.ts
 */

import { createChannel } from "../src/lib/actions/channels";

const channels = [
  {
    name: "General Announcements",
    description: "Company-wide announcements and important updates",
    type: "ALL_STAFF",
    icon: "📢",
    color: "#3b82f6",
  },
  {
    name: "Team Updates",
    description: "Updates and news from different teams",
    type: "ALL_STAFF",
    icon: "👥",
    color: "#10b981",
  },
  {
    name: "Social",
    description: "Casual conversations, celebrations, and fun",
    type: "ALL_STAFF",
    icon: "🎉",
    color: "#f59e0b",
  },
  {
    name: "Help & Questions",
    description: "Ask questions and get help from the team",
    type: "ALL_STAFF",
    icon: "❓",
    color: "#8b5cf6",
  },
  {
    name: "Managers Only",
    description: "Private channel for management discussions",
    type: "MANAGERS",
    icon: "🔒",
    color: "#ef4444",
  },
];

async function main() {
  console.log("🌱 Creating channels...\n");

  for (const channelData of channels) {
    const result = await createChannel(channelData);

    if (result.error) {
      console.log(`❌ Failed to create "${channelData.name}": ${result.error}`);
    } else if (result.channel) {
      console.log(
        `✅ Created: ${channelData.icon} ${result.channel.name} (ID: ${result.channel.id})`
      );
    }
  }

  console.log("\n✨ Channel creation completed!");
}

main().catch(console.error);
