"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";
import { AssignmentStatus, AssignmentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { scheduleRemindersForAssignment } from "@/lib/documents/reminder-service";

// ============================================================================
// Types
// ============================================================================

export interface BundleAssignmentWithRelations {
  id: string;
  bundleId: string;
  bundle: {
    id: string;
    name: string;
    category: string;
    dueWithinDays: number | null;
    reminderDays: number[];
  };
  userId: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
  assignment: {
    id: string;
    status: AssignmentStatus;
    dueDate: Date | null;
    completedAt: Date | null;
    assignedAt: Date;
  };
  createdAt: Date;
}

export interface BundleProgress {
  bundleId: string;
  bundleName: string;
  userId: string;
  userName: string;
  userEmail: string;
  totalDocuments: number;
  completedDocuments: number;
  inProgressDocuments: number;
  pendingDocuments: number;
  progress: number; // Percentage
  status: AssignmentStatus;
  dueDate: Date | null;
  completedAt: Date | null;
  documents: {
    templateId: string;
    templateName: string;
    isRequired: boolean;
    status: AssignmentStatus;
    completedAt: Date | null;
  }[];
}

export interface AssignBundleInput {
  bundleId: string;
  userId: string;
  venueId: string;
  dueDate?: Date;
  notes?: string;
  invitationId?: string;
}

export interface BulkAssignBundleInput {
  bundleId: string;
  userIds: string[];
  venueId: string;
  dueDate?: Date;
  notes?: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const assignBundleSchema = z.object({
  bundleId: z.string().cuid(),
  userId: z.string().cuid(),
  venueId: z.string().cuid(),
  dueDate: z.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  invitationId: z.string().cuid().optional().nullable(),
});

const bulkAssignBundleSchema = z.object({
  bundleId: z.string().cuid(),
  userIds: z.array(z.string().cuid()).min(1, "At least one user is required"),
  venueId: z.string().cuid(),
  dueDate: z.date().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

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
  return hasPermission(userId, "documents", permissionAction as any, venueId);
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Assign a bundle to a single user
 */
export async function assignBundleToUser(
  input: AssignBundleInput
): Promise<{ success: boolean; data?: BundleAssignmentWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "assignment_create", input.venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to assign bundles" };
    }

    // Validate input
    const validated = assignBundleSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;

    // Get bundle with items
    const bundle = await prisma.documentBundle.findUnique({
      where: { id: data.bundleId },
      include: {
        items: {
          include: {
            template: {
              select: { id: true, name: true, documentType: true, isActive: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
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

    // Check for existing bundle assignment
    const existingAssignment = await prisma.documentAssignment.findFirst({
      where: {
        userId: data.userId,
        venueId: data.venueId,
        bundleId: data.bundleId,
        status: { notIn: ["COMPLETED", "WAIVED", "EXPIRED"] },
      },
    });

    if (existingAssignment) {
      return { success: false, error: "User already has an active assignment for this bundle" };
    }

    // Calculate due date if not provided
    const dueDate = data.dueDate || (bundle.dueWithinDays
      ? new Date(Date.now() + bundle.dueWithinDays * 24 * 60 * 60 * 1000)
      : null);

    // Create assignment in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create main assignment
      const assignment = await tx.documentAssignment.create({
        data: {
          assignmentType: "BUNDLE",
          bundleId: data.bundleId,
          userId: data.userId,
          venueId: data.venueId,
          assignedBy: user.id,
          invitationId: data.invitationId || null,
          dueDate,
          notes: data.notes || null,
          bundleVersion: bundle.currentVersion,
          status: "PENDING",
        },
      });

      // Create bundle assignment junction record
      const bundleAssignment = await tx.bundleAssignment.create({
        data: {
          bundleId: data.bundleId,
          userId: data.userId,
          assignmentId: assignment.id,
        },
        include: {
          bundle: {
            select: {
              id: true,
              name: true,
              category: true,
              dueWithinDays: true,
              reminderDays: true,
            },
          },
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Create individual document assignments for each item in bundle
      for (const item of bundle.items) {
        if (!item.template.isActive) continue; // Skip inactive templates

        await tx.documentAssignment.create({
          data: {
            assignmentType: "SINGLE",
            templateId: item.templateId,
            userId: data.userId,
            venueId: data.venueId,
            assignedBy: user.id,
            dueDate,
            templateVersion: item.template.id ? 1 : undefined, // Would need to fetch actual version
            status: "PENDING",
          },
        });
      }

      // Create audit log
      await tx.documentAuditLog.create({
        data: {
          resourceType: "ASSIGNMENT",
          resourceId: assignment.id,
          action: "ASSIGNED",
          description: `Bundle "${bundle.name}" assigned to ${targetUser.email}`,
          userId: user.id,
          newValue: {
            bundleId: data.bundleId,
            bundleName: bundle.name,
            userId: data.userId,
            dueDate,
          } as any,
        },
      });

      return { assignment, bundleAssignment };
    });

    // Schedule reminders if due date is set
    if (dueDate && bundle.reminderDays.length > 0) {
      await scheduleRemindersForAssignment({
        assignmentId: result.assignment.id,
        dueDate,
        reminderDays: bundle.reminderDays,
      });
    }

    revalidatePath(`/system/documents`);
    revalidatePath(`/my/documents`);

    return {
      success: true,
      data: {
        id: result.bundleAssignment.id,
        bundleId: result.bundleAssignment.bundleId,
        bundle: result.bundleAssignment.bundle,
        userId: result.bundleAssignment.userId,
        user: result.bundleAssignment.user,
        assignment: {
          id: result.assignment.id,
          status: result.assignment.status,
          dueDate: result.assignment.dueDate,
          completedAt: result.assignment.completedAt,
          assignedAt: result.assignment.assignedAt,
        },
        createdAt: result.bundleAssignment.createdAt,
      },
    };
  } catch (error) {
    console.error("Error assigning bundle:", error);
    return { success: false, error: "Failed to assign bundle" };
  }
}

/**
 * Assign a bundle to multiple users
 */
export async function assignBundleToUsers(
  input: BulkAssignBundleInput
): Promise<{
  success: boolean;
  data?: {
    successful: string[];
    failed: { userId: string; error: string }[];
  };
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "assignment_create", input.venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to assign bundles" };
    }

    // Validate input
    const validated = bulkAssignBundleSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;

    // Get bundle
    const bundle = await prisma.documentBundle.findUnique({
      where: { id: data.bundleId },
      include: {
        items: {
          include: {
            template: {
              select: { id: true, name: true, isActive: true },
            },
          },
        },
      },
    });

    if (!bundle) {
      return { success: false, error: "Bundle not found" };
    }

    if (!bundle.isActive) {
      return { success: false, error: "Cannot assign an inactive bundle" };
    }

    // Calculate due date
    const dueDate = data.dueDate || (bundle.dueWithinDays
      ? new Date(Date.now() + bundle.dueWithinDays * 24 * 60 * 60 * 1000)
      : null);

    const successful: string[] = [];
    const failed: { userId: string; error: string }[] = [];

    // Process each user
    for (const userId of data.userIds) {
      try {
        // Check if user exists and belongs to venue
        const targetUser = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            venues: { where: { venueId: data.venueId } },
          },
        });

        if (!targetUser) {
          failed.push({ userId, error: "User not found" });
          continue;
        }

        if (targetUser.venues.length === 0) {
          failed.push({ userId, error: "User does not belong to this venue" });
          continue;
        }

        // Check for existing assignment
        const existingAssignment = await prisma.documentAssignment.findFirst({
          where: {
            userId,
            venueId: data.venueId,
            bundleId: data.bundleId,
            status: { notIn: ["COMPLETED", "WAIVED", "EXPIRED"] },
          },
        });

        if (existingAssignment) {
          failed.push({ userId, error: "User already has an active assignment" });
          continue;
        }

        // Create assignment in transaction
        await prisma.$transaction(async (tx) => {
          // Create main assignment
          const assignment = await tx.documentAssignment.create({
            data: {
              assignmentType: "BUNDLE",
              bundleId: data.bundleId,
              userId,
              venueId: data.venueId,
              assignedBy: user.id,
              dueDate,
              notes: data.notes || null,
              bundleVersion: bundle.currentVersion,
              status: "PENDING",
            },
          });

          // Create bundle assignment junction record
          await tx.bundleAssignment.create({
            data: {
              bundleId: data.bundleId,
              userId,
              assignmentId: assignment.id,
            },
          });

          // Create individual document assignments
          for (const item of bundle.items) {
            if (!item.template.isActive) continue;

            await tx.documentAssignment.create({
              data: {
                assignmentType: "SINGLE",
                templateId: item.templateId,
                userId,
                venueId: data.venueId,
                assignedBy: user.id,
                dueDate,
                status: "PENDING",
              },
            });
          }

          // Create audit log
          await tx.documentAuditLog.create({
            data: {
              resourceType: "ASSIGNMENT",
              resourceId: assignment.id,
              action: "ASSIGNED",
              description: `Bundle "${bundle.name}" assigned to ${targetUser.email} (bulk)`,
              userId: user.id,
              newValue: {
                bundleId: data.bundleId,
                bundleName: bundle.name,
                userId,
                dueDate,
                bulkAssignment: true,
              } as any,
            },
          });
        });

        successful.push(userId);
      } catch (error) {
        console.error(`Error assigning bundle to user ${userId}:`, error);
        failed.push({ userId, error: "Failed to create assignment" });
      }
    }

    revalidatePath(`/system/documents`);
    revalidatePath(`/my/documents`);

    return {
      success: true,
      data: { successful, failed },
    };
  } catch (error) {
    console.error("Error in bulk bundle assignment:", error);
    return { success: false, error: "Failed to assign bundle to users" };
  }
}

/**
 * Get bundle assignments for a specific bundle
 */
export async function getBundleAssignments(
  bundleId: string
): Promise<{ success: boolean; data?: BundleAssignmentWithRelations[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get bundle to check venue
    const bundle = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
      select: { venueId: true },
    });

    if (!bundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "assignment_read", bundle.venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view assignments" };
    }

    const assignments = await prisma.bundleAssignment.findMany({
      where: { bundleId },
      include: {
        bundle: {
          select: {
            id: true,
            name: true,
            category: true,
            dueWithinDays: true,
            reminderDays: true,
          },
        },
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        assignment: {
          select: {
            id: true,
            status: true,
            dueDate: true,
            completedAt: true,
            assignedAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return {
      success: true,
      data: assignments.map((a) => ({
        id: a.id,
        bundleId: a.bundleId,
        bundle: a.bundle,
        userId: a.userId,
        user: a.user,
        assignment: a.assignment,
        createdAt: a.createdAt,
      })),
    };
  } catch (error) {
    console.error("Error fetching bundle assignments:", error);
    return { success: false, error: "Failed to fetch assignments" };
  }
}

/**
 * Get bundle progress for a user
 */
export async function getBundleProgress(
  bundleId: string,
  userId: string
): Promise<{ success: boolean; data?: BundleProgress; error?: string }> {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return { success: false, error: "Unauthorized" };
    }

    // Get bundle with items
    const bundle = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
      include: {
        items: {
          include: {
            template: {
              select: { id: true, name: true },
            },
          },
          orderBy: { order: "asc" },
        },
      },
    });

    if (!bundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission - user can view their own progress or needs read permission
    if (currentUser.id !== userId) {
      const hasReadPermission = await checkDocumentPermission(currentUser.id, "assignment_read", bundle.venueId);
      if (!hasReadPermission) {
        return { success: false, error: "You don't have permission to view this progress" };
      }
    }

    // Get user info
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!targetUser) {
      return { success: false, error: "User not found" };
    }

    // Get bundle assignment
    const bundleAssignment = await prisma.documentAssignment.findFirst({
      where: {
        bundleId,
        userId,
        assignmentType: "BUNDLE",
      },
    });

    if (!bundleAssignment) {
      return { success: false, error: "No assignment found for this user and bundle" };
    }

    // Get individual document assignments for this bundle
    const documentAssignments = await prisma.documentAssignment.findMany({
      where: {
        userId,
        venueId: bundle.venueId,
        templateId: { in: bundle.items.map((item) => item.templateId) },
      },
      include: {
        template: {
          select: { id: true, name: true },
        },
      },
    });

    // Build progress data
    const documents = bundle.items.map((item) => {
      const assignment = documentAssignments.find((a) => a.templateId === item.templateId);
      return {
        templateId: item.templateId,
        templateName: item.template.name,
        isRequired: item.isRequired,
        status: assignment?.status || "PENDING",
        completedAt: assignment?.completedAt || null,
      };
    });

    const totalDocuments = documents.length;
    const completedDocuments = documents.filter((d) => d.status === "COMPLETED").length;
    const inProgressDocuments = documents.filter((d) => d.status === "IN_PROGRESS").length;
    const pendingDocuments = documents.filter((d) => d.status === "PENDING").length;
    const progress = totalDocuments > 0 ? Math.round((completedDocuments / totalDocuments) * 100) : 0;

    return {
      success: true,
      data: {
        bundleId: bundle.id,
        bundleName: bundle.name,
        userId: targetUser.id,
        userName: `${targetUser.firstName || ""} ${targetUser.lastName || ""}`.trim() || targetUser.email,
        userEmail: targetUser.email,
        totalDocuments,
        completedDocuments,
        inProgressDocuments,
        pendingDocuments,
        progress,
        status: bundleAssignment.status,
        dueDate: bundleAssignment.dueDate,
        completedAt: bundleAssignment.completedAt,
        documents,
      },
    };
  } catch (error) {
    console.error("Error fetching bundle progress:", error);
    return { success: false, error: "Failed to fetch bundle progress" };
  }
}

/**
 * Update bundle assignment status
 */
export async function updateBundleAssignment(
  assignmentId: string,
  updates: { status?: AssignmentStatus; notes?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing assignment
    const existingAssignment = await prisma.documentAssignment.findUnique({
      where: { id: assignmentId },
      include: {
        bundle: { select: { name: true, venueId: true } },
      },
    });

    if (!existingAssignment) {
      return { success: false, error: "Assignment not found" };
    }

    if (existingAssignment.assignmentType !== "BUNDLE") {
      return { success: false, error: "Not a bundle assignment" };
    }

    // Check permission
    const hasUpdatePermission = await checkDocumentPermission(user.id, "assignment_update", existingAssignment.bundle?.venueId);
    if (!hasUpdatePermission) {
      return { success: false, error: "You don't have permission to update this assignment" };
    }

    // Update assignment
    const updateData: any = {};
    if (updates.status) {
      updateData.status = updates.status;
      if (updates.status === "COMPLETED") {
        updateData.completedAt = new Date();
      }
    }
    if (updates.notes) {
      updateData.notes = updates.notes;
    }

    await prisma.documentAssignment.update({
      where: { id: assignmentId },
      data: updateData,
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "ASSIGNMENT",
        resourceId: assignmentId,
        action: "UPDATED",
        description: `Bundle assignment status changed to ${updates.status || "unchanged"}`,
        userId: user.id,
        oldValue: { status: existingAssignment.status } as any,
        newValue: updateData as any,
      },
    });

    revalidatePath(`/system/documents`);
    revalidatePath(`/my/documents`);

    return { success: true };
  } catch (error) {
    console.error("Error updating bundle assignment:", error);
    return { success: false, error: "Failed to update assignment" };
  }
}

/**
 * Get all bundles for a venue with assignment counts
 */
export async function getBundlesForVenue(
  venueId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "assignment_read", venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view bundles" };
    }

    const bundles = await prisma.documentBundle.findMany({
      where: { venueId },
      include: {
        items: {
          include: {
            template: {
              select: { id: true, name: true, documentType: true, category: true },
            },
          },
          orderBy: { order: "asc" },
        },
        _count: {
          select: {
            assignments: true,
            documentAssignments: true,
          },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { createdAt: "desc" },
      ],
    });

    return { success: true, data: bundles };
  } catch (error) {
    console.error("Error fetching bundles:", error);
    return { success: false, error: "Failed to fetch bundles" };
  }
}
