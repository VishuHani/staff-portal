import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRequireAuth, mockIsAdmin, mockHasPermission, mockCanApproveCampaign } =
  vi.hoisted(() => ({
    mockRequireAuth: vi.fn(),
    mockIsAdmin: vi.fn(),
    mockHasPermission: vi.fn(),
    mockCanApproveCampaign: vi.fn(),
  }));

const { mockRevalidatePath } = vi.hoisted(() => ({
  mockRevalidatePath: vi.fn(),
}));

const mockPrisma = vi.hoisted(() => ({
  emailApprovalPolicy: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  emailCampaign: {
    findUnique: vi.fn(),
  },
  emailCampaignApproval: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));

vi.mock("@/lib/rbac/access", () => ({
  requireAuth: mockRequireAuth,
  isAdmin: mockIsAdmin,
}));

vi.mock("@/lib/rbac/permissions", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/lib/actions/email-campaigns/shared", () => ({
  canApproveCampaign: mockCanApproveCampaign,
}));

import {
  getEmailApprovalPolicy,
  requestCampaignApproval,
  reviewCampaignApproval,
  upsertEmailApprovalPolicy,
} from "@/lib/actions/email-campaigns/approvals";

describe("email campaign approvals action contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ id: "user-1" });
    mockIsAdmin.mockResolvedValue(false);
    mockHasPermission.mockResolvedValue(true);
    mockCanApproveCampaign.mockResolvedValue(true);
  });

  it("returns action failure when approval policy access is denied", async () => {
    mockHasPermission.mockResolvedValue(false);
    const result = await getEmailApprovalPolicy("venue-1");
    expect(result).toEqual({
      success: false,
      error: "You don't have permission to view approval policy.",
    });
  });

  it("uses centralized revalidation after approval policy upsert", async () => {
    mockIsAdmin.mockResolvedValue(true);
    mockPrisma.emailApprovalPolicy.upsert.mockResolvedValue({});

    const result = await upsertEmailApprovalPolicy({
      venueId: "venue-1",
      enabled: true,
      requireForNonAdmin: true,
    });

    expect(result.success).toBe(true);
    expect(mockRevalidatePath).toHaveBeenCalledTimes(2);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/system/emails");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/manage/emails");
  });

  it("returns action failure when requesting approval for missing campaign", async () => {
    mockPrisma.emailCampaign.findUnique.mockResolvedValue(null);
    const result = await requestCampaignApproval("missing-campaign");
    expect(result).toEqual({
      success: false,
      error: "Campaign not found.",
    });
  });

  it("returns action failure when reviewer lacks approval rights", async () => {
    mockCanApproveCampaign.mockResolvedValue(false);
    const result = await reviewCampaignApproval({
      campaignId: "campaign-1",
      decision: "APPROVE",
    });
    expect(result).toEqual({
      success: false,
      error: "You don't have permission to review campaign approvals.",
    });
  });
});
