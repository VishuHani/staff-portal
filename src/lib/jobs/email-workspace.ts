import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendBrevoEmail } from "@/lib/services/email/brevo";
import {
  buildCampaignRunIdempotencyKey,
  isCampaignRunSchemaMissingError,
  isPrismaUniqueConstraintError,
} from "@/lib/email-workspace/campaign-runs";
import {
  getNextRunAt,
  type EmailRecurrenceRule,
} from "@/lib/email-workspace/recurrence";
import {
  buildRunDeliveryMetadata,
  dispatchReportDelivery,
  extractDeliveryConfigFromConfigJson,
} from "@/lib/email-workspace/report-delivery";

const MAX_CAMPAIGNS_PER_RUN = 5;
const MAX_REPORTS_PER_RUN = 5;
const MAX_RECIPIENTS_PER_CAMPAIGN = 3000;
const REPORT_CLAIM_TTL_MS = 5 * 60 * 1000;
const REPORT_FAILURE_RETRY_DELAY_MS = 2 * 60 * 1000;
const CAMPAIGN_FAILURE_RETRY_DELAY_MS = 2 * 60 * 1000;

type CampaignStatus = "DRAFT" | "SCHEDULED" | "SENDING" | "SENT" | "FAILED" | "CANCELLED" | "QUEUED" | "PARTIALLY_SENT";

interface RecipientCandidate {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface CampaignProcessingResult {
  checked: number;
  started: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface ReportProcessingResult {
  checked: number;
  processed: number;
  failed: number;
  skipped: number;
}

export interface EmailWorkspaceJobResult {
  campaigns: CampaignProcessingResult;
  reports: ReportProcessingResult;
}

function parseRecurrenceRule(value: Prisma.JsonValue | null): EmailRecurrenceRule | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<EmailRecurrenceRule>;
  if (!candidate.frequency || !candidate.timezone || !candidate.time) {
    return null;
  }

  return {
    frequency: candidate.frequency,
    timezone: candidate.timezone,
    time: candidate.time,
    interval: candidate.interval,
    weekdays: candidate.weekdays,
    monthDays: candidate.monthDays,
    startDate: candidate.startDate,
    endDate: candidate.endDate,
  };
}

function statusFilterToActiveValues(values: string[]): boolean[] | null {
  if (!values || values.length === 0) {
    return null;
  }

  const lowered = values.map((value) => value.toUpperCase());
  const mapped = new Set<boolean>();
  for (const value of lowered) {
    if (value === "ACTIVE") {
      mapped.add(true);
    } else if (value === "INACTIVE" || value === "PENDING") {
      mapped.add(false);
    }
  }

  return mapped.size > 0 ? [...mapped] : null;
}

async function resolveCampaignRecipients(campaign: {
  targetRoles: string[];
  targetVenueIds: string[];
  targetStatus: string[];
  targetUserIds: string[];
}): Promise<RecipientCandidate[]> {
  const where: Prisma.UserWhereInput = {};

  const activeFilter = statusFilterToActiveValues(campaign.targetStatus);
  if (activeFilter && activeFilter.length === 1) {
    where.active = activeFilter[0];
  } else {
    where.active = true;
  }

  if (campaign.targetRoles.length > 0) {
    where.role = {
      name: {
        in: campaign.targetRoles,
      },
    };
  }

  if (campaign.targetUserIds.length > 0) {
    where.id = {
      in: campaign.targetUserIds,
    };
  }

  if (campaign.targetVenueIds.length > 0) {
    where.venues = {
      some: {
        venueId: {
          in: campaign.targetVenueIds,
        },
      },
    };
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
    take: MAX_RECIPIENTS_PER_CAMPAIGN,
  });
}

async function updateCampaignRunSafely(
  runId: string | null,
  data: Prisma.EmailCampaignRunUpdateInput
) {
  if (!runId) {
    return;
  }

  try {
    await prisma.emailCampaignRun.update({
      where: { id: runId },
      data,
    });
  } catch (error) {
    if (!isCampaignRunSchemaMissingError(error)) {
      throw error;
    }
  }
}

