"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "./auth";
import {
  completeProfileSchema,
  updateProfileSchema,
  type CompleteProfileInput,
  type UpdateProfileInput,
} from "@/lib/schemas/profile";
import { uploadAvatar, deleteAvatar } from "@/lib/storage/avatars";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { getAuditContext } from "@/lib/utils/audit-helpers";

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

  const { firstName, lastName, phone, bio, dateOfBirth } = validatedFields.data;

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName,
        lastName,
        phone: phone || null,
        bio: bio || null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
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

  const { firstName, lastName, phone, bio, dateOfBirth } = validatedFields.data;

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
      },
    });

    // Build update data object dynamically (only include provided fields)
    const updateData: any = {};

    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone || null;
    if (bio !== undefined) updateData.bio = bio || null;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

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
  } catch (error: any) {
    console.error("Error uploading profile image:", error);
    return { error: error.message || "Failed to upload image" };
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
  } catch (error: any) {
    console.error("Error deleting profile image:", error);
    return { error: error.message || "Failed to delete image" };
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

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    profileImage: user.profileImage,
    phone: user.phone,
    bio: user.bio,
    dateOfBirth: user.dateOfBirth,
    profileCompletedAt: user.profileCompletedAt,
    createdAt: user.createdAt,
    role: user.role.name,
    venues: user.venues?.map((uv) => ({
      id: uv.venue.id,
      name: uv.venue.name,
      code: uv.venue.code,
      isPrimary: uv.isPrimary,
    })),
  };
}
