"use server";

/**
 * Venue Pay Configuration Actions
 * 
 * CONFIDENTIAL: These actions handle pay rate configuration
 * Only accessible to ADMIN and MANAGER roles
 */

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Decimal } from "@prisma/client/runtime/library";
import { getUserVenueIds } from "@/lib/utils/venue";

// ============================================================================
// SCHEMAS
// ============================================================================

const VenuePayConfigSchema = z.object({
  venueId: z.string(),
  defaultWeekdayRate: z.number().min(0).nullable(),
  defaultSaturdayRate: z.number().min(0).nullable(),
  defaultSundayRate: z.number().min(0).nullable(),
  defaultPublicHolidayRate: z.number().min(0).nullable(),
  defaultOvertimeRate: z.number().min(0).nullable(),
  defaultLateRate: z.number().min(0).nullable(),
  overtimeThresholdHours: z.number().int().min(0).default(8),
  overtimeMultiplier: z.number().min(1).max(3).nullable(),
  lateStartHour: z.number().int().min(0).max(23).default(22),
  autoCalculateBreaks: z.boolean().default(true),
  breakThresholdHours: z.number().int().min(0).default(4),
  defaultBreakMinutes: z.number().int().min(0).default(30),
  publicHolidayRegion: z.string().default("NSW"),
  // Superannuation settings
  superEnabled: z.boolean().default(true),
  superRate: z.number().min(0).max(1).nullable(), // e.g., 0.115 for 11.5%
});

const ShiftTemplateSchema = z.object({
  venueId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  color: z.string().default("#3B82F6"),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  breakMinutes: z.number().int().min(0).default(30),
  autoCalculateBreak: z.boolean().default(true),
  position: z.string().nullable(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  displayOrder: z.number().int().default(0),
});

const BreakRuleSchema = z.object({
  venueId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  minShiftHours: z.number().min(0),
  maxShiftHours: z.number().min(0).nullable(),
  breakMinutes: z.number().int().min(0),
  isPaid: z.boolean().default(false),
  additionalBreakMinutes: z.number().int().min(0).nullable(),
  additionalBreakThreshold: z.number().min(0).nullable(),
  priority: z.number().int().default(0),
  isDefault: z.boolean().default(false),
});

const CustomRateSchema = z.object({
  venueId: z.string(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable(),
  startDate: z.date(),
  endDate: z.date(),
  rateType: z.enum(["FIXED", "MULTIPLIER"]),
  fixedRate: z.number().min(0).nullable(),
  multiplier: z.number().min(1).max(5).nullable(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  isRecurring: z.boolean().default(false),
});

const UserPayRatesSchema = z.object({
  userId: z.string(),
  weekdayRate: z.number().min(0).nullable(),
  saturdayRate: z.number().min(0).nullable(),
  sundayRate: z.number().min(0).nullable(),
  publicHolidayRate: z.number().min(0).nullable(),
  overtimeRate: z.number().min(0).nullable(),
  lateRate: z.number().min(0).nullable(),
});

// User superannuation settings schema
const UserSuperSettingsSchema = z.object({
  userId: z.string(),
  superEnabled: z.boolean().nullable(), // null = use venue default
  customSuperRate: z.number().min(0).max(1).nullable(), // e.g., 0.115 for 11.5%
  // Super fund details
  superFundName: z.string().max(200).nullable(),
  superFundMemberNumber: z.string().max(100).nullable(),
  superFundUSI: z.string().max(50).nullable(),
  superFundABN: z.string().max(20).nullable(),
});

// ============================================================================
// HELPERS
// ============================================================================

async function checkPayConfigAccess(venueId: string) {
  const session = await auth();
  if (!session?.user?.id) {
    return { authorized: false, error: "Not authenticated" };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      role: { include: { rolePermissions: { include: { permission: true } } } },
      venuePermissions: { where: { venueId }, include: { permission: true } },
    },
  });

  if (!user) {
    return { authorized: false, error: "User not found" };
  }

  const isAdmin = user.role.name === "ADMIN";
  const isVenueManager = user.venuePermissions.some(
    (p) => p.permission.action === "manage" && p.permission.resource === "venue_pay_config"
  );

  if (!isAdmin && !isVenueManager) {
    return { authorized: false, error: "Not authorized to manage pay configuration" };
  }

  if (!isAdmin) {
    const userVenueIds = await getUserVenueIds(session.user.id);
    if (!userVenueIds.includes(venueId)) {
      return { authorized: false, error: "Not authorized to manage pay configuration" };
    }
  }

  return { authorized: true, userId: session.user.id };
}

function toDecimal(value: number | null | undefined): Decimal | null {
  if (value === null || value === undefined) return null;
  return new Decimal(value);
}

// ============================================================================
// VENUE PAY CONFIG ACTIONS
// ============================================================================

export async function getVenuePayConfig(venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    let config = await prisma.venuePayConfig.findUnique({
      where: { venueId },
    });

    if (!config) {
      config = await prisma.venuePayConfig.create({
        data: {
          venueId,
          overtimeThresholdHours: 8,
          overtimeMultiplier: new Decimal(1.5),
          lateStartHour: 22,
          autoCalculateBreaks: true,
          breakThresholdHours: 4,
          defaultBreakMinutes: 30,
          publicHolidayRegion: "NSW",
        },
      });
    }

    return { success: true, data: config };
  } catch (error) {
    console.error("Error fetching venue pay config:", error);
    return { success: false, error: "Failed to fetch pay configuration" };
  }
}

