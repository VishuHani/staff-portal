"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";
import { DocumentType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface DocumentTemplateWithRelations {
  id: string;
  venueId: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  documentType: DocumentType;
  pdfUrl: string | null;
  pdfFileName: string | null;
  pdfFileSize: number | null;
  pdfVersion: number;
  formSchema: Record<string, unknown> | null;
  formConfig: Record<string, unknown> | null;
  isHybrid: boolean;
  overlayFields: Record<string, unknown> | null;
  isRequired: boolean;
  allowDownload: boolean;
  requireSignature: boolean;
  requirePhoto: boolean;
  allowAttachments: boolean;
  instructions: string | null;
  isPrintOnly: boolean;
  printInstructions: string | null;
  currentVersion: number;
  isActive: boolean;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  _count?: {
    assignments: number;
  };
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
  documentType: DocumentType;
  pdfUrl?: string;
  pdfFileName?: string;
  pdfFileSize?: number;
  formSchema?: Record<string, unknown>;
  formConfig?: Record<string, unknown>;
  isHybrid?: boolean;
  overlayFields?: Record<string, unknown>;
  isRequired?: boolean;
  allowDownload?: boolean;
  requireSignature?: boolean;
  requirePhoto?: boolean;
  allowAttachments?: boolean;
  instructions?: string;
  isPrintOnly?: boolean;
  printInstructions?: string;
}

export interface UpdateTemplateInput extends Partial<CreateTemplateInput> {
  id: string;
}

export interface TemplateListFilters {
  venueId?: string;
  category?: string;
  documentType?: DocumentType;
  isActive?: boolean;
  search?: string;
}

// ============================================================================
// Validation Schemas
// ============================================================================

const createTemplateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
  description: z.string().max(1000).optional(),
  category: z.string().default("GENERAL"),
  tags: z.array(z.string()).default([]),
  documentType: z.nativeEnum(DocumentType),
  pdfUrl: z.string().optional().nullable().refine(
    (val) => {
      if (!val) return true;
      // Allow full URLs (http://, https://) or relative paths (/uploads/...)
      return val.startsWith('http://') || val.startsWith('https://') || val.startsWith('/');
    },
    { message: "Invalid URL format" }
  ),
  pdfFileName: z.string().max(255).optional().nullable(),
  pdfFileSize: z.number().int().positive().optional().nullable(),
  formSchema: z.record(z.string(), z.unknown()).optional().nullable(),
  formConfig: z.record(z.string(), z.unknown()).optional().nullable(),
  isHybrid: z.boolean().default(false),
  overlayFields: z.record(z.string(), z.unknown()).optional().nullable(),
  isRequired: z.boolean().default(true),
  allowDownload: z.boolean().default(true),
  requireSignature: z.boolean().default(false),
  requirePhoto: z.boolean().default(false),
  allowAttachments: z.boolean().default(false),
  instructions: z.string().max(5000).optional().nullable(),
  isPrintOnly: z.boolean().default(false),
  printInstructions: z.string().max(2000).optional().nullable(),
});

const updateTemplateSchema = createTemplateSchema.partial().extend({
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
  // Map our document actions to permission actions
  // Since the permission system uses a different action format, we check by resource
  const permissionMap: Record<string, string> = {
    template_create: "create",
    template_read: "read",
    template_update: "update",
    template_delete: "delete",
    assignment_create: "create",
    assignment_read: "read",
    assignment_update: "update",
    submission_create: "create",
    submission_read: "read",
    submission_update: "update",
    submission_review: "update",
  };

  const permissionAction = permissionMap[action] || "read";
  
  return hasPermission(userId, "documents", permissionAction as any, venueId);
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Create a new document template
 */
export async function createDocumentTemplate(
  venueId: string,
  input: CreateTemplateInput
): Promise<{ success: boolean; data?: DocumentTemplateWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasCreatePermission = await checkDocumentPermission(user.id, "template_create", venueId);
    if (!hasCreatePermission) {
      return { success: false, error: "You don't have permission to create templates" };
    }

    // Validate input
    const validated = createTemplateSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;

    // Create template
    const template = await prisma.documentTemplate.create({
      data: {
        venueId,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags,
        documentType: data.documentType,
        pdfUrl: data.pdfUrl,
        pdfFileName: data.pdfFileName,
        pdfFileSize: data.pdfFileSize,
        formSchema: data.formSchema as any,
        formConfig: data.formConfig as any,
        isHybrid: data.isHybrid,
        overlayFields: data.overlayFields as any,
        isRequired: data.isRequired,
        allowDownload: data.allowDownload,
        requireSignature: data.requireSignature,
        requirePhoto: data.requirePhoto,
        allowAttachments: data.allowAttachments,
        instructions: data.instructions,
        isPrintOnly: data.isPrintOnly,
        printInstructions: data.printInstructions,
        createdBy: user.id,
      },
    });

    // Create initial version snapshot
    await prisma.documentTemplateVersion.create({
      data: {
        templateId: template.id,
        version: 1,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        documentType: template.documentType,
        pdfUrl: template.pdfUrl,
        pdfFileName: template.pdfFileName,
        pdfFileSize: template.pdfFileSize,
        formSchema: template.formSchema as any,
        formConfig: template.formConfig as any,
        overlayFields: template.overlayFields as any,
        isHybrid: template.isHybrid,
        isRequired: template.isRequired,
        allowDownload: template.allowDownload,
        requireSignature: template.requireSignature,
        requirePhoto: template.requirePhoto,
        allowAttachments: template.allowAttachments,
        instructions: template.instructions,
        isPrintOnly: template.isPrintOnly,
        printInstructions: template.printInstructions,
        createdBy: user.id,
        changes: { type: "initial", message: "Template created" } as any,
      },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "TEMPLATE",
        resourceId: template.id,
        action: "CREATED",
        description: `Template "${template.name}" created`,
        userId: user.id,
        newValue: template as any,
      },
    });

    revalidatePath(`/system/documents`);

    return { success: true, data: template as DocumentTemplateWithRelations };
  } catch (error) {
    console.error("Error creating document template:", error);
    return { success: false, error: "Failed to create template" };
  }
}

