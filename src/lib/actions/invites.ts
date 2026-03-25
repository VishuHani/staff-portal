"use server";

import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import { hasAnyPermission, hasPermission } from "@/lib/rbac/permissions";
import { randomBytes } from "crypto";
import { addDays } from "date-fns";
import { sendBrevoEmail } from "@/lib/services/email/brevo";
import { getInvitationEmailTemplate } from "@/lib/services/email/templates";
import {
  createInvitationSchema,
  type CreateInvitationInput,
  type InvitationFilters,
} from "@/lib/schemas/invites";
import { SYSTEM_PERMISSIONS } from "@/lib/rbac/system-permissions";
import { revalidatePaths } from "@/lib/utils/action-contract";
import { toAbsoluteAppUrl } from "@/lib/utils/app-url";

// ============================================================================
// TYPES
// ============================================================================

export interface InvitationWithDetails {
  id: string;
  email: string;
  token: string;
  scope: string;
  venueId: string | null;
  venue: { id: string; name: string } | null;
  roleId: string;
  role: { id: string; name: string };
  documentIds: string[];
  status: string;
  acceptedAt: Date | null;
  expiresAt: Date;
  createdAt: Date;
  inviter: { id: string; firstName: string | null; lastName: string | null; email: string };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate a secure random token for invitation links
 */
function generateInvitationToken(): string {
  return randomBytes(32).toString("hex");
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Get or create invite settings (singleton pattern)
 */
async function getInviteSettings() {
  let settings = await prisma.inviteSettings.findFirst();
  
  if (!settings) {
    settings = await prisma.inviteSettings.create({
      data: {
        blockUntilDocumentsComplete: false,
        maxPendingPerVenue: 50,
        maxPendingPerUser: 20,
        maxInvitationsPerDay: 100,
        invitationExpirationDays: 7,
      },
    });
  }
  
  return settings;
}

/**
 * Get venues that a user can invite to
 * - Users with global venue scope can invite to all venues
 * - Others can only invite to venues they are assigned to
 */
async function hasGlobalInviteVenueScope(userId: string): Promise<boolean> {
  return hasAnyPermission(userId, SYSTEM_PERMISSIONS.venuesRead);
}

async function getUserInvitableVenues(userId: string): Promise<string[]> {
  if (await hasGlobalInviteVenueScope(userId)) {
    const venues = await prisma.venue.findMany({
      where: { active: true },
      select: { id: true },
    });
    return venues.map((v) => v.id);
  }

  const userVenues = await prisma.userVenue.findMany({
    where: { userId },
    select: { venueId: true },
  });
  
  return userVenues.map((uv) => uv.venueId);
}

// ============================================================================
// SERVER ACTIONS
// ============================================================================

/**
 * Create a new invitation
 */
export async function createInvitation(data: CreateInvitationInput): Promise<{
  success: boolean;
  invitation?: InvitationWithDetails;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    // Validate input
    const validated = createInvitationSchema.safeParse(data);
    if (!validated.success) {
      return { success: false, error: validated.error.issues[0]?.message || "Invalid input" };
    }
    
    const { email, scope, venueId, roleId, documentIds } = validated.data;
    const normalizedEmail = normalizeEmail(email);
    
    // Check if user has permission to create invitations
    const canInvite = await hasPermission(user.id, "invites", "create");
    if (!canInvite) {
      return { success: false, error: "You don't have permission to send invitations" };
    }
    
    const [invitableVenues, hasGlobalVenueScope] = await Promise.all([
      getUserInvitableVenues(user.id),
      hasGlobalInviteVenueScope(user.id),
    ]);
    
    if (scope === "VENUE") {
      if (!venueId) {
        return { success: false, error: "Venue is required for venue-scoped invitations" };
      }
      
      if (!hasGlobalVenueScope && !invitableVenues.includes(venueId)) {
        return { success: false, error: "You can only send invitations for venues you are assigned to" };
      }
    } else if (scope === "SYSTEM") {
      if (!hasGlobalVenueScope) {
        return {
          success: false,
          error: "Only users with global invite scope can send system-level invitations",
        };
      }
    }
    
    // Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    
    if (existingUser) {
      return { success: false, error: "A user with this email already exists" };
    }
    
    // Check for existing pending invitation
    const existingInvitation = await prisma.userInvitation.findFirst({
      where: {
        email: normalizedEmail,
        status: "PENDING",
        expiresAt: { gte: new Date() },
        ...(scope === "VENUE" ? { venueId } : { venueId: null }),
      },
    });
    
    if (existingInvitation) {
      return { success: false, error: "An active invitation already exists for this email" };
    }
    
    // Get invite settings for expiration
    const settings = await getInviteSettings();
    
    // Create invitation
    const token = generateInvitationToken();
    const expiresAt = addDays(new Date(), settings.invitationExpirationDays);
    
    const invitation = await prisma.userInvitation.create({
      data: {
        email: normalizedEmail,
        token,
        inviterId: user.id,
        scope,
        venueId: scope === "VENUE" ? venueId : null,
        roleId,
        documentIds: documentIds || [],
        expiresAt,
      },
      include: {
        venue: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    
    // Send invitation email
    const inviteLink = toAbsoluteAppUrl(`/signup?invite=${token}`);
    
    const emailTemplate = getInvitationEmailTemplate({
      inviterName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
      venueName: invitation.venue?.name || null,
      roleName: invitation.role.name,
      inviteLink,
      expirationDays: settings.invitationExpirationDays,
    });
    
    const emailResult = await sendBrevoEmail({
      to: normalizedEmail,
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.htmlContent,
    });

    if (!emailResult.success) {
      console.error("Invitation created but email delivery failed:", {
        email: normalizedEmail,
        error: emailResult.error,
      });
      await prisma.userInvitation.delete({ where: { id: invitation.id } });
      return {
        success: false,
        error:
          "Failed to deliver invitation email. Please verify Brevo settings and try again.",
      };
    }
    
    revalidatePaths("/system/invites", "/manage/invites");
    
    return { success: true, invitation: invitation as InvitationWithDetails };
  } catch (error) {
    console.error("Error creating invitation:", error);
    return { success: false, error: "Failed to create invitation" };
  }
}

/**
 * Get invitations list with filters and pagination
 */
export async function getInvitations(filters?: InvitationFilters & {
  page?: number;
  pageSize?: "50" | "100" | "200";
  dateFrom?: string;
  dateTo?: string;
  inviterId?: string;
}): Promise<{
  success: boolean;
  invitations?: InvitationWithDetails[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    // Check if user has permission to view invitations
    const canView = await hasPermission(user.id, "invites", "view");
    if (!canView) {
      return { success: false, error: "You don't have permission to view invitations" };
    }
    
    const [hasGlobalVenueScope, invitableVenues] = await Promise.all([
      hasGlobalInviteVenueScope(user.id),
      getUserInvitableVenues(user.id),
    ]);
    
    // Build where clause
    const where: any = {};
    
    if (filters?.status) {
      where.status = filters.status;
    }
    
    if (filters?.scope) {
      where.scope = filters.scope;
    }
    
    if (!hasGlobalVenueScope) {
      where.venueId = { in: invitableVenues };
    } else if (filters?.venueId) {
      where.venueId = filters.venueId;
    }
    
    if (filters?.search) {
      where.email = { contains: filters.search, mode: "insensitive" };
    }

    if (filters?.inviterId) {
      where.inviterId = filters.inviterId;
    }

    // Date range filters
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) {
        where.createdAt.gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        where.createdAt.lte = new Date(filters.dateTo);
      }
    }
    
    // Get total count for pagination
    const total = await prisma.userInvitation.count({ where });
    
    // Pagination
    const page = filters?.page || 1;
    const pageSize = filters?.pageSize ? parseInt(filters.pageSize) : 50;
    const totalPages = Math.ceil(total / pageSize);
    
    const invitations = await prisma.userInvitation.findMany({
      where,
      include: {
        venue: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    
    return { 
      success: true, 
      invitations: invitations as InvitationWithDetails[],
      total,
      page,
      pageSize,
      totalPages
    };
  } catch (error) {
    console.error("Error fetching invitations:", error);
    return { success: false, error: "Failed to fetch invitations" };
  }
}

/**
 * Cancel a pending invitation
 */
export async function cancelInvitation(invitationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    // Get the invitation
    const invitation = await prisma.userInvitation.findUnique({
      where: { id: invitationId },
    });
    
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }
    
    if (invitation.status !== "PENDING") {
      return { success: false, error: "Only pending invitations can be cancelled" };
    }
    
    // Check permission - user must be the inviter or an admin
    const hasGlobalVenueScope = await hasGlobalInviteVenueScope(user.id);
    if (invitation.inviterId !== user.id && !hasGlobalVenueScope) {
      // Check if user has venue permission
      if (invitation.venueId) {
        const canCancel = await hasPermission(user.id, "invites", "cancel", invitation.venueId);
        if (!canCancel) {
          return { success: false, error: "You don't have permission to cancel this invitation" };
        }
      } else {
        return { success: false, error: "You don't have permission to cancel this invitation" };
      }
    }
    
    await prisma.userInvitation.update({
      where: { id: invitationId },
      data: { status: "CANCELLED" },
    });
    
    revalidatePaths("/system/invites", "/manage/invites");
    
    return { success: true };
  } catch (error) {
    console.error("Error cancelling invitation:", error);
    return { success: false, error: "Failed to cancel invitation" };
  }
}

/**
 * Resend an invitation email
 */
export async function resendInvitation(invitationId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    // Get the invitation
    const invitation = await prisma.userInvitation.findUnique({
      where: { id: invitationId },
      include: {
        venue: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    
    if (!invitation) {
      return { success: false, error: "Invitation not found" };
    }
    
    if (invitation.status !== "PENDING") {
      return { success: false, error: "Only pending invitations can be resent" };
    }
    
    // Check permission
    const hasGlobalVenueScope = await hasGlobalInviteVenueScope(user.id);
    if (invitation.inviterId !== user.id && !hasGlobalVenueScope) {
      const canResend = await hasPermission(user.id, "invites", "resend");
      if (!canResend) {
        return { success: false, error: "You don't have permission to resend this invitation" };
      }
    }
    
    // Get settings and update expiration
    const settings = await getInviteSettings();
    const newExpiresAt = addDays(new Date(), settings.invitationExpirationDays);
    
    // Generate new token for security
    const newToken = generateInvitationToken();
    
    await prisma.userInvitation.update({
      where: { id: invitationId },
      data: {
        token: newToken,
        expiresAt: newExpiresAt,
      },
    });
    
    // Send new invitation email
    const inviteLink = toAbsoluteAppUrl(`/signup?invite=${newToken}`);
    
    const emailTemplate = getInvitationEmailTemplate({
      inviterName: `${invitation.inviter.firstName || ""} ${invitation.inviter.lastName || ""}`.trim() || invitation.inviter.email,
      venueName: invitation.venue?.name || null,
      roleName: invitation.role.name,
      inviteLink,
      expirationDays: settings.invitationExpirationDays,
    });
    
    const emailResult = await sendBrevoEmail({
      to: normalizeEmail(invitation.email),
      subject: emailTemplate.subject,
      htmlContent: emailTemplate.htmlContent,
    });

    if (!emailResult.success) {
      console.error("Failed to resend invitation email:", {
        email: invitation.email,
        invitationId,
        error: emailResult.error,
      });
      return {
        success: false,
        error: "Failed to deliver invitation email. Please verify Brevo configuration and try again.",
      };
    }
    
    return { success: true };
  } catch (error) {
    console.error("Error resending invitation:", error);
    return { success: false, error: "Failed to resend invitation" };
  }
}

/**
 * Validate an invitation token (for signup page)
 */
export async function validateInvitationToken(token: string): Promise<{
  success: boolean;
  invitation?: {
    email: string;
    scope: string;
    venueId: string | null;
    venueName?: string | null;
    roleId: string;
    roleName: string;
    documentIds: string[];
  };
  error?: string;
}> {
  try {
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        venue: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });
    
    if (!invitation) {
      return { success: false, error: "Invalid invitation token" };
    }
    
    if (invitation.status !== "PENDING") {
      return { success: false, error: "This invitation has already been used or cancelled" };
    }
    
    if (invitation.expiresAt < new Date()) {
      // Mark as expired
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return { success: false, error: "This invitation has expired" };
    }
    
    return {
      success: true,
      invitation: {
        email: invitation.email,
        scope: invitation.scope,
        venueId: invitation.venueId,
        venueName: invitation.venue?.name || null,
        roleId: invitation.roleId,
        roleName: invitation.role.name,
        documentIds: invitation.documentIds,
      },
    };
  } catch (error) {
    console.error("Error validating invitation token:", error);
    return { success: false, error: "Failed to validate invitation" };
  }
}

/**
 * Accept an invitation (called during signup)
 */
export async function acceptInvitation(token: string, userId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const invitation = await prisma.userInvitation.findUnique({
      where: { token },
      include: {
        venue: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });
    
    if (!invitation) {
      return { success: false, error: "Invalid invitation token" };
    }
    
    if (invitation.status !== "PENDING") {
      return { success: false, error: "This invitation has already been used or cancelled" };
    }
    
    if (invitation.expiresAt < new Date()) {
      await prisma.userInvitation.update({
        where: { id: invitation.id },
        data: { status: "EXPIRED" },
      });
      return { success: false, error: "This invitation has expired" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    if (normalizeEmail(user.email) !== normalizeEmail(invitation.email)) {
      return { success: false, error: "Invitation email does not match the signed-in account" };
    }
    
    // Update invitation status
    await prisma.userInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        acceptedBy: userId,
      },
    });
    
    // If venue-scoped, assign user to the venue
    if (invitation.scope === "VENUE" && invitation.venueId) {
      // Check if user is already assigned to this venue
      const existingAssignment = await prisma.userVenue.findUnique({
        where: {
          userId_venueId: {
            userId,
            venueId: invitation.venueId,
          },
        },
      });
      
      if (!existingAssignment) {
        // Check if this is the user's first venue (make it primary)
        const venueCount = await prisma.userVenue.count({
          where: { userId },
        });
        
        await prisma.userVenue.create({
          data: {
            userId,
            venueId: invitation.venueId,
            isPrimary: venueCount === 0,
          },
        });
      }
    }
    
    // Create document assignments if any (legacy onboarding documents)
    if (invitation.documentIds.length > 0) {
      const assignments = invitation.documentIds.map((docId) => ({
        userId,
        documentId: docId,
        invitationId: invitation.id,
        status: "PENDING",
      }));
      
      await prisma.userDocumentAssignment.createMany({
        data: assignments,
        skipDuplicates: true,
      });
    }
    
    // Link any document assignments that were created for this email (prospective user assignments)
    const { linkDocumentAssignmentsToUser } = await import("./documents/assignments");
    await linkDocumentAssignmentsToUser(userId, invitation.email, invitation.venueId ?? undefined);

    // Also link any assignments that were created via this invitation
    await prisma.documentAssignment.updateMany({
      where: {
        invitationId: invitation.id,
        userId: null,
        ...(invitation.venueId ? { venueId: invitation.venueId } : {}),
      },
      data: {
        userId,
        email: null, // Clear email since we now have a userId
      },
    });
    
    return { success: true };
  } catch (error) {
    console.error("Error accepting invitation:", error);
    return { success: false, error: "Failed to accept invitation" };
  }
}

/**
 * Get venues that the current user can invite to
 */
export async function getInvitableVenues(): Promise<{
  success: boolean;
  venues?: Array<{ id: string; name: string; code: string }>;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    const hasGlobalVenueScope = await hasGlobalInviteVenueScope(user.id);
    
    let venues;
    if (hasGlobalVenueScope) {
      venues = await prisma.venue.findMany({
        where: { active: true },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      });
    } else {
      venues = await prisma.venue.findMany({
        where: {
          active: true,
          userVenues: { some: { userId: user.id } },
        },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      });
    }
    
    return { success: true, venues };
  } catch (error) {
    console.error("Error fetching invitable venues:", error);
    return { success: false, error: "Failed to fetch venues" };
  }
}

/**
 * Get all roles for invitation dropdown
 */
export async function getInviteRoles(): Promise<{
  success: boolean;
  roles?: Array<{ id: string; name: string; description: string | null }>;
  error?: string;
}> {
  try {
    await requireAuth();
    
    const roles = await prisma.role.findMany({
      select: { id: true, name: true, description: true },
      orderBy: { name: "asc" },
    });
    
    return { success: true, roles };
  } catch (error) {
    console.error("Error fetching roles:", error);
    return { success: false, error: "Failed to fetch roles" };
  }
}

/**
 * Get invitation statistics
 */
export async function getInvitationStats(): Promise<{
  success: boolean;
  stats?: {
    total: number;
    pending: number;
    accepted: number;
    expired: number;
    cancelled: number;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    const canView = await hasPermission(user.id, "invites", "view");
    if (!canView) {
      return { success: false, error: "You don't have permission to view invitation stats" };
    }
    
    const [hasGlobalVenueScope, invitableVenues] = await Promise.all([
      hasGlobalInviteVenueScope(user.id),
      getUserInvitableVenues(user.id),
    ]);
    
    const where = hasGlobalVenueScope ? {} : { venueId: { in: invitableVenues } };
    
    const [total, pending, accepted, expired, cancelled] = await Promise.all([
      prisma.userInvitation.count({ where }),
      prisma.userInvitation.count({ where: { ...where, status: "PENDING" } }),
      prisma.userInvitation.count({ where: { ...where, status: "ACCEPTED" } }),
      prisma.userInvitation.count({ where: { ...where, status: "EXPIRED" } }),
      prisma.userInvitation.count({ where: { ...where, status: "CANCELLED" } }),
    ]);
    
    return {
      success: true,
      stats: { total, pending, accepted, expired, cancelled },
    };
  } catch (error) {
    console.error("Error fetching invitation stats:", error);
    return { success: false, error: "Failed to fetch invitation statistics" };
  }
}

/**
 * Get invitation analytics for charts
 */
export async function getInvitationAnalytics(): Promise<{
  success: boolean;
  analytics?: {
    byMonth: Array<{ month: string; sent: number; accepted: number; expired: number; cancelled: number }>;
    byVenue: Array<{ venueId: string; venueName: string; count: number }>;
    byRole: Array<{ roleId: string; roleName: string; count: number }>;
    byInviter: Array<{ inviterId: string; inviterName: string; count: number }>;
    acceptanceRate: number;
    avgTimeToAccept: number | null; // in hours
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    const canView = await hasPermission(user.id, "invites", "view");
    if (!canView) {
      return { success: false, error: "You don't have permission to view invitation analytics" };
    }
    
    const [hasGlobalVenueScope, invitableVenues] = await Promise.all([
      hasGlobalInviteVenueScope(user.id),
      getUserInvitableVenues(user.id),
    ]);
    
    const baseWhere = hasGlobalVenueScope ? {} : { venueId: { in: invitableVenues } };
    
    // Get invitations from the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    
    const invitations = await prisma.userInvitation.findMany({
      where: {
        ...baseWhere,
        createdAt: { gte: twelveMonthsAgo },
      },
      include: {
        venue: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
        inviter: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    
    // Group by month
    const byMonthMap = new Map<string, { sent: number; accepted: number; expired: number; cancelled: number }>();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months.push(monthKey);
      byMonthMap.set(monthKey, { sent: 0, accepted: 0, expired: 0, cancelled: 0 });
    }
    
    invitations.forEach((inv) => {
      const monthKey = `${inv.createdAt.getFullYear()}-${String(inv.createdAt.getMonth() + 1).padStart(2, '0')}`;
      const data = byMonthMap.get(monthKey);
      if (data) {
        data.sent++;
        if (inv.status === "ACCEPTED") data.accepted++;
        else if (inv.status === "EXPIRED") data.expired++;
        else if (inv.status === "CANCELLED") data.cancelled++;
      }
    });
    
    const byMonth = months.map((month) => ({
      month,
      ...byMonthMap.get(month)!,
    }));
    
    // Group by venue
    const byVenueMap = new Map<string, { venueId: string; venueName: string; count: number }>();
    invitations.forEach((inv) => {
      if (inv.venueId && inv.venue) {
        const existing = byVenueMap.get(inv.venueId);
        if (existing) {
          existing.count++;
        } else {
          byVenueMap.set(inv.venueId, {
            venueId: inv.venueId,
            venueName: inv.venue.name,
            count: 1,
          });
        }
      }
    });
    const byVenue = Array.from(byVenueMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
    
    // Group by role
    const byRoleMap = new Map<string, { roleId: string; roleName: string; count: number }>();
    invitations.forEach((inv) => {
      const existing = byRoleMap.get(inv.roleId);
      if (existing) {
        existing.count++;
      } else {
        byRoleMap.set(inv.roleId, {
          roleId: inv.roleId,
          roleName: inv.role.name,
          count: 1,
        });
      }
    });
    const byRole = Array.from(byRoleMap.values()).sort((a, b) => b.count - a.count);
    
    // Group by inviter
    const byInviterMap = new Map<string, { inviterId: string; inviterName: string; count: number }>();
    invitations.forEach((inv) => {
      const existing = byInviterMap.get(inv.inviterId);
      if (existing) {
        existing.count++;
      } else {
        byInviterMap.set(inv.inviterId, {
          inviterId: inv.inviterId,
          inviterName: `${inv.inviter.firstName || ''} ${inv.inviter.lastName || ''}`.trim() || inv.inviter.email,
          count: 1,
        });
      }
    });
    const byInviter = Array.from(byInviterMap.values()).sort((a, b) => b.count - a.count).slice(0, 10);
    
    // Calculate acceptance rate
    const totalCompleted = invitations.filter(i => i.status !== "PENDING").length;
    const accepted = invitations.filter(i => i.status === "ACCEPTED").length;
    const acceptanceRate = totalCompleted > 0 ? Math.round((accepted / totalCompleted) * 100) : 0;
    
    // Calculate average time to accept (in hours)
    const acceptedInvitations = invitations.filter(i => i.status === "ACCEPTED" && i.acceptedAt);
    let avgTimeToAccept: number | null = null;
    if (acceptedInvitations.length > 0) {
      const totalTime = acceptedInvitations.reduce((sum, inv) => {
        const diff = inv.acceptedAt!.getTime() - inv.createdAt.getTime();
        return sum + diff;
      }, 0);
      avgTimeToAccept = Math.round((totalTime / acceptedInvitations.length) / (1000 * 60 * 60)); // Convert ms to hours
    }
    
    return {
      success: true,
      analytics: {
        byMonth,
        byVenue,
        byRole,
        byInviter,
        acceptanceRate,
        avgTimeToAccept,
      },
    };
  } catch (error) {
    console.error("Error fetching invitation analytics:", error);
    return { success: false, error: "Failed to fetch invitation analytics" };
  }
}

/**
 * Get all inviters (users who have sent invitations)
 */
export async function getInviters(): Promise<{
  success: boolean;
  inviters?: Array<{ id: string; name: string; email: string }>;
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    const canView = await hasPermission(user.id, "invites", "view");
    if (!canView) {
      return { success: false, error: "You don't have permission to view inviters" };
    }
    
    const [hasGlobalVenueScope, invitableVenues] = await Promise.all([
      hasGlobalInviteVenueScope(user.id),
      getUserInvitableVenues(user.id),
    ]);
    
    const where = hasGlobalVenueScope ? {} : { venueId: { in: invitableVenues } };
    
    // Get unique inviter IDs
    const invitations = await prisma.userInvitation.findMany({
      where,
      select: { inviterId: true },
      distinct: ['inviterId'],
    });
    
    const inviterIds = invitations.map(i => i.inviterId);
    
    const users = await prisma.user.findMany({
      where: { id: { in: inviterIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });
    
    const inviters = users.map(u => ({
      id: u.id,
      name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.email,
      email: u.email,
    }));
    
    return { success: true, inviters };
  } catch (error) {
    console.error("Error fetching inviters:", error);
    return { success: false, error: "Failed to fetch inviters" };
  }
}

// ============================================================================
// INVITE SETTINGS ACTIONS
// ============================================================================

/**
 * Get invite settings (admin only)
 */
export async function getInviteSettingsAction(): Promise<{
  success: boolean;
  settings?: {
    id: string;
    blockUntilDocumentsComplete: boolean;
    maxPendingPerVenue: number;
    maxPendingPerUser: number;
    maxInvitationsPerDay: number;
    invitationExpirationDays: number;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    const canManageSettings = await hasAnyPermission(
      user.id,
      SYSTEM_PERMISSIONS.invitesManage
    );
    if (!canManageSettings) {
      return { success: false, error: "You don't have permission to view invite settings" };
    }
    
    const settings = await getInviteSettings();
    
    return { success: true, settings };
  } catch (error) {
    console.error("Error fetching invite settings:", error);
    return { success: false, error: "Failed to fetch invite settings" };
  }
}

/**
 * Update invite settings (admin only)
 */
export async function updateInviteSettingsAction(data: {
  blockUntilDocumentsComplete?: boolean;
  maxPendingPerVenue?: number;
  maxPendingPerUser?: number;
  maxInvitationsPerDay?: number;
  invitationExpirationDays?: number;
}): Promise<{
  success: boolean;
  settings?: {
    id: string;
    blockUntilDocumentsComplete: boolean;
    maxPendingPerVenue: number;
    maxPendingPerUser: number;
    maxInvitationsPerDay: number;
    invitationExpirationDays: number;
  };
  error?: string;
}> {
  try {
    const user = await requireAuth();
    
    const canManageSettings = await hasAnyPermission(
      user.id,
      SYSTEM_PERMISSIONS.invitesManage
    );
    if (!canManageSettings) {
      return {
        success: false,
        error: "You don't have permission to update invite settings",
      };
    }
    
    // Get existing settings
    const existingSettings = await getInviteSettings();
    
    // Update settings
    const updatedSettings = await prisma.inviteSettings.update({
      where: { id: existingSettings.id },
      data: {
        blockUntilDocumentsComplete: data.blockUntilDocumentsComplete ?? existingSettings.blockUntilDocumentsComplete,
        maxPendingPerVenue: data.maxPendingPerVenue ?? existingSettings.maxPendingPerVenue,
        maxPendingPerUser: data.maxPendingPerUser ?? existingSettings.maxPendingPerUser,
        maxInvitationsPerDay: data.maxInvitationsPerDay ?? existingSettings.maxInvitationsPerDay,
        invitationExpirationDays: data.invitationExpirationDays ?? existingSettings.invitationExpirationDays,
      },
    });
    
    revalidatePaths("/system/invites/settings");
    
    return { success: true, settings: updatedSettings };
  } catch (error) {
    console.error("Error updating invite settings:", error);
    return { success: false, error: "Failed to update invite settings" };
  }
}
