import { NotificationType, NotificationChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBrevoEmail } from "./email/brevo";
import { getEmailTemplate } from "./email/templates";

/**
 * Notification Channels Service
 * Handles multi-channel notification delivery (In-App, Email, Push, SMS)
 */

/**
 * Get user's notification preferences for a specific notification type
 * Returns default preferences if none exist
 */
export async function getUserNotificationPreference(
  userId: string,
  type: NotificationType
) {
  try {
    const preference = await prisma.notificationPreference.findUnique({
      where: {
        userId_type: {
          userId,
          type,
        },
      },
    });

    // Default preferences if none exist: IN_APP + EMAIL enabled
    if (!preference) {
      return {
        enabled: true,
        channels: ["IN_APP" as NotificationChannel, "EMAIL" as NotificationChannel],
      };
    }

    return {
      enabled: preference.enabled,
      channels: preference.channels,
    };
  } catch (error) {
    console.error("Error fetching notification preference:", error);
    // Return safe defaults on error
    return {
      enabled: true,
      channels: ["IN_APP" as NotificationChannel],
    };
  }
}

/**
 * Check if user should receive a notification of a given type
 */
export async function shouldNotifyUser(
  userId: string,
  type: NotificationType
): Promise<boolean> {
  const preference = await getUserNotificationPreference(userId, type);
  return preference.enabled;
}

/**
 * Get enabled notification channels for a user and notification type
 */
export async function getEnabledChannels(
  userId: string,
  type: NotificationType
): Promise<NotificationChannel[]> {
  const preference = await getUserNotificationPreference(userId, type);

  if (!preference.enabled) {
    return [];
  }

  return preference.channels;
}

/**
 * Send notification via EMAIL channel using Brevo
 * Fetches user email, formats template, and sends via Brevo API
 */
export async function sendEmailNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    // Fetch user email and name from database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    if (!user?.email) {
      console.error(`[EMAIL] User ${userId} has no email address`);
      return { success: false, channel: "EMAIL", error: "No email address" };
    }

    // Get formatted email template for notification type
    const template = getEmailTemplate(type, title, message, link);

    // Send email via Brevo
    const userName = user.firstName
      ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ""}`
      : user.email;

    const result = await sendBrevoEmail({
      to: user.email,
      toName: userName,
      subject: template.subject,
      htmlContent: template.htmlContent,
    });

    if (result.success) {
      console.log(`[EMAIL] Sent to ${user.email} (messageId: ${result.messageId})`);
      return { success: true, channel: "EMAIL", messageId: result.messageId };
    } else {
      console.error(`[EMAIL] Failed to send to ${user.email}:`, result.error);
      return { success: false, channel: "EMAIL", error: result.error };
    }
  } catch (error) {
    console.error("Error sending email notification:", error);
    return { success: false, channel: "EMAIL", error };
  }
}

/**
 * Send notification via PUSH channel
 * Placeholder for future push notification integration
 */
export async function sendPushNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    // TODO: Integrate with push service (e.g., Firebase Cloud Messaging, OneSignal)
    console.log(`[PUSH] Notification to user ${userId}:`, {
      type,
      title,
      message,
      link,
    });

    // Future implementation:
    // - Fetch user's device tokens from database
    // - Format push payload
    // - Send via push notification service
    // - Handle platform-specific formatting (iOS/Android/Web)
    // - Log delivery status

    return { success: true, channel: "PUSH" };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return { success: false, channel: "PUSH", error };
  }
}

/**
 * Send notification via SMS channel
 * Placeholder for future SMS integration
 */
export async function sendSmsNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  try {
    // TODO: Integrate with SMS service (e.g., Twilio, AWS SNS)
    console.log(`[SMS] Notification to user ${userId}:`, {
      type,
      title,
      message,
      link,
    });

    // Future implementation:
    // - Fetch user's phone number from database
    // - Format SMS message (respect character limits)
    // - Send via SMS service
    // - Handle opt-out/compliance requirements
    // - Log delivery status

    return { success: true, channel: "SMS" };
  } catch (error) {
    console.error("Error sending SMS notification:", error);
    return { success: false, channel: "SMS", error };
  }
}

/**
 * Send notification via all enabled channels for a user
 */
export async function sendMultiChannelNotification(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  link?: string
) {
  const channels = await getEnabledChannels(userId, type);

  if (channels.length === 0) {
    console.log(`User ${userId} has no enabled channels for ${type}`);
    return { success: false, reason: "No enabled channels" };
  }

  const results = await Promise.allSettled(
    channels.map(async (channel) => {
      switch (channel) {
        case "IN_APP":
          // IN_APP notifications are handled by createNotification()
          return { success: true, channel: "IN_APP" };

        case "EMAIL":
          return sendEmailNotification(userId, type, title, message, link);

        case "PUSH":
          return sendPushNotification(userId, type, title, message, link);

        case "SMS":
          return sendSmsNotification(userId, type, title, message, link);

        default:
          console.warn(`Unknown notification channel: ${channel}`);
          return { success: false, channel, error: "Unknown channel" };
      }
    })
  );

  const successCount = results.filter(
    (r) => r.status === "fulfilled" && r.value.success
  ).length;

  return {
    success: successCount > 0,
    channels,
    results,
    successCount,
    totalChannels: channels.length,
  };
}
