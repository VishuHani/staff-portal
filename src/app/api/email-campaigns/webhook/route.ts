import { Prisma } from "@prisma/client";
import { NextRequest } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { emailWebhookRateLimiter } from "@/lib/utils/public-rate-limit";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

type BrevoWebhookBody = {
  event?: string;
  email?: string;
  "message-id"?: string;
  campaign_id?: string | null;
  url?: string;
  device_type?: string;
  reason?: string;
  bounce_reason?: string;
  bounce_type?: string;
  [key: string]: unknown;
};

const SENT_STATUSES = new Set([
  "SENT",
  "DELIVERED",
  "OPENED",
  "CLICKED",
  "BOUNCED",
  "UNSUBSCRIBED",
  "COMPLAINED",
  "FAILED",
]);

async function safeUpdateUserPreference(
  userId: string,
  data: Prisma.UserEmailPreferenceUpdateInput
) {
  try {
    await prisma.userEmailPreference.update({
      where: { userId },
      data,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return;
    }
    throw error;
  }
}

function verifyWebhookSignature(rawBody: string, request: NextRequest): boolean {
  const signatureSecret =
    process.env.BREVO_WEBHOOK_SIGNATURE_SECRET || process.env.BREVO_WEBHOOK_SECRET;

  if (!signatureSecret) {
    return false;
  }

  const signatureHeader =
    request.headers.get("x-brevo-signature") ||
    request.headers.get("x-webhook-signature");

  if (!signatureHeader) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac("sha256", signatureSecret)
    .update(rawBody)
    .digest("hex");

  const normalizedProvided = signatureHeader.trim().toLowerCase();
  const normalizedExpected = expectedSignature.toLowerCase();

  if (normalizedProvided.length !== normalizedExpected.length) {
    return false;
  }

  return crypto.timingSafeEqual(
    Buffer.from(normalizedProvided),
    Buffer.from(normalizedExpected)
  );
}

function verifyWebhookToken(request: NextRequest): boolean {
  const expectedToken = process.env.BREVO_WEBHOOK_TOKEN;
  if (!expectedToken) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return false;
  }

  const providedToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  return providedToken === expectedToken;
}

export async function POST(request: NextRequest) {
  try {
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rateLimit = await emailWebhookRateLimiter.check(ipAddress);
    if (!rateLimit.allowed) {
      const response = apiError(
        rateLimit.reason || "Rate limit exceeded. Please try again later.",
        429
      );

      if (rateLimit.retryAfter) {
        response.headers.set("Retry-After", String(rateLimit.retryAfter));
      }

      return response;
    }

    const isProduction = process.env.NODE_ENV === "production";
    const hasTokenVerifier = !!process.env.BREVO_WEBHOOK_TOKEN;
    const hasSignatureVerifier = !!(
      process.env.BREVO_WEBHOOK_SIGNATURE_SECRET || process.env.BREVO_WEBHOOK_SECRET
    );

    if (isProduction && !hasTokenVerifier && !hasSignatureVerifier) {
      return apiError("Webhook verification is not configured", 503);
    }

    const rawBody = await request.text();

    if (hasTokenVerifier && !verifyWebhookToken(request)) {
      return apiError("Invalid webhook authorization token", 401);
    }

    if (!hasTokenVerifier && hasSignatureVerifier && !verifyWebhookSignature(rawBody, request)) {
      return apiError("Invalid webhook signature", 401);
    }

    const body = JSON.parse(rawBody) as BrevoWebhookBody;

    // Verify webhook signature in production if available.
    const eventType = body.event;
    const messageId = body["message-id"];
    const email = body.email;

    if (!eventType || !messageId || !email) {
      return apiError("Missing required webhook fields", 400);
    }

    await prisma.emailWebhookEvent.create({
      data: {
        eventType,
        brevoMessageId: messageId,
        campaignId: body.campaign_id || null,
        recipientEmail: email,
        eventData: body as unknown as Prisma.InputJsonValue,
      },
    });

    switch (eventType) {
      case "sent":
        await handleSentEvent(messageId);
        break;
      case "delivered":
        await handleDeliveredEvent(messageId);
        break;
      case "opened":
        await handleOpenedEvent(messageId, body);
        break;
      case "clicked":
        await handleClickedEvent(messageId, body);
        break;
      case "hardBounce":
      case "softBounce":
        await handleBounceEvent(messageId, body);
        break;
      case "spam":
        await handleSpamEvent(messageId);
        break;
      case "unsubscribed":
        await handleUnsubscribedEvent(messageId);
        break;
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    await prisma.emailWebhookEvent.updateMany({
      where: { brevoMessageId: messageId },
      data: { processed: true, processedAt: new Date() },
    });

    return apiSuccess({ status: "ok" });
  } catch (error) {
    console.error("Error processing Brevo webhook:", error);
    return apiError("Error processing Brevo webhook");
  }
}

async function findRecipient(messageId: string) {
  return prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
}

async function handleSentEvent(messageId: string) {
  const recipient = await findRecipient(messageId);
  if (!recipient) {
    return;
  }

  await prisma.emailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "SENT",
      sentAt: new Date(),
    },
  });
}

