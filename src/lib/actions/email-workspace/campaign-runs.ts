"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { canAccessEmailModule } from "@/lib/rbac/email-workspace";
import { isCampaignRunSchemaMissingError } from "@/lib/email-workspace/campaign-runs";
import { canAccessEmailCampaignVenue } from "@/lib/rbac/email-campaign-scope";

export interface EmailCampaignRunSummary {
  id: string;
  campaignId: string;
  idempotencyKey: string;
  triggerSource: "MANUAL" | "SCHEDULED";
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  scheduledFor: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  error: string | null;
  metadataJson: Prisma.JsonValue | null;
  createdAt: Date;
}

export interface ListCampaignRunsInput {
  campaignId: string;
  take?: number;
}

export interface CampaignRunsOutput {
  success: boolean;
  runs?: EmailCampaignRunSummary[];
  warning?: string;
  error?: string;
}

export async function listCampaignRuns(
  input: ListCampaignRunsInput
): Promise<CampaignRunsOutput> {
  try {
    const user = await requireAuth();
    if (!(await canAccessEmailModule(user.id, "campaigns"))) {
      return {
        success: false,
        error: "You don't have permission to view campaign run history.",
      };
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: input.campaignId },
      select: {
        id: true,
        createdBy: true,
        venueId: true,
      },
    });

    if (!campaign) {
      return {
        success: false,
        error: "Campaign not found.",
      };
    }

    const canRead =
      campaign.createdBy === user.id ||
      (await canAccessEmailCampaignVenue(user.id, campaign.venueId));
    if (!canRead) {
      return {
        success: false,
        error: "You don't have permission to view this campaign run history.",
      };
    }

    const take = Math.max(1, Math.min(input.take ?? 25, 100));
    const runs = await prisma.emailCampaignRun.findMany({
      where: { campaignId: input.campaignId },
      orderBy: [{ createdAt: "desc" }],
      take,
      select: {
        id: true,
        campaignId: true,
        idempotencyKey: true,
        triggerSource: true,
        status: true,
        scheduledFor: true,
        startedAt: true,
        completedAt: true,
        recipientCount: true,
        sentCount: true,
        failedCount: true,
        error: true,
        metadataJson: true,
        createdAt: true,
      },
    });

    return {
      success: true,
      runs,
    };
  } catch (error) {
    console.error("Error listing campaign runs:", error);

    if (isCampaignRunSchemaMissingError(error)) {
      return {
        success: true,
        runs: [],
        warning:
          "Campaign run history table is not available yet. Run the pending Prisma migration.",
      };
    }

    return {
      success: false,
      error: "Failed to load campaign run history.",
    };
  }
}
