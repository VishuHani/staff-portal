"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission, isAdmin } from "@/lib/rbac/permissions";
import { AssignmentType, AssignmentStatus, DocumentType } from "@prisma/client";
import { z } from "zod";
import { getUserVenueIds } from "@/lib/utils/venue";
import { revalidatePaths } from "@/lib/utils/action-contract";
import { toAbsoluteAppUrl } from "@/lib/utils/app-url";

// ============================================================================
// Types
// ============================================================================

export interface DocumentAssignmentWithRelations {
  id: string;
  assignmentType: AssignmentType;
  templateId: string | null;
  template?: {
    id: string;
    name: string;
    documentType: DocumentType;
    category: string;
  } | null;
  bundleId: string | null;
  bundle?: {
    id: string;
    name: string;
    category: string;
  } | null;
  userId: string | null;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  email: string | null;  // For prospective users
  venueId: string;
  venue: {
    id: string;
    name: string;
  };
  assignedBy: string;
  assignedByUser: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  };
  invitationId: string | null;
  assignedAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
  status: AssignmentStatus;
  templateVersion: number | null;
  bundleVersion: number | null;
  notes: string | null;
  _count?: {
    submissions: number;
    reminders: number;
  };
}

export interface CreateAssignmentInput {
  templateId?: string;
  bundleId?: string;
  userId: string;
  venueId: string;
  dueDate?: Date;
  notes?: string;
  invitationId?: string;
}

export interface UpdateAssignmentInput {
  id: string;
  status?: AssignmentStatus;
  dueDate?: Date;
  notes?: string;
}

export interface AssignmentListFilters {
  venueId?: string;
  userId?: string;
  templateId?: string;
  bundleId?: string;
  status?: AssignmentStatus;
  assignedBy?: string;
  email?: string;  // Filter by prospective user email
}

export interface CreateProspectiveAssignmentInput {
  templateId?: string;
  bundleId?: string;
  email: string;          // Email of prospective user
  venueId: string;
  dueDate?: Date;
  notes?: string;
  sendInvitation?: boolean; // Whether to send an invitation email
}

// ============================================================================
// Validation Schemas
// ============================================================================

const createAssignmentSchema = z.object({
  templateId: z.string().cuid().optional(),
  bundleId: z.string().cuid().optional(),
  userId: z.string().cuid(),
  venueId: z.string().cuid(),
  dueDate: z.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  invitationId: z.string().cuid().optional().nullable(),
}).refine(
  (data) => data.templateId || data.bundleId,
  {
    message: "Either templateId or bundleId must be provided",
  }
);

