import { NotificationType } from "@prisma/client";

export interface EmailTemplate {
  subject: string;
  htmlContent: string;
}

/**
 * Escape HTML special characters to prevent XSS attacks
 * Converts dangerous characters to HTML entities
 *
 * @param text - User-generated text to escape
 * @returns Escaped text safe for HTML insertion
 *
 * @security CRITICAL - This function prevents stored XSS in email templates
 */
function escapeHtml(text: string): string {
  const htmlEscapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;',
  };

  return text.replace(/[&<>"'\/]/g, (char) => htmlEscapeMap[char] || char);
}

/**
 * Get email template for a specific notification type
 *
 * @param type - Notification type
 * @param title - Notification title
 * @param message - Notification message
 * @param link - Optional link to app page
 * @param appUrl - Base app URL (from env or default)
 * @returns Email template with subject and HTML content
 *
 * NOTE: Future Enhancement - Admin UI for Template Customization
 * These templates are currently hardcoded but can be moved to database
 * with admin UI for customization (rich text editor, variable placeholders)
 */
export function getEmailTemplate(
  type: NotificationType,
  title: string,
  message: string,
  link?: string | null,
  appUrl: string = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
): EmailTemplate {
  // SECURITY: Escape all user-generated content to prevent XSS
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);

  // Validate and sanitize URLs - only allow relative paths or same domain
  const actionLink = link ? `${appUrl}${link}` : `${appUrl}/notifications`;

  // Base HTML template with professional styling
  const createTemplate = (
    content: string,
    buttonText: string = "View Details",
    accentColor: string = "#3b82f6"
  ) => `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${safeTitle}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
          }
          .header {
            background: ${accentColor};
            color: white;
            padding: 30px 20px;
            text-align: center;
          }
          .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
          }
          .content {
            padding: 40px 30px;
          }
          .content h2 {
            color: #1f2937;
            font-size: 20px;
            margin-top: 0;
            margin-bottom: 20px;
          }
          .content p {
            color: #4b5563;
            margin: 16px 0;
          }
          .button {
            display: inline-block;
            padding: 14px 28px;
            background: ${accentColor};
            color: white !important;
            text-decoration: none;
            border-radius: 6px;
            margin: 24px 0;
            font-weight: 500;
          }
          .button:hover {
            opacity: 0.9;
          }
          .footer {
            background: #f9fafb;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e5e7eb;
          }
          .footer p {
            color: #6b7280;
            font-size: 14px;
            margin: 8px 0;
          }
          .highlight {
            background: #fef3c7;
            padding: 16px;
            border-left: 4px solid #f59e0b;
            margin: 20px 0;
          }
          @media only screen and (max-width: 600px) {
            .content {
              padding: 30px 20px;
            }
            .button {
              display: block;
              text-align: center;
            }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📧 Staff Portal</h1>
          </div>
          <div class="content">
            ${content}
            <a href="${actionLink}" class="button">${buttonText}</a>
          </div>
          <div class="footer">
            <p>This is an automated message from Staff Portal.</p>
            <p>Please do not reply to this email.</p>
            <p style="margin-top: 12px;">
              <a href="${appUrl}" style="color: #3b82f6; text-decoration: none;">Visit Staff Portal</a> |
              <a href="${appUrl}/settings/notifications" style="color: #3b82f6; text-decoration: none;">Notification Settings</a>
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  // Template selection based on notification type
  switch (type) {
    case "NEW_MESSAGE":
      return {
        subject: `💬 New message: ${safeTitle}`,
        htmlContent: createTemplate(
          `
            <h2>You have a new message</h2>
            <p>${safeMessage}</p>
          `,
          "View Message",
          "#3b82f6"
        ),
      };

    case "MESSAGE_REPLY":
      return {
        subject: `↩️ Reply to your message: ${safeTitle}`,
        htmlContent: createTemplate(
          `
            <h2>Someone replied to your message</h2>
            <p>${safeMessage}</p>
          `,
          "View Reply",
          "#8b5cf6"
        ),
      };

    case "MESSAGE_MENTION":
      return {
        subject: `@️ You were mentioned in a message`,
        htmlContent: createTemplate(
          `
            <h2>You were mentioned</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>💡 Tip:</strong> You've been mentioned in a conversation. Click below to see what they said!</p>
            </div>
          `,
          "View Mention",
          "#f59e0b"
        ),
      };

    case "MESSAGE_REACTION":
      return {
        subject: `👍 Reaction to your message`,
        htmlContent: createTemplate(
          `
            <h2>Someone reacted to your message</h2>
            <p>${safeMessage}</p>
          `,
          "View Message",
          "#10b981"
        ),
      };

    case "POST_MENTION":
      return {
        subject: `@ You were mentioned in a post`,
        htmlContent: createTemplate(
          `
            <h2>You were mentioned in a post</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>💡 Tip:</strong> Someone wants your attention on a post. Check it out!</p>
            </div>
          `,
          "View Post",
          "#f59e0b"
        ),
      };

    case "POST_PINNED":
      return {
        subject: `📌 Important post pinned: ${safeTitle}`,
        htmlContent: createTemplate(
          `
            <h2>A post has been pinned</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>📌 Pinned:</strong> This post contains important information for the team.</p>
            </div>
          `,
          "View Post",
          "#6366f1"
        ),
      };

    case "POST_DELETED":
      return {
        subject: `🗑️ Post deleted: ${safeTitle}`,
        htmlContent: createTemplate(
          `
            <h2>A post has been deleted</h2>
            <p>${safeMessage}</p>
          `,
          "View Channel",
          "#ef4444"
        ),
      };

    case "TIME_OFF_REQUEST":
      return {
        subject: `📝 New time-off request awaiting approval`,
        htmlContent: createTemplate(
          `
            <h2>New Time-Off Request</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>⏰ Action Required:</strong> A team member has submitted a time-off request that needs your review.</p>
            </div>
          `,
          "Review Request",
          "#f59e0b"
        ),
      };

    case "TIME_OFF_APPROVED":
      return {
        subject: `✅ Time-off request approved`,
        htmlContent: createTemplate(
          `
            <h2>Good News! Your Time-Off Request Was Approved</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>🎉 Approved:</strong> Your request has been reviewed and approved. Enjoy your time off!</p>
            </div>
          `,
          "View Request",
          "#10b981"
        ),
      };

    case "TIME_OFF_REJECTED":
      return {
        subject: `❌ Time-off request update`,
        htmlContent: createTemplate(
          `
            <h2>Time-Off Request Update</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>ℹ️ Note:</strong> Your request was reviewed. Please check the details and notes from your manager.</p>
            </div>
          `,
          "View Request",
          "#ef4444"
        ),
      };

    case "TIME_OFF_CANCELLED":
      return {
        subject: `🚫 Time-off request cancelled`,
        htmlContent: createTemplate(
          `
            <h2>Time-Off Request Cancelled</h2>
            <p>${safeMessage}</p>
          `,
          "View Details",
          "#6b7280"
        ),
      };

    case "USER_CREATED":
      return {
        subject: `🎉 Welcome to Staff Portal!`,
        htmlContent: createTemplate(
          `
            <h2>Welcome to Staff Portal!</h2>
            <p>Your account has been successfully created.</p>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>👋 Get Started:</strong> Click below to complete your profile and explore the portal!</p>
            </div>
          `,
          "Complete Profile",
          "#10b981"
        ),
      };

    case "USER_UPDATED":
      return {
        subject: `📝 Your profile has been updated`,
        htmlContent: createTemplate(
          `
            <h2>Profile Update</h2>
            <p>${safeMessage}</p>
          `,
          "View Profile",
          "#3b82f6"
        ),
      };

    case "ROLE_CHANGED":
      return {
        subject: `🔐 Your role has been updated`,
        htmlContent: createTemplate(
          `
            <h2>Role Update</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>ℹ️ Important:</strong> Your permissions and access level may have changed. Please review your new role.</p>
            </div>
          `,
          "View Account",
          "#8b5cf6"
        ),
      };

    case "SYSTEM_ANNOUNCEMENT":
      return {
        subject: `📢 Announcement: ${safeTitle}`,
        htmlContent: createTemplate(
          `
            <h2>${safeTitle}</h2>
            <p>${safeMessage}</p>
            <div class="highlight">
              <p style="margin: 0;"><strong>📢 Important Announcement:</strong> Please read this message carefully as it may affect your work.</p>
            </div>
          `,
          "View Details",
          "#f59e0b"
        ),
      };

    case "GROUP_REMOVED":
      return {
        subject: `👥 Removed from conversation`,
        htmlContent: createTemplate(
          `
            <h2>Conversation Update</h2>
            <p>${safeMessage}</p>
          `,
          "View Messages",
          "#6b7280"
        ),
      };

    // Default fallback template
    default:
      return {
        subject: title,
        htmlContent: createTemplate(
          `
            <h2>${safeTitle}</h2>
            <p>${safeMessage}</p>
          `,
          "View Details",
          "#3b82f6"
        ),
      };
  }
}
