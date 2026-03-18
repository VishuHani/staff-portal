import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";

// GET /api/admin/break-rules - List break rules for a venue
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");

    if (!venueId) {
      return NextResponse.json({ error: "Venue ID is required" }, { status: 400 });
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", venueId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const breakRules = await prisma.breakRule.findMany({
      where: {
        venueId,
        isActive: true,
      },
      orderBy: [
        { priority: "desc" },
        { minShiftHours: "asc" },
      ],
    });

    return NextResponse.json(breakRules);
  } catch (error) {
    console.error("Error fetching break rules:", error);
    return NextResponse.json({ error: "Failed to fetch break rules" }, { status: 500 });
  }
}

// POST /api/admin/break-rules - Create a new break rule
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { venueId, name, description, minShiftHours, maxShiftHours, breakMinutes, isPaid, additionalBreakMinutes, additionalBreakThreshold, priority, isDefault } = body;

    if (!venueId || !name || minShiftHours === undefined || breakMinutes === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", venueId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    return NextResponse.json(breakRule, { status: 201 });
  } catch (error) {
    console.error("Error creating break rule:", error);
    return NextResponse.json({ error: "Failed to create break rule" }, { status: 500 });
  }
}
