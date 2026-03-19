import { Prisma } from "@prisma/client";
import { createHmac } from "crypto";
import { sendBrevoEmail } from "@/lib/services/email/brevo";

export type ReportDeliveryChannel = "EMAIL" | "WEBHOOK";

export interface ReportDeliveryConfig {
  channel: ReportDeliveryChannel;
  destination: string;
}

export interface ReportDeliveryPayload {
  reportDefinitionId: string;
  reportDefinitionName: string;
  reportType: string;
  generatedAt: string;
  resultJson: Prisma.JsonValue;
}

export interface ReportDeliveryOutcome {
  attempted: boolean;
  delivered: boolean;
  attemptedAt: string;
  completedAt: string;
  error?: string;
  responseStatus?: number;
  messageIds?: string[];
  attempts: ReportDeliveryAttempt[];
  retryPolicy: {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    strategy: "exponential_backoff_jitter";
  };
}

export interface ReportDeliveryAttempt {
  target: string;
  attempt: number;
  startedAt: string;
  completedAt: string;
  delivered: boolean;
  error?: string;
  responseStatus?: number;
  messageId?: string;
}

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_BASE_DELAY_MS = 400;
const DEFAULT_MAX_DELAY_MS = 5_000;
const WEBHOOK_TIMEOUT_MS = 10_000;

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

const DELIVERY_MAX_ATTEMPTS = Math.min(
  readPositiveInt(process.env.REPORT_DELIVERY_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS),
  5
);
const DELIVERY_BASE_DELAY_MS = readPositiveInt(
  process.env.REPORT_DELIVERY_BASE_DELAY_MS,
  DEFAULT_BASE_DELAY_MS
);
const DELIVERY_MAX_DELAY_MS = readPositiveInt(
  process.env.REPORT_DELIVERY_MAX_DELAY_MS,
  DEFAULT_MAX_DELAY_MS
);

function toText(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return JSON.stringify(value);
}

function parseEmailDestinations(destination: string): string[] {
  return destination
    .split(/[,\n;]/g)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBackoffDelayMs(attempt: number): number {
  const exponential = DELIVERY_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1);
  const jitter = Math.floor(Math.random() * 200);
  return Math.min(DELIVERY_MAX_DELAY_MS, exponential + jitter);
}

function isRetryableWebhookStatus(status: number): boolean {
  return status >= 500 || status === 408 || status === 409 || status === 425 || status === 429;
}

function isRetryableEmailError(errorText: string): boolean {
  const normalized = errorText.toLowerCase();
  if (normalized.includes("not configured")) {
    return false;
  }
  if (normalized.includes("invalid email")) {
    return false;
  }
  return true;
}

function buildEmailContent(payload: ReportDeliveryPayload): {
  subject: string;
  htmlContent: string;
  textContent: string;
} {
  const summary =
    payload.resultJson &&
    typeof payload.resultJson === "object" &&
    !Array.isArray(payload.resultJson) &&
    "summary" in payload.resultJson
      ? (payload.resultJson as { summary?: unknown }).summary
      : null;

  const summaryText = toText(summary || payload.resultJson);

  return {
    subject: `Email Report: ${payload.reportDefinitionName}`,
    htmlContent: `
      <h2>Email Report: ${payload.reportDefinitionName}</h2>
      <p><strong>Type:</strong> ${payload.reportType}</p>
      <p><strong>Generated:</strong> ${payload.generatedAt}</p>
      <h3>Summary</h3>
      <pre style="white-space: pre-wrap; font-family: monospace;">${summaryText}</pre>
    `,
    textContent: [
      `Email Report: ${payload.reportDefinitionName}`,
      `Type: ${payload.reportType}`,
      `Generated: ${payload.generatedAt}`,
      "",
      "Summary:",
      summaryText,
    ].join("\n"),
  };
}

export function extractDeliveryConfigFromConfigJson(
  configJson: Prisma.JsonValue
): ReportDeliveryConfig | null {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return null;
  }

  const delivery = (configJson as { delivery?: unknown }).delivery;
  if (!delivery || typeof delivery !== "object" || Array.isArray(delivery)) {
    return null;
  }

  const channel = (delivery as { channel?: unknown }).channel;
  const destination = (delivery as { destination?: unknown }).destination;

  if ((channel !== "EMAIL" && channel !== "WEBHOOK") || typeof destination !== "string") {
    return null;
  }

  const trimmedDestination = destination.trim();
  if (!trimmedDestination) {
    return null;
  }

  return {
    channel,
    destination: trimmedDestination,
  };
}

export function buildRunDeliveryMetadata(
  config: ReportDeliveryConfig,
  outcome: ReportDeliveryOutcome
): Prisma.InputJsonValue {
  return ({
    channel: config.channel,
    destination: config.destination,
    dispatch: {
      attempted: outcome.attempted,
      delivered: outcome.delivered,
      attemptedAt: outcome.attemptedAt,
      completedAt: outcome.completedAt,
      error: outcome.error || null,
      responseStatus: outcome.responseStatus || null,
      messageIds: outcome.messageIds || [],
      attempts: outcome.attempts,
      retryPolicy: outcome.retryPolicy,
    },
  } as unknown) as Prisma.InputJsonValue;
}

