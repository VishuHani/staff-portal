"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import type { 
  Email, 
  EmailWithRelations, 
  CreateEmailInput, 
  UpdateEmailInput,
  EmailFilters 
} from "@/types/email-campaign";

// ============================================================================
// GET EMAILS (List)
// ============================================================================

export async function getEmails(filters?: EmailFilters): Promise<EmailWithRelations[]> {
  const session = await auth();
  if (!session?.userId) {
    throw new Error("Unauthorized");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const where: any = {};

  // Filter by template status
  if (filters?.isTemplate !== undefined) {
    where.isTemplate = filters.isTemplate;
  }

  // Filter by category
  if (filters?.category) {
    where.category = filters.category;
  }

  // Filter by venue
  if (filters?.venueId) {
    where.venueId = filters.venueId;
  } else if (user.role.name !== "ADMIN") {
    // Non-admins can only see emails for their venue or system emails
    where.OR = [
      { venueId: user.venueId },
      { venueId: null, isSystem: true },
    ];
  }

  // Filter by system status
  if (filters?.isSystem !== undefined) {
    where.isSystem = filters.isSystem;
  }

  // Filter by creator
  if (filters?.createdBy) {
    where.createdBy = filters.createdBy;
  }

  // Search filter
  if (filters?.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { subject: { contains: filters.search, mode: "insensitive" } },
      { description: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const emails = await prisma.email.findMany({
    where,
    include: {
      venue: {
        select: { id: true, name: true, code: true },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
    orderBy: [
      { isTemplate: "desc" },
      { updatedAt: "desc" },
    ],
  });

  return emails as EmailWithRelations[];
}

// ============================================================================
// GET SINGLE EMAIL
// ============================================================================

export async function getEmail(id: string): Promise<EmailWithRelations | null> {
  const session = await auth();
  if (!session?.userId) {
    throw new Error("Unauthorized");
  }

  const email = await prisma.email.findUnique({
    where: { id },
    include: {
      venue: {
        select: { id: true, name: true, code: true },
      },
      creator: {
        select: { id: true, firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!email) {
    return null;
  }

  // Check access permissions
  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Non-admins can only access emails for their venue or system emails
  if (user.role.name !== "ADMIN" && email.venueId && email.venueId !== user.venueId) {
    throw new Error("Access denied");
  }

  return email as EmailWithRelations;
}

// ============================================================================
// CREATE EMAIL
// ============================================================================

export async function createEmail(input: CreateEmailInput): Promise<{ success: boolean; email?: Email; error?: string }> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Non-admins can only create emails for their venue
    if (user.role.name !== "ADMIN" && input.venueId && input.venueId !== user.venueId) {
      return { success: false, error: "Access denied" };
    }

    const email = await prisma.email.create({
      data: {
        name: input.name,
        description: input.description || null,
        subject: input.subject,
        previewText: input.previewText || null,
        htmlContent: input.htmlContent,
        textContent: input.textContent || null,
        designJson: input.designJson || null,
        emailType: input.emailType || "TRANSACTIONAL",
        category: input.category || null,
        isTemplate: input.isTemplate || false,
        variables: input.variables || [],
        venueId: input.venueId || null,
        createdBy: session.userId,
      },
    });

    return { success: true, email: email as Email };
  } catch (error) {
    console.error("Error creating email:", error);
    return { success: false, error: "Failed to create email" };
  }
}

// ============================================================================
// UPDATE EMAIL
// ============================================================================

export async function updateEmail(id: string, input: UpdateEmailInput): Promise<{ success: boolean; email?: Email; error?: string }> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if email exists and user has access
    const existingEmail = await prisma.email.findUnique({
      where: { id },
    });

    if (!existingEmail) {
      return { success: false, error: "Email not found" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Non-admins can only update emails for their venue
    if (user.role.name !== "ADMIN" && existingEmail.venueId && existingEmail.venueId !== user.venueId) {
      return { success: false, error: "Access denied" };
    }

    // System emails can only be updated by admins
    if (existingEmail.isSystem && user.role.name !== "ADMIN") {
      return { success: false, error: "System emails can only be modified by admins" };
    }

    const email = await prisma.email.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description }),
        ...(input.subject !== undefined && { subject: input.subject }),
        ...(input.previewText !== undefined && { previewText: input.previewText }),
        ...(input.htmlContent !== undefined && { htmlContent: input.htmlContent }),
        ...(input.textContent !== undefined && { textContent: input.textContent }),
        ...(input.designJson !== undefined && { designJson: input.designJson }),
        ...(input.emailType !== undefined && { emailType: input.emailType }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.isTemplate !== undefined && { isTemplate: input.isTemplate }),
        ...(input.variables !== undefined && { variables: input.variables }),
        ...(input.venueId !== undefined && { venueId: input.venueId }),
        ...(input.aiClassification !== undefined && { aiClassification: input.aiClassification }),
        ...(input.aiConfidence !== undefined && { aiConfidence: input.aiConfidence }),
      },
    });

    return { success: true, email: email as Email };
  } catch (error) {
    console.error("Error updating email:", error);
    return { success: false, error: "Failed to update email" };
  }
}

// ============================================================================
// DELETE EMAIL
// ============================================================================

export async function deleteEmail(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized" };
    }

    // Check if email exists and user has access
    const existingEmail = await prisma.email.findUnique({
      where: { id },
    });

    if (!existingEmail) {
      return { success: false, error: "Email not found" };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    // Non-admins can only delete emails for their venue
    if (user.role.name !== "ADMIN" && existingEmail.venueId && existingEmail.venueId !== user.venueId) {
      return { success: false, error: "Access denied" };
    }

    // System emails cannot be deleted
    if (existingEmail.isSystem) {
      return { success: false, error: "System emails cannot be deleted" };
    }

    // Check if email is being used by any campaigns
    const campaignsUsingEmail = await prisma.emailCampaign.count({
      where: { emailId: id },
    });

    if (campaignsUsingEmail > 0) {
      return { success: false, error: "Cannot delete email that is being used by campaigns" };
    }

    await prisma.email.delete({
      where: { id },
    });

    return { success: true };
  } catch (error) {
    console.error("Error deleting email:", error);
    return { success: false, error: "Failed to delete email" };
  }
}

// ============================================================================
// DUPLICATE EMAIL
// ============================================================================

export async function duplicateEmail(id: string): Promise<{ success: boolean; email?: Email; error?: string }> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const existingEmail = await prisma.email.findUnique({
      where: { id },
    });

    if (!existingEmail) {
      return { success: false, error: "Email not found" };
    }

    const newEmail = await prisma.email.create({
      data: {
        name: `${existingEmail.name} (Copy)`,
        description: existingEmail.description,
        subject: existingEmail.subject,
        previewText: existingEmail.previewText,
        htmlContent: existingEmail.htmlContent,
        textContent: existingEmail.textContent,
        designJson: existingEmail.designJson,
        emailType: existingEmail.emailType,
        category: existingEmail.category,
        isTemplate: false, // Duplicates are not templates by default
        variables: existingEmail.variables,
        venueId: existingEmail.venueId,
        createdBy: session.userId,
      },
    });

    return { success: true, email: newEmail as Email };
  } catch (error) {
    console.error("Error duplicating email:", error);
    return { success: false, error: "Failed to duplicate email" };
  }
}

