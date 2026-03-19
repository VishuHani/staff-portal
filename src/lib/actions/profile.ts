"use server";

import {
  actionFailure,
  actionSuccess,
  logActionError,
  revalidatePaths,
  type ActionResult,
} from "@/lib/utils/action-contract";
import { revalidatePath } from "next/cache";
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

type FieldErrors = Record<string, string[] | undefined>;

function revalidateProfilePaths(...paths: string[]) {
  revalidatePath("/", "layout");

  if (paths.length > 0) {
    revalidatePaths(paths);
  }
}

/**
 * Complete user profile (for users with profileCompletedAt = null)
 */
export async function completeProfile(
  data: CompleteProfileInput
): Promise<ActionResult<{ errors: FieldErrors }>> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  // Validate input
  const validatedFields = completeProfileSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      ...actionFailure("Invalid fields"),
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

    revalidateProfilePaths();
    return actionSuccess({});
  } catch (error) {
    logActionError("profile.completeProfile", error, { userId: user.id });
    return actionFailure("Failed to complete profile");
  }
}

/**
 * Update user profile
 */
export async function updateProfile(
  data: UpdateProfileInput
): Promise<ActionResult<{ errors: FieldErrors }>> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  // Validate input
  const validatedFields = updateProfileSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      ...actionFailure("Invalid fields"),
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

    revalidateProfilePaths("/settings/profile");
    return actionSuccess({});
  } catch (error) {
    logActionError("profile.updateProfile", error, { userId: user.id });
    return actionFailure("Failed to update profile");
  }
}

/**
 * Upload/update profile image
 */
export async function uploadProfileImage(
  formData: FormData
): Promise<ActionResult<{ url: string }>> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  const file = formData.get("file") as File;

  if (!file) {
    return actionFailure("No file provided");
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
      return actionFailure(uploadResult.error);
    }

    // Update user record
    await prisma.user.update({
      where: { id: user.id },
      data: {
        profileImage: uploadResult.url,
      },
    });

    revalidateProfilePaths("/settings/profile");
    return actionSuccess({ url: uploadResult.url });
  } catch (error: unknown) {
    logActionError("profile.uploadProfileImage", error, { userId: user.id });
    const errorMessage = error instanceof Error ? error.message : "Failed to upload image";
    return actionFailure(errorMessage);
  }
}

/**
 * Delete profile image
 */
export async function deleteProfileImage(): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  if (!user.profileImage) {
    return actionFailure("No profile image to delete");
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

    revalidateProfilePaths("/settings/profile");
    return actionSuccess({});
  } catch (error: unknown) {
    logActionError("profile.deleteProfileImage", error, { userId: user.id });
    const errorMessage = error instanceof Error ? error.message : "Failed to delete image";
    return actionFailure(errorMessage);
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
      // Superannuation fields
      superEnabled: true,
      customSuperRate: true,
      superFundName: true,
      superFundMemberNumber: true,
      superFundUSI: true,
      superFundABN: true,
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
    customSuperRate:
      fullUser.customSuperRate !== null ? Number(fullUser.customSuperRate) : null,
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
export async function addUserSkill(
  data: UserSkillInput
): Promise<
  ActionResult<{
    skill: Awaited<ReturnType<typeof prisma.userSkill.create>>;
    errors: FieldErrors;
  }>
> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  const validatedFields = userSkillSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      ...actionFailure("Invalid fields"),
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

    revalidatePaths("/my/profile");
    return actionSuccess({ skill });
  } catch (error: unknown) {
    logActionError("profile.addUserSkill", error, { userId: user.id });
    return actionFailure("Failed to add skill");
  }
}

/**
 * Update a skill
 */
export async function updateUserSkill(
  skillId: string,
  data: UserSkillInput
): Promise<
  ActionResult<{
    skill: Awaited<ReturnType<typeof prisma.userSkill.update>>;
    errors: FieldErrors;
  }>
> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  const validatedFields = userSkillSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      ...actionFailure("Invalid fields"),
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    // Verify ownership
    const existing = await prisma.userSkill.findFirst({
      where: { id: skillId, userId: user.id },
    });

    if (!existing) {
      return actionFailure("Skill not found");
    }

    const skill = await prisma.userSkill.update({
      where: { id: skillId },
      data: validatedFields.data,
    });

    revalidatePaths("/my/profile");
    return actionSuccess({ skill });
  } catch (error: unknown) {
    logActionError("profile.updateUserSkill", error, { userId: user.id, skillId });
    return actionFailure("Failed to update skill");
  }
}

/**
 * Delete a skill
 */
