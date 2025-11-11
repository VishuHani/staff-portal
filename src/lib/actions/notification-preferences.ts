"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { z } from "zod";
import type { NotificationType, NotificationChannel } from "@prisma/client";

/**
 * Server Actions for Notification Preferences
 */

// Zod schemas
const getPreferencesSchema = z.object({
  userId: z.string().cuid(),
});

const updatePreferenceSchema = z.object({
  userId: z.string().cuid(),
  type: z.string(),
  enabled: z.boolean(),
  channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "SMS"])),
});

const resetPreferencesSchema = z.object({
  userId: z.string().cuid(),
});

/**
 * Get all notification preferences for a user
 */
export async function getUserNotificationPreferences(userId: string) {
  try {
    const currentUser = await requireAuth();

    // Users can only view their own preferences
    if (currentUser.id !== userId) {
      return { error: "You can only view your own preferences" };
    }

    // Fetch all preferences for this user
    const preferences = await prisma.notificationPreference.findMany({
      where: { userId },
      orderBy: { type: "asc" },
    });

    return { preferences };
  } catch (error) {
    console.error("Error fetching notification preferences:", error);
    return { error: "Failed to fetch preferences" };
  }
}

/**
 * Update or create a notification preference
 */
export async function updateNotificationPreference(input: {
  userId: string;
  type: NotificationType;
  enabled: boolean;
  channels: NotificationChannel[];
}) {
  try {
    const currentUser = await requireAuth();

    // Validate input
    const validated = updatePreferenceSchema.parse(input);

    // Users can only update their own preferences
    if (currentUser.id !== validated.userId) {
      return { error: "You can only update your own preferences" };
    }

    // Upsert preference (create or update)
    const preference = await prisma.notificationPreference.upsert({
      where: {
        userId_type: {
          userId: validated.userId,
          type: validated.type as NotificationType,
        },
      },
      update: {
        enabled: validated.enabled,
        channels: validated.channels as NotificationChannel[],
        updatedAt: new Date(),
      },
      create: {
        userId: validated.userId,
        type: validated.type as NotificationType,
        enabled: validated.enabled,
        channels: validated.channels as NotificationChannel[],
      },
    });

    revalidatePath("/settings/notifications");
    return { preference };
  } catch (error) {
    console.error("Error updating notification preference:", error);
    return { error: "Failed to update preference" };
  }
}

/**
 * Reset all preferences to defaults (IN_APP only, all enabled)
 */
export async function resetNotificationPreferences(userId: string) {
  try {
    const currentUser = await requireAuth();

    // Users can only reset their own preferences
    if (currentUser.id !== userId) {
      return { error: "You can only reset your own preferences" };
    }

    // Delete all existing preferences (defaults will apply)
    await prisma.notificationPreference.deleteMany({
      where: { userId },
    });

    revalidatePath("/settings/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error resetting notification preferences:", error);
    return { error: "Failed to reset preferences" };
  }
}

/**
 * Batch update multiple preferences at once
 */
export async function batchUpdatePreferences(input: {
  userId: string;
  preferences: Array<{
    type: NotificationType;
    enabled: boolean;
    channels: NotificationChannel[];
  }>;
}) {
  try {
    const currentUser = await requireAuth();

    // Users can only update their own preferences
    if (currentUser.id !== input.userId) {
      return { error: "You can only update your own preferences" };
    }

    // Update all preferences in a transaction
    await prisma.$transaction(
      input.preferences.map((pref) =>
        prisma.notificationPreference.upsert({
          where: {
            userId_type: {
              userId: input.userId,
              type: pref.type,
            },
          },
          update: {
            enabled: pref.enabled,
            channels: pref.channels,
            updatedAt: new Date(),
          },
          create: {
            userId: input.userId,
            type: pref.type,
            enabled: pref.enabled,
            channels: pref.channels,
          },
        })
      )
    );

    revalidatePath("/settings/notifications");
    return { success: true };
  } catch (error) {
    console.error("Error batch updating preferences:", error);
    return { error: "Failed to update preferences" };
  }
}
