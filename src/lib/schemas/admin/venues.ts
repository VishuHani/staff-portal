import { z } from "zod";

// Time format validation helper (HH:mm)
const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/;

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
  // Business Hours - NEW
  businessHoursStart: z
    .string()
    .regex(timeRegex, "Start time must be in HH:mm format (e.g., 08:00)")
    .default("08:00"),
  businessHoursEnd: z
    .string()
    .regex(timeRegex, "End time must be in HH:mm format (e.g., 22:00)")
    .default("22:00"),
  operatingDays: z
    .array(z.number().min(0).max(6))
    .min(1, "Select at least one operating day")
    .default([1, 2, 3, 4, 5]), // Mon-Fri
}).refine(
  (data) => {
    // Validate businessHoursEnd > businessHoursStart
    const [startHour, startMin] = data.businessHoursStart.split(":").map(Number);
    const [endHour, endMin] = data.businessHoursEnd.split(":").map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return endMinutes > startMinutes;
  },
  {
    message: "Business closing time must be after opening time",
    path: ["businessHoursEnd"],
  }
);

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
  // Business Hours - NEW
  businessHoursStart: z
    .string()
    .regex(timeRegex, "Start time must be in HH:mm format (e.g., 08:00)")
    .optional(),
  businessHoursEnd: z
    .string()
    .regex(timeRegex, "End time must be in HH:mm format (e.g., 22:00)")
    .optional(),
  operatingDays: z
    .array(z.number().min(0).max(6))
    .min(1, "Select at least one operating day")
    .optional(),
}).refine(
  (data) => {
    // Validate businessHoursEnd > businessHoursStart (if both provided)
    if (data.businessHoursStart && data.businessHoursEnd) {
      const [startHour, startMin] = data.businessHoursStart.split(":").map(Number);
      const [endHour, endMin] = data.businessHoursEnd.split(":").map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      return endMinutes > startMinutes;
    }
    return true;
  },
  {
    message: "Business closing time must be after opening time",
    path: ["businessHoursEnd"],
  }
);

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