/**
 * Get a single document template by ID
 */
export async function getDocumentTemplate(
  templateId: string
): Promise<{ success: boolean; data?: DocumentTemplateWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    });

    if (!template) {
      return { success: false, error: "Template not found" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "template_read", template.venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view this template" };
    }

    return { success: true, data: template as DocumentTemplateWithRelations };
  } catch (error) {
    console.error("Error fetching document template:", error);
    return { success: false, error: "Failed to fetch template" };
  }
}

/**
 * List document templates with filters
 */
export async function listDocumentTemplates(
  filters: TemplateListFilters
): Promise<{ success: boolean; data?: DocumentTemplateWithRelations[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission (if venueId is provided, check specific venue, otherwise just check general permission)
    const hasReadPermission = await checkDocumentPermission(user.id, "template_read", filters.venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view templates" };
    }

    const where: any = {};
    
    // Only filter by venue if venueId is provided
    if (filters.venueId) {
      where.venueId = filters.venueId;
    }

    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.documentType) {
      where.documentType = filters.documentType;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const templates = await prisma.documentTemplate.findMany({
      where,
      include: {
        _count: {
          select: { assignments: true },
        },
      },
      orderBy: [
        { isActive: "desc" },
        { createdAt: "desc" },
      ],
    });

    return { success: true, data: templates as DocumentTemplateWithRelations[] };
  } catch (error) {
    console.error("Error listing document templates:", error);
    return { success: false, error: "Failed to list templates" };
  }
}

/**
 * Update a document template
 */
