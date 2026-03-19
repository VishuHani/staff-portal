"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, isAdmin } from "@/lib/rbac/access";
import { hasPermission } from "@/lib/rbac/permissions";
import {
  actionFailure,
  actionSuccess,
  logActionError,
  revalidatePaths,
  type ActionResult,
} from "@/lib/utils/action-contract";
import { canApproveCampaign } from "./shared";
import type { CampaignApprovalStatus } from "@/types/email-campaign";

type ApprovalPolicyPayload = {
  policy: {
    venueId: string;
    enabled: boolean;
    requireForNonAdmin: boolean;
    updatedAt: Date;
  };
};

export async function getEmailApprovalPolicy(
  venueId: string
): Promise<ActionResult<ApprovalPolicyPayload>> {
  try {
    const user = await requireAuth();
    const isUserAdmin = await isAdmin(user.id);

    if (!isUserAdmin && !(await hasPermission(user.id, "email_campaigns", "manage"))) {
      return actionFailure("You don't have permission to view approval policy.");
    }

    const policy = await prisma.emailApprovalPolicy.findUnique({
      where: { venueId },
      select: {
        venueId: true,
        enabled: true,
        requireForNonAdmin: true,
        updatedAt: true,
      },
    });

    return actionSuccess({
      policy: policy || {
        venueId,
        enabled: false,
        requireForNonAdmin: false,
        updatedAt: new Date(0),
      },
    });
  } catch (error) {
    logActionError("emailCampaigns.getEmailApprovalPolicy", error, { venueId });
    return actionFailure("Failed to fetch approval policy.");
  }
}

export async function upsertEmailApprovalPolicy(input: {
  venueId: string;
  enabled: boolean;
  requireForNonAdmin: boolean;
}): Promise<ActionResult> {
  try {
    const user = await requireAuth();
    if (!(await isAdmin(user.id))) {
      return actionFailure("Only admins can update approval policy.");
    }

    await prisma.emailApprovalPolicy.upsert({
      where: { venueId: input.venueId },
      create: {
        venueId: input.venueId,
        enabled: input.enabled,
        requireForNonAdmin: input.requireForNonAdmin,
      },
      update: {
        enabled: input.enabled,
        requireForNonAdmin: input.requireForNonAdmin,
      },
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return actionSuccess({});
  } catch (error) {
    logActionError("emailCampaigns.upsertEmailApprovalPolicy", error, {
      venueId: input.venueId,
    });
    return actionFailure("Failed to update approval policy.");
  }
}

export async function requestCampaignApproval(
  campaignId: string,
  notes?: string
): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        createdBy: true,
        venueId: true,
        approvalStatus: true,
      },
    });

    if (!campaign) {
      return actionFailure("Campaign not found.");
    }

    const isUserAdmin = await isAdmin(user.id);
    const canManageCampaigns =
      isUserAdmin || (await hasPermission(user.id, "email_campaigns", "manage"));

    if (!canManageCampaigns && campaign.createdBy !== user.id) {
      return actionFailure(
        "You don't have permission to request approval for this campaign."
      );
    }

    if (campaign.approvalStatus === "APPROVED") {
      return actionFailure("Campaign is already approved.");
    }

    await prisma.$transaction(async (tx) => {
      await tx.emailCampaign.update({
        where: { id: campaignId },
        data: {
          approvalStatus: "PENDING",
        },
      });

      await tx.emailCampaignApproval.create({
        data: {
          campaignId,
          requestedBy: user.id,
          status: "PENDING",
          notes: notes?.trim() || null,
        },
      });
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return actionSuccess({});
  } catch (error) {
    logActionError("emailCampaigns.requestCampaignApproval", error, {
      campaignId,
    });
    return actionFailure("Failed to request campaign approval.");
  }
}

export async function reviewCampaignApproval(input: {
  campaignId: string;
  decision: "APPROVE" | "REJECT";
  notes?: string;
}): Promise<ActionResult> {
  try {
    const user = await requireAuth();

    if (!(await canApproveCampaign(user.id))) {
      return actionFailure(
        "You don't have permission to review campaign approvals."
      );
    }

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: input.campaignId },
      select: {
        id: true,
        approvalStatus: true,
      },
    });

    if (!campaign) {
      return actionFailure("Campaign not found.");
    }

    const nextStatus: CampaignApprovalStatus =
      input.decision === "APPROVE" ? "APPROVED" : "REJECTED";

    await prisma.$transaction(async (tx) => {
      const pending = await tx.emailCampaignApproval.findFirst({
        where: {
          campaignId: input.campaignId,
          status: "PENDING",
        },
        orderBy: { requestedAt: "desc" },
      });

      if (pending) {
        await tx.emailCampaignApproval.update({
          where: { id: pending.id },
          data: {
            status: nextStatus,
            approvedBy: user.id,
            approvedAt: new Date(),
            notes: input.notes?.trim() || pending.notes,
          },
        });
      } else {
        await tx.emailCampaignApproval.create({
          data: {
            campaignId: input.campaignId,
            requestedBy: user.id,
            approvedBy: user.id,
            status: nextStatus,
            approvedAt: new Date(),
            notes: input.notes?.trim() || null,
          },
        });
      }

      await tx.emailCampaign.update({
        where: { id: input.campaignId },
        data: {
          approvalStatus: nextStatus,
        },
      });
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return actionSuccess({});
  } catch (error) {
    logActionError("emailCampaigns.reviewCampaignApproval", error, {
      campaignId: input.campaignId,
      decision: input.decision,
    });
    return actionFailure("Failed to review campaign approval.");
  }
}
