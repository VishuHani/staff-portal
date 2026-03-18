"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasPermission } from "@/lib/rbac/permissions";
import { DocumentType } from "@prisma/client";
import { revalidatePath } from "next/cache";

// ============================================================================
// Types
// ============================================================================

export interface TemplateLibraryItemWithRelations {
  id: string;
  name: string;
  description: string | null;
  category: string;
  tags: string[];
  jurisdiction: string;
  stateSpecific: string | null;
  documentType: DocumentType;
  pdfUrl: string | null;
  formSchema: Record<string, unknown> | null;
  formConfig: Record<string, unknown> | null;
  version: number;
  isActive: boolean;
  isOfficial: boolean;
  importCount: number;
  popularity: number;
  createdAt: Date;
  updatedAt: Date;
  _count?: {
    imports: number;
  };
}

export interface LibraryTemplateFilters {
  category?: string;
  jurisdiction?: string;
  documentType?: DocumentType;
  search?: string;
  isOfficial?: boolean;
  sortBy?: 'popularity' | 'name' | 'importCount' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ImportHistoryItem {
  id: string;
  libraryItemId: string;
  libraryItemName: string;
  templateId: string;
  customized: boolean;
  importedAt: Date;
  importedBy: string;
  importedByName: string;
}

export interface ImportLibraryTemplateInput {
  libraryItemId: string;
  venueId: string;
  customize?: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
  };
}

// ============================================================================
// Permission Check Helper
// ============================================================================

async function checkLibraryPermission(
  userId: string,
  action: string,
  venueId?: string
): Promise<boolean> {
  const permissionMap: Record<string, string> = {
    library_read: "read",
    library_import: "create",
    import_history_read: "read",
  };

  const permissionAction = permissionMap[action] || "read";
  
  return hasPermission(userId, "documents", permissionAction as any, venueId);
}

// ============================================================================
// Server Actions
// ============================================================================

/**
 * Get all available library templates with optional filters
 */
export async function getLibraryTemplates(
  filters: LibraryTemplateFilters = {}
): Promise<{ success: boolean; data?: TemplateLibraryItemWithRelations[]; error?: string; total?: number }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const where: any = {
      isActive: true,
    };

    // Apply filters
    if (filters.category) {
      where.category = filters.category;
    }

    if (filters.jurisdiction) {
      where.jurisdiction = filters.jurisdiction;
    }

    if (filters.documentType) {
      where.documentType = filters.documentType;
    }

    if (filters.isOfficial !== undefined) {
      where.isOfficial = filters.isOfficial;
    }

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
        { tags: { hasSome: [filters.search.toLowerCase()] } },
      ];
    }

    // Determine sort order
    const sortBy = filters.sortBy || 'popularity';
    const sortOrder = filters.sortOrder || 'desc';
    
    const orderBy: any = {};
    if (sortBy === 'popularity') {
      orderBy.popularity = sortOrder;
    } else if (sortBy === 'name') {
      orderBy.name = sortOrder;
    } else if (sortBy === 'importCount') {
      orderBy.importCount = sortOrder;
    } else if (sortBy === 'createdAt') {
      orderBy.createdAt = sortOrder;
    }

    // Get total count
    const total = await prisma.templateLibraryItem.count({ where });

    // Get paginated results
    const templates = await prisma.templateLibraryItem.findMany({
      where,
      include: {
        _count: {
          select: { imports: true },
        },
      },
      orderBy,
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });

    return { 
      success: true, 
      data: templates as TemplateLibraryItemWithRelations[],
      total 
    };
  } catch (error) {
    console.error("Error fetching library templates:", error);
    return { success: false, error: "Failed to fetch library templates" };
  }
}

/**
 * Get a single library template by ID
 */
export async function getLibraryTemplate(
  libraryItemId: string
): Promise<{ success: boolean; data?: TemplateLibraryItemWithRelations; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const template = await prisma.templateLibraryItem.findUnique({
      where: { id: libraryItemId },
      include: {
        _count: {
          select: { imports: true },
        },
      },
    });

    if (!template) {
      return { success: false, error: "Template not found" };
    }

    return { success: true, data: template as TemplateLibraryItemWithRelations };
  } catch (error) {
    console.error("Error fetching library template:", error);
    return { success: false, error: "Failed to fetch template" };
  }
}

/**
 * Import a library template to a venue
 */
