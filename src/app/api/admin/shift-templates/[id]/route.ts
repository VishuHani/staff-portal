import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";

// PUT /api/admin/shift-templates/[id] - Update a shift template
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, color, startTime, endTime, breakMinutes, autoCalculateBreak, position, daysOfWeek } = body;

    // Get the shift template to check permissions
    const existingTemplate = await prisma.shiftTemplate.findUnique({
      where: { id: params.id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Shift template not found" }, { status: 404 });
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", existingTemplate.venueId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const shiftTemplate = await prisma.shiftTemplate.update({
      where: { id: params.id },
      data: {
        name,
        description,
        color,
        startTime,
        endTime,
        breakMinutes,
        autoCalculateBreak,
        position,
        daysOfWeek,
      },
    });

    return NextResponse.json(shiftTemplate);
  } catch (error) {
    console.error("Error updating shift template:", error);
    return NextResponse.json({ error: "Failed to update shift template" }, { status: 500 });
  }
}

// DELETE /api/admin/shift-templates/[id] - Delete a shift template
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the shift template to check permissions
    const existingTemplate = await prisma.shiftTemplate.findUnique({
      where: { id: params.id },
    });

    if (!existingTemplate) {
      return NextResponse.json({ error: "Shift template not found" }, { status: 404 });
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", existingTemplate.venueId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete by setting isActive to false
    await prisma.shiftTemplate.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting shift template:", error);
    return NextResponse.json({ error: "Failed to delete shift template" }, { status: 500 });
  }
}
