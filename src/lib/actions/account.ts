"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac/access";
import bcrypt from "bcryptjs";
import {
  changePasswordSchema,
  updateEmailSchema,
  type ChangePasswordInput,
  type UpdateEmailInput,
} from "@/lib/schemas/account";
import { createClient } from "@/lib/auth/supabase-server";
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { getAuditContext } from "@/lib/utils/audit-helpers";

/**
 * Change user password
 * Validates current password before allowing change
 */
export async function changePassword(input: ChangePasswordInput) {
  try {
    const user = await requireAuth();

    // Validate input
    const validated = changePasswordSchema.safeParse(input);
    if (!validated.success) {
      return {
        error: validated.error.issues[0]?.message || "Invalid input",
      };
    }

    const { currentPassword, newPassword } = validated.data;

    // Get user's current password from database
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true, email: true },
    });

    if (!dbUser || !dbUser.password) {
      return { error: "User not found or password not set" };
    }

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, dbUser.password);
    if (!isValid) {
      return { error: "Current password is incorrect" };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in Prisma database
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword },
    });

    // Update password in Supabase Auth
    try {
      const supabase = await createClient();
      const { error: supabaseError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (supabaseError) {
        console.error("Error updating Supabase password:", supabaseError);
        // Don't fail the whole operation - Prisma password is updated
      }
    } catch (error) {
      console.error("Error updating Supabase password:", error);
      // Continue - Prisma password is already updated
    }

    // Audit log
    const auditContext = await getAuditContext();
    await createAuditLog({
      userId: user.id,
      actionType: "PASSWORD_CHANGED",
      resourceType: "User",
      resourceId: user.id,
      newValue: JSON.stringify({ email: dbUser.email, changedAt: new Date() }),
      ipAddress: auditContext.ipAddress,
    });

    revalidatePath("/settings/account");
    return { success: true };
  } catch (error) {
    console.error("Error changing password:", error);
    return { error: "Failed to change password" };
  }
}

/**
 * Update user email address
 * Requires password confirmation
 */
export async function updateEmail(input: UpdateEmailInput) {
  try {
    const user = await requireAuth();

    // Validate input
    const validated = updateEmailSchema.safeParse(input);
    if (!validated.success) {
      return {
        error: validated.error.issues[0]?.message || "Invalid input",
      };
    }

    const { newEmail, password } = validated.data;

    // Verify current password
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true, email: true },
    });

    if (!dbUser || !dbUser.password) {
      return { error: "User not found" };
    }

    const isValid = await bcrypt.compare(password, dbUser.password);
    if (!isValid) {
      return { error: "Password is incorrect" };
    }

    // Check if new email is already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (existingUser && existingUser.id !== user.id) {
      return { error: "This email is already in use" };
    }

    // Update email in Prisma database
    await prisma.user.update({
      where: { id: user.id },
      data: { email: newEmail },
    });

    // Update email in Supabase Auth
    try {
      const supabase = await createClient();
      const { error: supabaseError } = await supabase.auth.updateUser({
        email: newEmail,
      });

      if (supabaseError) {
        console.error("Error updating Supabase email:", supabaseError);
        // Don't fail - Prisma email is updated
        return {
          success: true,
          warning:
            "Email updated in database, but you may need to verify in Supabase",
        };
      }
    } catch (error) {
      console.error("Error updating Supabase email:", error);
    }

    revalidatePath("/settings/account");
    revalidatePath("/settings");
    return { success: true };
  } catch (error) {
    console.error("Error updating email:", error);
    return { error: "Failed to update email" };
  }
}

/**
 * Get current user's account information
 */
export async function getAccountInfo() {
  try {
    const user = await requireAuth();

    const accountInfo = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        email: true,
        firstName: true,
        lastName: true,
        role: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        active: true,
      },
    });

    if (!accountInfo) {
      return { error: "Account not found" };
    }

    return { accountInfo };
  } catch (error) {
    console.error("Error fetching account info:", error);
    return { error: "Failed to fetch account information" };
  }
}

/**
 * Deactivate user account
 * Requires password confirmation
 */
export async function deactivateAccount(password: string) {
  try {
    const user = await requireAuth();

    // Verify password
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    });

    if (!dbUser || !dbUser.password) {
      return { error: "User not found" };
    }

    const isValid = await bcrypt.compare(password, dbUser.password);
    if (!isValid) {
      return { error: "Password is incorrect" };
    }

    // Deactivate account
    await prisma.user.update({
      where: { id: user.id },
      data: { active: false },
    });

    // Sign out from Supabase
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Error signing out from Supabase:", error);
    }

    return { success: true };
  } catch (error) {
    console.error("Error deactivating account:", error);
    return { error: "Failed to deactivate account" };
  }
}
