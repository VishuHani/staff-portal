import { NextRequest } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

// GET /api/admin/break-rules - List break rules for a venue
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

    const breakRules = await prisma.breakRule.findMany({
      where: {
        venueId,
        isActive: true,
      },
      orderBy: [{ priority: "desc" }, { minShiftHours: "asc" }],
    });

    return apiSuccess({ breakRules });
  } catch (error) {
    console.error("Error fetching break rules:", error);
    return apiError("Failed to fetch break rules");
  }
}

// POST /api/admin/break-rules - Create a new break rule
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
      minShiftHours,
      maxShiftHours,
      breakMinutes,
      isPaid,
      additionalBreakMinutes,
      additionalBreakThreshold,
      priority,
      isDefault,
    } = body;

    if (
      !venueId ||
      !name ||
      minShiftHours === undefined ||
      breakMinutes === undefined
    ) {
      return apiError("Missing required fields", 400);
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", venueId);
    if (!canManage) {
      return apiError("Forbidden", 403);
    }

    // If this is set as default, unset any existing default rule for this venue
    if (isDefault) {
      await prisma.breakRule.updateMany({
        where: { venueId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const breakRule = await prisma.breakRule.create({
      data: {
        venueId,
        name,
        description,
        minShiftHours,
        maxShiftHours,
        breakMinutes,
        isPaid: isPaid || false,
        additionalBreakMinutes,
        additionalBreakThreshold,
        priority: priority || 0,
        isDefault: isDefault || false,
        isActive: true,
      },
    });

    return apiSuccess({ breakRule }, { status: 201 });
  } catch (error) {
    console.error("Error creating break rule:", error);
    return apiError("Failed to create break rule");
  }
}
