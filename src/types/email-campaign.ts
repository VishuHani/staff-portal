// ============================================================================
// Email System Types - Builder & Campaigns
// These types are defined locally to avoid Prisma client import issues.
// They correspond to the models in prisma/schema.prisma
// ============================================================================

// Email type enum - matches Prisma EmailType
export type EmailType = "TRANSACTIONAL" | "MARKETING";

// Campaign status enum - matches Prisma CampaignStatus
export type CampaignStatus = 
  | "DRAFT" 
  | "SCHEDULED" 
  | "QUEued" 
  | "sending" 
  | "sent" 
  | "partially_sent" 
  | "failed" 
  | "cancelled";

// Email recipient status enum - matches Prisma EmailRecipientStatus
export type EmailRecipientStatus = 
  | "pending" 
  | "queued" 
  | "sent" 
  | "delivered" 
  | "opened" 
  | "clicked" 
  | "bounced" 
  | "unsubscribed" 
  | "complained" 
  | "failed" 
  | "skipped";

// Runtime enum objects for use in code
export const EmailType = {
  TRANSACTIONAL: "TRANSACTIONAL" as const,
  MARKETING: "MARKETING" as const,
};

export const CampaignStatus = {
  DRAFT: "DRAFT" as const,
  SCHEDULED: "SCHEDULED" as const,
  QUEUED: "QUEUED" as const,
  SENDING: "SENDING" as const,
  SENT: "SENT" as const,
  PARTIALLY_SENT: "PARTIALLY_SENT" as const,
  FAILED: "FAILED" as const,
  CANCELLED: "CANCELLED" as const,
};

export const EmailRecipientStatus = {
  PENDING: "PENDING" as const,
  QUEUED: "QUEUED" as const,
  SENT: "SENT" as const,
  DELIVERED: "DELIVERED" as const,
  OPENED: "OPENED" as const,
  CLICKED: "CLICKED" as const,
  BOUNCED: "BOUNCED" as const,
  UNSUBSCRIBED: "UNSUBSCRIBED" as const,
  COMPLAINED: "COMPLAINED" as const,
  FAILED: "FAILED" as const,
  SKIPPED: "SKIPPED" as const,
};

// ============================================================================
// Email Model (Email Builder Studio)
// ============================================================================