export async function updateVenuePayConfig(data: z.infer<typeof VenuePayConfigSchema>) {
  const validated = VenuePayConfigSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: "Invalid data", details: validated.error.flatten() };
  }

  const access = await checkPayConfigAccess(validated.data.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const config = await prisma.venuePayConfig.upsert({
      where: { venueId: validated.data.venueId },
      create: {
        venueId: validated.data.venueId,
        defaultWeekdayRate: toDecimal(validated.data.defaultWeekdayRate),
        defaultSaturdayRate: toDecimal(validated.data.defaultSaturdayRate),
        defaultSundayRate: toDecimal(validated.data.defaultSundayRate),
        defaultPublicHolidayRate: toDecimal(validated.data.defaultPublicHolidayRate),
        defaultOvertimeRate: toDecimal(validated.data.defaultOvertimeRate),
        defaultLateRate: toDecimal(validated.data.defaultLateRate),
        overtimeThresholdHours: validated.data.overtimeThresholdHours,
        overtimeMultiplier: toDecimal(validated.data.overtimeMultiplier),
        lateStartHour: validated.data.lateStartHour,
        autoCalculateBreaks: validated.data.autoCalculateBreaks,
        breakThresholdHours: validated.data.breakThresholdHours,
        defaultBreakMinutes: validated.data.defaultBreakMinutes,
        publicHolidayRegion: validated.data.publicHolidayRegion,
        // Superannuation settings
        superEnabled: validated.data.superEnabled,
        superRate: toDecimal(validated.data.superRate),
      },
      update: {
        defaultWeekdayRate: toDecimal(validated.data.defaultWeekdayRate),
        defaultSaturdayRate: toDecimal(validated.data.defaultSaturdayRate),
        defaultSundayRate: toDecimal(validated.data.defaultSundayRate),
        defaultPublicHolidayRate: toDecimal(validated.data.defaultPublicHolidayRate),
        defaultOvertimeRate: toDecimal(validated.data.defaultOvertimeRate),
        defaultLateRate: toDecimal(validated.data.defaultLateRate),
        overtimeThresholdHours: validated.data.overtimeThresholdHours,
        overtimeMultiplier: toDecimal(validated.data.overtimeMultiplier),
        lateStartHour: validated.data.lateStartHour,
        autoCalculateBreaks: validated.data.autoCalculateBreaks,
        breakThresholdHours: validated.data.breakThresholdHours,
        defaultBreakMinutes: validated.data.defaultBreakMinutes,
        publicHolidayRegion: validated.data.publicHolidayRegion,
        // Superannuation settings
        superEnabled: validated.data.superEnabled,
        superRate: toDecimal(validated.data.superRate),
      },
    });

    revalidatePath(`/manage/venues/${validated.data.venueId}/pay-settings`);
    return { success: true, data: config };
  } catch (error) {
    console.error("Error updating venue pay config:", error);
    return { success: false, error: "Failed to update pay configuration" };
  }
}

// ============================================================================
// SHIFT TEMPLATE ACTIONS
// ============================================================================

export async function getShiftTemplates(venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const templates = await prisma.shiftTemplate.findMany({
      where: { venueId, isActive: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });

    return { success: true, data: templates };
  } catch (error) {
    console.error("Error fetching shift templates:", error);
    return { success: false, error: "Failed to fetch shift templates" };
  }
}

