import { NextRequest } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

// PUT /api/admin/shift-templates/[id] - Update a shift template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized", 401);
    }

    const body = await request.json();
    const {
      name,
      description,
      color,
      startTime,
      endTime,
      breakMinutes,
      autoCalculateBreak,
      position,
      daysOfWeek,
    } = body;

    // Get the shift template to check permissions
    const existingTemplate = await prisma.shiftTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return apiError("Shift template not found", 404);
    }

    // Check permissions
    const canManage = await hasPermission(
      user.id,
      "venues",
      "manage",
      existingTemplate.venueId
    );
    if (!canManage) {
      return apiError("Forbidden", 403);
    }

    const shiftTemplate = await prisma.shiftTemplate.update({
      where: { id },
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

    return apiSuccess({ shiftTemplate });
  } catch (error) {
    console.error("Error updating shift template:", error);
    return apiError("Failed to update shift template");
  }
}

// DELETE /api/admin/shift-templates/[id] - Delete a shift template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized", 401);
    }

    // Get the shift template to check permissions
    const existingTemplate = await prisma.shiftTemplate.findUnique({
      where: { id },
    });

    if (!existingTemplate) {
      return apiError("Shift template not found", 404);
    }

    // Check permissions
    const canManage = await hasPermission(
      user.id,
      "venues",
      "manage",
      existingTemplate.venueId
    );
    if (!canManage) {
      return apiError("Forbidden", 403);
    }

    // Soft delete by setting isActive to false
    await prisma.shiftTemplate.update({
      where: { id },
      data: { isActive: false },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Error deleting shift template:", error);
    return apiError("Failed to delete shift template");
  }
}
