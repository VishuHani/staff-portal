"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth, isAdmin } from "@/lib/rbac/access";
import { normalizePagination } from "@/lib/utils/pagination";
import { revalidatePaths } from "@/lib/utils/action-contract";
import {
  isFolderSchemaMissingError,
  validateFolderAssignment,
} from "@/lib/email-workspace/folder-access";
import {
  buildCampaignRunIdempotencyKey,
  isCampaignRunSchemaMissingError,
  isPrismaUniqueConstraintError,
} from "@/lib/email-workspace/campaign-runs";
import {
  CAMPAIGN_SEND_BATCH_SIZE,
  DEFAULT_CAMPAIGN_PAGE_SIZE,
  MAX_CAMPAIGN_PAGE_SIZE,
  chunkArray,
  resolveCampaignApprovalRequirement,
  updateCampaignRunRecord,
} from "@/lib/actions/email-campaigns/shared";
import type {
  CampaignPagination,
  CampaignSummary,
  EmailCampaignListItem,
} from "@/lib/actions/email-campaigns/shared";
export type {
  CampaignPagination,
  CampaignSummary,
  EmailCampaignListItem,
} from "@/lib/actions/email-campaigns/shared";
import {
  getEmailApprovalPolicy as getEmailApprovalPolicyImpl,
  requestCampaignApproval as requestCampaignApprovalImpl,
  reviewCampaignApproval as reviewCampaignApprovalImpl,
  upsertEmailApprovalPolicy as upsertEmailApprovalPolicyImpl,
} from "@/lib/actions/email-campaigns/approvals";
import type {
  EmailCampaign,
  EmailRecipient,
  EmailTemplate,
  EmailCampaignAnalytics,
  CampaignStatus,
  EmailType,
  EmailRecipientStatus,
} from "@/types/email-campaign";

type EmailCampaignCreateData = Parameters<typeof prisma.emailCampaign.create>[0]["data"];
type EmailCampaignUpdateData = Parameters<typeof prisma.emailCampaign.update>[0]["data"];

// ============================================================================
// TYPES
// ============================================================================

export interface CreateEmailCampaignInput {
  name: string;
  emailId: string; // Link to Email from Email Builder Studio
  folderId?: string | null;
  customSubject?: string | null; // Override email subject if needed
  customHtml?: string | null; // Override email HTML if needed
  targetRoles?: string[];
  targetVenueIds?: string[];
  targetStatus?: string[];
  targetUserIds?: string[];
  segmentId?: string | null; // Link to saved segment
  venueId?: string;
  scheduledAt?: Date | null;
}

// Legacy interface for backward compatibility
export interface LegacyCreateEmailCampaignInput {
  name: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
  textContent?: string;
  designJson?: Record<string, unknown>;
  emailType: EmailType;
  targetRoles?: string[];
  targetVenueIds?: string[];
  targetStatus?: string[];
  targetUserIds?: string[];
  customSegment?: Record<string, unknown>;
  venueId?: string;
  emailTemplateId?: string;
}

export interface UpdateEmailCampaignInput extends Partial<CreateEmailCampaignInput> {
  customSubject?: string | null;
  segmentId?: string | null;
  scheduledAt?: Date | null;
}

export interface EmailCampaignFilters {
  status?: CampaignStatus;
  emailType?: EmailType;
  folderId?: string;
  venueId?: string;
  createdBy?: string;
  search?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page?: number;
  limit?: number;
}

export interface TargetingPreview {
  roles?: string[];
  venueIds?: string[];
  userStatus?: string[];
  userIds?: string[];
  customSegment?: Record<string, unknown>;
}

export interface RecipientPreviewResult {
  totalCount: number;
  byRole: Record<string, number>;
  byVenue: Array<{ venueId: string; venueName: string; count: number }>;
  users: Array<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    roleName: string;
    venueName: string | null;
  }>;
}

// ============================================================================
// CREATE CAMPAIGN (New - Links to Email from Email Builder)
// ============================================================================