// ============================================================================
// SAVE AS TEMPLATE
// ============================================================================

export async function saveEmailAsTemplate(id: string, templateName?: string): Promise<{ success: boolean; email?: Email; error?: string }> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const existingEmail = await prisma.email.findUnique({
      where: { id },
    });

    if (!existingEmail) {
      return { success: false, error: "Email not found" };
    }

    // Create a new email as a template
    const template = await prisma.email.create({
      data: {
        name: templateName || `${existingEmail.name} (Template)`,
        description: existingEmail.description,
        subject: existingEmail.subject,
        previewText: existingEmail.previewText,
        htmlContent: existingEmail.htmlContent,
        textContent: existingEmail.textContent,
        designJson: existingEmail.designJson,
        emailType: existingEmail.emailType,
        category: existingEmail.category || "general",
        isTemplate: true,
        variables: existingEmail.variables,
        venueId: existingEmail.venueId,
        createdBy: session.userId,
      },
    });

    return { success: true, email: template as Email };
  } catch (error) {
    console.error("Error saving as template:", error);
    return { success: false, error: "Failed to save as template" };
  }
}

// ============================================================================
// GET EMAIL TEMPLATES (Convenience function)
// ============================================================================

export async function getEmailTemplates(venueId?: string): Promise<EmailWithRelations[]> {
  return getEmails({
    isTemplate: true,
    venueId,
  });
}

// ============================================================================
// INCREMENT EMAIL USE COUNT
// ============================================================================

export async function incrementEmailUseCount(id: string): Promise<void> {
  await prisma.email.update({
    where: { id },
    data: {
      useCount: { increment: 1 },
      lastUsedAt: new Date(),
    },
  });
}
