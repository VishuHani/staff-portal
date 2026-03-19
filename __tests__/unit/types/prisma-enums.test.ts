import { describe, expect, it } from "vitest";
import {
  AssignmentStatus as PrismaAssignmentStatus,
  CampaignApprovalStatus as PrismaCampaignApprovalStatus,
  CampaignStatus as PrismaCampaignStatus,
  DocumentType as PrismaDocumentType,
  EmailRecipientStatus as PrismaEmailRecipientStatus,
  EmailType as PrismaEmailType,
  NotificationType as PrismaNotificationType,
} from "@prisma/client";
import {
  PRISMA_ENUM_VALUES,
  PRISMA_ENUM_LOOKUPS,
} from "@/types/prisma-enums";

describe("prisma enums", () => {
  it("keeps shared enum values aligned with Prisma", () => {
    expect(PRISMA_ENUM_VALUES.AssignmentStatus).toEqual(
      Object.values(PrismaAssignmentStatus)
    );
    expect(PRISMA_ENUM_VALUES.CampaignApprovalStatus).toEqual(
      Object.values(PrismaCampaignApprovalStatus)
    );
    expect(PRISMA_ENUM_VALUES.CampaignStatus).toEqual(
      Object.values(PrismaCampaignStatus)
    );
    expect(PRISMA_ENUM_VALUES.DocumentType).toEqual(
      Object.values(PrismaDocumentType)
    );
    expect(PRISMA_ENUM_VALUES.EmailRecipientStatus).toEqual(
      Object.values(PrismaEmailRecipientStatus)
    );
    expect(PRISMA_ENUM_VALUES.EmailType).toEqual(Object.values(PrismaEmailType));
    expect(PRISMA_ENUM_VALUES.NotificationType).toEqual(
      Object.values(PrismaNotificationType)
    );
  });

  it("exposes lookup objects for runtime use", () => {
    expect(PRISMA_ENUM_LOOKUPS.EmailType.TRANSACTIONAL).toBe("TRANSACTIONAL");
    expect(PRISMA_ENUM_LOOKUPS.CampaignStatus.DRAFT).toBe("DRAFT");
    expect(PRISMA_ENUM_LOOKUPS.NotificationType.NEW_MESSAGE).toBe(
      "NEW_MESSAGE"
    );
  });
});
