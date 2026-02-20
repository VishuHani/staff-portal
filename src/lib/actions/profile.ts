"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import {
  completeProfileSchema,
  updateProfileSchema,
  userSkillSchema,
  userCertificationSchema,
  type CompleteProfileInput,
  type UpdateProfileInput,
  type UserSkillInput,
  type UserCertificationInput,
} from "@/lib/schemas/profile";
import { uploadAvatar, deleteAvatar } from "@/lib/storage/avatars";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { getAuditContext } from "@/lib/utils/audit-helpers";
import { calculateProfileCompletion } from "@/lib/utils/profile-completion";

/**
 * Complete user profile (for users with profileCompletedAt = null)
 */
export async function completeProfile(data: CompleteProfileInput) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Validate input
  const validatedFields = completeProfileSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const {
    firstName,
    lastName,
    phone,
    bio,
    dateOfBirth,
    addressStreet,
    addressCity,
    addressState,
    addressPostcode,
    addressCountry,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
  } = validatedFields.data;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        phone: phone || null,
        bio: bio || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        addressStreet: addressStreet || null,
        addressCity: addressCity || null,
        addressState: addressState || null,
        addressPostcode: addressPostcode || null,
        addressCountry: addressCountry || "Australia",
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        emergencyContactRelation: emergencyContactRelation || null,
        profileCompletedAt: new Date(), // Mark profile as complete
      },
    });

    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    console.error("Error completing profile:", error);
    return { error: "Failed to complete profile" };
  }
}

/**
 * Update user profile
 */
export async function updateProfile(data: UpdateProfileInput) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Validate input
  const validatedFields = updateProfileSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const {
    firstName,
    lastName,
    phone,
    bio,
    dateOfBirth,
    addressStreet,
    addressCity,
    addressState,
    addressPostcode,
    addressCountry,
    emergencyContactName,
    emergencyContactPhone,
    emergencyContactRelation,
    employmentType,
    employmentStartDate,
  } = validatedFields.data;

  try {
    // Get current user data for audit log
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        firstName: true,
        lastName: true,
        phone: true,
        bio: true,
        dateOfBirth: true,
        addressStreet: true,
        addressCity: true,
        addressState: true,
        addressPostcode: true,
        addressCountry: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        emergencyContactRelation: true,
        employmentType: true,
        employmentStartDate: true,
      },
    });

    // Build update data object dynamically (only include provided fields)
    const updateData: Record<string, unknown> = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone || null;
    if (bio !== undefined) updateData.bio = bio || null;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;
    if (addressStreet !== undefined) updateData.addressStreet = addressStreet || null;
    if (addressCity !== undefined) updateData.addressCity = addressCity || null;
    if (addressState !== undefined) updateData.addressState = addressState || null;
    if (addressPostcode !== undefined) updateData.addressPostcode = addressPostcode || null;
    if (addressCountry !== undefined) updateData.addressCountry = addressCountry || "Australia";
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName || null;
    if (emergencyContactPhone !== undefined) updateData.emergencyContactPhone = emergencyContactPhone || null;
    if (emergencyContactRelation !== undefined) updateData.emergencyContactRelation = emergencyContactRelation || null;
    if (employmentType !== undefined) updateData.employmentType = employmentType;
    if (employmentStartDate !== undefined) updateData.employmentStartDate = employmentStartDate ? new Date(employmentStartDate) : null;

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    // Audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "PROFILE_UPDATED",
      resourceType: "User",
      resourceId: user.id,
      oldValue: JSON.stringify(currentUser),
      newValue: JSON.stringify(updateData),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings/profile");
    return { success: true };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { error: "Failed to update profile" };
  }
}

/**
 * Upload/update profile image
 */
export async function uploadProfileImage(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const file = formData.get("file") as File;

  if (!file) {
    return { error: "No file provided" };
  }

  try {
    // Delete old avatar if exists
    if (user.profileImage) {
      await deleteAvatar(user.profileImage);
    }

    // Upload new avatar
    const uploadResult = await uploadAvatar(user.id, file);

    // Check if upload was successful
    if ("error" in uploadResult) {
      return { error: uploadResult.error };
    }

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileImage: uploadResult.url,
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings/profile");
    return { success: true, url: uploadResult.url };
  } catch (error: unknown) {
    console.error("Error uploading profile image:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
    return { error: errorMessage };
  }
}

/**
 * Delete profile image
 */
export async function deleteProfileImage() {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  if (!user.profileImage) {
    return { error: "No profile image to delete" };
  }

  try {
    // Delete from storage
    await deleteAvatar(user.profileImage);

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileImage: null,
      },
    });

    revalidatePath("/", "layout");
    revalidatePath("/settings/profile");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting profile image:", error);
    const errorMessage = error instanceof Error ? error.message : "Failed to delete image";
    return { error: errorMessage };
  }
}

/**
 * Get user profile (for viewing)
 */