export async function updateDocumentTemplate(
  input: UpdateTemplateInput
): Promise<{ success: boolean; data?: DocumentTemplateWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing template
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { id: input.id },
    });

    if (!existingTemplate) {
      return { success: false, error: "Template not found" };
    }

    // Check permission
    const hasUpdatePermission = await checkDocumentPermission(user.id, "template_update", existingTemplate.venueId);
    if (!hasUpdatePermission) {
      return { success: false, error: "You don't have permission to update this template" };
    }

    // Validate input
    const validated = updateTemplateSchema.safeParse(input);
    if (!validated.success) {
      const firstError = validated.error.issues[0];
      return { success: false, error: firstError?.message || "Invalid input" };
    }

    const data = validated.data;
    const updateData: any = {};

    // Only update fields that are provided
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.tags !== undefined) updateData.tags = data.tags;
    if (data.documentType !== undefined) updateData.documentType = data.documentType;
    if (data.pdfUrl !== undefined) updateData.pdfUrl = data.pdfUrl;
    if (data.pdfFileName !== undefined) updateData.pdfFileName = data.pdfFileName;
    if (data.pdfFileSize !== undefined) updateData.pdfFileSize = data.pdfFileSize;
    if (data.formSchema !== undefined) updateData.formSchema = data.formSchema;
    if (data.formConfig !== undefined) updateData.formConfig = data.formConfig;
    if (data.isHybrid !== undefined) updateData.isHybrid = data.isHybrid;
    if (data.overlayFields !== undefined) updateData.overlayFields = data.overlayFields;
    if (data.isRequired !== undefined) updateData.isRequired = data.isRequired;
    if (data.allowDownload !== undefined) updateData.allowDownload = data.allowDownload;
    if (data.requireSignature !== undefined) updateData.requireSignature = data.requireSignature;
    if (data.requirePhoto !== undefined) updateData.requirePhoto = data.requirePhoto;
    if (data.allowAttachments !== undefined) updateData.allowAttachments = data.allowAttachments;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.isPrintOnly !== undefined) updateData.isPrintOnly = data.isPrintOnly;
    if (data.printInstructions !== undefined) updateData.printInstructions = data.printInstructions;

    // Increment version
    updateData.currentVersion = existingTemplate.currentVersion + 1;

    // Update template
    const template = await prisma.documentTemplate.update({
      where: { id: input.id },
      data: updateData,
    });

    // Create version snapshot
    await prisma.documentTemplateVersion.create({
      data: {
        templateId: template.id,
        version: template.currentVersion,
        name: template.name,
        description: template.description,
        category: template.category,
        tags: template.tags,
        documentType: template.documentType,
        pdfUrl: template.pdfUrl,
        pdfFileName: template.pdfFileName,
        pdfFileSize: template.pdfFileSize,
        formSchema: template.formSchema as any,
        formConfig: template.formConfig as any,
        overlayFields: template.overlayFields as any,
        isHybrid: template.isHybrid,
        isRequired: template.isRequired,
        allowDownload: template.allowDownload,
        requireSignature: template.requireSignature,
        requirePhoto: template.requirePhoto,
        allowAttachments: template.allowAttachments,
        instructions: template.instructions,
        isPrintOnly: template.isPrintOnly,
        printInstructions: template.printInstructions,
        createdBy: user.id,
        changes: {
          previousVersion: existingTemplate.currentVersion,
          updatedFields: Object.keys(updateData).filter(k => k !== 'currentVersion'),
        } as any,
      },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "TEMPLATE",
        resourceId: template.id,
        action: "UPDATED",
        description: `Template "${template.name}" updated to version ${template.currentVersion}`,
        userId: user.id,
        oldValue: existingTemplate as any,
        newValue: template as any,
      },
    });

    revalidatePath(`/system/documents`);
    revalidatePath(`/system/documents/${template.id}`);

    return { success: true, data: template as DocumentTemplateWithRelations };
  } catch (error) {
    console.error("Error updating document template:", error);
    return { success: false, error: "Failed to update template" };
  }
}

/**
 * Delete (archive) a document template
 */
export async function deleteDocumentTemplate(
  templateId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Get existing template
    const existingTemplate = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!existingTemplate) {
      return { success: false, error: "Template not found" };
    }

    // Check permission
    const hasDeletePermission = await checkDocumentPermission(user.id, "template_delete", existingTemplate.venueId);
    if (!hasDeletePermission) {
      return { success: false, error: "You don't have permission to delete this template" };
    }

    // Check for active assignments
    const activeAssignments = await prisma.documentAssignment.count({
      where: {
        templateId,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    // Archive instead of delete
    await prisma.documentTemplate.update({
      where: { id: templateId },
      data: {
        isActive: false,
        archivedAt: new Date(),
      },
    });

    // Create audit log
    await prisma.documentAuditLog.create({
      data: {
        resourceType: "TEMPLATE",
        resourceId: templateId,
        action: "DELETED",
        description: `Template "${existingTemplate.name}" archived (${activeAssignments} active assignments)`,
        userId: user.id,
        oldValue: existingTemplate as any,
      },
    });

    revalidatePath(`/system/documents`);

    return { success: true };
  } catch (error) {
    console.error("Error deleting document template:", error);
    return { success: false, error: "Failed to delete template" };
  }
}

/**
 * Get template version history
 */
export async function getTemplateVersions(
  templateId: string
): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      return { success: false, error: "Template not found" };
    }

    // Check permission
    const hasReadPermission = await checkDocumentPermission(user.id, "template_read", template.venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view this template" };
    }

    const versions = await prisma.documentTemplateVersion.findMany({
      where: { templateId },
      orderBy: { version: "desc" },
    });

    return { success: true, data: versions };
  } catch (error) {
    console.error("Error fetching template versions:", error);
    return { success: false, error: "Failed to fetch template versions" };
  }
}

/**
 * Get template categories for a venue
 */
export async function getTemplateCategories(
  venueId: string
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const categories = await prisma.documentTemplate.findMany({
      where: { venueId },
      select: { category: true },
      distinct: ["category"],
    });

    return { success: true, data: categories.map((c) => c.category) };
  } catch (error) {
    console.error("Error fetching template categories:", error);
    return { success: false, error: "Failed to fetch categories" };
  }
}