export async function importLibraryTemplate(
  input: ImportLibraryTemplateInput
): Promise<{ success: boolean; data?: { templateId: string; importId: string }; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasImportPermission = await checkLibraryPermission(user.id, "library_import", input.venueId);
    if (!hasImportPermission) {
      return { success: false, error: "You don't have permission to import templates" };
    }

    // Get the library template
    const libraryItem = await prisma.templateLibraryItem.findUnique({
      where: { id: input.libraryItemId },
    });

    if (!libraryItem) {
      return { success: false, error: "Library template not found" };
    }

    // Check if already imported to this venue
    const existingImport = await prisma.templateLibraryImport.findFirst({
      where: {
        libraryItemId: input.libraryItemId,
        venueId: input.venueId,
      },
    });

    if (existingImport) {
      return { 
        success: false, 
        error: "This template has already been imported to your venue. You can find it in your templates." 
      };
    }

    // Create the venue template
    const templateData: any = {
      venueId: input.venueId,
      name: input.customize?.name || libraryItem.name,
      description: input.customize?.description || libraryItem.description,
      category: input.customize?.category || libraryItem.category,
      tags: input.customize?.tags || libraryItem.tags,
      documentType: libraryItem.documentType,
      pdfUrl: libraryItem.pdfUrl,
      formSchema: libraryItem.formSchema,
      formConfig: libraryItem.formConfig,
      isRequired: true,
      allowDownload: true,
      requireSignature: (libraryItem.formConfig as any)?.requireSignature || false,
      allowAttachments: (libraryItem.formConfig as any)?.allowAttachments || false,
      createdBy: user.id,
    };

    // Create template and import record in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the template
      const template = await tx.documentTemplate.create({
        data: templateData,
      });

      // Create initial version snapshot
      await tx.documentTemplateVersion.create({
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
          changes: { 
            type: "library_import", 
            message: "Template imported from library",
            libraryItemId: libraryItem.id,
          } as any,
        },
      });

      // Create import record
      const importRecord = await tx.templateLibraryImport.create({
        data: {
          libraryItemId: libraryItem.id,
          venueId: input.venueId,
          templateId: template.id,
          customized: !!(input.customize?.name || input.customize?.description || input.customize?.category || input.customize?.tags),
          importedBy: user.id,
        },
      });

      // Update library item import count and popularity
      const newImportCount = libraryItem.importCount + 1;
      const popularity = calculatePopularity(newImportCount, libraryItem.createdAt);
      
      await tx.templateLibraryItem.update({
        where: { id: libraryItem.id },
        data: {
          importCount: newImportCount,
          popularity,
        },
      });

      // Create audit log
      await tx.documentAuditLog.create({
        data: {
          resourceType: "TEMPLATE",
          resourceId: template.id,
          action: "CREATED",
          description: `Template "${template.name}" imported from library`,
          userId: user.id,
          newValue: {
            libraryItemId: libraryItem.id,
            libraryItemName: libraryItem.name,
          } as any,
        },
      });

      return { templateId: template.id, importId: importRecord.id };
    });

    revalidatePath(`/system/documents`);
    revalidatePath(`/system/documents/library`);

    return { success: true, data: result };
  } catch (error) {
    console.error("Error importing library template:", error);
    return { success: false, error: "Failed to import template" };
  }
}

/**
 * Get import history for a venue
 */
export async function getImportHistory(
  venueId: string,
  options: { limit?: number; offset?: number } = {}
): Promise<{ success: boolean; data?: ImportHistoryItem[]; error?: string; total?: number }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    // Check permission
    const hasReadPermission = await checkLibraryPermission(user.id, "import_history_read", venueId);
    if (!hasReadPermission) {
      return { success: false, error: "You don't have permission to view import history" };
    }

    // Get total count
    const total = await prisma.templateLibraryImport.count({
      where: { venueId },
    });

    // Get imports with related data
    const imports = await prisma.templateLibraryImport.findMany({
      where: { venueId },
      include: {
        libraryItem: {
          select: { name: true },
        },
      },
      orderBy: { importedAt: "desc" },
      take: options.limit || 50,
      skip: options.offset || 0,
    });

    // Get user names for importedBy
    const userIds = [...new Set(imports.map(i => i.importedBy))];
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, firstName: true, lastName: true },
    });

    const userMap = new Map(users.map(u => [u.id, `${u.firstName || ''} ${u.lastName || ''}`.trim()]));

    // Check if templates have been customized since import
    const templateIds = imports.map(i => i.templateId);
    const templates = await prisma.documentTemplate.findMany({
      where: { id: { in: templateIds } },
      select: { id: true, updatedAt: true },
    });

    const templateUpdateMap = new Map(templates.map(t => [t.id, t.updatedAt]));

    const historyItems: ImportHistoryItem[] = imports.map(imp => {
      const templateUpdatedAt = templateUpdateMap.get(imp.templateId);
      const wasCustomized = imp.customized || (templateUpdatedAt && templateUpdatedAt > imp.importedAt);

      return {
        id: imp.id,
        libraryItemId: imp.libraryItemId,
        libraryItemName: imp.libraryItem.name,
        templateId: imp.templateId,
        customized: !!wasCustomized,
        importedAt: imp.importedAt,
        importedBy: imp.importedBy,
        importedByName: userMap.get(imp.importedBy) || 'Unknown User',
      };
    });

    return { success: true, data: historyItems, total };
  } catch (error) {
    console.error("Error fetching import history:", error);
    return { success: false, error: "Failed to fetch import history" };
  }
}