export async function createShiftTemplate(data: z.infer<typeof ShiftTemplateSchema>) {
  const validated = ShiftTemplateSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: "Invalid data", details: validated.error.flatten() };
  }

  const access = await checkPayConfigAccess(validated.data.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const template = await prisma.shiftTemplate.create({
      data: {
        venueId: validated.data.venueId,
        name: validated.data.name,
        description: validated.data.description,
        color: validated.data.color,
        startTime: validated.data.startTime,
        endTime: validated.data.endTime,
        breakMinutes: validated.data.breakMinutes,
        autoCalculateBreak: validated.data.autoCalculateBreak,
        position: validated.data.position,
        daysOfWeek: validated.data.daysOfWeek,
        displayOrder: validated.data.displayOrder,
      },
    });

    revalidatePath(`/manage/venues/${validated.data.venueId}/pay-settings`);
    return { success: true, data: template };
  } catch (error) {
    console.error("Error creating shift template:", error);
    return { success: false, error: "Failed to create shift template" };
  }
}

export async function updateShiftTemplate(id: string, data: Partial<z.infer<typeof ShiftTemplateSchema>>) {
  const template = await prisma.shiftTemplate.findUnique({
    where: { id },
    select: { venueId: true },
  });

  if (!template) {
    return { success: false, error: "Template not found" };
  }

  const access = await checkPayConfigAccess(template.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const updated = await prisma.shiftTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        color: data.color,
        startTime: data.startTime,
        endTime: data.endTime,
        breakMinutes: data.breakMinutes,
        autoCalculateBreak: data.autoCalculateBreak,
        position: data.position,
        daysOfWeek: data.daysOfWeek,
        displayOrder: data.displayOrder,
      },
    });

    revalidatePath(`/manage/venues/${template.venueId}/pay-settings`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating shift template:", error);
    return { success: false, error: "Failed to update shift template" };
  }
}