export async function dispatchReportDelivery(
  config: ReportDeliveryConfig,
  payload: ReportDeliveryPayload
): Promise<ReportDeliveryOutcome> {
  const attemptedAt = new Date().toISOString();
  const baseOutcome = {
    attempted: true,
    attemptedAt,
    retryPolicy: {
      maxAttempts: DELIVERY_MAX_ATTEMPTS,
      baseDelayMs: DELIVERY_BASE_DELAY_MS,
      maxDelayMs: DELIVERY_MAX_DELAY_MS,
      strategy: "exponential_backoff_jitter" as const,
    },
  };

  try {
    if (config.channel === "EMAIL") {
      const recipients = parseEmailDestinations(config.destination);
      if (recipients.length === 0) {
        return {
          ...baseOutcome,
          delivered: false,
          completedAt: new Date().toISOString(),
          error: "No valid email destinations configured.",
          attempts: [],
        };
      }

      const content = buildEmailContent(payload);
      const messageIds: string[] = [];
      const failures: string[] = [];
      const attempts: ReportDeliveryAttempt[] = [];

      for (const recipient of recipients) {
        let deliveredRecipient = false;
        let recipientError = "";

        for (let attempt = 1; attempt <= DELIVERY_MAX_ATTEMPTS; attempt += 1) {
          const startedAt = new Date().toISOString();
          try {
            const result = await sendBrevoEmail({
              to: recipient,
              subject: content.subject,
              htmlContent: content.htmlContent,
              textContent: content.textContent,
            });

            if (result.success) {
              const completedAt = new Date().toISOString();
              attempts.push({
                target: recipient,
                attempt,
                startedAt,
                completedAt,
                delivered: true,
                messageId: result.messageId,
              });
              deliveredRecipient = true;
              if (result.messageId) {
                messageIds.push(result.messageId);
              }
              break;
            }

            recipientError = typeof result.error === "string" ? result.error : "Failed to send";
            const completedAt = new Date().toISOString();
            attempts.push({
              target: recipient,
              attempt,
              startedAt,
              completedAt,
              delivered: false,
              error: recipientError,
            });

            if (attempt < DELIVERY_MAX_ATTEMPTS && isRetryableEmailError(recipientError)) {
              await sleep(getBackoffDelayMs(attempt));
            } else {
              break;
            }
          } catch (error) {
            recipientError = String(error);
            const completedAt = new Date().toISOString();
            attempts.push({
              target: recipient,
              attempt,
              startedAt,
              completedAt,
              delivered: false,
              error: recipientError,
            });

            if (attempt < DELIVERY_MAX_ATTEMPTS && isRetryableEmailError(recipientError)) {
              await sleep(getBackoffDelayMs(attempt));
            } else {
              break;
            }
          }
        }

        if (!deliveredRecipient) {
          failures.push(recipient);
        }
      }

      if (failures.length > 0) {
        return {
          ...baseOutcome,
          delivered: false,
          completedAt: new Date().toISOString(),
          error: `Delivery failed for: ${failures.join(", ")}`,
          messageIds,
          attempts,
        };
      }

      return {
        ...baseOutcome,
        delivered: true,
        completedAt: new Date().toISOString(),
        messageIds,
        attempts,
      };
    }

    const signingSecret = process.env.REPORT_DELIVERY_WEBHOOK_SECRET;
    if (!signingSecret) {
      return {
        ...baseOutcome,
        delivered: false,
        completedAt: new Date().toISOString(),
        error: "REPORT_DELIVERY_WEBHOOK_SECRET is not configured.",
        attempts: [],
      };
    }

    const body = JSON.stringify(payload);
    const attempts: ReportDeliveryAttempt[] = [];
    let lastError = "";
    let lastStatus: number | undefined;

    for (let attempt = 1; attempt <= DELIVERY_MAX_ATTEMPTS; attempt += 1) {
      const startedAt = new Date().toISOString();
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = createHmac("sha256", signingSecret)
        .update(`${timestamp}.${body}`)
        .digest("hex");

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
      try {
        const response = await fetch(config.destination, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-staff-portal-report-id": payload.reportDefinitionId,
            "x-staff-portal-report-timestamp": timestamp,
            "x-staff-portal-report-signature": signature,
          },
          body,
          signal: controller.signal,
        });

        const completedAt = new Date().toISOString();
        lastStatus = response.status;

        if (response.ok) {
          attempts.push({
            target: config.destination,
            attempt,
            startedAt,
            completedAt,
            delivered: true,
            responseStatus: response.status,
          });

          return {
            ...baseOutcome,
            delivered: true,
            completedAt: new Date().toISOString(),
            responseStatus: response.status,
            attempts,
          };
        }

        const responseText = await response.text().catch(() => "");
        lastError = `Webhook responded with ${response.status}${responseText ? `: ${responseText}` : ""}`;
        attempts.push({
          target: config.destination,
          attempt,
          startedAt,
          completedAt,
          delivered: false,
          responseStatus: response.status,
          error: lastError,
        });

        if (attempt < DELIVERY_MAX_ATTEMPTS && isRetryableWebhookStatus(response.status)) {
          await sleep(getBackoffDelayMs(attempt));
        } else {
          break;
        }
      } catch (error) {
        lastError = String(error);
        attempts.push({
          target: config.destination,
          attempt,
          startedAt,
          completedAt: new Date().toISOString(),
          delivered: false,
          error: lastError,
        });

        if (attempt < DELIVERY_MAX_ATTEMPTS) {
          await sleep(getBackoffDelayMs(attempt));
        } else {
          break;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    return {
      ...baseOutcome,
      delivered: false,
      completedAt: new Date().toISOString(),
      error: lastError || "Webhook delivery failed.",
      responseStatus: lastStatus,
      attempts,
    };
  } catch (error) {
    return {
      ...baseOutcome,
      delivered: false,
      completedAt: new Date().toISOString(),
      error: String(error),
      attempts: [],
    }
  }
}
