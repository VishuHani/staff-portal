import { NextRequest } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

// GET /api/admin/shift-templates - List shift templates for a venue
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized", 401);
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");

    if (!venueId) {
      return apiError("Venue ID is required", 400);
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", venueId);
    if (!canManage) {
      return apiError("Forbidden", 403);
    }

    const shiftTemplates = await prisma.shiftTemplate.findMany({
      where: {
        venueId,
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
    });

    return apiSuccess({ shiftTemplates });
  } catch (error) {
    console.error("Error fetching shift templates:", error);
    return apiError("Failed to fetch shift templates");
  }
}

// POST /api/admin/shift-templates - Create a new shift template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const {
      venueId,
      name,
      description,
      color,
      startTime,
      endTime,
      breakMinutes,
      autoCalculateBreak,
      position,
      daysOfWeek,
      displayOrder,
    } = body;

    if (!venueId || !name || !startTime || !endTime) {
      return apiError("Missing required fields", 400);
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", venueId);
    if (!canManage) {
      return apiError("Forbidden", 403);
    }

    const shiftTemplate = await prisma.shiftTemplate.create({
      data: {
        venueId,
        name,
        description,
        color: color || "#3B82F6",
        startTime,
        endTime,
        breakMinutes: breakMinutes || 30,
        autoCalculateBreak: autoCalculateBreak ?? true,
        position,
        daysOfWeek: daysOfWeek || [0, 1, 2, 3, 4, 5, 6],
        displayOrder: displayOrder || 0,
        isActive: true,
      },
    });

    return apiSuccess({ shiftTemplate }, { status: 201 });
  } catch (error) {
    console.error("Error creating shift template:", error);
    return apiError("Failed to create shift template");
  }
}
