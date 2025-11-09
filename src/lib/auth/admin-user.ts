/**
 * Admin User Creation Utility
 *
 * This module provides a shared function for creating users in BOTH
 * Supabase Auth and Prisma database. This ensures authentication works correctly.
 *
 * IMPORTANT: Users must exist in both systems for login to work:
 * - Supabase Auth: Handles password verification and sessions
 * - Prisma DB: Stores user profile, role, and permissions
 */

import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

/**
 * Create an admin Supabase client with service role permissions
 * This bypasses Row Level Security and can create users programmatically
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      "Missing Supabase credentials. Ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in environment."
    );
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

interface CreateUserInBothSystemsParams {
  email: string;
  password: string;
  roleId: string;
  storeId?: string | null;
  active?: boolean;
}

interface CreateUserInBothSystemsResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * Create a user in BOTH Supabase Auth and Prisma database
 *
 * This function ensures the user can successfully log in by:
 * 1. Creating the user in Supabase Auth (for authentication)
 * 2. Creating the user in Prisma DB with the same ID (for profile/permissions)
 *
 * @param params - User creation parameters
 * @returns Result with userId or error message
 */
export async function createUserInBothSystems(
  params: CreateUserInBothSystemsParams
): Promise<CreateUserInBothSystemsResult> {
  const { email, password, roleId, storeId, active = true } = params;

  try {
    // Step 1: Check if user already exists in Prisma
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return {
        success: false,
        error: "User with this email already exists in database",
      };
    }

    // Step 2: Create user in Supabase Auth
    const adminClient = createAdminClient();

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for admin-created users
    });

    if (authError || !authData.user) {
      console.error("Supabase Auth error:", authError);
      return {
        success: false,
        error: `Failed to create user in Supabase Auth: ${authError?.message || "Unknown error"}`,
      };
    }

    // Step 3: Hash password for Prisma DB
    const hashedPassword = await bcrypt.hash(password, 10);

    // Step 4: Create user in Prisma DB with the same ID from Supabase
    try {
      const user = await prisma.user.create({
        data: {
          id: authData.user.id, // Use Supabase Auth ID
          email,
          password: hashedPassword,
          roleId,
          storeId: storeId || null,
          active,
        },
      });

      return {
        success: true,
        userId: user.id,
      };
    } catch (prismaError: any) {
      // If Prisma creation fails, clean up the Supabase Auth user
      console.error("Prisma error, cleaning up Supabase user:", prismaError);

      await adminClient.auth.admin.deleteUser(authData.user.id);

      return {
        success: false,
        error: `Failed to create user in database: ${prismaError.message || "Unknown error"}`,
      };
    }
  } catch (error: any) {
    console.error("Unexpected error in createUserInBothSystems:", error);
    return {
      success: false,
      error: `Unexpected error: ${error.message || "Unknown error"}`,
    };
  }
}

/**
 * Update an existing Prisma user by also creating them in Supabase Auth
 *
 * This is useful for migrating existing users that were created only in Prisma
 * (e.g., from old seed scripts) to work with the authentication system.
 *
 * @param email - User email
 * @param password - User password
 * @returns Result with success status
 */
export async function syncExistingUserToSupabase(
  email: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists in Prisma
    const prismaUser = await prisma.user.findUnique({
      where: { email },
    });

    if (!prismaUser) {
      return {
        success: false,
        error: "User not found in database",
      };
    }

    // Create in Supabase Auth
    const adminClient = createAdminClient();

    const { data: authData, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      // If user already exists in Supabase, that's actually okay
      if (authError.message?.includes("already registered")) {
        console.log(`User ${email} already exists in Supabase Auth`);
        return { success: true };
      }

      return {
        success: false,
        error: `Failed to sync to Supabase Auth: ${authError.message}`,
      };
    }

    // Update Prisma user with Supabase ID if different
    if (authData.user && authData.user.id !== prismaUser.id) {
      await prisma.user.update({
        where: { email },
        data: { id: authData.user.id },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Error syncing user to Supabase:", error);
    return {
      success: false,
      error: error.message || "Unknown error",
    };
  }
}
