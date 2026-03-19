"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  isFolderSchemaMissingError,
  validateFolderAssignment,
} from "@/lib/email-workspace/folder-access";
import type { 
  Email, 
  EmailWithRelations, 
  CreateEmailInput, 
  UpdateEmailInput,
  EmailFilters 
} from "@/types/email-campaign";

type EmailFindManyArgs = NonNullable<Parameters<typeof prisma.email.findMany>[0]>;
type EmailWhereInput = NonNullable<EmailFindManyArgs["where"]>;
type EmailCreateData = Parameters<typeof prisma.email.create>[0]["data"];
type EmailUpdateData = Parameters<typeof prisma.email.update>[0]["data"];

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

  const where: EmailWhereInput = {};
  const andConditions: EmailWhereInput[] = [];

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
    if (user.role.name !== "ADMIN" && filters.venueId !== user.venueId) {
      return [];
    }
    where.venueId = filters.venueId;
  } else if (user.role.name !== "ADMIN") {
    // Non-admins can only see emails for their venue or system emails
    andConditions.push({
      OR: [
        { venueId: user.venueId },
        { venueId: null, isSystem: true },
      ],
    });
  }

  // Filter by folder
  if (filters?.folderId) {
    where.folderId = filters.folderId;
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
    andConditions.push({
      OR: [
        { name: { contains: filters.search, mode: "insensitive" } },
        { subject: { contains: filters.search, mode: "insensitive" } },
        { description: { contains: filters.search, mode: "insensitive" } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
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

    const isUserAdmin = user.role.name === "ADMIN";

    // Non-admins can only create emails for their venue
    if (!isUserAdmin && input.venueId && input.venueId !== user.venueId) {
      return { success: false, error: "Access denied" };
    }

    let folderIdForCreate: string | null | undefined = undefined;

    if (input.folderId) {
      try {
        const folderValidation = await validateFolderAssignment({
          userId: session.userId,
          isAdminUser: isUserAdmin,
          module: "create",
          folderId: input.folderId,
        });

        if (!folderValidation.valid) {
          return {
            success: false,
            error: folderValidation.error || "Invalid folder selection.",
          };
        }

        folderIdForCreate = input.folderId;
      } catch (folderError) {
        if (!isFolderSchemaMissingError(folderError)) {
          throw folderError;
        }
      }
    }

    const createData: Record<string, unknown> = {
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
    };

    if (folderIdForCreate !== undefined) {
      createData.folderId = folderIdForCreate;
    }

    let email;
    try {
      email = await prisma.email.create({
        data: createData as EmailCreateData,
      });
    } catch (createError) {
      if (
        createData.folderId !== undefined &&
        isFolderSchemaMissingError(createError)
      ) {
        delete createData.folderId;
        email = await prisma.email.create({
          data: createData as EmailCreateData,
        });
      } else {
        throw createError;
      }
    }

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

    const isUserAdmin = user.role.name === "ADMIN";

    // Non-admins can only update emails for their venue
    if (!isUserAdmin && existingEmail.venueId && existingEmail.venueId !== user.venueId) {
      return { success: false, error: "Access denied" };
    }

    // System emails can only be updated by admins
    if (existingEmail.isSystem && user.role.name !== "ADMIN") {
      return { success: false, error: "System emails can only be modified by admins" };
    }

    const updateData: Record<string, unknown> = {
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
    };

    if (input.folderId !== undefined) {
      if (input.folderId) {
        try {
          const folderValidation = await validateFolderAssignment({
            userId: session.userId,
            isAdminUser: isUserAdmin,
            module: "create",
            folderId: input.folderId,
          });

          if (!folderValidation.valid) {
            return {
              success: false,
              error: folderValidation.error || "Invalid folder selection.",
            };
          }

          updateData.folderId = input.folderId;
        } catch (folderError) {
          if (!isFolderSchemaMissingError(folderError)) {
            throw folderError;
          }
        }
      } else {
        updateData.folderId = null;
      }
    }

    let email;
    try {
      email = await prisma.email.update({
        where: { id },
        data: updateData as EmailUpdateData,
      });
    } catch (updateError) {
      if (
        updateData.folderId !== undefined &&
        isFolderSchemaMissingError(updateError)
      ) {
        delete updateData.folderId;
        email = await prisma.email.update({
          where: { id },
          data: updateData as EmailUpdateData,
        });
      } else {
        throw updateError;
      }
    }

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

// ============================================================================
// SEND TEST EMAIL (Builder)
// ============================================================================

interface SendEmailBuilderTestInput {
  to: string;
  emailId?: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function sendEmailBuilderTest(
  input: SendEmailBuilderTestInput
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const session = await auth();
    if (!session?.userId) {
      return { success: false, error: "Unauthorized" };
    }

    const recipient = input.to.trim();
    if (!recipient) {
      return { success: false, error: "Test email address is required." };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(recipient)) {
      return { success: false, error: "Enter a valid test email address." };
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { role: true },
    });

    if (!user) {
      return { success: false, error: "User not found." };
    }

    let subject = input.subject?.trim() || "";
    let htmlContent = input.htmlContent?.trim() || "";
    let textContent = input.textContent?.trim() || "";

    if (input.emailId) {
      const email = await prisma.email.findUnique({
        where: { id: input.emailId },
      });

      if (!email) {
        return { success: false, error: "Email not found." };
      }

      if (user.role.name !== "ADMIN" && email.venueId && email.venueId !== user.venueId) {
        return { success: false, error: "Access denied." };
      }

      subject = subject || email.subject;
      htmlContent = htmlContent || email.htmlContent;
      textContent = textContent || email.textContent || "";
    }

    if (!subject || !htmlContent) {
      return {
        success: false,
        error: "Subject and HTML content are required to send a test email.",
      };
    }

    const safeTextContent = textContent || stripHtmlToText(htmlContent);

    const { sendBrevoEmail } = await import("@/lib/services/email/brevo");
    const result = await sendBrevoEmail({
      to: recipient,
      toName: "Test Recipient",
      subject: `[TEST] ${subject}`,
      htmlContent,
      textContent: safeTextContent,
    });

    if (!result.success) {
      return { success: false, error: "Failed to send test email." };
    }

    return {
      success: true,
      messageId: result.messageId,
    };
  } catch (error) {
    console.error("Error sending builder test email:", error);
    return { success: false, error: "Failed to send test email." };
  }
}
