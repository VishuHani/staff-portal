"use server";

import { headers } from "next/headers";
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
import { createAuditLog } from "@/lib/actions/admin/audit-logs";
import { NotificationType } from "@prisma/client";
import { rateLimit, getClientIp } from "@/lib/utils/rate-limit";

export async function login(formData: LoginInput) {
  // RATE LIMITING: Prevent brute force attacks
  // Use IP + email as identifier for more granular control
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const email = formData.email || "unknown";
  const identifier = `${ip}:${email}`;

  const { success, reset, remaining } = await rateLimit.login(identifier);
  if (!success) {
    const waitSeconds = Math.ceil(reset / 1000);
    return {
      error: `Too many login attempts. Please try again in ${waitSeconds} seconds.`,
    };
  }

  // Validate input
  const validatedFields = loginSchema.safeParse(formData);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email: validatedEmail, password } = validatedFields.data;
  const supabase = await createClient();

  // Sign in with Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email: validatedEmail,
    password,
  });

  if (error) {
    // Log failed login attempt (wrong password, invalid email, etc.)
    try {
      // Try to find user for logging purposes
      const userAttempt = await prisma.user.findUnique({
        where: { email: validatedEmail },
      });
      
      await createAuditLog({
        userId: userAttempt?.id || "unknown",
        actionType: "LOGIN_FAILED",
        resourceType: "Auth",
        resourceId: userAttempt?.id,
        newValue: JSON.stringify({ 
          email: validatedEmail, 
          reason: error.message,
          attemptIp: ip 
        }),
        ipAddress: ip,
      });
    } catch (auditError) {
      console.error("Error creating audit log:", auditError);
    }
    return { error: error.message };
  }

  // Verify user exists in our database
  const user = await prisma.user.findUnique({
    where: { email: validatedEmail },
    include: { role: true },
  });

  if (!user || !user.active) {
    await supabase.auth.signOut();
    // Log failed login attempt
    try {
      if (user) {
        await createAuditLog({
          userId: user.id,
          actionType: "LOGIN_FAILED",
          resourceType: "Auth",
          resourceId: user.id,
          newValue: JSON.stringify({ reason: "Account inactive", email: validatedEmail }),
        });
      }
    } catch (error) {
      console.error("Error creating audit log:", error);
    }
    return { error: "Account not found or inactive" };
  }

  // Log successful login
  try {
    await createAuditLog({
      userId: user.id,
      actionType: "LOGIN_SUCCESS",
      resourceType: "Auth",
      resourceId: user.id,
      newValue: JSON.stringify({ email: validatedEmail, roleId: user.roleId }),
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
    // Don't fail login if audit log fails
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signup(formData: SignupInput) {
  // RATE LIMITING: Prevent spam signups and account enumeration
  const headersList = await headers();
  const ip = getClientIp(headersList);

  const { success, reset } = await rateLimit.signup(ip);
  if (!success) {
    const waitMinutes = Math.ceil(reset / 1000 / 60);
    return {
      error: `Too many signup attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`,
    };
  }

  // Validate input
  const validatedFields = signupSchema.safeParse(formData);

  if (!validatedFields.success) {
    return {
      error: "Invalid fields",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email, password, firstName, lastName, phone } = validatedFields.data;
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

  const newUser = await prisma.user.create({
    data: {
      id: data.user.id,
      email,
      firstName,
      lastName,
      phone: phone || null,
      roleId: staffRole.id,
      active: true,
      profileCompletedAt: new Date(), // Profile complete since we collected names at signup
    },
  });

  // Initialize notification preferences (EMAIL + IN_APP enabled by default)
  const notificationTypes: NotificationType[] = [
    "NEW_MESSAGE",
    "MESSAGE_REPLY",
    "MESSAGE_MENTION",
    "MESSAGE_REACTION",
    "POST_MENTION",
    "POST_PINNED",
    "POST_DELETED",
    "TIME_OFF_REQUEST",
    "TIME_OFF_APPROVED",
    "TIME_OFF_REJECTED",
    "TIME_OFF_CANCELLED",
    "USER_CREATED",
    "USER_UPDATED",
    "ROLE_CHANGED",
    "SYSTEM_ANNOUNCEMENT",
    "GROUP_REMOVED",
  ];

  try {
    await prisma.notificationPreference.createMany({
      data: notificationTypes.map((type) => ({
        userId: newUser.id,
        type,
        enabled: true,
        channels: ["IN_APP", "EMAIL"],
      })),
    });
  } catch (error) {
    console.error("Error creating notification preferences:", error);
    // Don't fail signup if preference initialization fails
  }

  // Log user signup
  try {
    await createAuditLog({
      userId: newUser.id,
      actionType: "USER_SIGNUP",
      resourceType: "Auth",
      resourceId: newUser.id,
      newValue: JSON.stringify({ email, firstName, lastName, roleId: staffRole.id }),
    });
  } catch (error) {
    console.error("Error creating audit log:", error);
    // Don't fail signup if audit log fails
  }

  return {
    success: true,
    message: "Account created! Please check your email to verify your account.",
  };
}

export async function logout() {
  const supabase = await createClient();

  // Get current user before logout for audit log
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    try {
      await createAuditLog({
        userId: user.id,
        actionType: "LOGOUT",
        resourceType: "Auth",
        resourceId: user.id,
        newValue: JSON.stringify({ email: user.email }),
      });
    } catch (error) {
      console.error("Error creating audit log:", error);
      // Don't fail logout if audit log fails
    }
  }

  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function resetPassword(formData: ResetPasswordInput) {
  // RATE LIMITING: Prevent email spam and account enumeration
  const headersList = await headers();
  const ip = getClientIp(headersList);
  const email = formData.email || "unknown";
  const identifier = `${ip}:${email}`;

  const { success, reset } = await rateLimit.resetPassword(identifier);
  if (!success) {
    const waitMinutes = Math.ceil(reset / 1000 / 60);
    return {
      error: `Too many password reset attempts. Please try again in ${waitMinutes} minute${waitMinutes > 1 ? 's' : ''}.`,
    };
  }

  const validatedFields = resetPasswordSchema.safeParse(formData);

  if (!validatedFields.success) {
    return {
      error: "Invalid email",
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { email: validatedEmail } = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase.auth.resetPasswordForEmail(validatedEmail, {
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
      venue: true,
      venues: {
        include: {
          venue: {
            select: {
              id: true,
              name: true,
              code: true,
              active: true,
            },
          },
        },
      },
    },
  });

  return user;
}
