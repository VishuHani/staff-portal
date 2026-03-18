import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/actions/auth";
import { hasAnyPermission, isAdmin } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ venueId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { venueId } = await params;

    // Check if user has access to this venue
    const isUserAdmin = await isAdmin(user.id);
    
    if (!isUserAdmin) {
      const hasAccess = await hasAnyPermission(user.id, [
        { resource: "documents", action: "assign" },
      ]);
      
      if (!hasAccess) {
        // Check if user belongs to this venue
        const userVenue = await prisma.userVenue.findFirst({
          where: { userId: user.id, venueId },
        });
        
        if (!userVenue) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      }
    }

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    // Get users for this venue through UserVenue relation
    const userVenues = await prisma.userVenue.findMany({
      where: { venueId },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            active: true,
            roleId: true,
            role: {
              select: { name: true },
            },
          },
        },
      },
    });

    // Filter and transform users
    const users = userVenues
      .filter((uv) => includeInactive || uv.user.active)
      .map((uv) => ({
        id: uv.user.id,
        firstName: uv.user.firstName || "",
        lastName: uv.user.lastName || "",
        email: uv.user.email,
        role: uv.user.role?.name || "STAFF",
        active: uv.user.active,
      }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Error fetching venue users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
