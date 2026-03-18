import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";

// PUT /api/admin/break-rules/[id] - Update a break rule
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, minShiftHours, maxShiftHours, breakMinutes, isPaid, additionalBreakMinutes, additionalBreakThreshold, priority, isDefault } = body;

    // Get the break rule to check permissions
    const existingRule = await prisma.breakRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Break rule not found" }, { status: 404 });
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", existingRule.venueId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If this is set as default, unset any existing default rule for this venue
    if (isDefault && !existingRule.isDefault) {
      await prisma.breakRule.updateMany({
        where: { venueId: existingRule.venueId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const breakRule = await prisma.breakRule.update({
      where: { id },
      data: {
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
      },
    });

    return NextResponse.json(breakRule);
  } catch (error) {
    console.error("Error updating break rule:", error);
    return NextResponse.json({ error: "Failed to update break rule" }, { status: 500 });
  }
}

// DELETE /api/admin/break-rules/[id] - Delete a break rule
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the break rule to check permissions
    const existingRule = await prisma.breakRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return NextResponse.json({ error: "Break rule not found" }, { status: 404 });
    }

    // Check permissions
    const canManage = await hasPermission(user.id, "venues", "manage", existingRule.venueId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Soft delete by setting isActive to false
    await prisma.breakRule.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting break rule:", error);
    return NextResponse.json({ error: "Failed to delete break rule" }, { status: 500 });
  }
}