/**
 * Get library template categories
 */
export async function getLibraryCategories(): Promise<{ 
  success: boolean; 
  data?: { category: string; count: number }[]; 
  error?: string 
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const categories = await prisma.templateLibraryItem.groupBy({
      by: ['category'],
      where: { isActive: true },
      _count: {
        category: true,
      },
      orderBy: {
        category: 'asc',
      },
    });

    return { 
      success: true, 
      data: categories.map(c => ({
        category: c.category,
        count: c._count.category,
      }))
    };
  } catch (error) {
    console.error("Error fetching library categories:", error);
    return { success: false, error: "Failed to fetch categories" };
  }
}

/**
 * Get library template jurisdictions
 */
export async function getLibraryJurisdictions(): Promise<{ 
  success: boolean; 
  data?: { jurisdiction: string; count: number }[]; 
  error?: string 
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const jurisdictions = await prisma.templateLibraryItem.groupBy({
      by: ['jurisdiction'],
      where: { isActive: true },
      _count: {
        jurisdiction: true,
      },
      orderBy: {
        jurisdiction: 'asc',
      },
    });

    return { 
      success: true, 
      data: jurisdictions.map(j => ({
        jurisdiction: j.jurisdiction,
        count: j._count.jurisdiction,
      }))
    };
  } catch (error) {
    console.error("Error fetching library jurisdictions:", error);
    return { success: false, error: "Failed to fetch jurisdictions" };
  }
}

/**
 * Get most popular templates
 */
export async function getPopularTemplates(
  limit: number = 10
): Promise<{ success: boolean; data?: TemplateLibraryItemWithRelations[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const templates = await prisma.templateLibraryItem.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { imports: true },
        },
      },
      orderBy: { popularity: 'desc' },
      take: limit,
    });

    return { success: true, data: templates as TemplateLibraryItemWithRelations[] };
  } catch (error) {
    console.error("Error fetching popular templates:", error);
    return { success: false, error: "Failed to fetch popular templates" };
  }
}

/**
 * Get recently added templates
 */
export async function getRecentTemplates(
  limit: number = 10
): Promise<{ success: boolean; data?: TemplateLibraryItemWithRelations[]; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const templates = await prisma.templateLibraryItem.findMany({
      where: { isActive: true },
      include: {
        _count: {
          select: { imports: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return { success: true, data: templates as TemplateLibraryItemWithRelations[] };
  } catch (error) {
    console.error("Error fetching recent templates:", error);
    return { success: false, error: "Failed to fetch recent templates" };
  }
}

/**
 * Check if a template has been imported to a venue
 */
export async function checkTemplateImported(
  libraryItemId: string,
  venueId: string
): Promise<{ success: boolean; data?: { imported: boolean; templateId?: string }; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Unauthorized" };
    }

    const existingImport = await prisma.templateLibraryImport.findFirst({
      where: {
        libraryItemId,
        venueId,
      },
      select: { templateId: true },
    });

    return { 
      success: true, 
      data: { 
        imported: !!existingImport,
        templateId: existingImport?.templateId,
      } 
    };
  } catch (error) {
    console.error("Error checking template import:", error);
    return { success: false, error: "Failed to check import status" };
  }
}

/**
 * Update popularity scores for all templates (can be run as a scheduled job)
 */
export async function updatePopularityScores(): Promise<{ success: boolean; error?: string }> {
  try {
    const templates = await prisma.templateLibraryItem.findMany({
      select: { id: true, importCount: true, createdAt: true },
    });

    for (const template of templates) {
      const popularity = calculatePopularity(template.importCount, template.createdAt);
      await prisma.templateLibraryItem.update({
        where: { id: template.id },
        data: { popularity },
      });
    }

    return { success: true };
  } catch (error) {
    console.error("Error updating popularity scores:", error);
    return { success: false, error: "Failed to update popularity scores" };
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Calculate popularity score based on import count and recency
 * Score = importCount * recencyFactor
 * recencyFactor decays over time to favor newer templates
 */
function calculatePopularity(importCount: number, createdAt: Date): number {
  const ageInDays = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  
  // Recency factor: starts at 1.5 for new templates, decays to 0.5 over 365 days
  const recencyFactor = Math.max(0.5, 1.5 - (ageInDays / 365));
  
  // Boost for high import counts (logarithmic scale)
  const importBoost = importCount > 10 ? Math.log10(importCount) : 0;
  
  return Math.round((importCount * recencyFactor + importBoost) * 100) / 100;
}