export async function createEmailCampaign(
  data: CreateEmailCampaignInput
): Promise<{
  success: boolean;
  campaign?: EmailCampaign;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    
    if (!isUserAdmin) {
      // Non-admin can only create campaigns for their own venues
      if (data.venueId) {
        const userVenues = await prisma.userVenue.findMany({
          where: { userId: user.id },
          select: { venueId: true },
        });
        
        if (!userVenues.some(uv => uv.venueId === data.venueId)) {
          return { success: false, error: "You don't have permission to create campaigns for this venue" };
        }
      } else {
        return { success: false, error: "Venue managers can only create campaigns for their own venues" };
      }
    }

    // Validate input
    if (!data.name || !data.emailId) {
      return { success: false, error: "Name and email selection are required" };
    }

    // Get the email to link
    const email = await prisma.email.findUnique({
      where: { id: data.emailId },
    });

    if (!email) {
      return { success: false, error: "Selected email not found" };
    }

    // Check email access permissions
    if (!isUserAdmin && email.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues.some(uv => uv.venueId === email.venueId)) {
        return { success: false, error: "You don't have permission to use this email" };
      }
    }

    let folderIdForCreate: string | null | undefined = undefined;

    if (data.folderId) {
      try {
        const folderValidation = await validateFolderAssignment({
          userId: user.id,
          isAdminUser: isUserAdmin,
          module: "campaigns",
          folderId: data.folderId,
        });

        if (!folderValidation.valid) {
          return {
            success: false,
            error: folderValidation.error || "Invalid folder selection.",
          };
        }

        folderIdForCreate = data.folderId;
      } catch (folderError) {
        if (!isFolderSchemaMissingError(folderError)) {
          throw folderError;
        }
      }
    }

    const approvalRequirement = await resolveCampaignApprovalRequirement({
      venueId: data.venueId || null,
      isUserAdmin,
    });

    const campaignCreateData: Record<string, unknown> = {
      name: data.name,
      emailId: data.emailId,
      customSubject: data.customSubject,
      customHtml: data.customHtml,
      targetRoles: data.targetRoles || [],
      targetVenueIds: data.targetVenueIds || (isUserAdmin ? [] : [data.venueId!]).filter(Boolean),
      targetStatus: data.targetStatus || ["ACTIVE"],
      targetUserIds: data.targetUserIds || [],
      segmentId: data.segmentId,
      venueId: data.venueId,
      scheduledAt: data.scheduledAt,
      createdBy: user.id,
      status: "DRAFT",
      approvalStatus: approvalRequirement.approvalStatus,
    };

    if (folderIdForCreate !== undefined) {
      campaignCreateData.folderId = folderIdForCreate;
    }

    let campaign;
    try {
      campaign = await prisma.emailCampaign.create({
        data: campaignCreateData as EmailCampaignCreateData,
      });
    } catch (createError) {
      if (
        campaignCreateData.folderId !== undefined &&
        isFolderSchemaMissingError(createError)
      ) {
        delete campaignCreateData.folderId;
        campaign = await prisma.emailCampaign.create({
          data: campaignCreateData as EmailCampaignCreateData,
        });
      } else {
        throw createError;
      }
    }

    await prisma.$transaction(async (tx) => {
      // Increment email use count
      await tx.email.update({
        where: { id: data.emailId },
        data: {
          useCount: { increment: 1 },
          lastUsedAt: new Date(),
        },
      });

      if (approvalRequirement.requiresApproval) {
        await tx.emailCampaignApproval.create({
          data: {
            campaignId: campaign.id,
            requestedBy: user.id,
            status: "PENDING",
            notes: "Approval automatically requested based on venue policy.",
          },
        });
      }
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return { success: true, campaign: campaign as EmailCampaign };
  } catch (error) {
    console.error("Error creating email campaign:", error);
    return { success: false, error: "Failed to create email campaign" };
  }
}

// ============================================================================
// UPDATE CAMPAIGN
// ============================================================================