async function processCampaign(
  campaignId: string,
  now: Date
): Promise<"sent" | "failed" | "skipped"> {
  const dueCampaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      status: true,
      isRecurring: true,
      scheduledAt: true,
      nextRunAt: true,
    },
  });

  if (!dueCampaign) {
    return "skipped";
  }

  const scheduledFor = dueCampaign.nextRunAt || dueCampaign.scheduledAt || now;
  const idempotencyKey = buildCampaignRunIdempotencyKey({
    campaignId: dueCampaign.id,
    scheduledFor,
    triggerSource: "SCHEDULED",
  });

  let runId: string | null = null;
  try {
    const createdRun = await prisma.emailCampaignRun.create({
      data: {
        campaignId: dueCampaign.id,
        idempotencyKey,
        triggerSource: "SCHEDULED",
        status: "RUNNING",
        scheduledFor,
        startedAt: now,
        metadataJson: {
          campaignStatusAtStart: dueCampaign.status,
        } as Prisma.InputJsonValue,
      },
      select: { id: true },
    });
    runId = createdRun.id;
  } catch (error) {
    if (isPrismaUniqueConstraintError(error)) {
      return "skipped";
    }

    if (!isCampaignRunSchemaMissingError(error)) {
      throw error;
    }
  }

  try {
    const locked = await prisma.emailCampaign.updateMany({
      where: {
        id: campaignId,
        NOT: {
          status: "SENDING",
        },
      },
      data: {
        status: "SENDING",
        startedSendingAt: now,
      },
    });

    if (locked.count === 0) {
      await updateCampaignRunSafely(runId, {
        status: "CANCELLED",
        completedAt: new Date(),
        error: "Skipped because campaign is already being processed.",
      });
      return "skipped";
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        status: true,
        approvalStatus: true,
        name: true,
        customSubject: true,
        customHtml: true,
        targetRoles: true,
        targetVenueIds: true,
        targetStatus: true,
        targetUserIds: true,
        isRecurring: true,
        recurrenceRuleJson: true,
        email: {
          select: {
            subject: true,
            htmlContent: true,
            textContent: true,
          },
        },
      },
    });

    if (!campaign || !campaign.email) {
      await prisma.emailCampaign.update({
        where: { id: campaignId },
        data: {
          status: "FAILED",
          completedAt: new Date(),
        },
      });

      await updateCampaignRunSafely(runId, {
        status: "FAILED",
        completedAt: new Date(),
        error: "Campaign or linked email content was not found.",
      });
      return "failed";
    }

    if (campaign.approvalStatus === "PENDING" || campaign.approvalStatus === "REJECTED") {
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          status: campaign.isRecurring ? "SCHEDULED" : "DRAFT",
          completedAt: new Date(),
        },
      });

      await updateCampaignRunSafely(runId, {
        status: "CANCELLED",
        completedAt: new Date(),
        error: `Campaign blocked by approval status: ${campaign.approvalStatus}.`,
      });
      return "skipped";
    }

    const recipients = await resolveCampaignRecipients({
      targetRoles: campaign.targetRoles as string[],
      targetVenueIds: campaign.targetVenueIds as string[],
      targetStatus: campaign.targetStatus as string[],
      targetUserIds: campaign.targetUserIds as string[],
    });

    if (recipients.length === 0) {
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: {
          status: "FAILED",
          recipientCount: 0,
          sentCount: 0,
          completedAt: new Date(),
        },
      });

      await updateCampaignRunSafely(runId, {
        status: "FAILED",
        completedAt: new Date(),
        recipientCount: 0,
        sentCount: 0,
        failedCount: 0,
        error: "No recipients matched the campaign targeting rules.",
      });
      return "failed";
    }

    if (campaign.isRecurring) {
      await prisma.emailRecipient.deleteMany({
        where: { campaignId: campaign.id },
      });
    }

    await prisma.emailRecipient.createMany({
      data: recipients.map((recipient) => ({
        campaignId: campaign.id,
        userId: recipient.id,
        email: recipient.email,
        name: `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim(),
        status: "PENDING",
      })),
      skipDuplicates: true,
    });

    const subject = campaign.customSubject || campaign.email.subject;
    const htmlContent = campaign.customHtml || campaign.email.htmlContent;
    const textContent = campaign.email.textContent || undefined;

    let sentCount = 0;
    let failedCount = 0;

    for (const recipient of recipients) {
      try {
        const sendResult = await sendBrevoEmail({
          to: recipient.email,
          toName: `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim(),
          subject,
          htmlContent,
          textContent,
        });

        if (sendResult.success) {
          sentCount += 1;
          await prisma.emailRecipient.updateMany({
            where: { campaignId: campaign.id, userId: recipient.id },
            data: {
              status: "SENT",
              brevoMessageId: sendResult.messageId,
              sentAt: new Date(),
            },
          });
        } else {
          failedCount += 1;
          await prisma.emailRecipient.updateMany({
            where: { campaignId: campaign.id, userId: recipient.id },
            data: {
              status: "FAILED",
              error: "Failed to send",
            },
          });
        }
      } catch (error) {
        failedCount += 1;
        await prisma.emailRecipient.updateMany({
          where: { campaignId: campaign.id, userId: recipient.id },
          data: {
            status: "FAILED",
            error: String(error),
          },
        });
      }
    }

    const completedAt = new Date();
    const recurrenceRule = parseRecurrenceRule(campaign.recurrenceRuleJson);
    const nextRunAt =
      campaign.isRecurring && recurrenceRule ? getNextRunAt(recurrenceRule, completedAt) : null;

    const finalStatus: CampaignStatus =
      campaign.isRecurring && nextRunAt ? "SCHEDULED" : sentCount > 0 ? "SENT" : "FAILED";

    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: {
        status: finalStatus,
        recipientCount: recipients.length,
        sentCount,
        startedSendingAt: now,
        sentAt: sentCount > 0 ? completedAt : null,
        completedAt,
        lastRunAt: campaign.isRecurring ? completedAt : undefined,
        nextRunAt: campaign.isRecurring ? nextRunAt : undefined,
        scheduledAt: campaign.isRecurring && nextRunAt ? nextRunAt : undefined,
      },
    });

    await updateCampaignRunSafely(runId, {
      status: finalStatus === "FAILED" ? "FAILED" : "COMPLETED",
      completedAt,
      recipientCount: recipients.length,
      sentCount,
      failedCount,
      metadataJson: {
        scheduledFor: scheduledFor.toISOString(),
        isRecurring: campaign.isRecurring,
        nextRunAt: nextRunAt ? nextRunAt.toISOString() : null,
        finalCampaignStatus: finalStatus,
      } as Prisma.InputJsonValue,
    });

    return finalStatus === "FAILED" ? "failed" : "sent";
  } catch (error) {
    const failureAt = new Date();
    const retryAt = new Date(failureAt.getTime() + CAMPAIGN_FAILURE_RETRY_DELAY_MS);

    await prisma.emailCampaign.updateMany({
      where: {
        id: campaignId,
      },
      data: {
        status: dueCampaign.isRecurring ? "SCHEDULED" : "FAILED",
        completedAt: failureAt,
        nextRunAt: dueCampaign.isRecurring ? retryAt : undefined,
        scheduledAt: dueCampaign.isRecurring ? retryAt : undefined,
      },
    });

    await updateCampaignRunSafely(runId, {
      status: "FAILED",
      completedAt: failureAt,
      error: String(error),
      metadataJson: {
        scheduledFor: scheduledFor.toISOString(),
        retryAt: dueCampaign.isRecurring ? retryAt.toISOString() : null,
      } as Prisma.InputJsonValue,
    });

    return "failed";
  }
}

