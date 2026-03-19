import {
  AssignmentStatus as PrismaAssignmentStatus,
  CampaignApprovalStatus as PrismaCampaignApprovalStatus,
  CampaignStatus as PrismaCampaignStatus,
  DocumentType as PrismaDocumentType,
  EmailRecipientStatus as PrismaEmailRecipientStatus,
  EmailType as PrismaEmailType,
  NotificationType as PrismaNotificationType,
} from "@prisma/client";

type PrismaEnumObject = Record<string, string>;

function enumValues<T extends PrismaEnumObject>(enumObject: T) {
  return Object.values(enumObject) as [T[keyof T], ...T[keyof T][]];
}

function enumLookup<T extends PrismaEnumObject>(enumObject: T) {
  const values = enumValues(enumObject);
  return Object.freeze(
    Object.fromEntries(values.map((value) => [value, value])) as Record<
      T[keyof T],
      T[keyof T]
    >
  );
}

export const PRISMA_ENUM_VALUES = {
  AssignmentStatus: enumValues(PrismaAssignmentStatus),
  CampaignApprovalStatus: enumValues(PrismaCampaignApprovalStatus),
  CampaignStatus: enumValues(PrismaCampaignStatus),
  DocumentType: enumValues(PrismaDocumentType),
  EmailRecipientStatus: enumValues(PrismaEmailRecipientStatus),
  EmailType: enumValues(PrismaEmailType),
  NotificationType: enumValues(PrismaNotificationType),
} as const;

export const PRISMA_ENUM_LOOKUPS = {
  AssignmentStatus: enumLookup(PrismaAssignmentStatus),
  CampaignApprovalStatus: enumLookup(PrismaCampaignApprovalStatus),
  CampaignStatus: enumLookup(PrismaCampaignStatus),
  DocumentType: enumLookup(PrismaDocumentType),
  EmailRecipientStatus: enumLookup(PrismaEmailRecipientStatus),
  EmailType: enumLookup(PrismaEmailType),
  NotificationType: enumLookup(PrismaNotificationType),
} as const;

export type PrismaAssignmentStatusValue =
  (typeof PRISMA_ENUM_VALUES.AssignmentStatus)[number];
export type PrismaCampaignApprovalStatusValue =
  (typeof PRISMA_ENUM_VALUES.CampaignApprovalStatus)[number];
export type PrismaCampaignStatusValue =
  (typeof PRISMA_ENUM_VALUES.CampaignStatus)[number];
export type PrismaDocumentTypeValue =
  (typeof PRISMA_ENUM_VALUES.DocumentType)[number];
export type PrismaEmailRecipientStatusValue =
  (typeof PRISMA_ENUM_VALUES.EmailRecipientStatus)[number];
export type PrismaEmailTypeValue = (typeof PRISMA_ENUM_VALUES.EmailType)[number];
export type PrismaNotificationTypeValue =
  (typeof PRISMA_ENUM_VALUES.NotificationType)[number];