export async function updateEmailCampaign(
  id: string,
  data: UpdateEmailCampaignInput
): Promise<{
  success: boolean;
  campaign?: EmailCampaign;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const existingCampaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!existingCampaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (existingCampaign.status !== "DRAFT") {
      return { success: false, error: "Only draft campaigns can be edited" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && existingCampaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === existingCampaign.venueId)) {
        return { success: false, error: "You don't have permission to edit this campaign" };
      }
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (data.name !== undefined) updateData.name = data.name;
    if (data.emailId !== undefined) updateData.emailId = data.emailId;
    if (data.customSubject !== undefined) updateData.customSubject = data.customSubject;
    if (data.customHtml !== undefined) updateData.customHtml = data.customHtml;
    if (data.targetRoles !== undefined) updateData.targetRoles = data.targetRoles;
    if (data.targetVenueIds !== undefined) updateData.targetVenueIds = data.targetVenueIds;
    if (data.targetStatus !== undefined) updateData.targetStatus = data.targetStatus;
    if (data.targetUserIds !== undefined) updateData.targetUserIds = data.targetUserIds;
    if (data.segmentId !== undefined) updateData.segmentId = data.segmentId;
    if (data.scheduledAt !== undefined) updateData.scheduledAt = data.scheduledAt;

    if (data.folderId !== undefined) {
      if (data.folderId) {
        try {
          const folderValidation = await validateFolderAssignment({
            userId: user.id,
            isAdminUser: isUserAdmin,
            module: "campaigns",
            folderId: data.folderId,
          });

          if (!folderValidation.valid) {
            return {
              success: false,
              error: folderValidation.error || "Invalid folder selection.",
            };
          }

          updateData.folderId = data.folderId;
        } catch (folderError) {
          if (!isFolderSchemaMissingError(folderError)) {
            throw folderError;
          }
        }
      } else {
        updateData.folderId = null;
      }
    }

    // Update campaign
    let campaign;
    try {
      campaign = await prisma.emailCampaign.update({
        where: { id },
        data: updateData,
      });
    } catch (updateError) {
      if (
        updateData.folderId !== undefined &&
        isFolderSchemaMissingError(updateError)
      ) {
        delete updateData.folderId;
        campaign = await prisma.emailCampaign.update({
          where: { id },
          data: updateData as EmailCampaignUpdateData,
        });
      } else {
        throw updateError;
      }
    }

    revalidatePaths("/system/emails", "/manage/emails");

    return { success: true, campaign: campaign as EmailCampaign };
  } catch (error) {
    console.error("Error updating email campaign:", error);
    return { success: false, error: "Failed to update email campaign" };
  }
}

// ============================================================================
// DELETE CAMPAIGN
// ============================================================================

export async function deleteEmailCampaign(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (campaign.status !== "DRAFT") {
      return { success: false, error: "Only draft campaigns can be deleted" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && campaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === campaign.venueId)) {
        return { success: false, error: "You don't have permission to delete this campaign" };
      }
    }

    await prisma.emailCampaign.delete({
      where: { id },
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return { success: true };
  } catch (error) {
    console.error("Error deleting email campaign:", error);
    return { success: false, error: "Failed to delete email campaign" };
  }
}

// ============================================================================
// GET CAMPAIGN
// ============================================================================

export async function getEmailCampaign(id: string): Promise<{
  success: boolean;
  campaign?: EmailCampaign & {
    creator: { id: string; firstName: string | null; lastName: string | null; email: string } | null;
    venue: { id: string; name: string; code: string } | null;
    email: { id: string; name: string; subject: string; htmlContent: string; textContent: string | null } | null;
    segment: { id: string; name: string; description: string | null } | null;
    recipients?: EmailRecipient[];
    analytics?: EmailCampaignAnalytics | null;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        venue: {
          select: { id: true, name: true, code: true },
        },
        email: {
          select: { id: true, name: true, subject: true, htmlContent: true, textContent: true },
        },
        segment: {
          select: { id: true, name: true, description: true },
        },
        recipients: {
          take: 100,
          orderBy: [{ sentAt: "desc" }, { id: "desc" }],
        },
        analytics: true,
      },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && campaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === campaign.venueId)) {
        return { success: false, error: "You don't have permission to view this campaign" };
      }
    }

    return { success: true, campaign: campaign as any };
  } catch (error) {
    console.error("Error fetching email campaign:", error);
    return { success: false, error: "Failed to fetch email campaign" };
  }
}

// ============================================================================
// LIST CAMPAIGNS
// ============================================================================