const updateAssignmentSchema = z.object({
  id: z.string().cuid(),
  status: z.nativeEnum(AssignmentStatus).optional(),
  dueDate: z.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const createProspectiveAssignmentSchema = z.object({
  templateId: z.string().cuid().optional(),
  bundleId: z.string().cuid().optional(),
  email: z.string().email("Invalid email address"),
  venueId: z.string().cuid(),
  dueDate: z.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  sendInvitation: z.boolean().optional().default(true),
}).refine(
  (data) => data.templateId || data.bundleId,
  {
    message: "Either templateId or bundleId must be provided",
  }
);

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// ============================================================================
// Permission Check Helper
// ============================================================================

async function checkDocumentPermission(
  userId: string,
  action: string,
  venueId?: string
): Promise<boolean> {
  const permissionMap: Record<string, string> = {
    assignment_create: "create",
    assignment_read: "read",
    assignment_update: "update",
    assignment_delete: "delete",
  };

  const permissionAction = permissionMap[action] || "read";
  if (venueId) {
    const userIsAdmin = await isAdmin(userId);
    if (!userIsAdmin) {
      const userVenueIds = await getUserVenueIds(userId);
      if (!userVenueIds.includes(venueId)) {
        return false;
      }
    }
  }

  return hasPermission(userId, "documents", permissionAction as any, venueId);
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new document assignment (single document to single user)
 */
export async function createDocumentAssignment(
  input: CreateAssignmentInput
): Promise<{ success: boolean; data?: DocumentAssignmentWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "assignment_create", input.venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to create assignments" };
    }

    // Validate input
    const validated = createAssignmentSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;

    // Determine assignment type
    const assignmentType: AssignmentType = data.templateId ? "SINGLE" : "BUNDLE";

    // Get template or bundle version
    let templateVersion: number | null = null;
    let bundleVersion: number | null = null;

    if (data.templateId) {
      const template = await prisma.documentTemplate.findUnique({
        where: { id: data.templateId },
        select: { currentVersion: true, venueId: true, isActive: true },
      });

      if (!template) {
        return { success: false, error: "Template not found" };
      }

      if (!template.isActive) {
        return { success: false, error: "Cannot assign an inactive template" };
      }

      if (template.venueId !== data.venueId) {
        return { success: false, error: "Template does not belong to this venue" };
      }

      templateVersion = template.currentVersion;
    }

    if (data.bundleId) {
      const bundle = await prisma.documentBundle.findUnique({
        where: { id: data.bundleId },
        select: { currentVersion: true, venueId: true, isActive: true },
      });

      if (!bundle) {
        return { success: false, error: "Bundle not found" };
      }

      if (!bundle.isActive) {
        return { success: false, error: "Cannot assign an inactive bundle" };
      }

      if (bundle.venueId !== data.venueId) {
        return { success: false, error: "Bundle does not belong to this venue" };
      }

      bundleVersion = bundle.currentVersion;
    }

    // Check if user exists and belongs to venue
    const targetUser = await prisma.user.findUnique({
      where: { id: data.userId },
      include: {
        venues: { where: { venueId: data.venueId } },
      },
    });

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    if (targetUser.venues.length === 0) {
      return { success: false, error: "User does not belong to this venue" };
    }

    // Check for existing assignment
    const existingAssignment = await prisma.documentAssignment.findFirst({
      where: {
        userId: data.userId,
        venueId: data.venueId,
        templateId: data.templateId || null,
        bundleId: data.bundleId || null,
        status: { notIn: ["COMPLETED", "WAIVED", "EXPIRED"] },
      },
    });

    if (existingAssignment) {
      return { success: false, error: "User already has an active assignment for this document" };
    }

    // Create assignment
    const assignment = await prisma.documentAssignment.create({
      data: {
        assignmentType,
        templateId: data.templateId || null,
        bundleId: data.bundleId || null,
        userId: data.userId,
        venueId: data.venueId,
        assignedBy: user.id,
        invitationId: data.invitationId || null,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        templateVersion,
        bundleVersion,
        status: "PENDING",
      },
      include: {
        template: {
          select: { id: true, name: true, documentType: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        assignedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "ASSIGNMENT",
        resourceId: assignment.id,
        action: "ASSIGNED",
        description: `Document assigned to ${targetUser.email}`,
        userId: user.id,
        newValue: assignment as any,
      },
    });

    revalidatePaths("/system/documents", "/my/documents");

    return { success: true, data: assignment as DocumentAssignmentWithRelations };
  } catch (error) {
    console.error("Error creating document assignment:", error);
    return { success: false, error: "Failed to create assignment" };
  }
}

/**
 * Get a single document assignment by ID
 */
export async function getDocumentAssignment(
  assignmentId: string
): Promise<{ success: boolean; data?: DocumentAssignmentWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const assignment = await prisma.documentAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        template: {
          select: { id: true, name: true, documentType: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        assignedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { submissions: true, reminders: true },
        },
      },
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    // Check permission - user can view their own assignments or needs read permission
    if (assignment.userId !== user.id) {
      const hasReadPermission = await checkDocumentPermission(user.id, "assignment_read", assignment.venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view this assignment" };
      }
    }

    return { success: true, data: assignment as DocumentAssignmentWithRelations };
  } catch (error) {
    console.error("Error fetching document assignment:", error);
    return { success: false, error: "Failed to fetch assignment" };
  }
}

/**
 * List document assignments with filters
 */
export async function listDocumentAssignments(
  filters: AssignmentListFilters
): Promise<{ success: boolean; data?: DocumentAssignmentWithRelations[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const userIsAdmin = await isAdmin(user.id);
    const userVenueIds = userIsAdmin ? [] : await getUserVenueIds(user.id);
    const where: any = {};

    if (filters.venueId) {
      if (!userIsAdmin && !userVenueIds.includes(filters.venueId)) {
        return { success: false, error: "You don't have permission to view assignments for this venue" };
      }
      where.venueId = filters.venueId;
    } else if (!userIsAdmin) {
      if (userVenueIds.length === 0) {
        return { success: true, data: [] };
      }
      where.venueId = { in: userVenueIds };
    }

    if (filters.userId) {
      where.userId = filters.userId;
    }

    if (filters.templateId) {
      where.templateId = filters.templateId;
    }

    if (filters.bundleId) {
      where.bundleId = filters.bundleId;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.assignedBy) {
      where.assignedBy = filters.assignedBy;
    }

    const assignments = await prisma.documentAssignment.findMany({
      where,
      include: {
        template: {
          select: { id: true, name: true, documentType: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        assignedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { submissions: true, reminders: true },
        },
      },
      orderBy: [
        { status: "asc" },
        { assignedAt: "desc" },
      ],
    });

    return { success: true, data: assignments as DocumentAssignmentWithRelations[] };
  } catch (error) {
    console.error("Error listing document assignments:", error);
    return { success: false, error: "Failed to list assignments" };
  }
}

/**
 * List current user's document assignments
 */
export async function listMyDocumentAssignments(
  filters?: { status?: AssignmentStatus }
): Promise<{ success: boolean; data?: DocumentAssignmentWithRelations[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const userIsAdmin = await isAdmin(user.id);
    const userVenueIds = userIsAdmin ? [] : await getUserVenueIds(user.id);

    const where: any = {
      userId: user.id,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (!userIsAdmin) {
      if (userVenueIds.length === 0) {
        return { success: true, data: [] };
      }
      where.venueId = { in: userVenueIds };
    }

    const assignments = await prisma.documentAssignment.findMany({
      where,
      include: {
        template: {
          select: { id: true, name: true, documentType: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        assignedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: [
        { status: "asc" },
        { dueDate: "asc" },
        { assignedAt: "desc" },
      ],
    });

    return { success: true, data: assignments as DocumentAssignmentWithRelations[] };
  } catch (error) {
    console.error("Error listing user assignments:", error);
    return { success: false, error: "Failed to list assignments" };
  }
}

/**
 * Update a document assignment
 */
export async function updateDocumentAssignment(
  input: UpdateAssignmentInput
): Promise<{ success: boolean; data?: DocumentAssignmentWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing assignment
    const existingAssignment = await prisma.documentAssignment.findUnique({
      where: { id: input.id },
    });

    if (!existingAssignment) {
      return { success: false, error: "Assignment not found" };
    }

    // Check permission
    const hasUpdatePermission = await checkDocumentPermission(user.id, "assignment_update", existingAssignment.venueId);
    if (!hasUpdatePermission) {
      return { success: false, error: "You don't have permission to update this assignment" };
    }

    // Validate input
    const validated = updateAssignmentSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;
    const updateData: any = {};

    if (data.status !== undefined) {
      updateData.status = data.status;
      
      // Set completedAt if status is COMPLETED
      if (data.status === "COMPLETED") {
        updateData.completedAt = new Date();
      }
    }

    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate;
    }

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }

    // Update assignment
    const assignment = await prisma.documentAssignment.update({
      where: { id: input.id },
      data: updateData,
      include: {
        template: {
          select: { id: true, name: true, documentType: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        assignedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "ASSIGNMENT",
        resourceId: assignment.id,
        action: "UPDATED",
        description: `Assignment status changed to ${assignment.status}`,
        userId: user.id,
        oldValue: existingAssignment as any,
        newValue: assignment as any,
      },
    });

    revalidatePaths("/system/documents", "/my/documents");

    return { success: true, data: assignment as DocumentAssignmentWithRelations };
  } catch (error) {
    console.error("Error updating document assignment:", error);
    return { success: false, error: "Failed to update assignment" };
  }
}

/**
 * Waive a document assignment
 */
export async function waiveDocumentAssignment(
  assignmentId: string,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing assignment
    const existingAssignment = await prisma.documentAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!existingAssignment) {
      return { success: false, error: "Assignment not found" };
    }

    // Check permission
    const hasUpdatePermission = await checkDocumentPermission(user.id, "assignment_update", existingAssignment.venueId);
    if (!hasUpdatePermission) {
      return { success: false, error: "You don't have permission to waive this assignment" };
    }

    // Update assignment
    await prisma.documentAssignment.update({
      where: { id: assignmentId },
      data: {
        status: "WAIVED",
        notes: reason ? `Waived: ${reason}` : "Waived",
      },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "ASSIGNMENT",
        resourceId: assignmentId,
        action: "WAIVED",
        description: reason || "Assignment waived",
        userId: user.id,
        oldValue: existingAssignment as any,
      },
    });

    revalidatePaths("/system/documents", "/my/documents");

    return { success: true };
  } catch (error) {
    console.error("Error waiving document assignment:", error);
    return { success: false, error: "Failed to waive assignment" };
  }
}

/**
 * Get assignment statistics for a venue
 */
export async function getAssignmentStats(
  venueId: string
): Promise<{ success: boolean; data?: {
  total: number;
  pending: number;
  inProgress: number;
  submitted: number;
  completed: number;
  overdue: number;
}; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "assignment_read", venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view assignment statistics" };
    }

    const now = new Date();

    const [total, pending, inProgress, submitted, completed, overdue] = await Promise.all([
      prisma.documentAssignment.count({ where: { venueId } }),
      prisma.documentAssignment.count({ where: { venueId, status: "PENDING" } }),
      prisma.documentAssignment.count({ where: { venueId, status: "IN_PROGRESS" } }),
      prisma.documentAssignment.count({ where: { venueId, status: "SUBMITTED" } }),
      prisma.documentAssignment.count({ where: { venueId, status: "COMPLETED" } }),
      prisma.documentAssignment.count({
        where: {
          venueId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
          dueDate: { lt: now },
        },
      }),
    ]);

    return {
      success: true,
      data: { total, pending, inProgress, submitted, completed, overdue },
    };
  } catch (error) {
    console.error("Error fetching assignment stats:", error);
    return { success: false, error: "Failed to fetch statistics" };
  }
}

/**
 * Create a document assignment for a prospective user (user who hasn't signed up yet)
 * This will:
 * 1. Check if user already exists with this email
 * 2. If exists, use existing user assignment flow
 * 3. If not exists:
 *    a. Create assignment with email only (userId = null)
 *    b. Optionally create an invitation
 *    c. Send email notification
 */
export async function createProspectiveUserAssignment(
  input: CreateProspectiveAssignmentInput
): Promise<{ success: boolean; data?: DocumentAssignmentWithRelations; error?: string; invitationCreated?: boolean }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "assignment_create", input.venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to create assignments" };
    }

    // Validate input
    const validated = createProspectiveAssignmentSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;
    const normalizedEmail = normalizeEmail(data.email);

    // Check if user already exists with this email
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: {
        venues: { where: { venueId: data.venueId } },
      },
    });

    // If user exists and belongs to venue, use existing flow
    if (existingUser && existingUser.venues.length > 0) {
      // Use existing user assignment flow
      return createDocumentAssignment({
        templateId: data.templateId,
        bundleId: data.bundleId,
        userId: existingUser.id,
        venueId: data.venueId,
        dueDate: data.dueDate ?? undefined,
        notes: data.notes ?? undefined,
      });
    }

    // Determine assignment type
    const assignmentType: AssignmentType = data.templateId ? "SINGLE" : "BUNDLE";

    // Get template or bundle version
    let templateVersion: number | null = null;
    let bundleVersion: number | null = null;
    if (data.templateId) {
      const template = await prisma.documentTemplate.findUnique({
        where: { id: data.templateId },
        select: { currentVersion: true, venueId: true, isActive: true, name: true },
      });

      if (!template) {
        return { success: false, error: "Template not found" };
      }

      if (!template.isActive) {
        return { success: false, error: "Cannot assign an inactive template" };
      }

      if (template.venueId !== data.venueId) {
        return { success: false, error: "Template does not belong to this venue" };
      }

      templateVersion = template.currentVersion;
    }

    if (data.bundleId) {
      const bundle = await prisma.documentBundle.findUnique({
        where: { id: data.bundleId },
        select: { currentVersion: true, venueId: true, isActive: true, name: true },
      });

      if (!bundle) {
        return { success: false, error: "Bundle not found" };
      }

      if (!bundle.isActive) {
        return { success: false, error: "Cannot assign an inactive bundle" };
      }

      if (bundle.venueId !== data.venueId) {
        return { success: false, error: "Bundle does not belong to this venue" };
      }

      bundleVersion = bundle.currentVersion;
    }

    // Check for existing assignment for this email
    const existingAssignment = await prisma.documentAssignment.findFirst({
      where: {
        email: normalizedEmail,
        venueId: data.venueId,
        templateId: data.templateId || null,
        bundleId: data.bundleId || null,
        status: { notIn: ["COMPLETED", "WAIVED", "EXPIRED"] },
      },
    });

    if (existingAssignment) {
      return { success: false, error: "This email already has an active assignment for this document" };
    }

    // Get venue info for invitation
    const venue = await prisma.venue.findUnique({
      where: { id: data.venueId },
      select: { name: true },
    });

    // Check for existing pending invitation
    let invitationId: string | null = null;
    let invitationCreated = false;

    if (data.sendInvitation) {
      const existingInvitation = await prisma.userInvitation.findFirst({
        where: {
          email: normalizedEmail,
          status: "PENDING",
          expiresAt: { gte: new Date() },
          venueId: data.venueId,
        },
      });

      if (existingInvitation) {
        invitationId = existingInvitation.id;
      } else {
        // Create a new invitation
        const { randomBytes } = await import("crypto");
        const { addDays } = await import("date-fns");
        const token = randomBytes(32).toString("hex");
        const expiresAt = addDays(new Date(), 7);

        // Get default role for new users (STAFF role)
        const defaultRole = await prisma.role.findFirst({
          where: { name: "STAFF" },
        });

        if (!defaultRole) {
          return { success: false, error: "Default STAFF role not found" };
        }

        const invitation = await prisma.userInvitation.create({
          data: {
            email: normalizedEmail,
            token,
            inviterId: user.id,
            scope: "VENUE",
            venueId: data.venueId,
            roleId: defaultRole.id,
            expiresAt,
          },
        });

        invitationId = invitation.id;
        invitationCreated = true;

        // Send invitation email
        try {
          const { sendBrevoEmail } = await import("@/lib/services/email/brevo");
          const { getInvitationEmailTemplate } = await import("@/lib/services/email/templates");
          
          const inviteLink = toAbsoluteAppUrl(`/signup?invite=${token}`);
          
          const emailTemplate = getInvitationEmailTemplate({
            inviterName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
            venueName: venue?.name || null,
            roleName: defaultRole.name,
            inviteLink,
            expirationDays: 7,
          });
          
          const sendResult = await sendBrevoEmail({
            to: normalizedEmail,
            subject: emailTemplate.subject,
            htmlContent: emailTemplate.htmlContent,
          });

          if (!sendResult.success) {
            console.error("Failed to deliver invitation email:", {
              email: normalizedEmail,
              error: sendResult.error,
            });
          }
        } catch (emailError) {
          console.error("Failed to send invitation email:", emailError);
          // Continue even if email fails - the invitation is still created
        }
      }
    }

    // Create assignment with email only (userId = null)
    const assignment = await prisma.documentAssignment.create({
      data: {
        assignmentType,
        templateId: data.templateId || null,
        bundleId: data.bundleId || null,
        userId: null, // Null for prospective users
        email: normalizedEmail,
        venueId: data.venueId,
        assignedBy: user.id,
        invitationId,
        dueDate: data.dueDate || null,
        notes: data.notes || null,
        templateVersion,
        bundleVersion,
        status: "PENDING",
      },
      include: {
        template: {
          select: { id: true, name: true, documentType: true, category: true },
        },
        bundle: {
          select: { id: true, name: true, category: true },
        },
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        assignedByUser: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "ASSIGNMENT",
        resourceId: assignment.id,
        action: "ASSIGNED",
        description: `Document assigned to prospective user ${normalizedEmail}`,
        userId: user.id,
        newValue: assignment as any,
      },
    });

    revalidatePaths("/system/documents", "/my/documents");

    return { 
      success: true, 
      data: assignment as DocumentAssignmentWithRelations,
      invitationCreated 
    };
  } catch (error) {
    console.error("Error creating prospective user assignment:", error);
    return { success: false, error: "Failed to create assignment" };
  }
}

