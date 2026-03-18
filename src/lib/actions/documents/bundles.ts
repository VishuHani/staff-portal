"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface DocumentBundleWithRelations {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  allowPartialComplete: boolean;
  dueWithinDays: number | null;
  reminderDays: number[];
  currentVersion: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  items: {
    id: string;
    templateId: string;
    template: {
      id: string;
      name: string;
      documentType: string;
      category: string;
    };
    order: number;
    isRequired: boolean;
  }[];
  _count?: {
    assignments: number;
    documentAssignments: number;
  };
}

export interface CreateBundleInput {
  name: string;
  description?: string;
  category?: string;
  isRequired?: boolean;
  allowPartialComplete?: boolean;
  dueWithinDays?: number | null;
  reminderDays?: number[];
  items: {
    templateId: string;
    order: number;
    isRequired: boolean;
  }[];
}

export interface UpdateBundleInput extends Partial<CreateBundleInput> {
  id: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const createBundleSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  description: z.string().max(1000).optional(),
  category: z.string().default("GENERAL"),
  isRequired: z.boolean().default(true),
  allowPartialComplete: z.boolean().default(false),
  dueWithinDays: z.number().int().positive().optional().nullable(),
  reminderDays: z.array(z.number().int()).default([3, 1]),
  items: z.array(z.object({
    templateId: z.string().cuid(),
    order: z.number().int(),
    isRequired: z.boolean(),
  })).min(1, "At least one document is required"),
});

const updateBundleSchema = createBundleSchema.partial().extend({
  id: z.string().cuid(),
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
    bundle_create: "create",
    bundle_read: "read",
    bundle_update: "update",
    bundle_delete: "delete",
  };

  const permissionAction = permissionMap[action] || "read";
  return hasPermission(userId, "documents", permissionAction as any, venueId);
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new document bundle
 */
export async function createDocumentBundle(
  venueId: string,
  input: CreateBundleInput
): Promise<{ success: boolean; data?: DocumentBundleWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "bundle_create", venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to create bundles" };
    }

    // Validate input
    const validated = createBundleSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;

    // Verify all templates exist and belong to venue
    const templateIds = data.items.map((item) => item.templateId);
    const templates = await prisma.documentTemplate.findMany({
      where: {
        id: { in: templateIds },
        venueId,
        isActive: true,
      },
    });

    if (templates.length !== templateIds.length) {
      return { success: false, error: "One or more templates not found or inactive" };
    }

    // Create bundle with items in transaction
    const bundle = await prisma.$transaction(async (tx) => {
      // Create bundle
      const newBundle = await tx.documentBundle.create({
        data: {
          venueId,
          name: data.name,
          description: data.description,
          category: data.category,
          isRequired: data.isRequired,
          allowPartialComplete: data.allowPartialComplete,
          dueWithinDays: data.dueWithinDays,
          reminderDays: data.reminderDays,
          createdBy: user.id,
        },
      });

      // Create bundle items
      await tx.documentBundleItem.createMany({
        data: data.items.map((item) => ({
          bundleId: newBundle.id,
          templateId: item.templateId,
          order: item.order,
          isRequired: item.isRequired,
        })),
      });

      // Create initial version snapshot
      await tx.documentBundleVersion.create({
        data: {
          bundleId: newBundle.id,
          version: 1,
          name: newBundle.name,
          description: newBundle.description,
          category: newBundle.category,
          isRequired: newBundle.isRequired,
          allowPartialComplete: newBundle.allowPartialComplete,
          dueWithinDays: newBundle.dueWithinDays,
          reminderDays: newBundle.reminderDays,
          itemsSnapshot: data.items as any,
          changes: { type: "initial", message: "Bundle created" } as any,
        },
      });

      // Create audit log
      await tx.documentAuditLog.create({
        data: {
          resourceType: "BUNDLE",
          resourceId: newBundle.id,
          action: "CREATED",
          description: `Bundle "${newBundle.name}" created with ${data.items.length} documents`,
          userId: user.id,
          newValue: newBundle as any,
        },
      });

      return newBundle;
    });

    // Fetch the complete bundle with items
    const completeBundle = await prisma.documentBundle.findUnique({
      where: { id: bundle.id },
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
          select: { assignments: true, documentAssignments: true },
        },
      },
    });

    revalidatePath(`/system/documents`);

    return { success: true, data: completeBundle as DocumentBundleWithRelations };
  } catch (error) {
    console.error("Error creating document bundle:", error);
    return { success: false, error: "Failed to create bundle" };
  }
}

/**
 * Get a single document bundle by ID
 */
export async function getDocumentBundle(
  bundleId: string
): Promise<{ success: boolean; data?: DocumentBundleWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const bundle = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
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
          select: { assignments: true, documentAssignments: true },
        },
      },
    });

    if (!bundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "bundle_read", bundle.venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view this bundle" };
    }

    return { success: true, data: bundle as DocumentBundleWithRelations };
  } catch (error) {
    console.error("Error fetching document bundle:", error);
    return { success: false, error: "Failed to fetch bundle" };
  }
}

