import { z } from "zod";

// Schema for completing profile (required fields only)
export const completeProfileSchema = z.object({
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
  phone: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        // Allow various phone formats
        return /^[\d\s\-\(\)\+]+$/.test(val) && val.replace(/\D/g, "").length >= 10;
      },
      { message: "Please enter a valid phone number" }
    ),
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  dateOfBirth: z.string().optional(), // ISO date string from input[type="date"]
});

// Schema for updating full profile (all optional except names if provided)
export const updateProfileSchema = z.object({
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
  bio: z.string().max(500, "Bio must be less than 500 characters").optional(),
  dateOfBirth: z.string().optional(), // ISO date string
});

// Schema for avatar upload validation
export const uploadAvatarSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size <= 5 * 1024 * 1024, {
      message: "File size must be less than 5MB",
    })
    .refine(
      (file) => {
        const validTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
        return validTypes.includes(file.type);
      },
      {
        message: "File must be a JPEG, PNG, WebP, or GIF image",
      }
    ),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UploadAvatarInput = z.infer<typeof uploadAvatarSchema>;