/**
 * Link document assignments to a user when they sign up
 * This should be called when a user accepts an invitation
 */
export async function linkDocumentAssignmentsToUser(
  userId: string,
  email: string,
  venueId?: string
): Promise<{ success: boolean; linkedCount?: number; error?: string }> {
  try {
    const normalizedEmail = normalizeEmail(email);
    const userVenueIds = venueId ? [venueId] : await getUserVenueIds(userId);
    if (userVenueIds.length === 0) {
      return { success: true, linkedCount: 0 };
    }

    // Find all assignments with this email and no userId
    const assignments = await prisma.documentAssignment.findMany({
      where: {
        email: normalizedEmail,
        userId: null,
        venueId: { in: userVenueIds },
      },
    });

    if (assignments.length === 0) {
      return { success: true, linkedCount: 0 };
    }

    // Update all assignments to link to the user
    const result = await prisma.documentAssignment.updateMany({
      where: {
        email: normalizedEmail,
        userId: null,
        venueId: { in: userVenueIds },
      },
      data: {
        userId,
        email: null, // Clear email since we now have a userId
      },
    });

    // Create audit logs for each linked assignment
    for (const assignment of assignments) {
      await prisma.documentAuditLog.create({
        data: {
          resourceType: "ASSIGNMENT",
          resourceId: assignment.id,
          action: "UPDATED",
          description: `Assignment linked to user ${normalizedEmail} upon signup`,
          newValue: { linked: true, userId } as any,
        },
      });
    }

    return { success: true, linkedCount: result.count };
  } catch (error) {
    console.error("Error linking document assignments:", error);
    return { success: false, error: "Failed to link assignments" };
  }
}