export async function deleteShiftTemplate(id: string) {
  const template = await prisma.shiftTemplate.findUnique({
    where: { id },
    select: { venueId: true },
  });

  if (!template) {
    return { success: false, error: "Template not found" };
  }

  const access = await checkPayConfigAccess(template.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    await prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath(`/manage/venues/${template.venueId}/pay-settings`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting shift template:", error);
    return { success: false, error: "Failed to delete shift template" };
  }
}

// ============================================================================
// BREAK RULE ACTIONS
// ============================================================================

export async function getBreakRules(venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const rules = await prisma.breakRule.findMany({
      where: { venueId, isActive: true },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    return { success: true, data: rules };
  } catch (error) {
    console.error("Error fetching break rules:", error);
    return { success: false, error: "Failed to fetch break rules" };
  }
}

export async function createBreakRule(data: z.infer<typeof BreakRuleSchema>) {
  const validated = BreakRuleSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: "Invalid data", details: validated.error.flatten() };
  }

  const access = await checkPayConfigAccess(validated.data.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    if (validated.data.isDefault) {
      await prisma.breakRule.updateMany({
        where: { venueId: validated.data.venueId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const rule = await prisma.breakRule.create({
      data: {
        venueId: validated.data.venueId,
        name: validated.data.name,
        description: validated.data.description,
        minShiftHours: validated.data.minShiftHours,
        maxShiftHours: validated.data.maxShiftHours,
        breakMinutes: validated.data.breakMinutes,
        isPaid: validated.data.isPaid,
        additionalBreakMinutes: validated.data.additionalBreakMinutes,
        additionalBreakThreshold: validated.data.additionalBreakThreshold,
        priority: validated.data.priority,
        isDefault: validated.data.isDefault,
      },
    });

    revalidatePath(`/manage/venues/${validated.data.venueId}/pay-settings`);
    return { success: true, data: rule };
  } catch (error) {
    console.error("Error creating break rule:", error);
    return { success: false, error: "Failed to create break rule" };
  }
}

export async function updateBreakRule(id: string, data: Partial<z.infer<typeof BreakRuleSchema>>) {
  const rule = await prisma.breakRule.findUnique({
    where: { id },
    select: { venueId: true },
  });

  if (!rule) {
    return { success: false, error: "Rule not found" };
  }

  const access = await checkPayConfigAccess(rule.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    if (data.isDefault) {
      await prisma.breakRule.updateMany({
        where: { venueId: rule.venueId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.breakRule.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        minShiftHours: data.minShiftHours,
        maxShiftHours: data.maxShiftHours,
        breakMinutes: data.breakMinutes,
        isPaid: data.isPaid,
        additionalBreakMinutes: data.additionalBreakMinutes,
        additionalBreakThreshold: data.additionalBreakThreshold,
        priority: data.priority,
        isDefault: data.isDefault,
      },
    });

    revalidatePath(`/manage/venues/${rule.venueId}/pay-settings`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating break rule:", error);
    return { success: false, error: "Failed to update break rule" };
  }
}

export async function deleteBreakRule(id: string) {
  const rule = await prisma.breakRule.findUnique({
    where: { id },
    select: { venueId: true },
  });

  if (!rule) {
    return { success: false, error: "Rule not found" };
  }

  const access = await checkPayConfigAccess(rule.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    await prisma.breakRule.update({
      where: { id },
      data: { isActive: false },
    });

    revalidatePath(`/manage/venues/${rule.venueId}/pay-settings`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting break rule:", error);
    return { success: false, error: "Failed to delete break rule" };
  }
}

// ============================================================================
// CUSTOM RATE ACTIONS
// ============================================================================

export async function getCustomRates(venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const rates = await prisma.customRate.findMany({
      where: { venueId },
      orderBy: [{ startDate: "asc" }, { name: "asc" }],
    });

    return { success: true, data: rates };
  } catch (error) {
    console.error("Error fetching custom rates:", error);
    return { success: false, error: "Failed to fetch custom rates" };
  }
}

export async function createCustomRate(data: z.infer<typeof CustomRateSchema>) {
  const validated = CustomRateSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: "Invalid data", details: validated.error.flatten() };
  }

  const access = await checkPayConfigAccess(validated.data.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  if (validated.data.endDate < validated.data.startDate) {
    return { success: false, error: "End date must be after start date" };
  }

  try {
    const rate = await prisma.customRate.create({
      data: {
        venueId: validated.data.venueId,
        name: validated.data.name,
        description: validated.data.description,
        startDate: validated.data.startDate,
        endDate: validated.data.endDate,
        rateType: validated.data.rateType,
        fixedRate: toDecimal(validated.data.fixedRate),
        multiplier: toDecimal(validated.data.multiplier),
        startTime: validated.data.startTime,
        endTime: validated.data.endTime,
        isRecurring: validated.data.isRecurring,
      },
    });

    revalidatePath(`/manage/venues/${validated.data.venueId}/pay-settings`);
    return { success: true, data: rate };
  } catch (error) {
    console.error("Error creating custom rate:", error);
    return { success: false, error: "Failed to create custom rate" };
  }
}

export async function updateCustomRate(id: string, data: Partial<z.infer<typeof CustomRateSchema>>) {
  const rate = await prisma.customRate.findUnique({
    where: { id },
    select: { venueId: true },
  });

  if (!rate) {
    return { success: false, error: "Rate not found" };
  }

  const access = await checkPayConfigAccess(rate.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const updated = await prisma.customRate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        startDate: data.startDate,
        endDate: data.endDate,
        rateType: data.rateType,
        fixedRate: data.fixedRate !== undefined ? toDecimal(data.fixedRate) : undefined,
        multiplier: data.multiplier !== undefined ? toDecimal(data.multiplier) : undefined,
        startTime: data.startTime,
        endTime: data.endTime,
        isRecurring: data.isRecurring,
      },
    });

    revalidatePath(`/manage/venues/${rate.venueId}/pay-settings`);
    return { success: true, data: updated };
  } catch (error) {
    console.error("Error updating custom rate:", error);
    return { success: false, error: "Failed to update custom rate" };
  }
}

export async function deleteCustomRate(id: string) {
  const rate = await prisma.customRate.findUnique({
    where: { id },
    select: { venueId: true },
  });

  if (!rate) {
    return { success: false, error: "Rate not found" };
  }

  const access = await checkPayConfigAccess(rate.venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    await prisma.customRate.delete({
      where: { id },
    });

    revalidatePath(`/manage/venues/${rate.venueId}/pay-settings`);
    return { success: true };
  } catch (error) {
    console.error("Error deleting custom rate:", error);
    return { success: false, error: "Failed to delete custom rate" };
  }
}

// ============================================================================
// USER PAY RATE ACTIONS
// ============================================================================

export async function getUserPayRates(userId: string, venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        weekdayRate: true,
        saturdayRate: true,
        sundayRate: true,
        publicHolidayRate: true,
        overtimeRate: true,
        lateRate: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return { success: true, data: user };
  } catch (error) {
    console.error("Error fetching user pay rates:", error);
    return { success: false, error: "Failed to fetch user pay rates" };
  }
}

export async function updateUserPayRates(data: z.infer<typeof UserPayRatesSchema>, venueId: string) {
  const validated = UserPayRatesSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: "Invalid data", details: validated.error.flatten() };
  }

  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const user = await prisma.user.update({
      where: { id: validated.data.userId },
      data: {
        weekdayRate: toDecimal(validated.data.weekdayRate),
        saturdayRate: toDecimal(validated.data.saturdayRate),
        sundayRate: toDecimal(validated.data.sundayRate),
        publicHolidayRate: toDecimal(validated.data.publicHolidayRate),
        overtimeRate: toDecimal(validated.data.overtimeRate),
        lateRate: toDecimal(validated.data.lateRate),
      },
    });

    revalidatePath(`/manage/venues/${venueId}/staff`);
    return { success: true, data: user };
  } catch (error) {
    console.error("Error updating user pay rates:", error);
    return { success: false, error: "Failed to update user pay rates" };
  }
}

