import { NextRequest } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

// PUT /api/admin/staff/[id]/pay-rates - Update staff pay rates
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const { weekdayRate, saturdayRate, sundayRate, publicHolidayRate, superEnabled, customSuperRate } = body;

    // Get the staff member to check permissions
    const staffMember = await prisma.user.findUnique({
      where: { id },
      include: { venues: true },
    });

    if (!staffMember) {
      return apiError("Staff member not found", 404);
    }

    // Check if user has permission to manage any of the staff member's venues
    const venueIds = staffMember.venues.map(v => v.venueId);
    let canManage = false;
    for (const venueId of venueIds) {
      if (await hasPermission(user.id, "venues", "manage", venueId)) {
        canManage = true;
        break;
      }
    }

    if (!canManage) {
      return apiError("Forbidden", 403);
    }

    const updatedMember = await prisma.user.update({
      where: { id },
      data: {
        weekdayRate: weekdayRate !== undefined ? (weekdayRate === null ? null : parseFloat(weekdayRate)) : undefined,
        saturdayRate: saturdayRate !== undefined ? (saturdayRate === null ? null : parseFloat(saturdayRate)) : undefined,
        sundayRate: sundayRate !== undefined ? (sundayRate === null ? null : parseFloat(sundayRate)) : undefined,
        publicHolidayRate: publicHolidayRate !== undefined ? (publicHolidayRate === null ? null : parseFloat(publicHolidayRate)) : undefined,
        superEnabled: superEnabled !== undefined ? superEnabled : undefined,
        customSuperRate: customSuperRate !== undefined ? (customSuperRate === null ? null : parseFloat(customSuperRate)) : undefined,
      },
    });

    return apiSuccess(updatedMember);
  } catch (error) {
    console.error("Error updating staff pay rates:", error);
    return apiError("Failed to update staff pay rates");
  }
}