/**
 * List document bundles for a venue
 */
export async function listDocumentBundles(
  venueId: string,
  filters?: { category?: string; isActive?: boolean; search?: string }
): Promise<{ success: boolean; data?: DocumentBundleWithRelations[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "bundle_read", venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view bundles" };
    }

    const where: any = { venueId };

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const bundles = await prisma.documentBundle.findMany({
      where,
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
          select: { assignments: true, documentAssignments: true },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { createdAt: "desc" },
      ],
    });

    return { success: true, data: bundles as DocumentBundleWithRelations[] };
  } catch (error) {
    console.error("Error listing document bundles:", error);
    return { success: false, error: "Failed to list bundles" };
  }
}

/**
 * Update a document bundle
 */
export async function updateDocumentBundle(
  input: UpdateBundleInput
): Promise<{ success: boolean; data?: DocumentBundleWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing bundle
    const existingBundle = await prisma.documentBundle.findUnique({
      where: { id: input.id },
      include: { items: true },
    });

    if (!existingBundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission
    const hasUpdatePermission = await checkDocumentPermission(user.id, "bundle_update", existingBundle.venueId);
    if (!hasUpdatePermission) {
      return { success: false, error: "You don't have permission to update this bundle" };
    }

    // Validate input
    const validated = updateBundleSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;

    // Update bundle in transaction
    const bundle = await prisma.$transaction(async (tx) => {
      // Update bundle
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.category !== undefined) updateData.category = data.category;
      if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
      if (data.allowPartialComplete !== undefined) updateData.allowPartialComplete = data.allowPartialComplete;
      if (data.dueWithinDays !== undefined) updateData.dueWithinDays = data.dueWithinDays;
      if (data.reminderDays !== undefined) updateData.reminderDays = data.reminderDays;

      // Increment version
      updateData.currentVersion = existingBundle.currentVersion + 1;

      const updatedBundle = await tx.documentBundle.update({
        where: { id: input.id },
        data: updateData,
      });

      // Update items if provided
      if (data.items) {
        // Delete existing items
        await tx.documentBundleItem.deleteMany({
          where: { bundleId: input.id },
        });

        // Create new items
        await tx.documentBundleItem.createMany({
          data: data.items.map((item) => ({
            bundleId: input.id,
            templateId: item.templateId,
            order: item.order,
            isRequired: item.isRequired,
          })),
        });
      }

      // Create version snapshot
      await tx.documentBundleVersion.create({
        data: {
          bundleId: updatedBundle.id,
          version: updatedBundle.currentVersion,
          name: updatedBundle.name,
          description: updatedBundle.description,
          category: updatedBundle.category,
          isRequired: updatedBundle.isRequired,
          allowPartialComplete: updatedBundle.allowPartialComplete,
          dueWithinDays: updatedBundle.dueWithinDays,
          reminderDays: updatedBundle.reminderDays,
          itemsSnapshot: (data.items || existingBundle.items) as any,
          changes: {
            previousVersion: existingBundle.currentVersion,
            updatedFields: Object.keys(updateData).filter((k) => k !== "currentVersion"),
          } as any,
        },
      });

      // Create audit log
      await tx.documentAuditLog.create({
        data: {
          resourceType: "BUNDLE",
          resourceId: updatedBundle.id,
          action: "UPDATED",
          description: `Bundle "${updatedBundle.name}" updated to version ${updatedBundle.currentVersion}`,
          userId: user.id,
          oldValue: existingBundle as any,
          newValue: updatedBundle as any,
        },
      });

      return updatedBundle;
    });

    // Fetch complete bundle
    const completeBundle = await prisma.documentBundle.findUnique({
      where: { id: bundle.id },
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
          select: { assignments: true, documentAssignments: true },
        },
      },
    });

    revalidatePath(`/system/documents`);
    revalidatePath(`/system/documents/${bundle.id}`);

    return { success: true, data: completeBundle as DocumentBundleWithRelations };
  } catch (error) {
    console.error("Error updating document bundle:", error);
    return { success: false, error: "Failed to update bundle" };
  }
}

/**
 * Duplicate a document bundle
 */
