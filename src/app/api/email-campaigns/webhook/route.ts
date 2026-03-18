import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Verify webhook signature (optional but recommended)
    // In production, you should verify the signature comes from Brevo
    
    const eventType = body.event;
    const messageId = body["message-id"];
    const email = body.email;
    
    // Log the webhook event
    await prisma.emailWebhookEvent.create({
      data: {
        eventType,
        brevoMessageId: messageId,
        campaignId: body.campaign_id || null,
        recipientEmail: email,
        eventData: body,
      },
    });

    // Process different event types
    switch (eventType) {
      case "sent":
        await handleSentEvent(messageId, email, body);
        break;
      case "delivered":
        await handleDeliveredEvent(messageId, email, body);
        break;
      case "opened":
        await handleOpenedEvent(messageId, email, body);
        break;
      case "clicked":
        await handleClickedEvent(messageId, email, body);
        break;
      case "hardBounce":
      case "softBounce":
        await handleBounceEvent(messageId, email, body);
        break;
      case "spam":
        await handleSpamEvent(messageId, email, body);
        break;
      case "unsubscribed":
        await handleUnsubscribedEvent(messageId, email, body);
        break;
      default:
        console.log(`Unhandled webhook event type: ${eventType}`);
    }

    // Mark event as processed
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

async function handleSentEvent(messageId: string, email: string, data: any) {
  const recipient = await prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
  
  if (recipient) {
    await prisma.emailRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });
  }
}

async function handleDeliveredEvent(messageId: string, email: string, data: any) {
  const recipient = await prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
  
  if (recipient) {
    await prisma.emailRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "DELIVERED",
        deliveredAt: new Date(),
      },
    });
    
    // Update campaign stats
    await updateCampaignStats(recipient.campaignId);
  }
}

async function handleOpenedEvent(messageId: string, email: string, data: any) {
  const recipient = await prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
  
  if (recipient) {
    await prisma.emailRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "OPENED",
        openedAt: new Date(),
        openedCount: { increment: 1 },
        deviceType: data.device_type || null,
      },
    });
    
    // Update user engagement
    await prisma.userEmailPreference.update({
      where: { userId: recipient.userId },
      data: {
        lastOpenedAt: new Date(),
        totalOpens: { increment: 1 },
      },
    });
    
    // Update campaign stats
    await updateCampaignStats(recipient.campaignId);
  }
}

}

async function handleClickedEvent(messageId: string, email: string, data: any) {
  const recipient = await prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
  
  if (recipient) {
    const clickedUrls = recipient.clickedUrls as any || {};
    const newClick = {
      url: data.url,
      timestamp: new Date().toISOString(),
    };
    
    await prisma.emailRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "CLICKED",
        clickedAt: new Date(),
        clickedCount: { increment: 1 },
        clickedUrls: [...(clickedUrls || []), newClick],
      },
    });
    
    // Update user engagement
    await prisma.userEmailPreference.update({
      where: { userId: recipient.userId },
      data: {
        lastClickedAt: new Date(),
        totalClicks: { increment: 1 },
      },
    });
    
    // Update campaign stats
    await updateCampaignStats(recipient.campaignId);
  }
}

async function handleBounceEvent(messageId: string, email: string, data: any) {
  const recipient = await prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
  
  if (recipient) {
    await prisma.emailRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "BOUNCED",
        bounceReason: data.reason || data.bounce_reason,
        bounceType: data.bounce_type,
      },
    });
    
    // Update campaign stats
    await updateCampaignStats(recipient.campaignId);
  }
}

async function handleSpamEvent(messageId: string, email: string, data: any) {
  const recipient = await prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
  
  if (recipient) {
    await prisma.emailRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "COMPLAINED",
        complainedAt: new Date(),
      },
    });
    
    // Update campaign stats
    await updateCampaignStats(recipient.campaignId);
  }
}

async function handleUnsubscribedEvent(messageId: string, email: string, data: any) {
  const recipient = await prisma.emailRecipient.findFirst({
    where: { brevoMessageId: messageId },
  });
  
  if (recipient) {
    await prisma.emailRecipient.update({
      where: { id: recipient.id },
      data: {
        status: "UNSUBSCRIBED",
        unsubscribedAt: new Date(),
      },
    });
    
    // Update user preferences
    await prisma.userEmailPreference.update({
      where: { userId: recipient.userId },
      data: {
        receiveMarketing: false,
        unsubscribedAt: new Date(),
        unsubscribedFrom: { push: "MARKETING" },
      },
    });
    
    // Update campaign stats
    await updateCampaignStats(recipient.campaignId);
  }
}

async function updateCampaignStats(campaignId: string) {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      _count: { select: { status: true } },
      recipients: true,
    },
  });
  
  if (!campaign) return;
  
  const stats = campaign as any;
  const recipients = campaign?.recipients || [];
  
  const totalSent = stats?._count?.status || 0;
  const delivered = recipients.filter((r: any) => r.status === "DELIVERED").length || 0;
  const opened = recipients.filter((r: any) => r.status === "OPENED" || r.status === "CLICKED").length || 0;
  const clicked = recipients.filter((r: any) => r.status === "CLICKED").length || 0;
  const bounced = recipients.filter((r: any) => r.status === "BOUNCED").length || 0;
  const unsubscribed = recipients.filter((r: any) => r.status === "UNSUBSCRIBED").length || 0;
  
  const openRate = totalSent > 0 ? (opened / totalSent) * 100 : 0;
  const clickRate = totalSent > 0 ? (clicked / totalSent) * 100 : 0;
  const bounceRate = totalSent > 0 ? (bounced / totalSent) * 100 : 0;
  const unsubscribeRate = totalSent > 0 ? (unsubscribed / totalSent) * 100 : 0;
  
  await prisma.emailCampaign.update({
    where: { id: campaignId },
    data: {
      deliveredCount: delivered,
      openedCount: opened,
      clickedCount: clicked,
      bouncedCount: bounced,
      unsubscribedCount: unsubscribed,
    },
  });
    
    // Update or create analytics record
    await prisma.emailCampaignAnalytics.upsert({
    where: { campaignId },
      update: {
        openRate,
        clickRate,
        bounceRate,
        unsubscribeRate,
        updatedAt: new Date(),
      },
      create: {
        campaignId,
        openRate,
        clickRate,
        bounceRate,
        unsubscribeRate,
      },
    });
  }
}