export async function getEmailCampaigns(filters?: EmailCampaignFilters): Promise<{
  success: boolean;
  campaigns?: EmailCampaignListItem[];
  total?: number;
  summary?: CampaignSummary;
  pagination?: CampaignPagination;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const isUserAdmin = await isAdmin(user.id);

    const pagination = normalizePagination(
      {
        page: filters?.page,
        limit: filters?.limit,
      },
      {
        defaultLimit: DEFAULT_CAMPAIGN_PAGE_SIZE,
        maxLimit: MAX_CAMPAIGN_PAGE_SIZE,
      }
    );

    const where: any = {};

    // Apply filters
    if (filters?.status) {
      where.status = filters.status;
    }
    if (filters?.emailType) {
      where.email = { emailType: filters.emailType };
    }
    if (filters?.folderId) {
      where.folderId = filters.folderId === "none" ? null : filters.folderId;
    }
    if (filters?.createdBy) {
      where.createdBy = filters.createdBy;
    }
    if (filters?.venueId) {
      where.venueId = filters.venueId;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { email: { subject: { contains: filters.search, mode: "insensitive" } } },
      ];
    }
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {
        gte: filters.dateFrom,
        lte: filters.dateTo,
      };
    }

    // Non-admin can only see campaigns for their venues
    if (!isUserAdmin) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      const allowedVenueIds = userVenues.map((uv) => uv.venueId);

      if (filters?.venueId) {
        if (!allowedVenueIds.includes(filters.venueId)) {
          return {
            success: true,
            campaigns: [],
            total: 0,
            summary: {
              drafts: 0,
              scheduled: 0,
              sent: 0,
              totalRecipients: 0,
            },
            pagination: {
              page: pagination.page,
              limit: pagination.limit,
              total: 0,
              totalPages: 0,
              hasMore: false,
            },
          };
        }

        where.venueId = filters.venueId;
      } else {
        where.venueId = { in: allowedVenueIds };
      }
    }

    const [total, statusCounts, recipientSummary, campaigns] = await Promise.all([
      prisma.emailCampaign.count({ where }),
      prisma.emailCampaign.groupBy({
        by: ["status"],
        where,
        _count: { _all: true },
      }),
      prisma.emailCampaign.aggregate({
        where,
        _sum: { recipientCount: true },
      }),
      prisma.emailCampaign.findMany({
        where,
        include: {
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          venue: {
            select: { id: true, name: true, code: true },
          },
          email: {
            select: { id: true, name: true, subject: true, emailType: true },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: pagination.skip,
        take: pagination.take,
      }),
    ]);

    const statusMap = statusCounts.reduce<Record<string, number>>((acc, row) => {
      acc[row.status] = row._count._all;
      return acc;
    }, {});
    const totalPages = total > 0 ? Math.ceil(total / pagination.limit) : 0;

    return {
      success: true,
      campaigns: campaigns.map((campaign) => ({
        ...campaign,
        subject: campaign.customSubject || campaign.email.subject,
        emailType: campaign.email.emailType,
      })),
      total,
      summary: {
        drafts: statusMap.DRAFT || 0,
        scheduled: statusMap.SCHEDULED || 0,
        sent: (statusMap.SENT || 0) + (statusMap.PARTIALLY_SENT || 0),
        totalRecipients: recipientSummary._sum.recipientCount || 0,
      },
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasMore: pagination.page < totalPages,
      },
    };
  } catch (error) {
    console.error("Error fetching email campaigns:", error);
    return { success: false, error: "Failed to fetch email campaigns" };
  }
}

// ============================================================================
// PREVIEW RECIPIENTS
// ============================================================================

export async function previewCampaignRecipients(
  targeting: TargetingPreview
): Promise<RecipientPreviewResult> {
  try {
    const user = await requireAuth();
    const isUserAdmin = await isAdmin(user.id);

    // Build user query
    const userWhere: any = {
      active: true,
    };

    // Apply role filter
    if (targeting.roles && targeting.roles.length > 0) {
      userWhere.role = { name: { in: targeting.roles } };
    }

    // Apply venue filter
    let venueFilter: string[] = [];
    if (isUserAdmin) {
      if (targeting.venueIds && targeting.venueIds.length > 0) {
        venueFilter = targeting.venueIds;
      }
    } else {
      // Non-admin can only target their own venues
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      venueFilter = userVenues.map(uv => uv.venueId);
      
      if (targeting.venueIds && targeting.venueIds.length > 0) {
        venueFilter = venueFilter.filter(v => targeting.venueIds!.includes(v));
      }
    }

    if (venueFilter.length > 0) {
      userWhere.venues = { some: { venueId: { in: venueFilter } } };
    }

    // Apply status filter
    if (targeting.userStatus && targeting.userStatus.length > 0) {
      const statusMap: Record<string, boolean> = {
        ACTIVE: true,
        INACTIVE: false,
        PENDING: false,
      };
      const statuses = targeting.userStatus.filter(s => statusMap[s] !== undefined);
      if (statuses.length > 0) {
        userWhere.active = { in: statuses.map(s => s === "ACTIVE") };
      }
    }

    // Apply specific user IDs
    if (targeting.userIds && targeting.userIds.length > 0) {
      userWhere.id = { in: targeting.userIds };
    }

    // Get users
    const users = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        roleId: true,
        role: { select: { name: true } },
        venues: { select: { venueId: true, venue: { select: { name: true } } } },
      },
      take: 500,
    });

    // Calculate stats
    const byRole: Record<string, number> = {};
    const byVenue: Record<string, { venueId: string; venueName: string; count: number }> = {};

    for (const u of users) {
      const roleName = u.role?.name || "Unknown";
      byRole[roleName] = (byRole[roleName] || 0) + 1;

      const userVenue = u.venues?.[0];
      const venueId = userVenue?.venueId || "no-venue";
      const venueName = userVenue?.venue?.name || "No Venue";

      if (!byVenue[venueId]) {
        byVenue[venueId] = { venueId, venueName, count: 0 };
      }
      byVenue[venueId].count++;
    }

    return {
      totalCount: users.length,
      byRole,
      byVenue: Object.values(byVenue),
      users: users.map(u => ({
        id: u.id,
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        roleName: u.role?.name || "Unknown",
        venueName: u.venues?.[0]?.venue?.name || null,
      })),
    };
  } catch (error) {
    console.error("Error previewing recipients:", error);
    return {
      totalCount: 0,
      byRole: {},
      byVenue: [],
      users: [],
    };
  }
}