// ============================================================================
// Prospective Users
// ============================================================================

export interface ProspectiveUser {
  email: string;
  assignments: Array<{
    id: string;
    templateId: string | null;
    templateName: string | null;
    bundleId: string | null;
    bundleName: string | null;
    venueId: string;
    venueName: string;
    status: AssignmentStatus;
    dueDate: Date | null;
    assignedAt: Date;
    invitationStatus: "pending" | "sent" | "expired" | "accepted" | "none";
    invitationId: string | null;
  }>;
  totalAssignments: number;
  pendingAssignments: number;
  oldestAssignment: Date;
}

/**
 * Get all prospective users (users with assignments but no account yet)
 * Optionally filtered by venue
 */
export async function getProspectiveUsers(
  venueId?: string
): Promise<{ success: boolean; data?: ProspectiveUser[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const userIsAdmin = await isAdmin(user.id);
    const userVenueIds = userIsAdmin ? [] : await getUserVenueIds(user.id);

    // Build where clause for assignments
    const whereClause: any = {
      userId: null,
      email: { not: null },
      status: { notIn: ["COMPLETED", "WAIVED", "EXPIRED"] },
    };

    if (venueId) {
      if (!userIsAdmin && !userVenueIds.includes(venueId)) {
        return { success: false, error: "You don't have permission to view prospective users" };
      }
      whereClause.venueId = venueId;
    } else {
      if (!userIsAdmin) {
        if (userVenueIds.length === 0) {
          return { success: true, data: [] };
        }
        whereClause.venueId = { in: userVenueIds };
      }
    }

    // Get all assignments for prospective users
    const assignments = await prisma.documentAssignment.findMany({
      where: whereClause,
      select: {
        id: true,
        email: true,
        templateId: true,
        bundleId: true,
        venueId: true,
        status: true,
        dueDate: true,
        assignedAt: true,
        invitationId: true,
        template: {
          select: { id: true, name: true },
        },
        bundle: {
          select: { id: true, name: true },
        },
        venue: {
          select: { id: true, name: true },
        },
        invitation: {
          select: {
            id: true,
            status: true,
            expiresAt: true,
          },
        },
      },
      orderBy: { assignedAt: "desc" },
    });

    // Group by email
    const prospectiveUsersMap = new Map<string, ProspectiveUser>();

    for (const assignment of assignments) {
      const email = assignment.email!;
      
      if (!prospectiveUsersMap.has(email)) {
        prospectiveUsersMap.set(email, {
          email,
          assignments: [],
          totalAssignments: 0,
          pendingAssignments: 0,
          oldestAssignment: assignment.assignedAt,
        });
      }

      const prospectiveUser = prospectiveUsersMap.get(email)!;
      
      // Determine invitation status
      let invitationStatus: "pending" | "sent" | "expired" | "accepted" | "none" = "none";
      if (assignment.invitation) {
        if (assignment.invitation.status === "ACCEPTED") {
          invitationStatus = "accepted";
        } else if (assignment.invitation.status === "PENDING") {
          invitationStatus = new Date() > assignment.invitation.expiresAt ? "expired" : "sent";
        } else {
          invitationStatus = assignment.invitation.status.toLowerCase() as any;
        }
      }

      prospectiveUser.assignments.push({
        id: assignment.id,
        templateId: assignment.templateId,
        templateName: assignment.template?.name || null,
        bundleId: assignment.bundleId,
        bundleName: assignment.bundle?.name || null,
        venueId: assignment.venueId,
        venueName: assignment.venue.name,
        status: assignment.status,
        dueDate: assignment.dueDate,
        assignedAt: assignment.assignedAt,
        invitationStatus,
        invitationId: assignment.invitationId,
      });
      
      prospectiveUser.totalAssignments++;
      if (assignment.status === "PENDING") {
        prospectiveUser.pendingAssignments++;
      }
      if (assignment.assignedAt < prospectiveUser.oldestAssignment) {
        prospectiveUser.oldestAssignment = assignment.assignedAt;
      }
    }

    return { success: true, data: Array.from(prospectiveUsersMap.values()) };
  } catch (error) {
    console.error("Error fetching prospective users:", error);
    return { success: false, error: "Failed to fetch prospective users" };
  }
}

