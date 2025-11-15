/**
 * Initialize Notification Preferences for Existing Users
 *
 * This script creates NotificationPreference records for all users who don't have them.
 * Sets all notification types to enabled with EMAIL + IN_APP channels.
 *
 * Usage: npx tsx scripts/init-notification-preferences.ts
 */

import { prisma } from "../src/lib/prisma";
import { NotificationType } from "@prisma/client";

const NOTIFICATION_TYPES: NotificationType[] = [
  "NEW_MESSAGE",
  "MESSAGE_REPLY",
  "MESSAGE_MENTION",
  "MESSAGE_REACTION",
  "POST_MENTION",
  "POST_PINNED",
  "POST_DELETED",
  "TIME_OFF_REQUEST",
  "TIME_OFF_APPROVED",
  "TIME_OFF_REJECTED",
  "TIME_OFF_CANCELLED",
  "USER_CREATED",
  "USER_UPDATED",
  "ROLE_CHANGED",
  "SYSTEM_ANNOUNCEMENT",
  "GROUP_REMOVED",
];

async function initializeNotificationPreferences() {
  console.log("\n🔔 INITIALIZING NOTIFICATION PREFERENCES");
  console.log("==========================================\n");

  try {
    // Get all active users
    const users = await prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    console.log(`📊 Found ${users.length} active users\n`);

    let usersUpdated = 0;
    let preferencesCreated = 0;
    let usersAlreadyConfigured = 0;

    for (const user of users) {
      const userName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.email;

      // Check if user already has preferences
      const existingPreferences = await prisma.notificationPreference.count({
        where: { userId: user.id },
      });

      if (existingPreferences > 0) {
        console.log(`✓ ${userName} - Already has ${existingPreferences} preferences (skipping)`);
        usersAlreadyConfigured++;
        continue;
      }

      // Create all notification preferences for this user
      const preferencesData = NOTIFICATION_TYPES.map((type) => ({
        userId: user.id,
        type,
        enabled: true,
        channels: ["IN_APP", "EMAIL"],
      }));

      const result = await prisma.notificationPreference.createMany({
        data: preferencesData,
      });

      console.log(`✅ ${userName} - Created ${result.count} notification preferences`);
      usersUpdated++;
      preferencesCreated += result.count;
    }

    // Summary
    console.log("\n\n📊 SUMMARY");
    console.log("==========");
    console.log(`👥 Total users processed: ${users.length}`);
    console.log(`✅ Users updated: ${usersUpdated}`);
    console.log(`⏭️  Users already configured: ${usersAlreadyConfigured}`);
    console.log(`🔔 Total preferences created: ${preferencesCreated}`);

    if (usersUpdated > 0) {
      console.log("\n✨ All users now have email notifications enabled by default!");
      console.log("📧 Users can customize their preferences at /settings/notifications");
    } else {
      console.log("\n✓ All users already have notification preferences configured");
    }
  } catch (error) {
    console.error("\n❌ Error initializing notification preferences:", error);
    throw error;
  }
}

// Run the initialization
initializeNotificationPreferences()
  .then(() => {
    console.log("\n✅ Script completed successfully\n");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