// ============================================================================
// SEND TEST EMAIL
// ============================================================================

export async function sendTestEmail(
  campaignId: string,
  testEmailAddress: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id: campaignId },
      include: {
        email: {
          select: { id: true, subject: true, htmlContent: true, textContent: true },
        },
      },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (!campaign.email) {
      return { success: false, error: "Campaign has no linked email" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && campaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === campaign.venueId)) {
        return { success: false, error: "You don't have permission to send this campaign" };
      }
    }

    // Get content from email or custom overrides
    const subject = campaign.customSubject || campaign.email.subject;
    const htmlContent = campaign.customHtml || campaign.email.htmlContent;
    const textContent = campaign.email.textContent || undefined;

    // Send test email via Brevo
    const { sendBrevoEmail } = await import("@/lib/services/email/brevo");
    
    const result = await sendBrevoEmail({
      to: testEmailAddress,
      toName: "Test Recipient",
      subject: `[TEST] ${subject}`,
      htmlContent,
      textContent,
    });

    if (result.success) {
      return { success: true, messageId: result.messageId };
    } else {
      return { success: false, error: "Failed to send test email" };
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    return { success: false, error: "Failed to send test email" };
  }
}

// ============================================================================
// SEND CAMPAIGN
// ============================================================================

export async function sendEmailCampaign(id: string): Promise<{
  success: boolean;
  recipientCount?: number;
  error?: string;
}> {
  let runId: string | null = null;
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
      include: {
        email: {
          select: { id: true, subject: true, htmlContent: true, textContent: true },
        },
      },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (!campaign.email) {
      return { success: false, error: "Campaign has no linked email" };
    }

    if (campaign.approvalStatus === "PENDING") {
      return { success: false, error: "Campaign is awaiting approval before it can be sent." };
    }

    if (campaign.approvalStatus === "REJECTED") {
      return { success: false, error: "Campaign approval was rejected. Update and resubmit for approval." };
    }

    if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
      return { success: false, error: "Campaign cannot be sent" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && campaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === campaign.venueId)) {
        return { success: false, error: "You don't have permission to send this campaign" };
      }
    }

    // Get recipients
    const targeting: TargetingPreview = {
      roles: campaign.targetRoles as string[],
      venueIds: campaign.targetVenueIds as string[],
      userStatus: campaign.targetStatus as string[],
      userIds: campaign.targetUserIds as string[],
    };

    const recipientPreview = await previewCampaignRecipients(targeting);
    
    if (recipientPreview.totalCount === 0) {
      return { success: false, error: "No recipients match the targeting criteria" };
    }

    const runScheduledFor = new Date();
    const runKey = buildCampaignRunIdempotencyKey({
      campaignId: id,
      scheduledFor: runScheduledFor,
      triggerSource: "MANUAL",
    });
    try {
      const createdRun = await prisma.emailCampaignRun.create({
        data: {
          campaignId: id,
          idempotencyKey: runKey,
          triggerSource: "MANUAL",
          status: "RUNNING",
          scheduledFor: runScheduledFor,
          startedAt: runScheduledFor,
          metadataJson: {
            requestedBy: user.id,
          } as any,
        },
        select: { id: true },
      });
      runId = createdRun.id;
    } catch (runError) {
      if (isPrismaUniqueConstraintError(runError)) {
        return {
          success: false,
          error: "A manual send run is already in progress for this campaign.",
        };
      }

      if (!isCampaignRunSchemaMissingError(runError)) {
        throw runError;
      }
    }

    // Update campaign status
    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "SENDING" as any,
        startedSendingAt: new Date(),
        recipientCount: recipientPreview.totalCount,
      },
    });

    // Create recipient records
    const recipientData = recipientPreview.users.map(u => ({
      campaignId: id,
      userId: u.id,
      email: u.email,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      status: "PENDING" as any,
    }));

    await prisma.emailRecipient.createMany({
      data: recipientData,
      skipDuplicates: true,
    });

    // Get content from email or custom overrides
    const subject = campaign.customSubject || campaign.email.subject;
    const htmlContent = campaign.customHtml || campaign.email.htmlContent;
    const textContent = campaign.email.textContent || undefined;

    // Send emails in batches (using Brevo API)
    const { sendBrevoEmail } = await import("@/lib/services/email/brevo");
    
    let sentCount = 0;
    let failedCount = 0;

    for (const recipientBatch of chunkArray(
      recipientPreview.users,
      CAMPAIGN_SEND_BATCH_SIZE
    )) {
      await Promise.allSettled(
        recipientBatch.map(async (recipient) => {
          try {
            const result = await sendBrevoEmail({
              to: recipient.email,
              toName: `${recipient.firstName || ""} ${recipient.lastName || ""}`.trim(),
              subject,
              htmlContent,
              textContent,
            });

            if (result.success) {
              sentCount++;
              try {
                await prisma.emailRecipient.updateMany({
                  where: { campaignId: id, userId: recipient.id },
                  data: {
                    status: "SENT" as any,
                    brevoMessageId: result.messageId,
                    sentAt: new Date(),
                  },
                });
              } catch (updateError) {
                console.error(
                  `Error updating sent status for ${recipient.email}:`,
                  updateError
                );
              }
              return;
            }

            failedCount++;
            try {
              await prisma.emailRecipient.updateMany({
                where: { campaignId: id, userId: recipient.id },
                data: {
                  status: "FAILED" as any,
                  error: "Failed to send",
                },
              });
            } catch (updateError) {
              console.error(
                `Error updating failed status for ${recipient.email}:`,
                updateError
              );
            }
          } catch (error) {
            failedCount++;
            console.error(`Error sending to ${recipient.email}:`, error);
            try {
              await prisma.emailRecipient.updateMany({
                where: { campaignId: id, userId: recipient.id },
                data: {
                  status: "FAILED" as any,
                  error: error instanceof Error ? error.message : "Failed to send",
                },
              });
            } catch (updateError) {
              console.error(
                `Error updating failed status for ${recipient.email}:`,
                updateError
              );
            }
          }
        })
      );
    }

    // Update campaign status
    const completedAt = new Date();
    const finalStatus =
      sentCount === 0 ? "FAILED" : failedCount > 0 ? "PARTIALLY_SENT" : "SENT";

    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: finalStatus as any,
        sentAt: sentCount > 0 ? completedAt : null,
        completedAt,
        sentCount,
      },
    });

    await updateCampaignRunRecord(runId, {
      status: finalStatus === "FAILED" ? "FAILED" : "COMPLETED",
      completedAt,
      recipientCount: recipientPreview.totalCount,
      sentCount,
      failedCount,
      error:
        finalStatus === "FAILED"
          ? "No recipients were successfully sent."
          : failedCount > 0
            ? `${failedCount} recipient deliveries failed.`
            : null,
      metadataJson: {
        requestedBy: user.id,
        campaignStatus: finalStatus,
      } as any,
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return { success: true, recipientCount: sentCount };
  } catch (error) {
    await updateCampaignRunRecord(runId, {
      status: "FAILED",
      completedAt: new Date(),
      error: String(error),
    });

    console.error("Error sending email campaign:", error);
    return { success: false, error: "Failed to send email campaign" };
  }
}