export async function getProfile() {
  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  // Fetch full user data from database
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      profileImage: true,
      phone: true,
      bio: true,
      dateOfBirth: true,
      profileCompletedAt: true,
      createdAt: true,
      addressStreet: true,
      addressCity: true,
      addressState: true,
      addressPostcode: true,
      addressCountry: true,
      emergencyContactName: true,
      emergencyContactPhone: true,
      emergencyContactRelation: true,
      employmentType: true,
      employmentStartDate: true,
      role: {
        select: { name: true },
      },
      venues: {
        select: {
          isPrimary: true,
          venue: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      skills: {
        select: {
          id: true,
          name: true,
          category: true,
          level: true,
          notes: true,
          verified: true,
          verifiedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      certifications: {
        select: {
          id: true,
          name: true,
          issuingBody: true,
          issueDate: true,
          expiryDate: true,
          certificateNumber: true,
          status: true,
          notes: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!fullUser) {
    return null;
  }

  const completion = calculateProfileCompletion(fullUser);

  return {
    ...fullUser,
    role: fullUser.role.name,
    venues: fullUser.venues.map((uv) => ({
      id: uv.venue.id,
      name: uv.venue.name,
      code: uv.venue.code,
      isPrimary: uv.isPrimary,
    })),
    completion,
  };
}

// ============================================================================
// SKILLS MANAGEMENT
// ============================================================================

/**
 * Add a skill to user profile
 */
export async function addUserSkill(data: UserSkillInput) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const validatedFields = userSkillSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const skill = await prisma.userSkill.create({
      data: {
        userId: user.id,
        ...validatedFields.data,
      },
    });

    revalidatePath("/my/profile");
    return { success: true, skill };
  } catch (error: unknown) {
    console.error("Error adding skill:", error);
    return { error: "Failed to add skill" };
  }
}

/**
 * Update a skill
 */
export async function updateUserSkill(skillId: string, data: UserSkillInput) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const validatedFields = userSkillSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    // Verify ownership
    const existing = await prisma.userSkill.findFirst({
      where: { id: skillId, userId: user.id },
    });

    if (!existing) {
      return { error: "Skill not found" };
    }

    const skill = await prisma.userSkill.update({
      where: { id: skillId },
      data: validatedFields.data,
    });

    revalidatePath("/my/profile");
    return { success: true, skill };
  } catch (error: unknown) {
    console.error("Error updating skill:", error);
    return { error: "Failed to update skill" };
  }
}

/**
 * Delete a skill
 */
export async function deleteUserSkill(skillId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  try {
    // Verify ownership
    const existing = await prisma.userSkill.findFirst({
      where: { id: skillId, userId: user.id },
    });

    if (!existing) {
      return { error: "Skill not found" };
    }

    await prisma.userSkill.delete({
      where: { id: skillId },
    });

    revalidatePath("/my/profile");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting skill:", error);
    return { error: "Failed to delete skill" };
  }
}

// ============================================================================
// CERTIFICATIONS MANAGEMENT
// ============================================================================

/**
 * Add a certification to user profile
 */
export async function addUserCertification(data: UserCertificationInput) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const validatedFields = userCertificationSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    const { issueDate, expiryDate, documentUrl } = validatedFields.data;

    // Determine status based on expiry date
    let status = "ACTIVE";
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      const now = new Date();
      if (expiry < now) {
        status = "EXPIRED";
      } else if (expiry.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
        // 30 days
        status = "PENDING_RENEWAL";
      }
    }

    const certification = await prisma.userCertification.create({
      data: {
        userId: user.id,
        name: validatedFields.data.name,
        issuingBody: validatedFields.data.issuingBody,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        certificateNumber: validatedFields.data.certificateNumber,
        documentUrl: documentUrl || null,
        notes: validatedFields.data.notes,
        status,
      },
    });

    revalidatePath("/my/profile");
    return { success: true, certification };
  } catch (error: unknown) {
    console.error("Error adding certification:", error);
    return { error: "Failed to add certification" };
  }
}

/**
 * Update a certification
 */
export async function updateUserCertification(
  certificationId: string,
  data: UserCertificationInput
) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  const validatedFields = userCertificationSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    // Verify ownership
    const existing = await prisma.userCertification.findFirst({
      where: { id: certificationId, userId: user.id },
    });

    if (!existing) {
      return { error: "Certification not found" };
    }

    const { issueDate, expiryDate, documentUrl } = validatedFields.data;

    // Determine status based on expiry date
    let status = "ACTIVE";
    if (expiryDate) {
      const expiry = new Date(expiryDate);
      const now = new Date();
      if (expiry < now) {
        status = "EXPIRED";
      } else if (expiry.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
        status = "PENDING_RENEWAL";
      }
    }

    const certification = await prisma.userCertification.update({
      where: { id: certificationId },
      data: {
        name: validatedFields.data.name,
        issuingBody: validatedFields.data.issuingBody,
        issueDate: issueDate ? new Date(issueDate) : null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        certificateNumber: validatedFields.data.certificateNumber,
        documentUrl: documentUrl || null,
        notes: validatedFields.data.notes,
        status,
      },
    });

    revalidatePath("/my/profile");
    return { success: true, certification };
  } catch (error: unknown) {
    console.error("Error updating certification:", error);
    return { error: "Failed to update certification" };
  }
}

/**
 * Delete a certification
 */
export async function deleteUserCertification(certificationId: string) {
  const user = await getCurrentUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  try {
    // Verify ownership
    const existing = await prisma.userCertification.findFirst({
      where: { id: certificationId, userId: user.id },
    });

    if (!existing) {
      return { error: "Certification not found" };
    }

    await prisma.userCertification.delete({
      where: { id: certificationId },
    });

    revalidatePath("/my/profile");
    return { success: true };
  } catch (error: unknown) {
    console.error("Error deleting certification:", error);
    return { error: "Failed to delete certification" };
  }
}
