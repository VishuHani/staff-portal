import { z } from "zod";

// Create user schema
export const createUserSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .min(1, "Email is required"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  roleId: z.string().cuid("Invalid role ID"),
  storeId: z.string().cuid("Invalid store ID").optional(),
  active: z.boolean().default(true),
});

// Update user schema
export const updateUserSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
  email: z.string().email("Invalid email address").optional(),
  roleId: z.string().cuid("Invalid role ID").optional(),
  storeId: z.string().cuid("Invalid store ID").optional().nullable(),
  active: z.boolean().optional(),
});

// Delete user schema
export const deleteUserSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
});

// Toggle active schema
export const toggleUserActiveSchema = z.object({
  userId: z.string().cuid("Invalid user ID"),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type ToggleUserActiveInput = z.infer<typeof toggleUserActiveSchema>;
