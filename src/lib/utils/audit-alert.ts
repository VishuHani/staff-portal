/**
 * Audit Log Alerting System
 *
 * Handles audit log failures to ensure compliance and data integrity.
 *
 * Features:
 * - Email alerts to admins when audit log creation fails
 * - Backup audit log storage (file system fallback)
 * - Automatic retry mechanism
 * - Critical for SOC 2, GDPR, HIPAA compliance
 *
 * Usage:
 * ```ts
 * await handleAuditLogFailure(auditData, error);
 * ```
 */

import { sendBrevoEmail } from "@/lib/services/email/brevo";
import { prisma } from "@/lib/prisma";
import * as fs from "fs/promises";
import * as path from "path";

export interface AuditLogData {
  userId: string;
  actionType: string;
  resourceType: string;
  resourceId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
}

/**
 * Backup audit log to file system
 *
 * Creates a daily log file in logs/audit/ directory
 * Format: YYYY-MM-DD.log (one file per day for easy rotation)
 */
async function backupAuditLogToFile(auditData: AuditLogData): Promise<boolean> {
  try {
    // Create logs directory if it doesn't exist
    const logsDir = path.join(process.cwd(), "logs", "audit");
    await fs.mkdir(logsDir, { recursive: true });

    // Create daily log file (YYYY-MM-DD.log)
    const today = new Date().toISOString().split("T")[0];
    const logFile = path.join(logsDir, `${today}.log`);

    // Format log entry as JSON line
    const logEntry = {
      timestamp: new Date().toISOString(),
      ...auditData,
      source: "BACKUP_FALLBACK",
    };

    const logLine = JSON.stringify(logEntry) + "\n";

    // Append to log file
    await fs.appendFile(logFile, logLine, "utf-8");

    console.log(`✅ Audit log backed up to file: ${logFile}`);
    return true;
  } catch (error) {
    console.error("❌ Failed to backup audit log to file:", error);
    return false;
  }
}

/**
 * Get admin emails for alerting
 */
async function getAdminEmails(): Promise<string[]> {
  try {
    const admins = await prisma.user.findMany({
      where: {
        active: true,
        role: {
          name: "ADMIN",
        },
      },
      select: {
        email: true,
      },
    });

    return admins.map((admin) => admin.email);
  } catch (error) {
    console.error("Error fetching admin emails:", error);
    // Fallback to environment variable if database query fails
    const fallbackEmail = process.env.ADMIN_ALERT_EMAIL;
    return fallbackEmail ? [fallbackEmail] : [];
  }
}

/**
 * Send alert email to admins
 */
async function sendAuditLogFailureAlert(
  auditData: AuditLogData,
  error: Error,
  backupSuccess: boolean
): Promise<void> {
  try {
    const adminEmails = await getAdminEmails();

    if (adminEmails.length === 0) {
      console.warn(
        "⚠️  No admin emails found for audit log failure alert. Set ADMIN_ALERT_EMAIL in .env"
      );
      return;
    }

    const subject = `🚨 CRITICAL: Audit Log Failure - ${auditData.actionType}`;

    const message = `
CRITICAL AUDIT LOG FAILURE

An audit log entry failed to be created in the database. This is a compliance issue that requires immediate attention.

=== AUDIT LOG DETAILS ===
Action Type: ${auditData.actionType}
Resource Type: ${auditData.resourceType}
Resource ID: ${auditData.resourceId || "N/A"}
User ID: ${auditData.userId}
IP Address: ${auditData.ipAddress || "N/A"}
Timestamp: ${new Date().toISOString()}

=== ERROR DETAILS ===
Error Message: ${error.message}
Error Name: ${error.name}
Stack Trace: ${error.stack || "N/A"}

=== BACKUP STATUS ===
File System Backup: ${backupSuccess ? "✅ SUCCESS" : "❌ FAILED"}
${backupSuccess ? `Backup Location: logs/audit/${new Date().toISOString().split("T")[0]}.log` : ""}

=== RECOMMENDED ACTIONS ===
1. Check database connectivity and health
2. Review database disk space and resources
3. Verify audit log table schema and constraints
4. ${backupSuccess ? "Restore from backup file when database is recovered" : "CRITICAL: No backup available - data loss occurred"}
5. Investigate root cause to prevent future failures

=== COMPLIANCE IMPACT ===
This failure affects compliance with:
- SOC 2 Type II (requires comprehensive audit trail)
- GDPR Article 30 (record of processing activities)
- HIPAA § 164.308(a)(1)(ii)(D) (information system activity review)

Immediate attention required.

---
This is an automated alert from the Staff Portal Audit System.
Server: ${process.env.NEXT_PUBLIC_APP_URL || "localhost"}
Environment: ${process.env.NODE_ENV || "development"}
`.trim();

    // Send email to all admins
    for (const email of adminEmails) {
      try {
        await sendBrevoEmail({
          to: email,
          subject,
          htmlContent: message.replace(/\n/g, "<br>"),
          textContent: message,
        });
      } catch (emailError) {
        console.error(`Failed to send alert email to ${email}:`, emailError);
        // Continue to next admin even if one email fails
      }
    }

    console.log(
      `📧 Audit log failure alerts sent to ${adminEmails.length} admin(s)`
    );
  } catch (error) {
    console.error("Error sending audit log failure alert:", error);
    // Don't throw - alerting failure shouldn't break the app
  }
}

