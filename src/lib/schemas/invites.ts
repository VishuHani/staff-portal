import { z } from "zod";

/**
 * Schema for creating a new invitation
 */
export const createInvitationSchema = z.object({
  email: z.string().email("Invalid email address"),
  scope: z.enum(["SYSTEM", "VENUE"], {
    message: "Please select an invitation scope",
  }),
  venueId: z.string().optional(),
  roleId: z.string({
    message: "Please select a role",
  }),
  documentIds: z.array(z.string()).optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

/**
 * Schema for invitation filters
 */
export const invitationFiltersSchema = z.object({
  status: z.enum(["PENDING", "ACCEPTED", "EXPIRED", "CANCELLED"]).optional(),
  venueId: z.string().optional(),
  scope: z.enum(["SYSTEM", "VENUE"]).optional(),
  search: z.string().optional(),
  inviterId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.number().int().positive().optional(),
  pageSize: z.enum(["50", "100", "200"]).optional(),
});

export type InvitationFilters = z.infer<typeof invitationFiltersSchema>;

/**
 * Schema for invite settings
 */
export const inviteSettingsSchema = z.object({
  blockUntilDocumentsComplete: z.boolean().default(false),
  maxPendingPerVenue: z.number().min(1).max(500).default(50),
  maxPendingPerUser: z.number().min(1).max(100).default(20),
  maxInvitationsPerDay: z.number().min(1).max(1000).default(100),
  invitationExpirationDays: z.number().min(1).max(30).default(7),
});

export type InviteSettingsInput = z.infer<typeof inviteSettingsSchema>;

/**
 * Schema for onboarding document creation
 */
export const createOnboardingDocumentSchema = z.object({
  venueId: z.string(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  type: z.enum(["FORM", "PDF", "EXTERNAL_LINK"]),
  content: z.any().optional(),
  isRequired: z.boolean().default(true),
});

export type CreateOnboardingDocumentInput = z.infer<typeof createOnboardingDocumentSchema>;