async function handleDeliveredEvent(messageId: string) {
  const recipient = await findRecipient(messageId);
  if (!recipient) {
    return;
  }

  await prisma.emailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "DELIVERED",
      deliveredAt: new Date(),
    },
  });

  await updateCampaignStats(recipient.campaignId);
}

async function handleOpenedEvent(messageId: string, data: BrevoWebhookBody) {
  const recipient = await findRecipient(messageId);
  if (!recipient) {
    return;
  }

  await prisma.emailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "OPENED",
      openedAt: new Date(),
      openedCount: { increment: 1 },
      deviceType: data.device_type || null,
    },
  });

  await safeUpdateUserPreference(recipient.userId, {
    lastOpenedAt: new Date(),
    totalOpens: { increment: 1 },
  });

  await updateCampaignStats(recipient.campaignId);
}

async function handleClickedEvent(messageId: string, data: BrevoWebhookBody) {
  const recipient = await findRecipient(messageId);
  if (!recipient) {
    return;
  }

  const existingClickedUrls = Array.isArray(recipient.clickedUrls)
    ? (recipient.clickedUrls as Array<Record<string, unknown>>)
    : [];

  const newClick = {
    url: typeof data.url === "string" ? data.url : "",
    timestamp: new Date().toISOString(),
  };

  await prisma.emailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "CLICKED",
      clickedAt: new Date(),
      clickedCount: { increment: 1 },
      clickedUrls: [...existingClickedUrls, newClick] as Prisma.InputJsonValue,
    },
  });

  await safeUpdateUserPreference(recipient.userId, {
    lastClickedAt: new Date(),
    totalClicks: { increment: 1 },
  });

  await updateCampaignStats(recipient.campaignId);
}

async function handleBounceEvent(messageId: string, data: BrevoWebhookBody) {
  const recipient = await findRecipient(messageId);
  if (!recipient) {
    return;
  }

  await prisma.emailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "BOUNCED",
      bounceReason:
        (typeof data.reason === "string" ? data.reason : null) ||
        (typeof data.bounce_reason === "string" ? data.bounce_reason : null),
      bounceType: typeof data.bounce_type === "string" ? data.bounce_type : null,
    },
  });

  await updateCampaignStats(recipient.campaignId);
}

async function handleSpamEvent(messageId: string) {
  const recipient = await findRecipient(messageId);
  if (!recipient) {
    return;
  }

  await prisma.emailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "COMPLAINED",
      complainedAt: new Date(),
    },
  });

  await updateCampaignStats(recipient.campaignId);
}

async function handleUnsubscribedEvent(messageId: string) {
  const recipient = await findRecipient(messageId);
  if (!recipient) {
    return;
  }

  await prisma.emailRecipient.update({
    where: { id: recipient.id },
    data: {
      status: "UNSUBSCRIBED",
      unsubscribedAt: new Date(),
    },
  });

  await safeUpdateUserPreference(recipient.userId, {
    receiveMarketing: false,
    unsubscribedAt: new Date(),
    unsubscribedFrom: { push: "MARKETING" },
  });

  await updateCampaignStats(recipient.campaignId);
}

async function updateCampaignStats(campaignId: string) {
  const recipients = await prisma.emailRecipient.findMany({
    where: { campaignId },
    select: { status: true },
  });

  const totalSent = recipients.filter((recipient) => SENT_STATUSES.has(recipient.status)).length;
  const delivered = recipients.filter((recipient) => recipient.status === "DELIVERED").length;
  const opened = recipients.filter(
    (recipient) => recipient.status === "OPENED" || recipient.status === "CLICKED"
  ).length;
  const clicked = recipients.filter((recipient) => recipient.status === "CLICKED").length;
  const bounced = recipients.filter((recipient) => recipient.status === "BOUNCED").length;
  const unsubscribed = recipients.filter(
    (recipient) => recipient.status === "UNSUBSCRIBED"
  ).length;
  const complained = recipients.filter((recipient) => recipient.status === "COMPLAINED").length;

  const openRate = totalSent > 0 ? opened / totalSent : 0;
  const clickRate = totalSent > 0 ? clicked / totalSent : 0;
  const clickToOpenRate = opened > 0 ? clicked / opened : 0;
  const bounceRate = totalSent > 0 ? bounced / totalSent : 0;
  const unsubscribeRate = totalSent > 0 ? unsubscribed / totalSent : 0;
  const complaintRate = totalSent > 0 ? complained / totalSent : 0;

  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      deliveredCount: delivered,
      openedCount: opened,
      clickedCount: clicked,
      bouncedCount: bounced,
      unsubscribedCount: unsubscribed,
      complaintCount: complained,
    },
  });

  await prisma.emailCampaignAnalytics.upsert({
    where: { campaignId },
    update: {
      openRate,
      clickRate,
      clickToOpenRate,
      bounceRate,
      unsubscribeRate,
      complaintRate,
      updatedAt: new Date(),
    },
    create: {
      campaignId,
      openRate,
      clickRate,
      clickToOpenRate,
      bounceRate,
      unsubscribeRate,
      complaintRate,
    },
  });
}
