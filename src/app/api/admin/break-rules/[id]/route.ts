import { NextRequest } from "next/server";
import { createClient } from "@/lib/auth/supabase-server";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac/permissions";
import { apiError, apiSuccess } from "@/lib/utils/api-response";

// PUT /api/admin/break-rules/[id] - Update a break rule
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
      minShiftHours,
      maxShiftHours,
      breakMinutes,
      isPaid,
      additionalBreakMinutes,
      additionalBreakThreshold,
      priority,
      isDefault,
    } = body;

    // Get the break rule to check permissions
    const existingRule = await prisma.breakRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return apiError("Break rule not found", 404);
    }

    // Check permissions
    const canManage = await hasPermission(
      user.id,
      "venues",
      "manage",
      existingRule.venueId
    );
    if (!canManage) {
      return apiError("Forbidden", 403);
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

    return apiSuccess({ breakRule });
  } catch (error) {
    console.error("Error updating break rule:", error);
    return apiError("Failed to update break rule");
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
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return apiError("Unauthorized", 401);
    }

    // Get the break rule to check permissions
    const existingRule = await prisma.breakRule.findUnique({
      where: { id },
    });

    if (!existingRule) {
      return apiError("Break rule not found", 404);
    }

    // Check permissions
    const canManage = await hasPermission(
      user.id,
      "venues",
      "manage",
      existingRule.venueId
    );
    if (!canManage) {
      return apiError("Forbidden", 403);
    }

    // Soft delete by setting isActive to false
    await prisma.breakRule.update({
      where: { id },
      data: { isActive: false },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Error deleting break rule:", error);
    return apiError("Failed to delete break rule");
  }
}