// ============================================================================
// SCHEDULE CAMPAIGN
// ============================================================================

export async function scheduleEmailCampaign(
  id: string,
  scheduledAt: Date
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (campaign.status !== "DRAFT") {
      return { success: false, error: "Only draft campaigns can be scheduled" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && campaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === campaign.venueId)) {
        return { success: false, error: "You don't have permission to schedule this campaign" };
      }
    }

    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "SCHEDULED" as any,
        scheduledAt,
      },
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return { success: true };
  } catch (error) {
    console.error("Error scheduling email campaign:", error);
    return { success: false, error: "Failed to schedule email campaign" };
  }
}

// ============================================================================
// CANCEL CAMPAIGN
// ============================================================================

export async function cancelEmailCampaign(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    if (campaign.status !== "SCHEDULED" && campaign.status !== "DRAFT") {
      return { success: false, error: "Only scheduled or draft campaigns can be cancelled" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && campaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === campaign.venueId)) {
        return { success: false, error: "You don't have permission to cancel this campaign" };
      }
    }

    await prisma.emailCampaign.update({
      where: { id },
      data: {
        status: "CANCELLED" as any,
      },
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return { success: true };
  } catch (error) {
    console.error("Error cancelling email campaign:", error);
    return { success: false, error: "Failed to cancel email campaign" };
  }
}

