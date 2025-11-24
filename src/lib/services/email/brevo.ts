import { TransactionalEmailsApi, SendSmtpEmail } from "@getbrevo/brevo";

// Initialize Brevo API lazily to ensure env vars are loaded
let emailAPI: TransactionalEmailsApi | null = null;

function getEmailAPI(): TransactionalEmailsApi {
  if (!emailAPI) {
    emailAPI = new TransactionalEmailsApi();
    emailAPI.setApiKey(0, process.env.BREVO_API_KEY || "");
  }
  return emailAPI;
}

const getSenderEmail = () => process.env.BREVO_SENDER_EMAIL || "noreply@example.com";
const getSenderName = () => process.env.BREVO_SENDER_NAME || "Staff Portal";

export interface SendEmailParams {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: unknown;
}

/**
 * Send an email using Brevo (formerly Sendinblue)
 *
 * @param params - Email parameters
 * @returns Result with success status and messageId
 *
 * @example
 * ```typescript
 * const result = await sendBrevoEmail({
 *   to: "user@example.com",
 *   toName: "John Doe",
 *   subject: "Welcome to Staff Portal",
 *   htmlContent: "<h1>Welcome!</h1><p>Thanks for joining.</p>",
 * });
 *
 * if (result.success) {
 *   console.log("Email sent:", result.messageId);
 * }
 * ```
 */
export async function sendBrevoEmail(
  params: SendEmailParams
): Promise<SendEmailResult> {
  try {
    // Validate environment variables
    if (!process.env.BREVO_API_KEY) {
      console.warn("[BREVO] API key not configured - skipping email send");
      return {
        success: false,
        error: "BREVO_API_KEY not configured",
      };
    }

    // Create email message
    const message = new SendSmtpEmail();
    message.subject = params.subject;
    message.htmlContent = params.htmlContent;
    message.textContent =
      params.textContent || stripHtmlTags(params.htmlContent);
    message.sender = { name: getSenderName(), email: getSenderEmail() };
    message.to = [{ email: params.to, name: params.toName || params.to }];

    // Send email via Brevo API
    const api = getEmailAPI();
    const response = await api.sendTransacEmail(message);

    console.log("[BREVO] Email sent successfully:", {
      to: params.to,
      subject: params.subject,
      messageId: response.body?.messageId,
    });

    return {
      success: true,
      messageId: response.body?.messageId,
    };
  } catch (error: any) {
    console.error("[BREVO] Error sending email:", {
      to: params.to,
      subject: params.subject,
      error,
      errorResponse: error?.response?.data, // Log the actual error message from Brevo
    });

    return {
      success: false,
      error,
    };
  }
}

/**
 * Strip HTML tags from content to create plain text version
 * Simple implementation for fallback text content
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}