/**
 * Get all staff pay rates for a venue
 */
export async function getVenueStaffPayRates(venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const staff = await prisma.user.findMany({
      where: {
        OR: [
          { venueId },
          { venues: { some: { venueId } } },
        ],
        active: true,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { name: true } },
        weekdayRate: true,
        saturdayRate: true,
        sundayRate: true,
        publicHolidayRate: true,
        overtimeRate: true,
        lateRate: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return { success: true, data: staff };
  } catch (error) {
    console.error("Error fetching venue staff pay rates:", error);
    return { success: false, error: "Failed to fetch staff pay rates" };
  }
}

// ============================================================================
// USER SUPERANNUATION SETTINGS ACTIONS
// ============================================================================

/**
 * Get user's superannuation settings
 */
export async function getUserSuperSettings(userId: string, venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        superEnabled: true,
        customSuperRate: true,
        superFundName: true,
        superFundMemberNumber: true,
        superFundUSI: true,
        superFundABN: true,
      },
    });

    if (!user) {
      return { success: false, error: "User not found" };
    }

    return { success: true, data: user };
  } catch (error) {
    console.error("Error fetching user super settings:", error);
    return { success: false, error: "Failed to fetch user super settings" };
  }
}

/**
 * Update user's superannuation settings
 */
export async function updateUserSuperSettings(
  data: z.infer<typeof UserSuperSettingsSchema>,
  venueId: string
) {
  const validated = UserSuperSettingsSchema.safeParse(data);
  if (!validated.success) {
    return { success: false, error: "Invalid data", details: validated.error.flatten() };
  }

  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const user = await prisma.user.update({
      where: { id: validated.data.userId },
      data: {
        superEnabled: validated.data.superEnabled,
        customSuperRate: toDecimal(validated.data.customSuperRate),
        superFundName: validated.data.superFundName,
        superFundMemberNumber: validated.data.superFundMemberNumber,
        superFundUSI: validated.data.superFundUSI,
        superFundABN: validated.data.superFundABN,
      },
    });

    revalidatePath(`/manage/venues/${venueId}/staff`);
    return { success: true, data: user };
  } catch (error) {
    console.error("Error updating user super settings:", error);
    return { success: false, error: "Failed to update user super settings" };
  }
}

/**
 * Get all staff super settings for a venue
 */
export async function getVenueStaffSuperSettings(venueId: string) {
  const access = await checkPayConfigAccess(venueId);
  if (!access.authorized) {
    return { success: false, error: access.error };
  }

  try {
    const staff = await prisma.user.findMany({
      where: {
        OR: [
          { venueId },
          { venues: { some: { venueId } } },
        ],
        active: true,
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: { select: { name: true } },
        superEnabled: true,
        customSuperRate: true,
        superFundName: true,
        superFundMemberNumber: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return { success: true, data: staff };
  } catch (error) {
    console.error("Error fetching venue staff super settings:", error);
    return { success: false, error: "Failed to fetch staff super settings" };
  }
}