export async function getEmailApprovalPolicy(venueId: string) {
  return getEmailApprovalPolicyImpl(venueId);
}

export async function upsertEmailApprovalPolicy(input: {
  venueId: string;
  enabled: boolean;
  requireForNonAdmin: boolean;
}) {
  return upsertEmailApprovalPolicyImpl(input);
}

export async function requestCampaignApproval(campaignId: string, notes?: string) {
  return requestCampaignApprovalImpl(campaignId, notes);
}

export async function reviewCampaignApproval(input: {
  campaignId: string;
  decision: "APPROVE" | "REJECT";
  notes?: string;
}) {
  return reviewCampaignApprovalImpl(input);
}

// ============================================================================
// GET CAMPAIGN ANALYTICS
// ============================================================================

export async function getCampaignAnalytics(id: string): Promise<{
  success: boolean;
  analytics?: EmailCampaignAnalytics | null;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const campaign = await prisma.emailCampaign.findUnique({
      where: { id },
    });

    if (!campaign) {
      return { success: false, error: "Campaign not found" };
    }

    // Check permissions
    const isUserAdmin = await isAdmin(user.id);
    if (!isUserAdmin && campaign.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      
      if (!userVenues?.some(uv => uv.venueId === campaign.venueId)) {
        return { success: false, error: "You don't have permission to view this campaign" };
      }
    }

    const analytics = await prisma.emailCampaignAnalytics.findUnique({
      where: { campaignId: id },
    });

    return { success: true, analytics: analytics as EmailCampaignAnalytics | null };
  } catch (error) {
    console.error("Error fetching campaign analytics:", error);
    return { success: false, error: "Failed to fetch campaign analytics" };
  }
}

// ============================================================================
// EMAIL TEMPLATES (Legacy - kept for backward compatibility)
// ============================================================================

export async function getEmailTemplates(filters?: {
  category?: string;
  venueId?: string;
  isSystem?: boolean;
  search?: string;
}): Promise<{
  success: boolean;
  templates?: EmailTemplate[];
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const isUserAdmin = await isAdmin(user.id);

    const where: any = {};

    if (filters?.category) {
      where.category = filters.category;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { subject: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Non-admin can only see templates for their venues or system templates
    if (!isUserAdmin) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      where.OR = [
        { venueId: { in: userVenues.map(uv => uv.venueId) } },
        { isSystem: true },
      ];
    }

    const templates = await prisma.emailTemplate.findMany({
      where,
      orderBy: [{ isSystem: "desc" }, { useCount: "desc" }],
      take: 50,
    });

    return { success: true, templates: templates as EmailTemplate[] };
  } catch (error) {
    console.error("Error fetching email templates:", error);
    return { success: false, error: "Failed to fetch email templates" };
  }
}

// ============================================================================
// USER EMAIL PREFERENCES
// ============================================================================

export async function getUserEmailPreferences(): Promise<{
  success: boolean;
  preferences?: UserEmailPreferences;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    let preferences = await prisma.userEmailPreference.findUnique({
      where: { userId: user.id },
    });

    // Create default preferences if not exists
    if (!preferences) {
      preferences = await prisma.userEmailPreference.create({
        data: {
          userId: user.id,
          receiveMarketing: true,
          receiveTransactional: true,
          receiveAnnouncements: true,
          receiveReminders: true,
        },
      });
    }

    return { success: true, preferences: preferences as UserEmailPreferences };
  } catch (error) {
    console.error("Error fetching user email preferences:", error);
    return { success: false, error: "Failed to fetch email preferences" };
  }
}

export async function updateUserEmailPreferences(data: {
  receiveMarketing?: boolean;
  receiveTransactional?: boolean;
  receiveAnnouncements?: boolean;
  receiveReminders?: boolean;
}): Promise<{
  success: boolean;
  preferences?: UserEmailPreferences;
  error?: string;
}> {
  try {
    const user = await requireAuth();

    const preferences = await prisma.userEmailPreference.upsert({
      where: { userId: user.id },
      update: {
        ...data,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        ...data,
      },
    });

    return { success: true, preferences: preferences as UserEmailPreferences };
  } catch (error) {
    console.error("Error updating user email preferences:", error);
    return { success: false, error: "Failed to update email preferences" };
  }
}

type UserEmailPreferences = {
  id: string;
  userId: string;
  receiveMarketing: boolean;
  receiveTransactional: boolean;
  receiveAnnouncements: boolean;
  receiveReminders: boolean;
  unsubscribedAt: Date | null;
  unsubscribedFrom: string[];
  unsubscribeReason: string | null;
  lastOpenedAt: Date | null;
  lastClickedAt: Date | null;
  totalOpens: number;
  totalClicks: number;
  createdAt: Date;
  updatedAt: Date;
};

