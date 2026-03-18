import { prisma } from "@/lib/prisma";
import { ReminderType, NotificationType } from "@prisma/client";
import { sendBrevoEmail } from "@/lib/services/email/brevo";
import { createNotification } from "@/lib/services/notifications";
import {
  getPendingReminders,
  markReminderSent,
  markReminderFailed,
} from "@/lib/documents/reminder-service";

// ============================================================================
// Types
// ============================================================================

export interface ProcessRemindersResult {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  errors: { reminderId: string; error: string }[];
}

export interface ReminderEmailData {
  to: string;
  toName: string;
  documentName: string;
  dueDate: Date | null;
  daysUntilDue: number;
  venueName: string;
  assignmentId: string;
}

// ============================================================================
// Reminder Processing Job
// ============================================================================

/**
 * Main job to process pending document reminders
 * Should be called by a cron job (e.g., every 5-15 minutes)
 */
export async function processDocumentReminders(): Promise<ProcessRemindersResult> {
  console.log("[DocumentReminders] Starting reminder processing job...");

  const result: ProcessRemindersResult = {
    processed: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  try {
    // Get pending reminders
    const { success, reminders, error } = await getPendingReminders();

    if (!success || !reminders) {
      console.error("[DocumentReminders] Failed to fetch pending reminders:", error);
      return result;
    }

    console.log(`[DocumentReminders] Found ${reminders.length} pending reminders`);

    // Process each reminder
    for (const reminder of reminders) {
      result.processed++;

      try {
        // Skip if assignment is no longer active
        if (["COMPLETED", "WAIVED", "EXPIRED"].includes(reminder.assignment.status)) {
          console.log(`[DocumentReminders] Skipping reminder ${reminder.id} - assignment not active`);
          result.skipped++;
          await markReminderSent(reminder.id); // Mark as sent to prevent reprocessing
          continue;
        }

        // Send notifications based on reminder type
        const sendResult = await sendReminderNotification(reminder);

        if (sendResult.success) {
          await markReminderSent(reminder.id);
          result.sent++;
          console.log(`[DocumentReminders] Successfully sent reminder ${reminder.id}`);
        } else {
          await markReminderFailed(reminder.id, sendResult.error);
          result.failed++;
          result.errors.push({
            reminderId: reminder.id,
            error: sendResult.error || "Unknown error",
          });
          console.error(`[DocumentReminders] Failed to send reminder ${reminder.id}:`, sendResult.error);
        }
      } catch (error: any) {
        console.error(`[DocumentReminders] Error processing reminder ${reminder.id}:`, error);
        result.failed++;
        result.errors.push({
          reminderId: reminder.id,
          error: error.message || "Unknown error",
        });

        // Mark as failed
        await markReminderFailed(reminder.id, error.message);
      }
    }

    console.log("[DocumentReminders] Processing complete:", {
      processed: result.processed,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped,
    });

    return result;
  } catch (error: any) {
    console.error("[DocumentReminders] Job error:", error);
    result.errors.push({
      reminderId: "job",
      error: error.message || "Job failed",
    });
    return result;
  }
}

/**
 * Send reminder notification based on type (email, in-app, or both)
 */
async function sendReminderNotification(reminder: any): Promise<{ success: boolean; error?: string }> {
  const { assignment, reminderType } = reminder;

  // Get document/bundle name
  const documentName = assignment.template?.name || assignment.bundle?.name || "Document";
  const userName = assignment.user.firstName && assignment.user.lastName
    ? `${assignment.user.firstName} ${assignment.user.lastName}`
    : assignment.user.email;

  // Calculate days until due
  const daysUntilDue = assignment.dueDate
    ? Math.ceil((new Date(assignment.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : 0;

  const results: { email?: boolean; inApp?: boolean } = {};

  // Send email notification
  if (reminderType === "EMAIL" || reminderType === "BOTH") {
    const emailResult = await sendReminderEmail({
      to: assignment.user.email,
      toName: userName,
      documentName,
      dueDate: assignment.dueDate,
      daysUntilDue,
      venueName: assignment.venue?.name || "Staff Portal",
      assignmentId: assignment.id,
    });
    results.email = emailResult.success;
  }

  // Send in-app notification
  if (reminderType === "IN_APP" || reminderType === "BOTH") {
    const inAppResult = await sendInAppReminder({
      userId: assignment.user.id,
      documentName,
      dueDate: assignment.dueDate,
      daysUntilDue,
      assignmentId: assignment.id,
    });
    results.inApp = inAppResult.success;
  }

  // Determine overall success
  const expectedCount = reminderType === "BOTH" ? 2 : 1;
  const successCount = Object.values(results).filter(Boolean).length;

  return {
    success: successCount >= 1, // At least one notification sent
    error: successCount === 0 ? "All notifications failed" : undefined,
  };
}

/**
 * Send reminder email via Brevo
 */
async function sendReminderEmail(data: ReminderEmailData): Promise<{ success: boolean; error?: string }> {
  try {
    const { to, toName, documentName, dueDate, daysUntilDue, venueName, assignmentId } = data;

    // Build email content
    const subject = daysUntilDue > 0
      ? `Reminder: ${documentName} due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`
      : daysUntilDue === 0
      ? `Reminder: ${documentName} is due today`
      : `Overdue: ${documentName} was due ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} ago`;

    const dueDateStr = dueDate
      ? new Date(dueDate).toLocaleDateString("en-AU", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "No due date";

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document Reminder</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Document Reminder</h1>
        </div>
        
        <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb; border-top: none;">
          <p style="font-size: 16px;">Hi ${toName},</p>
          
          <p style="font-size: 16px;">
            ${daysUntilDue > 0
              ? `This is a friendly reminder that <strong>${documentName}</strong> is due in <strong style="color: #f59e0b;">${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}</strong>.`
              : daysUntilDue === 0
              ? `This is a reminder that <strong>${documentName}</strong> is due <strong style="color: #ef4444;">today</strong>.`
              : `<strong style="color: #ef4444;">${documentName}</strong> is overdue and was due ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} ago.`
            }
          </p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #e5e7eb;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #6b7280; padding: 8px 0;">Document:</td>
                <td style="font-weight: 600; padding: 8px 0;">${documentName}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 8px 0;">Due Date:</td>
                <td style="font-weight: 600; padding: 8px 0;">${dueDateStr}</td>
              </tr>
              <tr>
                <td style="color: #6b7280; padding: 8px 0;">Venue:</td>
                <td style="font-weight: 600; padding: 8px 0;">${venueName}</td>
              </tr>
            </table>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || "https://staff-portal.example.com"}/my/documents/${assignmentId}"
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              View Document
            </a>
          </div>
          
          <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
            If you have already completed this document, please disregard this reminder.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center;">
            This is an automated reminder from ${venueName}.<br>
            Please do not reply to this email.
          </p>
        </div>
      </body>
      </html>
    `;

    const textContent = `
Document Reminder

Hi ${toName},

${daysUntilDue > 0
  ? `This is a reminder that ${documentName} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}.`
  : daysUntilDue === 0
  ? `This is a reminder that ${documentName} is due today.`
  : `${documentName} is overdue and was due ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) === 1 ? "" : "s"} ago.`
}

Document: ${documentName}
Due Date: ${dueDateStr}
Venue: ${venueName}

View your document at: ${process.env.NEXT_PUBLIC_APP_URL || "https://staff-portal.example.com"}/my/documents/${assignmentId}

If you have already completed this document, please disregard this reminder.

This is an automated reminder from ${venueName}.
    `.trim();

    const result = await sendBrevoEmail({
      to,
      toName,
      subject,
      htmlContent,
      textContent,
    });

    return {
      success: result.success,
      error: result.success ? undefined : String(result.error),
    };
  } catch (error: any) {
    console.error("[DocumentReminders] Error sending email:", error);
    return {
      success: false,
      error: error.message || "Failed to send email",
    };
  }
}

/**
 * Send in-app notification
 */
async function sendInAppReminder(data: {
  userId: string;
  documentName: string;
  dueDate: Date | null;
  daysUntilDue: number;
  assignmentId: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { userId, documentName, dueDate, daysUntilDue, assignmentId } = data;

    const title = daysUntilDue > 0
      ? `Document due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`
      : daysUntilDue === 0
      ? "Document due today"
      : "Document overdue";

    const message = daysUntilDue > 0
      ? `${documentName} is due in ${daysUntilDue} day${daysUntilDue === 1 ? "" : "s"}`
      : daysUntilDue === 0
      ? `${documentName} is due today`
      : `${documentName} is overdue`;

    await createNotification({
      userId,
      type: "SYSTEM_ANNOUNCEMENT" as NotificationType, // Using existing type
      title,
      message,
      link: `/my/documents/${assignmentId}`,
    });

    return { success: true };
  } catch (error: any) {
    console.error("[DocumentReminders] Error sending in-app notification:", error);
    return {
      success: false,
      error: error.message || "Failed to send notification",
    };
  }
}

// ============================================================================
// Cron Job Handler
// ============================================================================

/**
 * Handler for cron job endpoint
 * Can be called by external cron service or Next.js API route
 */
export async function handleReminderCron(): Promise<{
  success: boolean;
  result?: ProcessRemindersResult;
  error?: string;
}> {
  try {
    // Verify cron secret if set
    const cronSecret = process.env.CRON_SECRET;
    // Note: In actual implementation, you'd verify the secret from headers

    console.log("[DocumentReminders] Cron job triggered at:", new Date().toISOString());

    const result = await processDocumentReminders();

    return {
      success: true,
      result,
    };
  } catch (error: any) {
    console.error("[DocumentReminders] Cron job error:", error);
    return {
      success: false,
      error: error.message || "Cron job failed",
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if reminders should be processed (rate limiting)
 */
export function shouldProcessReminders(): boolean {
  // Could implement rate limiting here
  // For now, always return true
  return true;
}

/**
 * Get reminder processing status
 */
export async function getReminderProcessingStatus(): Promise<{
  lastRun: Date | null;
  nextRun: Date | null;
  pendingCount: number;
}> {
  try {
    const pendingCount = await prisma.documentReminder.count({
      where: { status: "PENDING" },
    });

    // Get last sent reminder
    const lastReminder = await prisma.documentReminder.findFirst({
      where: { status: "SENT" },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    });

    // Calculate next run (assuming cron runs every 15 minutes)
    const now = new Date();
    const nextRun = new Date(now);
    nextRun.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
    nextRun.setSeconds(0);
    nextRun.setMilliseconds(0);

    return {
      lastRun: lastReminder?.sentAt || null,
      nextRun,
      pendingCount,
    };
  } catch (error) {
    console.error("[DocumentReminders] Error getting status:", error);
    return {
      lastRun: null,
      nextRun: null,
      pendingCount: 0,
    };
  }
}