export async function deleteUserSkill(skillId: string): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  try {
    // Verify ownership
    const existing = await prisma.userSkill.findFirst({
      where: { id: skillId, userId: user.id },
    });

    if (!existing) {
      return actionFailure("Skill not found");
    }

    await prisma.userSkill.delete({
      where: { id: skillId },
    });

    revalidatePaths("/my/profile");
    return actionSuccess({});
  } catch (error: unknown) {
    logActionError("profile.deleteUserSkill", error, { userId: user.id, skillId });
    return actionFailure("Failed to delete skill");
  }
}

// ============================================================================
// CERTIFICATIONS MANAGEMENT
// ============================================================================

/**
 * Add a certification to user profile
 */
export async function addUserCertification(
  data: UserCertificationInput
): Promise<
  ActionResult<{
    certification: Awaited<ReturnType<typeof prisma.userCertification.create>>;
    errors: FieldErrors;
  }>
> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  const validatedFields = userCertificationSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      ...actionFailure("Invalid fields"),
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

    revalidatePaths("/my/profile");
    return actionSuccess({ certification });
  } catch (error: unknown) {
    logActionError("profile.addUserCertification", error, { userId: user.id });
    return actionFailure("Failed to add certification");
  }
}

/**
 * Update a certification
 */
export async function updateUserCertification(
  certificationId: string,
  data: UserCertificationInput
): Promise<
  ActionResult<{
    certification: Awaited<ReturnType<typeof prisma.userCertification.update>>;
    errors: FieldErrors;
  }>
> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  const validatedFields = userCertificationSchema.safeParse(data);

  if (!validatedFields.success) {
    return {
      ...actionFailure("Invalid fields"),
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  try {
    // Verify ownership
    const existing = await prisma.userCertification.findFirst({
      where: { id: certificationId, userId: user.id },
    });

    if (!existing) {
      return actionFailure("Certification not found");
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

    revalidatePaths("/my/profile");
    return actionSuccess({ certification });
  } catch (error: unknown) {
    logActionError("profile.updateUserCertification", error, { userId: user.id, certificationId });
    return actionFailure("Failed to update certification");
  }
}

/**
 * Delete a certification
 */
export async function deleteUserCertification(
  certificationId: string
): Promise<ActionResult> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  try {
    // Verify ownership
    const existing = await prisma.userCertification.findFirst({
      where: { id: certificationId, userId: user.id },
    });

    if (!existing) {
      return actionFailure("Certification not found");
    }

    await prisma.userCertification.delete({
      where: { id: certificationId },
    });

    revalidatePaths("/my/profile");
    return actionSuccess({});
  } catch (error: unknown) {
    logActionError("profile.deleteUserCertification", error, { userId: user.id, certificationId });
    return actionFailure("Failed to delete certification");
  }
}

// ============================================================================
// SUPERANNUATION SETTINGS
// ============================================================================

/**
 * Get user's own superannuation settings
 */
export async function getMySuperSettings(): Promise<
  ActionResult<{ data: any }>
> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  try {
    const userData = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        superEnabled: true,
        customSuperRate: true,
        superFundName: true,
        superFundMemberNumber: true,
        superFundUSI: true,
        superFundABN: true,
      },
    });

    if (!userData) {
      return actionFailure("User not found");
    }

    return actionSuccess({ data: userData });
  } catch (error: unknown) {
    logActionError("profile.getMySuperSettings", error, { userId: user.id });
    return actionFailure("Failed to fetch superannuation settings");
  }
}

/**
 * Update user's own superannuation settings
 */
export async function updateMySuperSettings(data: {
  superEnabled: boolean | null;
  customSuperRate: number | null;
  superFundName: string | null;
  superFundMemberNumber: string | null;
  superFundUSI: string | null;
  superFundABN: string | null;
}): Promise<
  ActionResult<{ data: any }>
> {
  const user = await getCurrentUser();

  if (!user) {
    return actionFailure("Unauthorized");
  }

  try {
    // Get current user data for audit log
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        superEnabled: true,
        customSuperRate: true,
        superFundName: true,
        superFundMemberNumber: true,
        superFundUSI: true,
        superFundABN: true,
      },
    });

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        superEnabled: data.superEnabled,
        customSuperRate: data.customSuperRate,
        superFundName: data.superFundName,
        superFundMemberNumber: data.superFundMemberNumber,
        superFundUSI: data.superFundUSI,
        superFundABN: data.superFundABN,
      },
    });

    // Audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "PROFILE_UPDATED",
      resourceType: "User",
      resourceId: user.id,
      oldValue: JSON.stringify(currentUser),
      newValue: JSON.stringify(data),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePaths("/my/profile");
    return actionSuccess({ data: updatedUser });
  } catch (error: unknown) {
    logActionError("profile.updateMySuperSettings", error, { userId: user.id });
    return actionFailure("Failed to update superannuation settings");
  }
}