export async function duplicateDocumentBundle(
  bundleId: string
): Promise<{ success: boolean; data?: DocumentBundleWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing bundle
    const existingBundle = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
      include: { items: true },
    });

    if (!existingBundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "bundle_create", existingBundle.venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to duplicate bundles" };
    }

    // Create duplicate
    const newBundle = await prisma.$transaction(async (tx) => {
      // Create bundle
      const duplicate = await tx.documentBundle.create({
        data: {
          venueId: existingBundle.venueId,
          name: `${existingBundle.name} (Copy)`,
          description: existingBundle.description,
          category: existingBundle.category,
          isRequired: existingBundle.isRequired,
          allowPartialComplete: existingBundle.allowPartialComplete,
          dueWithinDays: existingBundle.dueWithinDays,
          reminderDays: existingBundle.reminderDays,
          createdBy: user.id,
        },
      });

      // Create bundle items
      await tx.documentBundleItem.createMany({
        data: existingBundle.items.map((item) => ({
          bundleId: duplicate.id,
          templateId: item.templateId,
          order: item.order,
          isRequired: item.isRequired,
        })),
      });

      // Create audit log
      await tx.documentAuditLog.create({
        data: {
          resourceType: "BUNDLE",
          resourceId: duplicate.id,
          action: "CREATED",
          description: `Bundle duplicated from "${existingBundle.name}"`,
          userId: user.id,
          oldValue: { sourceBundleId: bundleId } as any,
          newValue: duplicate as any,
        },
      });

      return duplicate;
    });

    // Fetch complete bundle
    const completeBundle = await prisma.documentBundle.findUnique({
      where: { id: newBundle.id },
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
          select: { assignments: true, documentAssignments: true },
        },
      },
    });

    revalidatePath(`/system/documents`);

    return { success: true, data: completeBundle as DocumentBundleWithRelations };
  } catch (error) {
    console.error("Error duplicating document bundle:", error);
    return { success: false, error: "Failed to duplicate bundle" };
  }
}

/**
 * Archive a document bundle
 */
export async function archiveDocumentBundle(
  bundleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing bundle
    const existingBundle = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
    });

    if (!existingBundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission
    const hasDeletePermission = await checkDocumentPermission(user.id, "bundle_delete", existingBundle.venueId);
    if (!hasDeletePermission) {
      return { success: false, error: "You don't have permission to archive this bundle" };
    }

    // Archive bundle
    await prisma.documentBundle.update({
      where: { id: bundleId },
      data: { isActive: false },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "BUNDLE",
        resourceId: bundleId,
        action: "DELETED",
        description: `Bundle "${existingBundle.name}" archived`,
        userId: user.id,
        oldValue: existingBundle as any,
      },
    });

    revalidatePath(`/system/documents`);

    return { success: true };
  } catch (error) {
    console.error("Error archiving document bundle:", error);
    return { success: false, error: "Failed to archive bundle" };
  }
}

/**
 * Restore an archived document bundle
 */
export async function restoreDocumentBundle(
  bundleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing bundle
    const existingBundle = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
    });

    if (!existingBundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission
    const hasUpdatePermission = await checkDocumentPermission(user.id, "bundle_update", existingBundle.venueId);
    if (!hasUpdatePermission) {
      return { success: false, error: "You don't have permission to restore this bundle" };
    }

    // Restore bundle
    await prisma.documentBundle.update({
      where: { id: bundleId },
      data: { isActive: true },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "BUNDLE",
        resourceId: bundleId,
        action: "UPDATED",
        description: `Bundle "${existingBundle.name}" restored`,
        userId: user.id,
        oldValue: existingBundle as any,
      },
    });

    revalidatePath(`/system/documents`);

    return { success: true };
  } catch (error) {
    console.error("Error restoring document bundle:", error);
    return { success: false, error: "Failed to restore bundle" };
  }
}

/**
 * Delete a document bundle permanently
 */
export async function deleteDocumentBundle(
  bundleId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing bundle
    const existingBundle = await prisma.documentBundle.findUnique({
      where: { id: bundleId },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!existingBundle) {
      return { success: false, error: "Bundle not found" };
    }

    // Check permission
    const hasDeletePermission = await checkDocumentPermission(user.id, "bundle_delete", existingBundle.venueId);
    if (!hasDeletePermission) {
      return { success: false, error: "You don't have permission to delete this bundle" };
    }

    // Check for active assignments
    if (existingBundle._count?.assignments && existingBundle._count.assignments > 0) {
      return { success: false, error: "Cannot delete bundle with active assignments. Archive instead." };
    }

    // Delete bundle (cascade will handle items and versions)
    await prisma.documentBundle.delete({
      where: { id: bundleId },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "BUNDLE",
        resourceId: bundleId,
        action: "DELETED",
        description: `Bundle "${existingBundle.name}" permanently deleted`,
        userId: user.id,
        oldValue: existingBundle as any,
      },
    });

    revalidatePath(`/system/documents`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting document bundle:", error);
    return { success: false, error: "Failed to delete bundle" };
  }
}

/**
 * Get bundle categories for a venue
 */
export async function getBundleCategories(
  venueId: string
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const categories = await prisma.documentBundle.findMany({
      where: { venueId },
      select: { category: true },
      distinct: ["category"],
    });

    return { success: true, data: categories.map((c) => c.category) };
  } catch (error) {
    console.error("Error fetching bundle categories:", error);
    return { success: false, error: "Failed to fetch categories" };
  }
}
