import { z } from "zod";

// Employment type enum
export const EmploymentType = {
  FULL_TIME: "FULL_TIME",
  PART_TIME: "PART_TIME",
  CASUAL: "CASUAL",
  CONTRACTOR: "CONTRACTOR",
} as const;

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
  // Address fields
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(100).optional(),
  addressPostcode: z.string().max(20).optional(),
  addressCountry: z.string().max(100).optional(),
  // Emergency contact
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z.string().optional().refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      return /^[\d\s\-\(\)\+]+$/.test(val) && val.replace(/\D/g, "").length >= 10;
    },
    { message: "Please enter a valid phone number" }
  ),
  emergencyContactRelation: z.string().max(50).optional(),
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
  // Address fields
  addressStreet: z.string().max(200).optional(),
  addressCity: z.string().max(100).optional(),
  addressState: z.string().max(100).optional(),
  addressPostcode: z.string().max(20).optional(),
  addressCountry: z.string().max(100).optional(),
  // Emergency contact
  emergencyContactName: z.string().max(100).optional(),
  emergencyContactPhone: z.string().optional().refine(
    (val) => {
      if (!val || val.trim() === "") return true;
      return /^[\d\s\-\(\)\+]+$/.test(val) && val.replace(/\D/g, "").length >= 10;
    },
    { message: "Please enter a valid phone number" }
  ),
  emergencyContactRelation: z.string().max(50).optional(),
  // Employment details (admin only typically)
  employmentType: z.enum(["FULL_TIME", "PART_TIME", "CASUAL", "CONTRACTOR"]).optional(),
  employmentStartDate: z.string().optional(),
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

// Schema for skills
export const userSkillSchema = z.object({
  name: z.string().min(1, "Skill name is required").max(100),
  category: z.string().max(50).optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced", "Expert"]).optional(),
  notes: z.string().max(500).optional(),
});

// Schema for certifications
export const userCertificationSchema = z.object({
  name: z.string().min(1, "Certification name is required").max(100),
  issuingBody: z.string().max(100).optional(),
  issueDate: z.string().optional(),
  expiryDate: z.string().optional(),
  certificateNumber: z.string().max(50).optional(),
  documentUrl: z.string().url().optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export type CompleteProfileInput = z.infer<typeof completeProfileSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UploadAvatarInput = z.infer<typeof uploadAvatarSchema>;
export type UserSkillInput = z.infer<typeof userSkillSchema>;
export type UserCertificationInput = z.infer<typeof userCertificationSchema>;