// ============================================================================
// GET AVAILABLE EMAILS (from Email Builder Studio)
// ============================================================================

export async function getAvailableEmails(filters?: {
  isTemplate?: boolean;
  venueId?: string;
  search?: string;
}): Promise<{
  success: boolean;
  emails?: Array<{
    id: string;
    name: string;
    subject: string;
    emailType: string;
    category: string | null;
    thumbnailUrl: string | null;
    lastUsedAt: Date | null;
    useCount: number;
  }>;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const isUserAdmin = await isAdmin(user.id);

    const where: any = {};

    if (filters?.isTemplate !== undefined) {
      where.isTemplate = filters.isTemplate;
    }
    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { subject: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Non-admin can only see emails for their venues or system emails
    if (!isUserAdmin) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      where.OR = [
        { venueId: { in: userVenues.map(uv => uv.venueId) } },
        { venueId: null }, // Global emails available to all
      ];
    }

    const emails = await prisma.email.findMany({
      where,
      select: {
        id: true,
        name: true,
        subject: true,
        emailType: true,
        category: true,
        thumbnailUrl: true,
        lastUsedAt: true,
        useCount: true,
      },
      orderBy: [
        { isTemplate: "desc" },
        { lastUsedAt: "desc" },
      ],
      take: 50,
    });

    return { success: true, emails };
  } catch (error) {
    console.error("Error fetching available emails:", error);
    return { success: false, error: "Failed to fetch available emails" };
  }
}

// ============================================================================
// GET SAVED SEGMENTS
// ============================================================================

export async function getEmailSegments(filters?: {
  venueId?: string;
  search?: string;
}): Promise<{
  success: boolean;
  segments?: Array<{
    id: string;
    name: string;
    description: string | null;
    userCount: number;
    createdAt: Date;
  }>;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const isUserAdmin = await isAdmin(user.id);

    const where: any = {};

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    // Non-admin can only see segments for their venues or system segments
    if (!isUserAdmin) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      where.OR = [
        { venueId: { in: userVenues.map(uv => uv.venueId) } },
        { venueId: null }, // Global segments available to all
      ];
    }

    const segments = await prisma.emailSegment.findMany({
      where,
      select: {
        id: true,
        name: true,
        description: true,
        userCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return { success: true, segments };
  } catch (error) {
    console.error("Error fetching email segments:", error);
    return { success: false, error: "Failed to fetch email segments" };
  }
}

// ============================================================================
// CREATE EMAIL SEGMENT
// ============================================================================

export async function createEmailSegment(data: {
  name: string;
  description?: string;
  rules: Record<string, unknown>;
  venueId?: string;
}): Promise<{
  success: boolean;
  segment?: { id: string; name: string };
  error?: string;
}> {
  try {
    const user = await requireAuth();
    const isUserAdmin = await isAdmin(user.id);

    if (!isUserAdmin && !data.venueId) {
      return { success: false, error: "Venue managers can only create segments for their venues" };
    }

    // Check venue permission
    if (!isUserAdmin && data.venueId) {
      const userVenues = await prisma.userVenue.findMany({
        where: { userId: user.id },
        select: { venueId: true },
      });
      if (!userVenues.some(uv => uv.venueId === data.venueId)) {
        return { success: false, error: "You don't have permission to create segments for this venue" };
      }
    }

    const segment = await prisma.emailSegment.create({
      data: {
        name: data.name,
        description: data.description,
        rules: data.rules as any,
        venueId: data.venueId,
        createdBy: user.id,
      },
    });

    revalidatePaths("/system/emails", "/manage/emails");

    return { success: true, segment: { id: segment.id, name: segment.name } };
  } catch (error) {
    console.error("Error creating email segment:", error);
    return { success: false, error: "Failed to create email segment" };
  }
}

// ============================================================================
// HELPER: GET CAMPAIGN CONTENT
// ============================================================================

// Helper function to get the effective content for a campaign
export async function getCampaignContent(campaignId: string): Promise<{
  subject: string;
  htmlContent: string;
  textContent: string | null;
} | null> {
  const campaign = await prisma.emailCampaign.findUnique({
    where: { id: campaignId },
    include: {
      email: {
        select: { subject: true, htmlContent: true, textContent: true },
      },
    },
  });

  if (!campaign || !campaign.email) return null;

  return {
    subject: campaign.customSubject || campaign.email.subject,
    htmlContent: campaign.customHtml || campaign.email.htmlContent,
    textContent: campaign.email.textContent,
  };
}
