import { prisma } from "@/lib/prisma";
import { hasAnyPermission } from "@/lib/rbac/permissions";
import type {
  CampaignApprovalStatus,
  EmailCampaign,
  EmailType,
} from "@/types/email-campaign";

export interface EmailCampaignListItem extends EmailCampaign {
  subject: string;
  emailType: EmailType;
}

export interface CampaignSummary {
  drafts: number;
  scheduled: number;
  sent: number;
  totalRecipients: number;
}

export interface CampaignPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export const DEFAULT_CAMPAIGN_PAGE_SIZE = 25;
export const MAX_CAMPAIGN_PAGE_SIZE = 100;
export const CAMPAIGN_SEND_BATCH_SIZE = 10;

export function chunkArray<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items];
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function updateCampaignRunRecord(
  runId: string | null,
  data: Parameters<typeof prisma.emailCampaignRun.update>[0]["data"]
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
    const { isCampaignRunSchemaMissingError } = await import(
      "@/lib/email-workspace/campaign-runs"
    );
    if (!isCampaignRunSchemaMissingError(error)) {
      throw error;
    }
  }
}

export async function resolveCampaignApprovalRequirement(input: {
  venueId?: string | null;
  isUserAdmin: boolean;
}): Promise<{
  approvalStatus: CampaignApprovalStatus;
  requiresApproval: boolean;
}> {
  if (input.isUserAdmin || !input.venueId) {
    return {
      approvalStatus: "NOT_REQUIRED",
      requiresApproval: false,
    };
  }

  const policy = await prisma.emailApprovalPolicy.findUnique({
    where: { venueId: input.venueId },
    select: {
      enabled: true,
      requireForNonAdmin: true,
    },
  });

  const requiresApproval = Boolean(policy?.enabled && policy?.requireForNonAdmin);

  return {
    approvalStatus: requiresApproval ? "PENDING" : "NOT_REQUIRED",
    requiresApproval,
  };
}

export async function canApproveCampaign(userId: string): Promise<boolean> {
  return hasAnyPermission(userId, [
    { resource: "email_workspace", action: "approve" },
    { resource: "email_campaigns", action: "approve" },
    { resource: "email_campaigns", action: "manage" },
  ]);
}
