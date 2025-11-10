import { z } from "zod";

// Create venue schema
export const createVenueSchema = z.object({
  name: z
    .string()
    .min(1, "Venue name is required")
    .min(2, "Venue name must be at least 2 characters")
    .max(100, "Venue name must be less than 100 characters"),
  code: z
    .string()
    .min(1, "Venue code is required")
    .min(2, "Venue code must be at least 2 characters")
    .max(20, "Venue code must be less than 20 characters")
    .regex(/^[A-Z0-9_-]+$/, "Venue code must be uppercase letters, numbers, hyphens, or underscores only"),
  address: z
    .string()
    .max(200, "Address must be less than 200 characters")
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
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  active: z.boolean().default(true),
});

// Update venue schema
export const updateVenueSchema = z.object({
  venueId: z.string().cuid("Invalid venue ID"),
  name: z
    .string()
    .min(2, "Venue name must be at least 2 characters")
    .max(100, "Venue name must be less than 100 characters")
    .optional(),
  code: z
    .string()
    .min(2, "Venue code must be at least 2 characters")
    .max(20, "Venue code must be less than 20 characters")
    .regex(/^[A-Z0-9_-]+$/, "Venue code must be uppercase letters, numbers, hyphens, or underscores only")
    .optional(),
  address: z
    .string()
    .max(200, "Address must be less than 200 characters")
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
  email: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  active: z.boolean().optional(),
});

// Delete venue schema
export const deleteVenueSchema = z.object({
  venueId: z.string().cuid("Invalid venue ID"),
});

// Toggle venue active status schema
export const toggleVenueActiveSchema = z.object({
  venueId: z.string().cuid("Invalid venue ID"),
});

// Type exports
export type CreateVenueInput = z.infer<typeof createVenueSchema>;
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>;
export type DeleteVenueInput = z.infer<typeof deleteVenueSchema>;
export type ToggleVenueActiveInput = z.infer<typeof toggleVenueActiveSchema>;