async function processDueCampaigns(now: Date): Promise<CampaignProcessingResult> {
  const dueCampaigns = await prisma.emailCampaign.findMany({
    where: {
      OR: [
        {
          status: "SCHEDULED",
          scheduledAt: {
            lte: now,
          },
        },
        {
          isRecurring: true,
          nextRunAt: {
            lte: now,
          },
          status: {
            notIn: ["CANCELLED", "SENDING"] as CampaignStatus[],
          },
        },
      ],
    },
    select: {
      id: true,
    },
    orderBy: [{ scheduledAt: "asc" }, { nextRunAt: "asc" }, { createdAt: "asc" }],
    take: MAX_CAMPAIGNS_PER_RUN,
  });

  const result: CampaignProcessingResult = {
    checked: dueCampaigns.length,
    started: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  };

  for (const campaign of dueCampaigns) {
    result.started += 1;
    const outcome = await processCampaign(campaign.id, now);
    if (outcome === "sent") {
      result.sent += 1;
    } else if (outcome === "failed") {
      result.failed += 1;
    } else {
      result.skipped += 1;
    }
  }

  return result;
}

function getReportWindowDays(configJson: Prisma.JsonValue): number {
  if (configJson && typeof configJson === "object" && !Array.isArray(configJson)) {
    const value = (configJson as { windowDays?: unknown }).windowDays;
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.floor(value);
    }
  }
  return 30;
}