export interface Email {
  id: string;
  name: string;
  description?: string | null;
  subject: string;
  previewText?: string | null;
  htmlContent: string;
  textContent?: string | null;
  designJson?: Record<string, unknown> | null;
  emailType: EmailType;
  category?: string | null;
  aiClassification?: EmailType | null;
  aiConfidence?: number | null;
  isTemplate: boolean;
  variables: string[];
  thumbnailUrl?: string | null;
  useCount: number;
  lastUsedAt?: Date | null;
  isSystem: boolean;
  isDefault: boolean;
  venueId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailWithRelations extends Email {
  venue?: {
    id: string;
    name: string;
    code: string;
  } | null;
  creator?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  campaigns?: EmailCampaign[];
  generations?: EmailGeneration[];
}

// ============================================================================
// Email Segment Model (Saved Segments)
// ============================================================================

export interface EmailSegment {
  id: string;
  name: string;
  description?: string | null;
  rules: SegmentRules;
  userCount: number;
  lastCalculated?: Date | null;
  isSystem: boolean;
  venueId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailSegmentWithRelations extends EmailSegment {
  venue?: {
    id: string;
    name: string;
    code: string;
  } | null;
  creator?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  campaigns?: EmailCampaign[];
}

// ============================================================================
// Email Campaign Model (Campaign Manager)
// ============================================================================

export interface EmailCampaign {
  id: string;
  name: string;
  emailId: string;
  customSubject?: string | null;
  customHtml?: string | null;
  targetRoles: string[];
  targetVenueIds: string[];
  targetStatus: string[];
  targetUserIds: string[];
  segmentId?: string | null;
  recipientCount: number;
  sentCount: number;
  deliveredCount: number;
  openedCount: number;
  clickedCount: number;
  bouncedCount: number;
  unsubscribedCount: number;
  complaintCount: number;
  status: CampaignStatus;
  scheduledAt?: Date | null;
  sentAt?: Date | null;
  startedSendingAt?: Date | null;
  completedAt?: Date | null;
  createdBy: string;
  venueId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailCampaignWithRelations extends EmailCampaign {
  email?: Email | null;
  segment?: EmailSegment | null;
  creator?: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  } | null;
  venue?: {
    id: string;
    name: string;
    code: string;
  } | null;
  recipients?: EmailRecipient[];
  analytics?: EmailCampaignAnalytics | null;
}

// Legacy interface for backward compatibility - includes email content directly
export interface EmailCampaignWithContent extends EmailCampaign {
  // These are from the linked Email entity
  subject: string;
  previewText?: string | null;
  htmlContent: string;
  textContent?: string | null;
  emailType: EmailType;
  email?: Email | null;
  emailTemplate?: EmailTemplate | null;
}

// ============================================================================
// Email Recipient Types
// ============================================================================

export interface EmailRecipient {
  id: string;
  campaignId: string;
  userId: string;
  email: string;
  name?: string | null;
  status: EmailRecipientStatus;
  brevoMessageId?: string | null;
  sentAt?: Date | null;
  deliveredAt?: Date | null;
  openedAt?: Date | null;
  openedCount: number;
  clickedAt?: Date | null;
  clickedCount: number;
  clickedUrls?: Record<string, unknown> | null;
  unsubscribedAt?: Date | null;
  complainedAt?: Date | null;
  error?: string | null;
  bounceReason?: string | null;
  bounceType?: string | null;
  deviceType?: string | null;
  emailClient?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ============================================================================
// Email Template Types (Legacy - Deprecated)
// ============================================================================

export interface EmailTemplate {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  thumbnailUrl?: string | null;
  subject: string;
  htmlContent: string;
  textContent?: string | null;
  designJson?: Record<string, unknown> | null;
  variables: string[];
  useCount: number;
  lastUsedAt?: Date | null;
  isSystem: boolean;
  isDefault: boolean;
  venueId?: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Email Campaign Analytics Types
// ============================================================================

export interface EmailCampaignAnalytics {
  id: string;
  campaignId: string;
  openRate: number;
  clickRate: number;
  clickToOpenRate: number;
  bounceRate: number;
  unsubscribeRate: number;
  complaintRate: number;
  desktopOpens: number;
  mobileOpens: number;
  tabletOpens: number;
  unknownDeviceOpens: number;
  clientBreakdown?: Record<string, unknown> | null;
  opensByHour?: Record<string, unknown> | null;
  opensByDay?: Record<string, unknown> | null;
  clicksByHour?: Record<string, unknown> | null;
  clicksByDay?: Record<string, unknown> | null;
  opensByCountry?: Record<string, unknown> | null;
  topClickedLinks?: Record<string, unknown> | null;
  hourlyTimeline?: Record<string, unknown> | null;
  updatedAt: Date;
}

// ============================================================================
// Email Generation Types (AI)
// ============================================================================

export interface EmailGeneration {
  id: string;
  prompt: string;
  generatedHtml: string;
  generatedSubject?: string | null;
  generatedText?: string | null;
  modelUsed: string;
  tokensUsed?: number | null;
  generationTime?: number | null;
  rating?: number | null;
  feedback?: string | null;
  wasUsed: boolean;
  emailId?: string | null;
  tone?: string | null;
  targetAudience?: string | null;
  emailType?: EmailType | null;
  createdBy: string;
  createdAt: Date;
}

// ============================================================================
// User Email Preferences
// ============================================================================

export interface UserEmailPreferences {
  id: string;
  userId: string;
  receiveMarketing: boolean;
  receiveTransactional: boolean;
  receiveAnnouncements: boolean;
  receiveReminders: boolean;
  unsubscribedAt?: Date | null;
  unsubscribedFrom: string[];
  unsubscribeReason?: string | null;
  lastOpenedAt?: Date | null;
  lastClickedAt?: Date | null;
  totalOpens: number;
  totalClicks: number;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Segment Rules Types
// ============================================================================

export interface SegmentRules {
  roles?: string[];
  venueIds?: string[];
  userStatus?: string[];
  userIds?: string[];
  customConditions?: SegmentCondition[];
}

export interface SegmentCondition {
  field: string;
  operator: "equals" | "not_equals" | "contains" | "greater_than" | "less_than" | "in" | "not_in";
  value: string | number | string[] | number[];
}

// ============================================================================
// Recipient Preview Types
// ============================================================================

export interface RecipientPreview {
  totalCount: number;
  byRole: Record<string, number>;
  byVenue: Array<{ venueId: string; venueName: string; count: number }>;
}

// ============================================================================
// Create/Update Input Types
// ============================================================================

export interface CreateEmailInput {
  name: string;
  description?: string;
  subject: string;
  previewText?: string;
  htmlContent: string;
  textContent?: string;
  designJson?: Record<string, unknown>;
  emailType: EmailType;
  category?: string;
  isTemplate?: boolean;
  variables?: string[];
  venueId?: string;
}

export interface UpdateEmailInput extends Partial<CreateEmailInput> {
  aiClassification?: EmailType;
  aiConfidence?: number;
}

export interface CreateEmailCampaignInput {
  name: string;
  emailId: string;
  customSubject?: string;
  customHtml?: string;
  targetRoles?: string[];
  targetVenueIds?: string[];
  targetStatus?: string[];
  targetUserIds?: string[];
  segmentId?: string;
  scheduledAt?: Date;
  venueId?: string;
}

export interface UpdateEmailCampaignInput extends Partial<CreateEmailCampaignInput> {
  // Additional fields for updates if needed
}

export interface CreateEmailSegmentInput {
  name: string;
  description?: string;
  rules: SegmentRules;
  venueId?: string;
}

export interface UpdateEmailSegmentInput extends Partial<CreateEmailSegmentInput> {
  // Additional fields for updates if needed
}

// ============================================================================
// Filter Types
// ============================================================================

export interface EmailFilters {
  isTemplate?: boolean;
  category?: string;
  venueId?: string;
  isSystem?: boolean;
  createdBy?: string;
  search?: string;
}

export interface EmailCampaignFilters {
  status?: CampaignStatus;
  emailType?: EmailType;
  venueId?: string;
  createdBy?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
}

export interface EmailSegmentFilters {
  venueId?: string;
  isSystem?: boolean;
  createdBy?: string;
  search?: string;
}

export interface EmailTemplateFilters {
  category?: string;
  venueId?: string;
  isSystem?: boolean;
  search?: string;
}