/**
 * Handle audit log creation failure
 *
 * This function is called when createAuditLog fails.
 * It performs three critical actions:
 * 1. Backs up the audit log to file system
 * 2. Sends alert emails to admins
 * 3. Logs detailed error information
 *
 * @param auditData - The audit log data that failed to be created
 * @param error - The error that occurred
 */
export async function handleAuditLogFailure(
  auditData: AuditLogData,
  error: Error
): Promise<void> {
  console.error("🚨 CRITICAL: Audit log creation failed:", {
    auditData,
    error: error.message,
    stack: error.stack,
  });

  // Step 1: Backup to file system (critical for data recovery)
  const backupSuccess = await backupAuditLogToFile(auditData);

  // Step 2: Alert admins (compliance requirement)
  await sendAuditLogFailureAlert(auditData, error, backupSuccess);

  // Step 3: Log to console with high visibility
  console.error(`
╔═══════════════════════════════════════════════════════════════╗
║                  AUDIT LOG FAILURE DETECTED                    ║
║                                                                 ║
║  This is a CRITICAL compliance issue requiring immediate       ║
║  attention. Audit logs are required for regulatory compliance. ║
║                                                                 ║
║  Action: ${auditData.actionType.padEnd(48)}║
║  User: ${auditData.userId.padEnd(50)}║
║  Backup: ${(backupSuccess ? "✅ SUCCESS" : "❌ FAILED").padEnd(47)}║
║                                                                 ║
╚═══════════════════════════════════════════════════════════════╝
  `);
}

/**
 * Retry audit log creation with exponential backoff
 *
 * Attempts to create audit log up to 3 times with increasing delays
 *
 * @param auditData - The audit log data to create
 * @param attempt - Current attempt number (1-based)
 * @returns true if successful, false otherwise
 */
export async function retryAuditLogCreation(
  auditData: AuditLogData,
  attempt: number = 1
): Promise<boolean> {
  const maxAttempts = 3;
  const baseDelay = 100; // milliseconds

  try {
    await prisma.auditLog.create({
      data: {
        userId: auditData.userId,
        actionType: auditData.actionType,
        resourceType: auditData.resourceType,
        resourceId: auditData.resourceId,
        oldValue: auditData.oldValue,
        newValue: auditData.newValue,
        ipAddress: auditData.ipAddress,
      },
    });

    if (attempt > 1) {
      console.log(`✅ Audit log created successfully on retry ${attempt}`);
    }

    return true;
  } catch (error) {
    if (attempt < maxAttempts) {
      // Exponential backoff: 100ms, 200ms, 400ms
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(
        `Retrying audit log creation (attempt ${attempt + 1}/${maxAttempts}) in ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryAuditLogCreation(auditData, attempt + 1);
    }

    // All retries failed
    console.error(
      `❌ Failed to create audit log after ${maxAttempts} attempts`
    );
    return false;
  }
}
