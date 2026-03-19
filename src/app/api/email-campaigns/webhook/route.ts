import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BrevoWebhookBody;

    // Verify webhook signature in production if available.
    const eventType = body.event;
    const messageId = body["message-id"];
    const email = body.email;

    if (!eventType || !messageId || !email) {
      return NextResponse.json(
        { status: "error", error: "Missing required webhook fields" },
        { status: 400 }
      );
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

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error processing Brevo webhook:", error);
    return NextResponse.json({ status: "error" }, { status: 500 });
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
