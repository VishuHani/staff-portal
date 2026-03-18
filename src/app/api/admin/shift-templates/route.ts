import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";

// GET /api/admin/shift-templates - List shift templates for a venue
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

    const shiftTemplates = await prisma.shiftTemplate.findMany({
      where: {
        venueId,
        isActive: true,
      },
      orderBy: {
        displayOrder: "asc",
      },
    });

    return NextResponse.json(shiftTemplates);
  } catch (error) {
    console.error("Error fetching shift templates:", error);
    return NextResponse.json({ error: "Failed to fetch shift templates" }, { status: 500 });
  }
}

// POST /api/admin/shift-templates - Create a new shift template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { venueId, name, description, color, startTime, endTime, breakMinutes, autoCalculateBreak, position, daysOfWeek, displayOrder } = body;

    if (!venueId || !name || !startTime || !endTime) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", venueId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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

    return NextResponse.json(shiftTemplate, { status: 201 });
  } catch (error) {
    console.error("Error creating shift template:", error);
    return NextResponse.json({ error: "Failed to create shift template" }, { status: 500 });
  }
}