/**
 * Resend invitation to a prospective user
 */
export async function resendProspectiveUserInvitation(
  email: string,
  venueId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "assignment_create", venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to resend invitations" };
    }

    // Get venue info
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { name: true },
    });

    if (!venue) {
      return { success: false, error: "Venue not found" };
    }

    // Check for existing pending invitation
    const normalizedEmail = normalizeEmail(email);

    const existingInvitation = await prisma.userInvitation.findFirst({
      where: {
        email: normalizedEmail,
        status: "PENDING",
        expiresAt: { gte: new Date() },
        venueId,
      },
    });

    if (existingInvitation) {
      // Invitation already exists and is valid
      return { success: true };
    }

    // Create a new invitation
    const { randomBytes } = await import("crypto");
    const { addDays } = await import("date-fns");
    const token = randomBytes(32).toString("hex");
    const expiresAt = addDays(new Date(), 7);

    // Get default role for new users (STAFF role)
    const defaultRole = await prisma.role.findFirst({
      where: { name: "STAFF" },
    });

    if (!defaultRole) {
      return { success: false, error: "Default STAFF role not found" };
    }

    const invitation = await prisma.userInvitation.create({
      data: {
        email: normalizedEmail,
        token,
        inviterId: user.id,
        scope: "VENUE",
        venueId,
        roleId: defaultRole.id,
        expiresAt,
      },
    });

    // Send invitation email
    try {
      const { sendBrevoEmail } = await import("@/lib/services/email/brevo");
      const { getInvitationEmailTemplate } = await import("@/lib/services/email/templates");
      
      const inviteLink = toAbsoluteAppUrl(`/signup?invite=${token}`);
      
      const emailTemplate = getInvitationEmailTemplate({
        inviterName: `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email,
        venueName: venue.name,
        roleName: defaultRole.name,
        inviteLink,
        expirationDays: 7,
      });
      
      const sendResult = await sendBrevoEmail({
        to: normalizedEmail,
        subject: emailTemplate.subject,
        htmlContent: emailTemplate.htmlContent,
      });

      if (!sendResult.success) {
        console.error("Failed to deliver invitation email:", {
          email: normalizedEmail,
          error: sendResult.error,
        });
      }
    } catch (emailError) {
      console.error("Failed to send invitation email:", emailError);
      // Continue even if email fails - the invitation is still created
    }

    // Update assignments with the new invitation ID
    await prisma.documentAssignment.updateMany({
      where: {
        email: normalizedEmail,
        venueId,
        invitationId: null,
      },
      data: {
        invitationId: invitation.id,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Error resending invitation:", error);
    return { success: false, error: "Failed to resend invitation" };
  }
}

/**
 * Cancel assignment for a prospective user
 */
export async function cancelProspectiveUserAssignment(
  assignmentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get the assignment
    const assignment = await prisma.documentAssignment.findUnique({
      where: { id: assignmentId },
    });

    if (!assignment) {
      return { success: false, error: "Assignment not found" };
    }

    // Check permission
    const hasDeletePermission = await checkDocumentPermission(user.id, "assignment_update", assignment.venueId);
    if (!hasDeletePermission) {
      return { success: false, error: "You don't have permission to cancel this assignment" };
    }

    // Delete the assignment
    await prisma.documentAssignment.delete({
      where: { id: assignmentId },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "ASSIGNMENT",
        resourceId: assignmentId,
        action: "DELETED",
        description: `Assignment for prospective user ${assignment.email} cancelled`,
        userId: user.id,
        oldValue: assignment as any,
      },
    });

    revalidatePaths("/system/documents", "/manage/documents");

    return { success: true };
  } catch (error) {
    console.error("Error cancelling assignment:", error);
    return { success: false, error: "Failed to cancel assignment" };
  }
}
