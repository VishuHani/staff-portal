"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import {
  loginSchema,
  signupSchema,
  resetPasswordSchema,
  type LoginInput,
  type SignupInput,
  type ResetPasswordInput,
} from "@/lib/auth/schemas";

export async function login(formData: LoginInput) {
  // Validate input
  const validatedFields = loginSchema.safeParse(formData);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validatedFields.data;
  const supabase = await createClient();

  // Sign in with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  // Verify user exists in our database
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  if (!user || !user.active) {
    await supabase.auth.signOut();
    return { error: "Account not found or inactive" };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: SignupInput) {
  // Validate input
  const validatedFields = signupSchema.safeParse(formData);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password } = validatedFields.data;
  const supabase = await createClient();

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    return { error: "User with this email already exists" };
  }

  // Sign up with Supabase
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  if (!data.user) {
    return { error: "Failed to create user" };
  }

  // Create user in our database with default staff role
  const staffRole = await prisma.role.findUnique({
    where: { name: "STAFF" },
  });

  if (!staffRole) {
    await supabase.auth.admin.deleteUser(data.user.id);
    return { error: "System error: Staff role not found" };
  }

  await prisma.user.create({
    data: {
      id: data.user.id,
      email,
      roleId: staffRole.id,
      active: true,
    },
  });

  return {
    success: true,
    message: "Account created! Please check your email to verify your account.",
  };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function resetPassword(formData: ResetPasswordInput) {
  const validatedFields = resetPasswordSchema.safeParse(formData);

  if (!validatedFields.success) {
    return {
      error: "Invalid email",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email } = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: "Password reset email sent. Please check your inbox.",
  };
}

export async function getCurrentUser() {
  const supabase = await createClient();

  const {
    data: { user: supabaseUser },
  } = await supabase.auth.getUser();

  if (!supabaseUser) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: supabaseUser.id },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
      store: true,
    },
  });

  return user;
}
