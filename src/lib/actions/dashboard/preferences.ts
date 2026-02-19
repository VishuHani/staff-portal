"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/actions/auth";
import { DashboardWidget } from "@/components/dashboard/DashboardCustomizationPanel";
import { DEFAULT_STAFF_WIDGETS, DEFAULT_MANAGER_WIDGETS, DEFAULT_ADMIN_WIDGETS } from "@/components/dashboard/widget-defaults";

export interface DashboardPreferences {
  widgets: DashboardWidget[];
  dateRange: {
    from: string | null;
    to: string | null;
  } | null;
}

export async function getDefaultWidgets(role: string): Promise<DashboardWidget[]> {
  switch (role) {
    case "STAFF":
      return DEFAULT_STAFF_WIDGETS;
    case "MANAGER":
      return DEFAULT_MANAGER_WIDGETS;
    case "ADMIN":
      return DEFAULT_ADMIN_WIDGETS;
    default:
      return DEFAULT_STAFF_WIDGETS;
  }
}

export async function getDashboardPreferences(): Promise<{
  success: boolean;
  data?: DashboardPreferences;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const preferences = await prisma.userDashboardPreferences.findUnique({
      where: { userId: user.id },
    });

    if (!preferences) {
      // Return default preferences
      const defaultWidgets = await getDefaultWidgets(user.role.name);
      return {
        success: true,
        data: {
          widgets: defaultWidgets,
          dateRange: null,
        },
      };
    }

    const widgets = preferences.widgets as unknown as DashboardWidget[];
    const dateRange = preferences.dateRange as unknown as { from: string | null; to: string | null } | null;

    return {
      success: true,
      data: {
        widgets,
        dateRange,
      },
    };
  } catch (error) {
    console.error("[getDashboardPreferences] Error:", error);
    return { success: false, error: "Failed to get preferences" };
  }
}

export async function saveDashboardWidgets(
  widgets: DashboardWidget[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    await prisma.userDashboardPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        widgets: widgets as any,
      },
      update: {
        widgets: widgets as any,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[saveDashboardWidgets] Error:", error);
    return { success: false, error: "Failed to save widgets" };
  }
}

export async function saveDashboardDateRange(
  dateRange: { from: Date | null; to: Date | null } | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const serializedRange = dateRange
      ? {
          from: dateRange.from ? dateRange.from.toISOString() : null,
          to: dateRange.to ? dateRange.to.toISOString() : null,
        }
      : null;

    await prisma.userDashboardPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        dateRange: serializedRange as any,
      },
      update: {
        dateRange: serializedRange as any,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[saveDashboardDateRange] Error:", error);
    return { success: false, error: "Failed to save date range" };
  }
}

export async function saveDashboardPreferences(
  widgets: DashboardWidget[],
  dateRange: { from: Date | null; to: Date | null } | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const serializedRange = dateRange
      ? {
          from: dateRange.from ? dateRange.from.toISOString() : null,
          to: dateRange.to ? dateRange.to.toISOString() : null,
        }
      : null;

    await prisma.userDashboardPreferences.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        widgets: widgets as any,
        dateRange: serializedRange as any,
      },
      update: {
        widgets: widgets as any,
        dateRange: serializedRange as any,
      },
    });

    return { success: true };
  } catch (error) {
    console.error("[saveDashboardPreferences] Error:", error);
    return { success: false, error: "Failed to save preferences" };
  }
}
