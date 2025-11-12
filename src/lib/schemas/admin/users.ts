import { z } from "zod";

// Create user schema
export const createUserSchema = z.object({
  firstName: z
    .string()
    .min(1, "First name is required")
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters"),
  lastName: z
    .string()
    .min(1, "Last name is required")
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters"),
  email: z
    .string()
    .email("Invalid email address")
    .min(1, "Email is required"),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        return /^[\d\s\-\(\)\+]+$/.test(val) && val.replace(/\D/g, "").length >= 10;
      },
      { message: "Please enter a valid phone number" }
    ),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      "Password must contain at least one uppercase letter, one lowercase letter, and one number"
    ),
  roleId: z.string().cuid("Invalid role ID"),
  venueIds: z
    .array(z.string().cuid("Invalid venue ID"))
    .min(1, "At least one venue must be selected")
    .optional(), // Optional for backward compatibility
  primaryVenueId: z.string().cuid("Invalid primary venue ID").optional(),
  active: z.boolean().default(true),
})
  .refine(
    (data) => {
      // If venueIds is provided, primaryVenueId must be one of them
      if (data.venueIds && data.venueIds.length > 0 && data.primaryVenueId) {
        return data.venueIds.includes(data.primaryVenueId);
      }
      return true;
    },
    {
      message: "Primary venue must be one of the selected venues",
      path: ["primaryVenueId"],
    }
  );

// Update user schema
export const updateUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  firstName: z
    .string()
    .min(2, "First name must be at least 2 characters")
    .max(50, "First name must be less than 50 characters")
    .optional(),
  lastName: z
    .string()
    .min(2, "Last name must be at least 2 characters")
    .max(50, "Last name must be less than 50 characters")
    .optional(),
  email: z.string().email("Invalid email address").optional(),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        return /^[\d\s\-\(\)\+]+$/.test(val) && val.replace(/\D/g, "").length >= 10;
      },
      { message: "Please enter a valid phone number" }
    ),
  roleId: z.string().cuid("Invalid role ID").optional(),
  venueIds: z
    .array(z.string().cuid("Invalid venue ID"))
    .min(1, "At least one venue must be selected")
    .optional(),
  primaryVenueId: z.string().cuid("Invalid primary venue ID").optional(),
  active: z.boolean().optional(),
})
  .refine(
    (data) => {
      // If venueIds is provided, primaryVenueId must be one of them
      if (data.venueIds && data.venueIds.length > 0 && data.primaryVenueId) {
        return data.venueIds.includes(data.primaryVenueId);
      }
      return true;
    },
    {
      message: "Primary venue must be one of the selected venues",
      path: ["primaryVenueId"],
    }
  );

// Delete user schema
export const deleteUserSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// Toggle active schema
export const toggleUserActiveSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
});

// Type exports
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type DeleteUserInput = z.infer<typeof deleteUserSchema>;
export type ToggleUserActiveInput = z.infer<typeof toggleUserActiveSchema>;