async function processReportDefinition(
  definitionId: string,
  now: Date
): Promise<"processed" | "failed" | "skipped"> {
  const claimUntil = new Date(now.getTime() + REPORT_CLAIM_TTL_MS);
  const claim = await prisma.emailReportDefinition.updateMany({
    where: {
      id: definitionId,
      isScheduled: true,
      nextRunAt: {
        lte: now,
      },
    },
    data: {
      nextRunAt: claimUntil,
    },
  });

  if (claim.count === 0) {
    return "skipped";
  }

  const definition = await prisma.emailReportDefinition.findUnique({
    where: { id: definitionId },
    select: {
      id: true,
      name: true,
      reportType: true,
      configJson: true,
      venueId: true,
      recurrenceRuleJson: true,
      isScheduled: true,
      nextRunAt: true,
    },
  });

  if (!definition || !definition.isScheduled) {
    return "skipped";
  }

  const startedAt = new Date();
  try {
    const windowDays = getReportWindowDays(definition.configJson);
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - windowDays);

    const campaignWhere: Prisma.EmailCampaignWhereInput = {
      createdAt: {
        gte: dateFrom,
      },
    };
    if (definition.venueId) {
      campaignWhere.venueId = definition.venueId;
    }

    const [totalCampaigns, sentCampaigns, aggregates] = await Promise.all([
      prisma.emailCampaign.count({ where: campaignWhere }),
      prisma.emailCampaign.count({
        where: {
          ...campaignWhere,
          status: "SENT",
        },
      }),
      prisma.emailCampaign.aggregate({
        where: campaignWhere,
        _sum: {
          recipientCount: true,
          deliveredCount: true,
          openedCount: true,
          clickedCount: true,
          bouncedCount: true,
          unsubscribedCount: true,
        },
      }),
    ]);

    const generatedAt = new Date().toISOString();
    const resultJson: Prisma.InputJsonValue = {
      reportType: definition.reportType,
      generatedAt,
      windowDays,
      summary: {
        totalCampaigns,
        sentCampaigns,
        recipientCount: aggregates._sum.recipientCount || 0,
        deliveredCount: aggregates._sum.deliveredCount || 0,
        openedCount: aggregates._sum.openedCount || 0,
        clickedCount: aggregates._sum.clickedCount || 0,
        bouncedCount: aggregates._sum.bouncedCount || 0,
        unsubscribedCount: aggregates._sum.unsubscribedCount || 0,
      },
    };

    const recurrenceRule = parseRecurrenceRule(definition.recurrenceRuleJson);
    const nextRunAt = recurrenceRule ? getNextRunAt(recurrenceRule, now) : null;
    const deliveryConfig = extractDeliveryConfigFromConfigJson(definition.configJson);
    let runId: string | null = null;

    await prisma.$transaction(async (tx) => {
      const createdRun = await tx.emailReportRun.create({
        data: {
          reportDefinitionId: definition.id,
          status: "COMPLETED",
          startedAt,
          completedAt: new Date(),
          resultJson,
          deliveryConfigJson: deliveryConfig
            ? ({
                channel: deliveryConfig.channel,
                destination: deliveryConfig.destination,
              } as Prisma.InputJsonValue)
            : Prisma.DbNull,
        },
      });
      runId = createdRun.id;

      await tx.emailReportDefinition.update({
        where: { id: definition.id },
        data: {
          nextRunAt,
          isScheduled: Boolean(nextRunAt),
        },
      });
    });

    if (runId && deliveryConfig) {
      const deliveryOutcome = await dispatchReportDelivery(deliveryConfig, {
        reportDefinitionId: definition.id,
        reportDefinitionName: definition.name,
        reportType: definition.reportType,
        generatedAt,
        resultJson: resultJson as Prisma.JsonValue,
      });

      await prisma.emailReportRun.update({
        where: { id: runId },
        data: {
          deliveryConfigJson: buildRunDeliveryMetadata(deliveryConfig, deliveryOutcome),
        },
      });
    }

    return "processed";
  } catch (error) {
    await prisma.emailReportRun.create({
      data: {
        reportDefinitionId: definition.id,
        status: "FAILED",
        startedAt,
        completedAt: new Date(),
        error: String(error),
      },
    });

    await prisma.emailReportDefinition.update({
      where: { id: definition.id },
      data: {
        isScheduled: true,
        nextRunAt: new Date(Date.now() + REPORT_FAILURE_RETRY_DELAY_MS),
      },
    });

    return "failed";
  }
}

async function processDueReports(now: Date): Promise<ReportProcessingResult> {
  const definitions = await prisma.emailReportDefinition.findMany({
    where: {
      isScheduled: true,
      nextRunAt: {
        lte: now,
      },
    },
    select: {
      id: true,
    },
    orderBy: [{ nextRunAt: "asc" }, { createdAt: "asc" }],
    take: MAX_REPORTS_PER_RUN,
  });

  const result: ReportProcessingResult = {
    checked: definitions.length,
    processed: 0,
    failed: 0,
    skipped: 0,
  };

  for (const definition of definitions) {
    const outcome = await processReportDefinition(definition.id, now);
    if (outcome === "processed") {
      result.processed += 1;
    } else if (outcome === "failed") {
      result.failed += 1;
    } else {
      result.skipped += 1;
    }
  }

  return result;
}

export async function processEmailWorkspaceJobs(
  now: Date = new Date()
): Promise<EmailWorkspaceJobResult> {
  const [campaigns, reports] = await Promise.all([
    processDueCampaigns(now),
    processDueReports(now),
  ]);

  return {
    campaigns,
    reports,
  };
}
